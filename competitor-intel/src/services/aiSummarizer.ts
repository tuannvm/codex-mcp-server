import Anthropic from '@anthropic-ai/sdk';
import type { SecFiling, FilingSummary } from '../config/competitors.js';
import { getFilingSummary, saveFilingSummary } from './blobStore.js';

const USER_AGENT = 'The Dobbs Group Competitor Intel alerts@dobbsgroup.com';

async function fetchDocText(url: string, maxBytes = 60000): Promise<string> {
  if (!url) return '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Range': `bytes=0-${maxBytes}` },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok && res.status !== 206) return '';
    const raw = await res.text();
    return raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 30000);
  } catch {
    return '';
  }
}

export async function summarizeFiling(filing: SecFiling): Promise<FilingSummary | null> {
  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.log('[AI] ANTHROPIC_API_KEY not set');
    return null;
  }

  // Check cache
  const cached = await getFilingSummary(filing.id);
  if (cached) return cached;

  const docText = await fetchDocText(filing.document_url);
  if (!docText || docText.length < 200) {
    console.log(`[AI] Insufficient text for ${filing.id}`);
    return null;
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are an analyst at an institutional investment consulting firm (The Dobbs Group / Graystone Consulting). Analyze this SEC filing and provide a structured summary.

Filing: ${filing.filing_type} by ${filing.company_name}
Filed: ${filing.filed_date}
Document URL: ${filing.document_url}

Document text (first ~30KB):
${docText.substring(0, 25000)}

Respond in JSON with exactly these fields:
{
  "summary": "2-3 paragraph executive summary of the filing",
  "impact_companies": ["list of companies affected"],
  "impact_stocks": ["relevant stock tickers"],
  "cost_implications": "brief description of financial/cost impact",
  "key_risks": ["list of key risks identified"],
  "action_items": ["recommended actions for investment consultants"]
}

Focus on: regulatory impact, competitive implications for investment consulting, fee/cost changes, compliance requirements, and anything relevant to institutional investors.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    const summary: FilingSummary = {
      filing_id: filing.id,
      document_url: filing.document_url,
      company_name: filing.company_name,
      filing_type: filing.filing_type,
      filed_date: filing.filed_date,
      summary: parsed.summary || '',
      impact_companies: parsed.impact_companies || [],
      impact_stocks: parsed.impact_stocks || [],
      cost_implications: parsed.cost_implications || '',
      key_risks: parsed.key_risks || [],
      action_items: parsed.action_items || [],
      generated_at: new Date().toISOString(),
    };

    await saveFilingSummary(summary);
    return summary;
  } catch (err: any) {
    console.error(`[AI] Summary failed: ${err.message}`);
    return null;
  }
}

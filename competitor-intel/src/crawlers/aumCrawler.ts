import type { AumEntry, AumAssetClass } from '../config/competitors.js';
import { upsertAumEntry, logCrawl } from '../services/blobStore.js';

const SEC_SEARCH_BASE = 'https://efts.sec.gov/LATEST/search-index';
const USER_AGENT = 'The Dobbs Group Competitor Intel alerts@dobbsgroup.com';
const MIN_AUM_BILLIONS = 50;

interface EdgarHit {
  _id: string;
  _source: {
    display_names?: string[];
    ciks?: string[];
    root_form?: string;
    form?: string;
    file_date?: string;
    adsh?: string;
  };
}

async function searchEdgarAdv(startDate: string, endDate: string): Promise<EdgarHit[]> {
  const params = new URLSearchParams({
    q: '"assets under management"',
    dateRange: 'custom',
    startdt: startDate,
    enddt: endDate,
    forms: 'ADV',
  });
  const res = await fetch(`${SEC_SEARCH_BASE}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`EDGAR API error: ${res.status}`);
  const data = await res.json();
  return (data.hits?.hits || []) as EdgarHit[];
}

function buildDocUrl(hit: EdgarHit): string {
  const id = hit._id || '';
  const src = hit._source || {};
  const parts = id.split(':');
  if (parts.length < 2) return '';
  const filename = parts[1];
  const accession = src.adsh || parts[0];
  const cleanAccession = accession.replace(/-/g, '');
  const cik = (src.ciks || [])[0] || '';
  if (!cik) return '';
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${cleanAccession}/${filename}`;
}

/** Fetch first ~100KB of a filing and extract AUM data */
async function fetchAndParseAum(docUrl: string): Promise<{
  total: number;
  discretionary?: number;
  nonDiscretionary?: number;
  assetClasses?: AumAssetClass[];
} | null> {
  if (!docUrl) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(docUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Range': 'bytes=0-100000' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok && res.status !== 206) return null;
    const raw = await res.text();

    // Strip HTML/XML for text analysis
    const text = raw.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');

    return parseAumFromText(text);
  } catch {
    return null;
  }
}

/** Parse AUM figures from filing text */
function parseAumFromText(text: string): {
  total: number;
  discretionary?: number;
  nonDiscretionary?: number;
  assetClasses?: AumAssetClass[];
} | null {
  // Match dollar amounts: $X,XXX,XXX,XXX or $X.X billion/trillion
  const billionPattern = /\$\s*([\d,.]+)\s*(billion|trillion)/gi;
  const rawAmountPattern = /\$\s*([\d,]+(?:\.\d+)?)\s/g;

  let totalAum = 0;
  let discretionary: number | undefined;
  let nonDiscretionary: number | undefined;

  // Look for explicit "assets under management" or "regulatory assets" amounts
  const aumContextPatterns = [
    /(?:total|aggregate|regulatory)\s+(?:assets?\s+)?(?:under\s+(?:management|advisement))\s*[:\s]*\$\s*([\d,.]+)\s*(billion|trillion|million)?/gi,
    /(?:AUM|AUA)\s*[:\s]*\$\s*([\d,.]+)\s*(billion|trillion|million)?/gi,
    /\$\s*([\d,.]+)\s*(billion|trillion)\s+(?:in\s+)?(?:assets?\s+)?(?:under\s+(?:management|advisement))/gi,
  ];

  for (const pattern of aumContextPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = parseAmount(match[1], match[2]);
      if (amount > totalAum) totalAum = amount;
    }
  }

  // Look for discretionary/non-discretionary split
  const discPattern = /discretionary\s*[:\s]*\$\s*([\d,.]+)\s*(billion|trillion|million)?/gi;
  const nonDiscPattern = /non[- ]?discretionary\s*[:\s]*\$\s*([\d,.]+)\s*(billion|trillion|million)?/gi;

  let match;
  while ((match = discPattern.exec(text)) !== null) {
    const val = parseAmount(match[1], match[2]);
    if (!discretionary || val > discretionary) discretionary = val;
  }
  while ((match = nonDiscPattern.exec(text)) !== null) {
    const val = parseAmount(match[1], match[2]);
    if (!nonDiscretionary || val > nonDiscretionary) nonDiscretionary = val;
  }

  // If we found disc + nonDisc but not total, compute total
  if (!totalAum && discretionary && nonDiscretionary) {
    totalAum = discretionary + nonDiscretionary;
  }

  // If no AUM found through context, try raw large amounts near AUM keywords
  if (!totalAum) {
    const textLower = text.toLowerCase();
    let billionMatch;
    while ((billionMatch = billionPattern.exec(text)) !== null) {
      const amount = parseAmount(billionMatch[1], billionMatch[2]);
      // Check if "assets" or "management" appears within 200 chars
      const start = Math.max(0, billionMatch.index - 200);
      const context = textLower.substring(start, billionMatch.index + 100);
      if (context.includes('asset') || context.includes('management') || context.includes('aum') || context.includes('aua')) {
        if (amount > totalAum) totalAum = amount;
      }
    }
  }

  if (totalAum < MIN_AUM_BILLIONS) return null;

  // Parse asset class allocations if available
  const assetClasses = parseAssetClasses(text, totalAum);

  return {
    total: Math.round(totalAum * 10) / 10,
    discretionary: discretionary ? Math.round(discretionary * 10) / 10 : undefined,
    nonDiscretionary: nonDiscretionary ? Math.round(nonDiscretionary * 10) / 10 : undefined,
    assetClasses: assetClasses.length > 0 ? assetClasses : undefined,
  };
}

function parseAmount(numStr: string, unit?: string): number {
  const num = parseFloat(numStr.replace(/,/g, ''));
  if (isNaN(num)) return 0;
  const u = (unit || '').toLowerCase();
  if (u === 'trillion') return num * 1000;
  if (u === 'billion') return num;
  if (u === 'million') return num / 1000;
  // Raw number — if > 1 billion, treat as dollars
  if (num >= 1_000_000_000) return num / 1_000_000_000;
  if (num >= 1_000_000) return num / 1_000_000_000; // likely in dollars
  return num; // assume billions if small
}

function parseAssetClasses(text: string, totalAum: number): AumAssetClass[] {
  const classes: AumAssetClass[] = [];
  const patterns: [string, RegExp][] = [
    ['Equities', /(?:equit(?:y|ies)|stocks?)\s*[:\s]*(?:\$\s*([\d,.]+)\s*(billion|million|trillion)?|([\d.]+)\s*%)/gi],
    ['Fixed Income', /(?:fixed\s+income|bonds?)\s*[:\s]*(?:\$\s*([\d,.]+)\s*(billion|million|trillion)?|([\d.]+)\s*%)/gi],
    ['Alternatives', /(?:alternatives?|hedge\s+funds?|private\s+equity)\s*[:\s]*(?:\$\s*([\d,.]+)\s*(billion|million|trillion)?|([\d.]+)\s*%)/gi],
    ['Real Assets', /(?:real\s+(?:assets?|estate)|infrastructure)\s*[:\s]*(?:\$\s*([\d,.]+)\s*(billion|million|trillion)?|([\d.]+)\s*%)/gi],
    ['Cash & Other', /(?:cash|money\s+market|other)\s*[:\s]*(?:\$\s*([\d,.]+)\s*(billion|million|trillion)?|([\d.]+)\s*%)/gi],
  ];

  for (const [name, pattern] of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        // Dollar amount
        const amount = parseAmount(match[1], match[2]);
        if (amount > 0) {
          classes.push({ name, amount_billions: Math.round(amount * 10) / 10 });
          break;
        }
      } else if (match[3]) {
        // Percentage
        const pct = parseFloat(match[3]);
        if (pct > 0 && pct <= 100) {
          classes.push({ name, amount_billions: Math.round((totalAum * pct / 100) * 10) / 10 });
          break;
        }
      }
    }
  }

  return classes;
}

function makeEntityId(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 40);
}

export async function crawlAumFromEdgar(): Promise<number> {
  console.log(`[${new Date().toISOString()}] Starting AUM crawl from EDGAR ADV filings...`);

  // Search last 6 months of ADV filings mentioning AUM
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];

  let hits: EdgarHit[];
  try {
    hits = await searchEdgarAdv(startDate, endDate);
  } catch (err: any) {
    console.error(`EDGAR search failed: ${err.message}`);
    await logCrawl({
      crawl_type: 'aum-crawl',
      entity_id: 'edgar',
      articles_found: 0,
      status: 'error',
      error_message: err.message,
      finished_at: new Date().toISOString(),
    });
    return 0;
  }

  console.log(`  Found ${hits.length} ADV filings to analyze`);

  let updatedCount = 0;
  const seen = new Set<string>();

  // Process in batches of 3 with 500ms delay
  for (let i = 0; i < hits.length; i += 3) {
    const batch = hits.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(async (hit) => {
        const src = hit._source || {};
        const companyName = (src.display_names || [])[0] || '';
        if (!companyName || seen.has(companyName)) return null;
        seen.add(companyName);

        const docUrl = buildDocUrl(hit);
        const aumData = await fetchAndParseAum(docUrl);
        if (!aumData) return null;

        console.log(`  ${companyName}: $${aumData.total}B AUM`);

        const entry: AumEntry = {
          entity_id: makeEntityId(companyName),
          entity_name: companyName,
          aum_billions: aumData.total,
          as_of_date: src.file_date || endDate,
          source: 'ADV filing (EDGAR crawl)',
          notes: `CIK: ${(src.ciks || [])[0] || 'N/A'}`,
          updated_at: new Date().toISOString(),
          discretionary_billions: aumData.discretionary,
          non_discretionary_billions: aumData.nonDiscretionary,
          asset_classes: aumData.assetClasses,
        };

        await upsertAumEntry(entry);
        return entry;
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) updatedCount++;
    }

    // Rate limit delay
    if (i + 3 < hits.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[${new Date().toISOString()}] AUM crawl complete. ${updatedCount} entries updated.`);

  await logCrawl({
    crawl_type: 'aum-crawl',
    entity_id: 'edgar',
    articles_found: updatedCount,
    status: 'success',
    error_message: null,
    finished_at: new Date().toISOString(),
  });

  return updatedCount;
}

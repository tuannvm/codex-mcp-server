import type { SecFiling } from '../config/competitors.js';
import { ALL_ENTITIES, SEC_KEYWORD_CATEGORIES } from '../config/competitors.js';
import { addSecFilings, getSecFilings, logCrawl, getAllEntitiesWithCustom } from '../services/blobStore.js';

const SEC_SEARCH_BASE = 'https://efts.sec.gov/LATEST/search-index';
const USER_AGENT = 'The Dobbs Group Competitor Intel alerts@dobbsgroup.com';

function makeId(): string {
  return `sec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function searchEdgar(query: string, startDate: string, endDate: string): Promise<any[]> {
  const params = new URLSearchParams({
    q: `"${query}"`,
    dateRange: 'custom',
    startdt: startDate,
    enddt: endDate,
  });
  const res = await fetch(`${SEC_SEARCH_BASE}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) throw new Error(`EDGAR API error: ${res.status}`);
  const data = await res.json();
  return data.hits?.hits || [];
}

function buildDocUrl(hit: any): string {
  const id = hit._id || '';
  const src = hit._source || {};
  const parts = id.split(':');
  if (parts.length < 2) return '';
  const filename = parts[1];
  // Use adsh field for reliable accession number, fall back to _id parsing
  const accession = src.adsh || parts[0];
  const cleanAccession = accession.replace(/-/g, '');
  const cik = (src.ciks || [])[0] || '';
  if (!cik) return '';
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${cleanAccession}/${filename}`;
}

/** Fetch first ~40KB of a filing document and extract top words from actual content */
async function fetchDocTopWords(docUrl: string): Promise<string[]> {
  if (!docUrl) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(docUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Range': 'bytes=0-40000' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok && res.status !== 206) return [];
    const raw = await res.text();

    // Strip HTML/XML tags, entities, and non-alpha chars
    const text = raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/[^a-zA-Z\s]/g, ' ')
      .toLowerCase();

    // Count word frequencies
    const words = text.split(/\s+/);
    const freq: Record<string, number> = {};
    for (const w of words) {
      if (w.length < 4 || STOP_WORDS.has(w) || DOC_STOP_WORDS.has(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  } catch {
    return [];
  }
}

function countKeywords(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const hits: Record<string, number> = {};
  for (const cat of Object.values(SEC_KEYWORD_CATEGORIES)) {
    for (const kw of cat.keywords) {
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = lower.match(regex);
      if (matches && matches.length > 0) {
        hits[kw] = matches.length;
      }
    }
  }
  return hits;
}

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','as','is','was','are','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','can','could',
  'not','no','nor','so','if','then','than','that','this','these','those','it',
  'its','he','she','they','we','you','i','me','my','our','your','his','her',
  'their','which','who','whom','what','where','when','how','all','each','every',
  'both','few','more','most','other','some','such','any','only','own','same',
  'also','very','just','about','above','after','before','between','into','through',
  'during','under','over','out','up','down','off','re','s','t','d','ll','ve',
  'inc','llc','corp','co','et','al','sec','filed','form','file','report',
]);

// Extra stop words for SEC document content (common boilerplate)
const DOC_STOP_WORDS = new Set([
  'document','section','item','page','date','table','contents','part','total',
  'following','period','ended','year','years','number','pursuant','herein',
  'thereof','therein','hereto','thereto','upon','such','each','been','made',
  'shall','will','would','could','should','must','other','certain','respect',
  'applicable','including','without','unless','subject','accordance','provided',
  'whether','described','related','general','information','commission','exchange',
  'securities','registrant','states','united','state','federal','registered',
  'none','true','false','type','text','name','value','amount','percent',
  'class','style','font','color','width','align','span','border','xmlns',
  'html','body','head','title','meta','content','http','https','www',
]);

function extractTopWords(keywordHits: Record<string, number>, description: string): string[] {
  // Start with keyword_hits sorted by count desc
  const sorted = Object.entries(keywordHits)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const topWords: string[] = sorted.slice(0, 5).map(([word]) => word);

  // If fewer than 5, supplement from description word frequency
  if (topWords.length < 5 && description) {
    const existing = new Set(topWords.map(w => w.toLowerCase()));
    const words = description.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    const freq: Record<string, number> = {};
    for (const w of words) {
      if (w.length < 3 || STOP_WORDS.has(w) || existing.has(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
    const descWords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
    for (const w of descWords) {
      if (topWords.length >= 5) break;
      topWords.push(w);
    }
  }

  return topWords;
}

function computeRisk(keywordHits: Record<string, number>): { score: number; level: SecFiling['risk_level'] } {
  let score = 0;
  for (const [category, config] of Object.entries(SEC_KEYWORD_CATEGORIES)) {
    for (const kw of config.keywords) {
      const count = keywordHits[kw] || 0;
      score += count * config.weight;
    }
  }
  let level: SecFiling['risk_level'] = 'info';
  if (score >= 10) level = 'critical';
  else if (score >= 5) level = 'warning';
  else if (score >= 1) level = 'monitor';
  return { score, level };
}

export async function scanSec(customQuery?: string): Promise<number> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

  const allEntities = await getAllEntitiesWithCustom();
  const queries = customQuery
    ? [customQuery]
    : allEntities.map(e => e.name);

  let totalNew = 0;

  // Process in batches of 3 to respect EDGAR rate limit (10 req/sec)
  for (let i = 0; i < queries.length; i += 3) {
    const batch = queries.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(q => searchEdgar(q, startDate, endDate))
    );

    const filings: SecFiling[] = [];
    // Build filings from hits, track which need doc keywords
    const needsDocKeywords: Array<{ filing: SecFiling; docUrl: string }> = [];

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const hit of result.value) {
        const src = hit._source || {};
        const id = hit._id || '';
        const text = `${src.file_description || ''} ${(src.display_names || []).join(' ')}`;
        const keywordHits = countKeywords(text);
        const { score, level } = computeRisk(keywordHits);
        const descText = (src.file_description || '').substring(0, 500);
        const topWords = extractTopWords(keywordHits, descText);
        const accessionParts = id.split(':');
        const docUrl = buildDocUrl(hit);

        const filing: SecFiling = {
          id: makeId(),
          entity_names: src.display_names || [],
          filing_type: src.root_form || src.form || 'Unknown',
          filed_date: src.file_date || endDate,
          company_name: (src.display_names || ['Unknown'])[0],
          file_number: (src.file_num || [])[0] || '',
          document_url: docUrl,
          description: descText,
          keyword_hits: keywordHits,
          risk_level: level,
          risk_score: score,
          period_ending: src.period_ending || '',
          cik: (src.ciks || [])[0] || '',
          accession_number: accessionParts[0] || '',
          sic_code: (src.sics || [])[0] || '',
          top_words: topWords.length > 0 ? topWords : undefined,
          created_at: new Date().toISOString(),
        };
        filings.push(filing);

        // Queue for doc keyword extraction (always try to get real doc keywords)
        if (docUrl) {
          needsDocKeywords.push({ filing, docUrl });
        }
      }
    }

    // Fetch document keywords (cap at 8 per batch to stay within timeout)
    const toFetch = needsDocKeywords.slice(0, 8);
    if (toFetch.length > 0) {
      const docResults = await Promise.all(
        toFetch.map(({ docUrl }) => fetchDocTopWords(docUrl))
      );
      for (let k = 0; k < toFetch.length; k++) {
        if (docResults[k].length > 0) {
          toFetch[k].filing.top_words = docResults[k];
        }
      }
    }

    const newCount = await addSecFilings(filings, true);
    totalNew += newCount;

    if (i + 3 < queries.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  await logCrawl({
    crawl_type: 'sec_scanner',
    entity_id: null,
    articles_found: totalNew,
    status: 'success',
    error_message: null,
    finished_at: new Date().toISOString(),
  });

  return totalNew;
}

/** Backfill keywords for filings that don't have them yet */
export async function enrichFilingKeywords(): Promise<number> {
  const allFilings = await getSecFilings({ limit: 1000 });
  const needsKeywords = allFilings.filter(f => (!f.top_words || f.top_words.length === 0) && f.document_url);

  if (needsKeywords.length === 0) return 0;

  // Process in batches of 10 with concurrent fetching (cap at 50 per call)
  const batchSize = 10;
  let enriched = 0;
  const toProcess = needsKeywords.slice(0, 50);

  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(f => fetchDocTopWords(f.document_url))
    );

    for (let k = 0; k < batch.length; k++) {
      if (results[k].length > 0) {
        batch[k].top_words = results[k];
        enriched++;
      }
    }
  }

  // Save updated filings back (use addSecFilings with refreshKeywords to update in place)
  if (enriched > 0) {
    await addSecFilings(allFilings, true);
  }

  return enriched;
}

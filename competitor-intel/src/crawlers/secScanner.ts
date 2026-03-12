import type { SecFiling } from '../config/competitors.js';
import { ALL_ENTITIES, SEC_KEYWORDS } from '../config/competitors.js';
import { addSecFilings, logCrawl } from '../services/blobStore.js';

const SEC_SEARCH_BASE = 'https://efts.sec.gov/LATEST/search-index';
const USER_AGENT = 'The Dobbs Group Competitor Intel alerts@dobbsgroup.com';

function makeId(): string {
  return `sec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function searchEdgar(query: string, startDate: string, endDate: string): Promise<any[]> {
  const url = new URL(SEC_SEARCH_BASE);
  url.searchParams.set('q', `"${query}"`);
  url.searchParams.set('dateRange', 'custom');
  url.searchParams.set('startdt', startDate);
  url.searchParams.set('enddt', endDate);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) throw new Error(`EDGAR API error: ${res.status}`);
  const data = await res.json();
  return data.hits?.hits || [];
}

function countKeywords(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const hits: Record<string, number> = {};
  for (const kw of SEC_KEYWORDS) {
    const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      hits[kw] = matches.length;
    }
  }
  return hits;
}

export async function scanSec(customQuery?: string): Promise<number> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

  const queries = customQuery
    ? [customQuery]
    : ALL_ENTITIES.map(e => e.name);

  let totalNew = 0;

  // Process in batches of 3 to respect EDGAR rate limit (10 req/sec)
  for (let i = 0; i < queries.length; i += 3) {
    const batch = queries.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(q => searchEdgar(q, startDate, endDate))
    );

    const filings: SecFiling[] = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const hit of result.value) {
        const src = hit._source || {};
        const text = `${src.file_description || ''} ${(src.display_names || []).join(' ')}`;
        filings.push({
          id: makeId(),
          entity_names: src.display_names || [],
          filing_type: src.file_type || src.form_type || 'Unknown',
          filed_date: src.file_date || endDate,
          company_name: (src.display_names || ['Unknown'])[0],
          file_number: src.file_num || '',
          document_url: src.file_name
            ? `https://www.sec.gov/Archives/${src.file_name}`
            : '',
          description: (src.file_description || '').substring(0, 500),
          keyword_hits: countKeywords(text),
          created_at: new Date().toISOString(),
        });
      }
    }

    const newCount = await addSecFilings(filings);
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

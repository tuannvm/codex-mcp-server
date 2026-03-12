import { SIC_DESCRIPTIONS } from '../config/competitors.js';
import { getAllEntitiesWithCustom, logCrawl } from '../services/blobStore.js';

const EFTS_BASE = 'https://efts.sec.gov/LATEST/search-index';
const USER_AGENT = 'The Dobbs Group Competitor Intel alerts@dobbsgroup.com';

// Industry search queries mapped to SIC codes for discovery
const DISCOVERY_QUERIES: Array<{ query: string; sic: string; label: string }> = [
  { query: '"registered investment adviser" OR "investment advisory"', sic: '6282', label: 'Investment Advice' },
  { query: '"wealth management" OR "asset management"', sic: '6726', label: 'Investment Offices' },
  { query: '"broker dealer" OR "securities broker"', sic: '6211', label: 'Security Brokers & Dealers' },
];

interface EdgarHit {
  _id: string;
  _source: {
    display_names?: string[];
    ciks?: string[];
    sics?: string[];
    root_form?: string;
    form?: string;
    file_date?: string;
    file_description?: string;
  };
}

export interface DiscoverySuggestion {
  name: string;
  cik: string;
  sic_code: string;
  sic_description: string;
  filing_count: number;
  recent_filing_types: string[];
  latest_filing_date: string;
}

async function searchByIndustry(query: string, startDate: string, endDate: string): Promise<EdgarHit[]> {
  const params = new URLSearchParams({
    q: query,
    dateRange: 'custom',
    startdt: startDate,
    enddt: endDate,
  });
  const res = await fetch(`${EFTS_BASE}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    console.error(`[DISCOVER] EDGAR API error: ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.hits?.hits || [];
}

export async function discoverCompetitors(): Promise<DiscoverySuggestion[]> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];

  // Get all currently tracked entity names for deduplication
  const tracked = await getAllEntitiesWithCustom();
  const trackedNames = new Set(tracked.map(e => e.name.toLowerCase()));

  // Collect all hits across industry queries
  const companyMap = new Map<string, {
    name: string;
    cik: string;
    sic_code: string;
    filingTypes: Set<string>;
    filingCount: number;
    latestDate: string;
  }>();

  for (const dq of DISCOVERY_QUERIES) {
    try {
      const hits = await searchByIndustry(dq.query, startDate, endDate);

      for (const hit of hits) {
        const src = hit._source || {};
        const names = src.display_names || [];
        const cik = (src.ciks || [])[0] || '';
        const filingType = src.root_form || src.form || '';
        const fileDate = src.file_date || '';

        if (!cik || names.length === 0) continue;

        const primaryName = names[0];
        const key = cik; // Use CIK as unique key

        if (companyMap.has(key)) {
          const entry = companyMap.get(key)!;
          entry.filingCount++;
          if (filingType) entry.filingTypes.add(filingType);
          if (fileDate > entry.latestDate) entry.latestDate = fileDate;
        } else {
          // Use SIC from EDGAR if available, otherwise use the query's mapped SIC
          const sicFromEdgar = (src.sics || [])[0] || dq.sic;
          companyMap.set(key, {
            name: primaryName,
            cik,
            sic_code: sicFromEdgar,
            filingTypes: new Set(filingType ? [filingType] : []),
            filingCount: 1,
            latestDate: fileDate,
          });
        }
      }

      // Rate limit: wait between queries
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[DISCOVER] Error searching "${dq.label}":`, err);
    }
  }

  // Filter out already-tracked entities and build suggestions
  const suggestions: DiscoverySuggestion[] = [];

  for (const [, entry] of companyMap) {
    // Skip if already tracked (case-insensitive name match)
    if (trackedNames.has(entry.name.toLowerCase())) continue;

    // Skip entries with very generic names
    if (entry.name.length < 3) continue;

    suggestions.push({
      name: entry.name,
      cik: entry.cik,
      sic_code: entry.sic_code,
      sic_description: SIC_DESCRIPTIONS[entry.sic_code] || `SIC ${entry.sic_code}`,
      filing_count: entry.filingCount,
      recent_filing_types: Array.from(entry.filingTypes),
      latest_filing_date: entry.latestDate,
    });
  }

  // Rank by filing frequency (most active filers first)
  suggestions.sort((a, b) => b.filing_count - a.filing_count);

  await logCrawl({
    crawl_type: 'discovery',
    entity_id: null,
    articles_found: suggestions.length,
    status: 'success',
    error_message: null,
    finished_at: new Date().toISOString(),
  });

  // Return top 20 suggestions
  return suggestions.slice(0, 20);
}

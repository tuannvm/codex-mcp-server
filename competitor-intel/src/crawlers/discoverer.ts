import { SIC_DESCRIPTIONS } from '../config/competitors.js';
import { getAllEntitiesWithCustom, logCrawl } from '../services/blobStore.js';

const EFTS_BASE = 'https://efts.sec.gov/LATEST/search-index/';
const USER_AGENT = 'The Dobbs Group Competitor Intel alerts@dobbsgroup.com';

// Target SIC codes for investment advisory / consulting firms
const DISCOVERY_SIC_CODES = ['6282', '6726', '6211'];

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

async function searchBySic(sicCode: string, startDate: string, endDate: string): Promise<EdgarHit[]> {
  // Use EDGAR full-text search for filings by SIC code
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${sicCode}%22&dateRange=custom&startdt=${startDate}&enddt=${endDate}&forms=ADV,10-K,13F`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    // Fallback: try the company search endpoint
    const fallbackUrl = `https://efts.sec.gov/LATEST/search-index?q=*&dateRange=custom&startdt=${startDate}&enddt=${endDate}`;
    const fallbackRes = await fetch(fallbackUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!fallbackRes.ok) return [];
    const data = await fallbackRes.json();
    return (data.hits?.hits || []).filter((h: EdgarHit) => {
      const sics = h._source?.sics || [];
      return sics.includes(sicCode);
    });
  }

  const data = await res.json();
  const hits: EdgarHit[] = data.hits?.hits || [];
  // Filter to only hits with matching SIC
  return hits.filter(h => {
    const sics = h._source?.sics || [];
    return sics.includes(sicCode);
  });
}

export async function discoverCompetitors(): Promise<DiscoverySuggestion[]> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];

  // Get all currently tracked entity names for deduplication
  const tracked = await getAllEntitiesWithCustom();
  const trackedNames = new Set(tracked.map(e => e.name.toLowerCase()));

  // Collect all hits across SIC codes
  const companyMap = new Map<string, {
    name: string;
    cik: string;
    sic_code: string;
    filingTypes: Set<string>;
    filingCount: number;
    latestDate: string;
  }>();

  for (const sic of DISCOVERY_SIC_CODES) {
    try {
      const hits = await searchBySic(sic, startDate, endDate);

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
          companyMap.set(key, {
            name: primaryName,
            cik,
            sic_code: sic,
            filingTypes: new Set(filingType ? [filingType] : []),
            filingCount: 1,
            latestDate: fileDate,
          });
        }
      }

      // Rate limit: wait between SIC code queries
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[DISCOVER] Error searching SIC ${sic}:`, err);
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

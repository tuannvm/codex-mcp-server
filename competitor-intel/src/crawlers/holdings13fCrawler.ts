/**
 * SEC 13F Holdings Crawler
 * Fetches 13F-HR filings from EDGAR and parses holdings from XML information tables
 */

import type { Filing13F, Holding13F } from '../config/competitors.js';
import { save13FHoldings } from '../services/blobStore.js';

const EDGAR_EFTS = 'https://efts.sec.gov/LATEST/search-index';
const EDGAR_ARCHIVES = 'https://www.sec.gov/Archives/edgar/data';
const UA = 'CompetitorIntelDashboard contact@example.com';

// Entities with known CIKs for 13F filing lookup
// Includes wirehouses, major asset managers, RIAs, pension consultants, and competitors
export const ENTITIES_WITH_CIK: Array<{ name: string; cik: string }> = [
  // ── Wirehouses & Large Banks ──
  { name: 'J.P. Morgan Asset Management', cik: '0000019617' },
  { name: 'Morgan Stanley', cik: '0000895421' },
  { name: 'Goldman Sachs', cik: '0000886982' },
  { name: 'Bank of America / Merrill Lynch', cik: '0000070858' },
  { name: 'Wells Fargo', cik: '0000072971' },
  { name: 'UBS', cik: '0001114446' },
  { name: 'Citigroup', cik: '0000831001' },
  { name: 'Deutsche Bank', cik: '0001159508' },
  { name: 'Barclays', cik: '0000312070' },
  { name: 'Credit Suisse (now UBS)', cik: '0001159510' },

  // ── Major Asset Managers ──
  { name: 'BlackRock', cik: '0001364742' },
  { name: 'Vanguard Group', cik: '0000102909' },
  { name: 'State Street Global Advisors', cik: '0000093751' },
  { name: 'Fidelity (FMR LLC)', cik: '0000315066' },
  { name: 'Capital Group', cik: '0000016988' },
  { name: 'T. Rowe Price', cik: '0001018963' },
  { name: 'Invesco', cik: '0000914208' },
  { name: 'Franklin Templeton', cik: '0000038777' },
  { name: 'PIMCO', cik: '0001040280' },
  { name: 'Northern Trust', cik: '0000073124' },
  { name: 'BNY Mellon', cik: '0000009626' },
  { name: 'Charles Schwab', cik: '0000316709' },
  { name: 'Nuveen (TIAA)', cik: '0000790652' },
  { name: 'Dimensional Fund Advisors', cik: '0000354204' },
  { name: 'Wellington Management', cik: '0001423053' },
  { name: 'Geode Capital Management', cik: '0001214717' },

  // ── Hedge Funds & Alternative Managers ──
  { name: 'Bridgewater Associates', cik: '0001350694' },
  { name: 'Citadel Advisors', cik: '0001423053' },
  { name: 'Renaissance Technologies', cik: '0001037389' },
  { name: 'Two Sigma Investments', cik: '0001179392' },
  { name: 'D.E. Shaw', cik: '0001009207' },
  { name: 'AQR Capital Management', cik: '0001167557' },
  { name: 'Millennium Management', cik: '0001273087' },
  { name: 'Point72 Asset Management', cik: '0001603466' },
  { name: 'Baupost Group', cik: '0001061768' },
  { name: 'Elliott Management', cik: '0001048445' },
  { name: 'Pershing Square Capital', cik: '0001336528' },
  { name: 'Third Point', cik: '0001040273' },
  { name: 'Viking Global Investors', cik: '0001103804' },
  { name: 'Tiger Global Management', cik: '0001167483' },

  // ── Insurance & Institutional ──
  { name: 'Berkshire Hathaway', cik: '0001067983' },
  { name: 'MetLife Investment Management', cik: '0001099219' },
  { name: 'Prudential Financial', cik: '0001137774' },
  { name: 'Principal Financial Group', cik: '0001126328' },

  // ── RIAs & Consultants (Competitors) ──
  { name: 'Cambridge Associates', cik: '0001048839' },
  { name: 'William Blair', cik: '0000837498' },
  { name: 'CAPTRUST Financial Advisors', cik: '0001633949' },
  { name: 'Baird (Robert W. Baird)', cik: '0000904495' },
  { name: 'Raymond James Financial', cik: '0000720005' },
  { name: 'LPL Financial', cik: '0001397187' },
  { name: 'Stifel Financial', cik: '0000720005' },
  { name: 'Ameriprise Financial', cik: '0000820027' },
  { name: 'Edward Jones (parent: Jones Financial)', cik: '0000049196' },

  // ── Endowment & Foundation Managers ──
  { name: 'Yale University (Investments Office)', cik: '0001547734' },
  { name: 'Harvard Management Company', cik: '0001082621' },
];

async function search13FFilings(cik: string): Promise<Array<{ accession: string; filedDate: string }>> {
  try {
    const paddedCik = cik.replace(/^0+/, '');
    const url = `https://efts.sec.gov/LATEST/search-index?q=%2213F-HR%22&dateRange=custom&startdt=${getStartDate()}&enddt=${new Date().toISOString().split('T')[0]}&forms=13F-HR`;

    // Use EDGAR full-text search
    const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%2213F-HR%22+AND+%22${paddedCik}%22&forms=13F-HR`;

    // Actually use the submissions endpoint which is more reliable
    const subUrl = `https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`;
    const res = await fetch(subUrl, { headers: { 'User-Agent': UA } });

    if (!res.ok) {
      console.warn(`[13F] Failed to fetch submissions for CIK ${cik}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const recent = data.filings?.recent;
    if (!recent) return [];

    const filings: Array<{ accession: string; filedDate: string }> = [];
    for (let i = 0; i < recent.form.length && filings.length < 2; i++) {
      if (recent.form[i] === '13F-HR') {
        filings.push({
          accession: recent.accessionNumber[i].replace(/-/g, ''),
          filedDate: recent.filingDate[i],
        });
      }
    }

    return filings;
  } catch (err) {
    console.warn(`[13F] Error searching for CIK ${cik}:`, err);
    return [];
  }
}

function getStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().split('T')[0];
}

async function fetchInfoTable(cik: string, accession: string): Promise<Holding13F[]> {
  try {
    const cleanCik = cik.replace(/^0+/, '');
    const indexUrl = `${EDGAR_ARCHIVES}/${cleanCik}/${accession}/index.json`;
    const indexRes = await fetch(indexUrl, { headers: { 'User-Agent': UA } });

    if (!indexRes.ok) return [];

    const indexData = await indexRes.json();
    const items = indexData.directory?.item || [];

    // Find the information table XML — filenames vary (e.g. "infotable.xml", "Information_Table_12.31.2025.xml")
    const infoTableFile = items.find((item: any) => {
      const lower = item.name.toLowerCase();
      return (lower.includes('infotable') || lower.includes('information_table') || lower.includes('info_table')) &&
        (lower.endsWith('.xml'));
    });

    if (!infoTableFile) {
      console.warn(`[13F] No info table found for ${cik}/${accession}`);
      return [];
    }

    const xmlUrl = `${EDGAR_ARCHIVES}/${cleanCik}/${accession}/${infoTableFile.name}`;
    const xmlRes = await fetch(xmlUrl, { headers: { 'User-Agent': UA } });
    if (!xmlRes.ok) return [];

    const xml = await xmlRes.text();
    return parseInfoTableXml(xml);
  } catch (err) {
    console.warn(`[13F] Error fetching info table for ${cik}/${accession}:`, err);
    return [];
  }
}

function parseInfoTableXml(xml: string): Holding13F[] {
  const holdings: Holding13F[] = [];

  // Match infoTable entries with any namespace prefix (ns1:infoTable, infoTable, etc.)
  const entryPattern = /<(?:\w+:)?infoTable\b[^>]*>([\s\S]*?)<\/(?:\w+:)?infoTable>/gi;
  const allEntries = xml.match(entryPattern) || [];

  for (const entry of allEntries) {
    const getField = (name: string): string => {
      const p = new RegExp(`<(?:\\w+:)?${name}[^>]*>([^<]*)`, 'i');
      const m = entry.match(p);
      return m ? m[1].trim() : '';
    };

    const issuer = getField('nameOfIssuer');
    const cusip = getField('cusip');
    const valueStr = getField('value');
    const sharesStr = getField('sshPrnamt');
    const shareType = getField('sshPrnamtType');

    if (issuer && cusip) {
      holdings.push({
        issuer,
        cusip,
        value_thousands: parseInt(valueStr) || 0,
        shares: parseInt(sharesStr) || 0,
        share_type: shareType || 'SH',
      });
    }
  }

  return holdings;
}

function extractPeriod(filedDate: string): string {
  // 13F filings are for the quarter ending before the filing date
  const d = new Date(filedDate);
  const month = d.getMonth(); // 0-indexed
  // Quarter ending: Q1=03-31, Q2=06-30, Q3=09-30, Q4=12-31
  if (month <= 3) return `${d.getFullYear() - 1}-12-31`;
  if (month <= 6) return `${d.getFullYear()}-03-31`;
  if (month <= 9) return `${d.getFullYear()}-06-30`;
  return `${d.getFullYear()}-09-30`;
}

/** Crawl a specific batch of entities (for use by the batched API endpoint) */
export async function crawl13FBatch(entities: Array<{ name: string; cik: string }>): Promise<number> {
  let totalFilings = 0;

  for (const entity of entities) {
    console.log(`[13F] Searching filings for ${entity.name} (CIK: ${entity.cik})...`);

    const filings = await search13FFilings(entity.cik);
    console.log(`[13F] Found ${filings.length} 13F-HR filings for ${entity.name}`);

    for (const filing of filings) {
      const holdings = await fetchInfoTable(entity.cik, filing.accession);
      if (holdings.length === 0) continue;

      const period = extractPeriod(filing.filedDate);
      const totalValue = holdings.reduce((sum, h) => sum + h.value_thousands, 0);

      const filing13f: Filing13F = {
        entity_name: entity.name,
        cik: entity.cik,
        period,
        filed_date: filing.filedDate,
        accession_number: filing.accession,
        holdings: holdings.sort((a, b) => b.value_thousands - a.value_thousands),
        total_value_thousands: totalValue,
      };

      await save13FHoldings(entity.cik, filing13f);
      totalFilings++;
      console.log(`[13F] Saved ${holdings.length} holdings for ${entity.name} (${period})`);

      // Rate limit: EDGAR wants max 10 req/sec — be conservative
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return totalFilings;
}

/** Crawl all entities (used by scheduled function) */
export async function crawl13FHoldings(): Promise<number> {
  return crawl13FBatch(ENTITIES_WITH_CIK);
}

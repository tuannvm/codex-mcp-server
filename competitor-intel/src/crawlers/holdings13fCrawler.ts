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
const ENTITIES_WITH_CIK: Array<{ name: string; cik: string }> = [
  { name: 'J.P. Morgan Asset Management', cik: '0000019617' },
  { name: 'UBS', cik: '0001114446' },
  { name: 'Cambridge Associates', cik: '0001048839' },
  { name: 'William Blair', cik: '0000837498' },
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
    for (let i = 0; i < recent.form.length && filings.length < 4; i++) {
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

    // Find the information table XML
    const infoTableFile = items.find((item: any) =>
      item.name.toLowerCase().includes('infotable') &&
      (item.name.endsWith('.xml') || item.name.endsWith('.XML'))
    );

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

  // Simple XML parsing for info table entries
  const entryPattern = /<infoTable[^>]*>([\s\S]*?)<\/infoTable>/gi;
  const entries = xml.match(entryPattern) || [];

  // If no entries found with infoTable tags, try ns1:infoTable or other namespace patterns
  const altPattern = /<(?:ns1:|)[iI]nfo[tT]able[^>]*>([\s\S]*?)<\/(?:ns1:|)[iI]nfo[tT]able>/gi;
  const allEntries = entries.length > 0 ? entries : (xml.match(altPattern) || []);

  for (const entry of allEntries) {
    const getField = (name: string): string => {
      const patterns = [
        new RegExp(`<(?:ns1:)?${name}[^>]*>([^<]*)<`, 'i'),
        new RegExp(`<${name}>([^<]*)`, 'i'),
      ];
      for (const p of patterns) {
        const m = entry.match(p);
        if (m) return m[1].trim();
      }
      return '';
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

export async function crawl13FHoldings(): Promise<number> {
  let totalFilings = 0;

  for (const entity of ENTITIES_WITH_CIK) {
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

      // Rate limit: EDGAR wants max 10 req/sec
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return totalFilings;
}

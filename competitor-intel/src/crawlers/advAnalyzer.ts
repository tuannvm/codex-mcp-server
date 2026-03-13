import type { FormAdvAnalysis } from '../config/competitors.js';
import { getAllEntitiesWithCustom, saveAdvAnalysis, logCrawl } from '../services/blobStore.js';

const USER_AGENT = 'The Dobbs Group Competitor Intel alerts@dobbsgroup.com';
const EDGAR_FULL_TEXT = 'https://efts.sec.gov/LATEST/search-index';

async function searchAdvFiling(entityName: string): Promise<any | null> {
  const params = new URLSearchParams({
    q: `"${entityName}"`,
    forms: 'ADV',
    dateRange: 'custom',
    startdt: new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0],
    enddt: new Date().toISOString().split('T')[0],
  });

  try {
    const res = await fetch(`${EDGAR_FULL_TEXT}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hits = data.hits?.hits || [];
    return hits[0] || null;
  } catch {
    return null;
  }
}

function parseNumber(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  if (!match) return 0;
  const num = match[1].replace(/,/g, '').replace(/\$/g, '');
  return parseFloat(num) || 0;
}

function parseAdvText(text: string, entityName: string, cik: string): Partial<FormAdvAnalysis> {
  const result: Partial<FormAdvAnalysis> = {};

  // Total AUM (Item 5.F)
  const aumMatch = text.match(/regulatory\s*assets\s*under\s*management[^$]*\$?([\d,]+(?:\.\d+)?)\s*(billion|million|trillion)?/i);
  if (aumMatch) {
    let val = parseFloat(aumMatch[1].replace(/,/g, ''));
    const unit = (aumMatch[2] || '').toLowerCase();
    if (unit === 'billion') val *= 1;
    else if (unit === 'million') val /= 1000;
    else if (unit === 'trillion') val *= 1000;
    else if (val > 1e9) val /= 1e9; // raw dollar amount
    result.total_aum = val;
  }

  // Discretionary / Non-Discretionary (Item 5.F)
  const discMatch = text.match(/discretionary[^$]*\$?([\d,.]+)\s*(billion|million)?/i);
  const nonDiscMatch = text.match(/non-discretionary[^$]*\$?([\d,.]+)\s*(billion|million)?/i);
  if (discMatch) {
    let val = parseFloat(discMatch[1].replace(/,/g, ''));
    if ((discMatch[2] || '').toLowerCase() === 'million') val /= 1000;
    result.discretionary_aum = val;
  }
  if (nonDiscMatch) {
    let val = parseFloat(nonDiscMatch[1].replace(/,/g, ''));
    if ((nonDiscMatch[2] || '').toLowerCase() === 'million') val /= 1000;
    result.non_discretionary_aum = val;
  }

  // Employee count (Item 5.A)
  const empMatch = text.match(/(?:total|full.time)\s*employees?\s*[:=]?\s*(\d+)/i) ||
    text.match(/(\d+)\s*(?:total|full.time)\s*employees?/i);
  if (empMatch) result.employees = parseInt(empMatch[1]);

  // Advisory employees
  const advEmpMatch = text.match(/(\d+)\s*(?:advisory|investment)\s*(?:personnel|employees|professionals)/i);
  if (advEmpMatch) result.advisory_employees = parseInt(advEmpMatch[1]);

  // Number of accounts (Item 5.D)
  const acctMatch = text.match(/(?:total|number\s*of)\s*(?:client)?\s*accounts?\s*[:=]?\s*(\d+)/i);
  if (acctMatch) result.total_accounts = parseInt(acctMatch[1]);

  // Compensation methods
  const compMethods: string[] = [];
  if (/percentage\s*of\s*assets/i.test(text)) compMethods.push('Percentage of AUM');
  if (/hourly\s*charges/i.test(text)) compMethods.push('Hourly fees');
  if (/fixed\s*fee/i.test(text)) compMethods.push('Fixed fees');
  if (/performance.based/i.test(text)) compMethods.push('Performance-based');
  if (/commission/i.test(text)) compMethods.push('Commissions');
  result.compensation_methods = compMethods;

  // Disciplinary
  result.disciplinary_disclosures = /disciplinary|legal\s*or\s*regulatory/i.test(text) &&
    !/no\s*(?:disciplinary|legal)/i.test(text);

  // Client types
  const clientTypes: Array<{ type: string; count_or_pct: string }> = [];
  const clientPatterns = [
    { type: 'Pension/Retirement Plans', pattern: /pension|retirement|ERISA/i },
    { type: 'Endowments/Foundations', pattern: /endowment|foundation|charitable/i },
    { type: 'Corporations', pattern: /corporation|business\s*entit/i },
    { type: 'High Net Worth', pattern: /high\s*net\s*worth|individual/i },
    { type: 'Government', pattern: /government|state|municipal/i },
    { type: 'Insurance Companies', pattern: /insurance\s*compan/i },
    { type: 'Investment Companies', pattern: /investment\s*compan|mutual\s*fund/i },
  ];
  for (const cp of clientPatterns) {
    if (cp.pattern.test(text)) clientTypes.push({ type: cp.type, count_or_pct: 'Yes' });
  }
  result.client_types = clientTypes;

  return result;
}

export async function analyzeAdv(entityId?: string): Promise<number> {
  const allEntities = await getAllEntitiesWithCustom();
  const targets = entityId
    ? allEntities.filter(e => e.id === entityId)
    : allEntities.filter(e => e.tier === 1 || e.tier === 'self');

  let analyzed = 0;

  for (let i = 0; i < targets.length; i++) {
    const entity = targets[i];
    try {
      const hit = await searchAdvFiling(entity.name);
      if (!hit) continue;

      const src = hit._source || {};
      const cik = (src.ciks || [])[0] || '';
      const accession = src.adsh || '';
      const cleanAccession = accession.replace(/-/g, '');
      const filename = (hit._id || '').split(':')[1] || '';

      if (!cik || !filename) continue;
      const docUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${cleanAccession}/${filename}`;

      // Fetch document text
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(docUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Range': 'bytes=0-80000' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok && res.status !== 206) continue;

      const raw = await res.text();
      const text = raw.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ');

      const parsed = parseAdvText(text, entity.name, cik);

      const analysis: FormAdvAnalysis = {
        entity_id: entity.id,
        entity_name: entity.name,
        cik,
        filing_date: src.file_date || new Date().toISOString().split('T')[0],
        total_aum: parsed.total_aum || 0,
        discretionary_aum: parsed.discretionary_aum || 0,
        non_discretionary_aum: parsed.non_discretionary_aum || 0,
        total_accounts: parsed.total_accounts || 0,
        employees: parsed.employees || 0,
        advisory_employees: parsed.advisory_employees || 0,
        fee_schedule: [],
        client_types: parsed.client_types || [],
        compensation_methods: parsed.compensation_methods || [],
        disciplinary_disclosures: parsed.disciplinary_disclosures || false,
        other_business_activities: [],
        updated_at: new Date().toISOString(),
      };

      await saveAdvAnalysis(analysis);
      analyzed++;
    } catch (err: any) {
      console.error(`[ADV] Error for ${entity.name}: ${err.message}`);
    }

    // Rate limit
    if (i + 1 < targets.length) await new Promise(r => setTimeout(r, 300));
  }

  await logCrawl({
    crawl_type: 'adv_analysis',
    entity_id: entityId || null,
    articles_found: analyzed,
    status: 'success',
    error_message: null,
    finished_at: new Date().toISOString(),
  });

  return analyzed;
}

/**
 * FINRA BrokerCheck Crawler
 * Fetches disciplinary actions and regulatory alerts from FINRA
 */

import type { FinraAlert } from '../config/competitors.js';
import { addFinraAlerts } from '../services/blobStore.js';

// Firms to monitor with their CRD numbers
const MONITORED_FIRMS: Array<{ name: string; crd: string }> = [
  { name: 'Morgan Stanley', crd: '149777' },
  { name: 'J.P. Morgan', crd: '79' },
  { name: 'UBS Financial Services', crd: '8174' },
  { name: 'CAPTRUST Financial Advisors', crd: '137241' },
  { name: 'William Blair', crd: '41' },
];

async function fetchFinraActions(firmName: string, crd: string): Promise<FinraAlert[]> {
  const alerts: FinraAlert[] = [];

  try {
    // FINRA BrokerCheck API — search for firm disciplinary events
    const searchUrl = `https://api.brokercheck.finra.org/search/firm?query=${encodeURIComponent(firmName)}&filter=active=true&hl=true&nrows=5&start=0`;

    const res = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CompetitorIntelDashboard/1.0',
      },
    });

    if (!res.ok) {
      console.warn(`[FINRA] Search failed for ${firmName}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const hits = data.hits?.hits || [];

    for (const hit of hits) {
      const source = hit._source || {};
      const disclosures = source.disclosures || [];

      for (const disc of disclosures.slice(0, 10)) {
        const actionType = disc.disclosureType?.toLowerCase() || 'regulatory';
        let severity: 'critical' | 'warning' | 'info' = 'info';

        if (['regulatory', 'disciplinary'].some(t => actionType.includes(t))) {
          severity = 'critical';
        } else if (['arbitration', 'civil', 'complaint'].some(t => actionType.includes(t))) {
          severity = 'warning';
        }

        alerts.push({
          id: `finra-${crd}-${disc.eventDate || Date.now()}-${alerts.length}`,
          firm_name: firmName,
          crd_number: crd,
          action_type: disc.disclosureType || 'Unknown',
          severity,
          summary: disc.disclosureDetail || disc.disclosureResolution || 'No details available',
          date: disc.eventDate || new Date().toISOString().split('T')[0],
          source_url: `https://brokercheck.finra.org/firm/summary/${crd}`,
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn(`[FINRA] Error for ${firmName}:`, err);
  }

  return alerts;
}

export async function crawlFinra(): Promise<number> {
  const apiKey = process.env.FINRA_API_KEY;
  // FINRA BrokerCheck doesn't always require API key for basic queries

  let totalAlerts = 0;

  for (const firm of MONITORED_FIRMS) {
    console.log(`[FINRA] Checking ${firm.name} (CRD: ${firm.crd})...`);
    const alerts = await fetchFinraActions(firm.name, firm.crd);

    if (alerts.length > 0) {
      const added = await addFinraAlerts(alerts);
      totalAlerts += added;
      console.log(`[FINRA] Added ${added} new alerts for ${firm.name}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  return totalAlerts;
}

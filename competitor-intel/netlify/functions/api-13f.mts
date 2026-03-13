import type { Config } from '@netlify/functions';
import { get13FHoldings, getAll13FPeriods } from '../../src/services/blobStore.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';
import { ENTITIES_WITH_CIK } from '../../src/crawlers/holdings13fCrawler.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const url = new URL(req.url);
  const cik = url.searchParams.get('cik') || '';
  const period = url.searchParams.get('period') || undefined;

  if (!cik) {
    // Return all entities that have crawled data
    const entities: Array<{ name: string; cik: string }> = [];
    const periods: Record<string, string[]> = {};

    for (const entity of ENTITIES_WITH_CIK) {
      const p = await getAll13FPeriods(entity.cik);
      if (p.length > 0) {
        entities.push(entity);
        periods[entity.cik] = p;
      }
    }

    return new Response(JSON.stringify({ entities, periods }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const filing = await get13FHoldings(cik, period);
  const allPeriods = await getAll13FPeriods(cik);

  return new Response(JSON.stringify({ filing, periods: allPeriods }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/13f' };

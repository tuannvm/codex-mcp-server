import type { Config } from '@netlify/functions';
import { get13FHoldings, getAll13FPeriods } from '../../src/services/blobStore.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const url = new URL(req.url);
  const cik = url.searchParams.get('cik') || '';
  const period = url.searchParams.get('period') || undefined;

  if (!cik) {
    const periods: Record<string, string[]> = {};
    // Return available entities and their periods
    for (const entity of [
      { name: 'J.P. Morgan Asset Management', cik: '0000019617' },
      { name: 'UBS', cik: '0001114446' },
      { name: 'Cambridge Associates', cik: '0001048839' },
      { name: 'William Blair', cik: '0000837498' },
    ]) {
      const p = await getAll13FPeriods(entity.cik);
      if (p.length > 0) periods[entity.cik] = p;
    }
    return new Response(JSON.stringify({ entities: [
      { name: 'J.P. Morgan Asset Management', cik: '0000019617' },
      { name: 'UBS', cik: '0001114446' },
      { name: 'Cambridge Associates', cik: '0001048839' },
      { name: 'William Blair', cik: '0000837498' },
    ], periods }), {
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

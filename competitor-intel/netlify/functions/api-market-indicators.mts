import type { Config } from '@netlify/functions';
import { getMarketIndicators } from '../../src/services/blobStore.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const data = await getMarketIndicators();
  return new Response(JSON.stringify(data || { fred_series: [], fear_greed: null, yield_spread: null, updated_at: null }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/market-indicators' };

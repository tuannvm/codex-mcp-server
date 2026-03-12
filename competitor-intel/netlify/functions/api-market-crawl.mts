import type { Config } from '@netlify/functions';
import { crawlMarketIndicators } from '../../src/crawlers/fredCrawler.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  try {
    const count = await crawlMarketIndicators();
    return new Response(JSON.stringify({ success: true, updated: count }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/market-indicators/crawl', method: 'POST' };

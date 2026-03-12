import type { Config } from '@netlify/functions';
import { crawl13FHoldings } from '../../src/crawlers/holdings13fCrawler.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  try {
    const count = await crawl13FHoldings();
    return new Response(JSON.stringify({ success: true, filings: count }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/13f/crawl', method: 'POST' };

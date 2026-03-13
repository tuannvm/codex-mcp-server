import type { Config } from '@netlify/functions';
import { crawlFinra } from '../../src/crawlers/finraCrawler.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  try {
    const count = await crawlFinra();
    return new Response(JSON.stringify({ success: true, alerts: count }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/finra/crawl', method: 'POST' };

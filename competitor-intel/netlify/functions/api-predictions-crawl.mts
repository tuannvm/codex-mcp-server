import type { Config } from '@netlify/functions';
import { crawlPredictionMarkets } from '../../src/crawlers/predictionCrawler.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  try {
    const newMarkets = await crawlPredictionMarkets();
    return new Response(JSON.stringify({ success: true, newMarkets }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/predictions/crawl', method: 'POST' };

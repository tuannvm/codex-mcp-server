import type { Config } from '@netlify/functions';
import { crawlAllFinancialNews } from '../../src/crawlers/finNewsCrawler.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  try {
    const newArticles = await crawlAllFinancialNews();
    return new Response(JSON.stringify({ success: true, newArticles }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/fin-crawl', method: 'POST' };

import type { Config } from '@netlify/functions';
import { crawlAumFromEdgar } from '../../src/crawlers/aumCrawler.js';

export default async () => {
  try {
    const updatedCount = await crawlAumFromEdgar();
    return new Response(JSON.stringify({ success: true, updatedCount }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/aum/crawl', method: 'POST' };

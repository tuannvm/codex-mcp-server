import type { Config } from '@netlify/functions';
import { crawlFinra } from '../../src/crawlers/finraCrawler.js';

export default async () => {
  console.log('[SCHEDULED] Running FINRA alerts crawl...');
  const count = await crawlFinra();
  console.log(`[SCHEDULED] FINRA crawl complete. ${count} new alerts.`);
};

export const config: Config = {
  schedule: '0 12 * * *', // Daily noon UTC
};

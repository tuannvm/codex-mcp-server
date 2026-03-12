import type { Config } from '@netlify/functions';
import { crawlMarketIndicators } from '../../src/crawlers/fredCrawler.js';

export default async () => {
  console.log('[SCHEDULED] Running market indicators crawl...');
  const count = await crawlMarketIndicators();
  console.log(`[SCHEDULED] Market indicators crawl complete. ${count} series updated.`);
};

export const config: Config = {
  schedule: '0 */4 * * *', // Every 4 hours
};

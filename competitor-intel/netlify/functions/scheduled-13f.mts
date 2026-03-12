import type { Config } from '@netlify/functions';
import { crawl13FHoldings } from '../../src/crawlers/holdings13fCrawler.js';

export default async () => {
  console.log('[SCHEDULED] Running 13F holdings crawl...');
  const count = await crawl13FHoldings();
  console.log(`[SCHEDULED] 13F crawl complete. ${count} filings processed.`);
};

export const config: Config = {
  schedule: '0 10 * * 1', // Weekly Monday at 10 AM UTC
};

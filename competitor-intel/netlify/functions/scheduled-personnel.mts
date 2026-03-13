import type { Config } from '@netlify/functions';
import { crawlPersonnel } from '../../src/crawlers/personnelCrawler.js';

export default async () => {
  console.log('[SCHEDULED] Scanning personnel changes...');
  const found = await crawlPersonnel();
  console.log(`[SCHEDULED] Personnel scan complete. ${found} changes found.`);
};

export const config: Config = {
  schedule: '0 8 * * *', // Daily at 8 AM UTC
};

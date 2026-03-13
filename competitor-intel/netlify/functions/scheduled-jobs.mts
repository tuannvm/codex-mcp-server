import type { Config } from '@netlify/functions';
import { crawlJobs } from '../../src/crawlers/jobCrawler.js';

export default async () => {
  console.log('[SCHEDULED] Scanning job postings...');
  const found = await crawlJobs();
  console.log(`[SCHEDULED] Job scan complete. ${found} postings found.`);
};

export const config: Config = {
  schedule: '0 10 * * 1', // Weekly on Monday at 10 AM UTC
};

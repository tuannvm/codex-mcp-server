import type { Config } from '@netlify/functions';
import { crawlAumFromEdgar } from '../../src/crawlers/aumCrawler.js';

export default async () => {
  console.log('[SCHEDULED] Running AUM crawl from EDGAR ADV filings...');
  const updatedCount = await crawlAumFromEdgar();
  console.log(`[SCHEDULED] AUM crawl complete. ${updatedCount} entries updated.`);
};

export const config: Config = {
  schedule: '0 6 * * 1', // Weekly: Monday at 6 AM UTC
};

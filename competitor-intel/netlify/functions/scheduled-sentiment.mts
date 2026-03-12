import type { Config } from '@netlify/functions';
import { crawlSentiment } from '../../src/crawlers/sentimentCrawler.js';

export default async () => {
  console.log('[SCHEDULED] Running sentiment crawl...');
  const count = await crawlSentiment();
  console.log(`[SCHEDULED] Sentiment crawl complete. ${count} topics updated.`);
};

export const config: Config = {
  schedule: '0 6,14,22 * * *', // 3x daily
};

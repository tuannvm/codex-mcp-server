import type { Config } from '@netlify/functions';
import { crawlPredictionMarkets } from '../../src/crawlers/predictionCrawler.js';

export default async () => {
  console.log('[SCHEDULED] Running prediction markets crawl...');
  const newMarkets = await crawlPredictionMarkets();
  console.log(`[SCHEDULED] Prediction markets complete. ${newMarkets} new/updated.`);
};

export const config: Config = {
  schedule: '0 */4 * * *', // Every 4 hours
};

import type { Config } from '@netlify/functions';
import { crawlAll } from '../../src/crawlers/newsCrawler.js';
import { checkAndAlertNegativeArticles } from '../../src/services/emailAlert.js';

export default async () => {
  console.log('[SCHEDULED] Running news crawl...');
  const newArticles = await crawlAll();
  const alertResult = await checkAndAlertNegativeArticles();
  console.log(`[SCHEDULED] News crawl complete. ${newArticles} new articles. Alert:`, alertResult);
};

export const config: Config = {
  schedule: '0 */2 * * *', // Every 2 hours
};

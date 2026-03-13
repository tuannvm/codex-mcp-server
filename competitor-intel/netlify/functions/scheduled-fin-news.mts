import type { Config } from '@netlify/functions';
import { crawlAllFinancialNews } from '../../src/crawlers/finNewsCrawler.js';

export default async () => {
  console.log('[SCHEDULED] Running financial news crawl...');
  const newArticles = await crawlAllFinancialNews();
  console.log(`[SCHEDULED] Financial news crawl complete. ${newArticles} new articles.`);
};

export const config: Config = {
  schedule: '0 */3 * * *',
};

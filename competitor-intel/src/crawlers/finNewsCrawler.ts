import RSSParser from 'rss-parser';
import { FINANCIAL_NEWS_SOURCES, type FinancialArticle, type FinancialNewsSource } from '../config/competitors.js';
import { addFinArticles, logCrawl } from '../services/blobStore.js';
import { analyzeSentiment } from '../services/sentiment.js';

const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IntelBot/1.0)' },
});

function buildGoogleNewsUrl(domain: string, terms: string[]): string {
  const query = `site:${domain} ${terms.join(' ')}`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

function cleanTitle(title: string): string {
  const parts = (title || '').split(' - ');
  return parts.length > 1 ? parts.slice(0, -1).join(' - ').trim() : title || '';
}

function makeId(): string {
  return `fin-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function crawlSource(source: FinancialNewsSource): Promise<FinancialArticle[]> {
  const url = buildGoogleNewsUrl(source.domain, source.searchTerms);
  const feed = await parser.parseURL(url);

  return (feed.items || []).filter(item => item.link).map(item => {
    const title = cleanTitle(item.title || '');
    const snippet = (item.contentSnippet || item.content || '')
      .replace(/<[^>]*>/g, '').substring(0, 500).trim();
    const { score, label } = analyzeSentiment(`${title} ${snippet}`);

    return {
      id: makeId(),
      title,
      link: item.link || '',
      source_name: source.name,
      source_domain: source.domain,
      pub_date: item.isoDate || item.pubDate || new Date().toISOString(),
      snippet,
      sentiment_score: score,
      sentiment_label: label,
      created_at: new Date().toISOString(),
      search_query: `site:${source.domain}`,
    } as FinancialArticle;
  });
}

export async function crawlAllFinancialNews(): Promise<number> {
  console.log(`[${new Date().toISOString()}] Starting financial news crawl for ${FINANCIAL_NEWS_SOURCES.length} sources...`);
  let totalNew = 0;

  const allArticles: FinancialArticle[] = [];
  const results = await Promise.allSettled(
    FINANCIAL_NEWS_SOURCES.map(async (source) => {
      try {
        const articles = await crawlSource(source);
        console.log(`  ${source.name}: ${articles.length} fetched`);
        await logCrawl({
          crawl_type: 'financial-news',
          entity_id: source.domain,
          articles_found: articles.length,
          status: 'success',
          error_message: null,
          finished_at: new Date().toISOString(),
        });
        return articles;
      } catch (err: any) {
        console.error(`  ${source.name}: ERROR - ${err.message}`);
        await logCrawl({
          crawl_type: 'financial-news',
          entity_id: source.domain,
          articles_found: 0,
          status: 'error',
          error_message: err.message,
          finished_at: new Date().toISOString(),
        });
        return [] as FinancialArticle[];
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') allArticles.push(...r.value);
  }

  totalNew = allArticles.length > 0 ? await addFinArticles(allArticles) : 0;

  console.log(`[${new Date().toISOString()}] Financial news crawl complete. ${totalNew} new articles.`);
  return totalNew;
}

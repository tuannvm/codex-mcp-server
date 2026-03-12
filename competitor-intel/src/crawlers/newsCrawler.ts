import RSSParser from 'rss-parser';
import { ALL_ENTITIES, type Entity, type Article } from '../config/competitors.js';
import { addArticles, logCrawl } from '../services/blobStore.js';
import { analyzeSentiment } from '../services/sentiment.js';

const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IntelBot/1.0)' },
});

function buildGoogleNewsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

function extractSource(item: any): string {
  if (item.source) return item.source;
  const parts = (item.title || '').split(' - ');
  return parts.length > 1 ? parts[parts.length - 1].trim() : item.creator || 'Unknown';
}

function cleanTitle(title: string): string {
  const parts = (title || '').split(' - ');
  return parts.length > 1 ? parts.slice(0, -1).join(' - ').trim() : title || '';
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function crawlEntityQueries(entity: Entity): Promise<Article[]> {
  // Fetch all queries for this entity in parallel
  const queryResults = await Promise.allSettled(
    entity.searchQueries.map(async (query) => {
      const url = buildGoogleNewsUrl(query);
      const feed = await parser.parseURL(url);
      return (feed.items || []).map(item => {
        const title = cleanTitle(item.title || '');
        const snippet = (item.contentSnippet || item.content || '')
          .replace(/<[^>]*>/g, '').substring(0, 500).trim();
        const { score, label } = analyzeSentiment(`${title} ${snippet}`);

        return {
          id: makeId(),
          entity_id: entity.id,
          entity_name: entity.name,
          title,
          link: item.link || '',
          source: extractSource(item),
          pub_date: item.isoDate || item.pubDate || new Date().toISOString(),
          snippet,
          sentiment_score: score,
          sentiment_label: label,
          alerted: false,
          created_at: new Date().toISOString(),
          search_query: query,
        } as Article;
      });
    })
  );

  return queryResults
    .filter((r): r is PromiseFulfilledResult<Article[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

export async function crawlAll(): Promise<number> {
  console.log(`[${new Date().toISOString()}] Starting parallel news crawl for ${ALL_ENTITIES.length} entities...`);
  let totalNew = 0;

  // Crawl all entities in parallel for speed (no delays needed in serverless)
  const results = await Promise.allSettled(
    ALL_ENTITIES.map(async (entity) => {
      try {
        const articles = await crawlEntityQueries(entity);
        const newCount = await addArticles(entity.id, articles);
        console.log(`  ${entity.name}: ${newCount} new articles`);
        await logCrawl({
          crawl_type: 'news',
          entity_id: entity.id,
          articles_found: newCount,
          status: 'success',
          error_message: null,
          finished_at: new Date().toISOString(),
        });
        return newCount;
      } catch (err: any) {
        console.error(`  ${entity.name}: ERROR - ${err.message}`);
        await logCrawl({
          crawl_type: 'news',
          entity_id: entity.id,
          articles_found: 0,
          status: 'error',
          error_message: err.message,
          finished_at: new Date().toISOString(),
        });
        return 0;
      }
    })
  );

  totalNew = results
    .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
    .reduce((sum, r) => sum + r.value, 0);

  console.log(`[${new Date().toISOString()}] News crawl complete. ${totalNew} new articles.`);
  return totalNew;
}

export async function crawlSingle(entityId: string): Promise<number> {
  const entity = ALL_ENTITIES.find(e => e.id === entityId);
  if (!entity) throw new Error(`Entity not found: ${entityId}`);

  const articles = await crawlEntityQueries(entity);
  const newCount = await addArticles(entity.id, articles);
  await logCrawl({
    crawl_type: 'news',
    entity_id: entity.id,
    articles_found: newCount,
    status: 'success',
    error_message: null,
    finished_at: new Date().toISOString(),
  });
  return newCount;
}

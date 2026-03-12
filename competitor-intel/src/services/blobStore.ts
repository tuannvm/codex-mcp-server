import { getStore } from '@netlify/blobs';
import type { Article, GovEvent, CrawlLogEntry } from '../config/competitors.js';
import { ALL_ENTITIES } from '../config/competitors.js';

function articleStore() {
  return getStore({ name: 'articles', consistency: 'strong' });
}

function eventsStore() {
  return getStore({ name: 'gov-events', consistency: 'strong' });
}

function logStore() {
  return getStore({ name: 'crawl-log', consistency: 'strong' });
}

// ── Articles ────────────────────────────────────────────

export async function getArticlesForEntity(entityId: string): Promise<Article[]> {
  const store = articleStore();
  const data = await store.get(entityId, { type: 'json' });
  return data || [];
}

export async function saveArticlesForEntity(entityId: string, articles: Article[]): Promise<void> {
  const store = articleStore();
  await store.setJSON(entityId, articles);
}

export async function addArticles(entityId: string, newArticles: Article[]): Promise<number> {
  const existing = await getArticlesForEntity(entityId);
  const existingLinks = new Set(existing.map(a => a.link));

  const unique = newArticles.filter(a => !existingLinks.has(a.link));
  if (unique.length === 0) return 0;

  const merged = [...unique, ...existing]
    .sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime())
    .slice(0, 500); // Cap per entity

  await saveArticlesForEntity(entityId, merged);
  return unique.length;
}

export async function getAllArticles(filters?: {
  entityId?: string;
  sentiment?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Article[]> {
  const { entityId, sentiment, search, limit = 100, offset = 0 } = filters || {};

  let all: Article[] = [];

  if (entityId && entityId !== 'all') {
    all = await getArticlesForEntity(entityId);
  } else {
    const entityIds = ALL_ENTITIES.map(e => e.id);
    const results = await Promise.all(entityIds.map(id => getArticlesForEntity(id)));
    all = results.flat();
  }

  // Filter
  if (sentiment && sentiment !== 'all') {
    all = all.filter(a => a.sentiment_label === sentiment);
  }
  if (search) {
    const q = search.toLowerCase();
    all = all.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.snippet && a.snippet.toLowerCase().includes(q))
    );
  }

  // Sort by date descending
  all.sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime());

  return all.slice(offset, offset + limit);
}

export async function getArticleStats(): Promise<Array<{
  entity_id: string;
  entity_name: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  latest_article: string | null;
}>> {
  const stats = [];

  for (const entity of ALL_ENTITIES) {
    const articles = await getArticlesForEntity(entity.id);
    if (articles.length === 0) continue;

    stats.push({
      entity_id: entity.id,
      entity_name: entity.name,
      total: articles.length,
      positive: articles.filter(a => a.sentiment_label === 'positive').length,
      neutral: articles.filter(a => a.sentiment_label === 'neutral').length,
      negative: articles.filter(a => a.sentiment_label === 'negative').length,
      latest_article: articles.length > 0
        ? articles.reduce((latest, a) =>
            new Date(a.pub_date) > new Date(latest.pub_date) ? a : latest
          ).pub_date
        : null,
    });
  }

  return stats.sort((a, b) => b.total - a.total);
}

export async function getUnalertedNegativeArticles(entityId: string): Promise<Article[]> {
  const articles = await getArticlesForEntity(entityId);
  return articles.filter(a => a.sentiment_label === 'negative' && !a.alerted);
}

export async function markAlerted(entityId: string, articleIds: string[]): Promise<void> {
  const articles = await getArticlesForEntity(entityId);
  const idSet = new Set(articleIds);
  for (const a of articles) {
    if (idSet.has(a.id)) a.alerted = true;
  }
  await saveArticlesForEntity(entityId, articles);
}

// ── Government Events ───────────────────────────────────

export async function getGovEvents(filters?: {
  startDate?: string;
  endDate?: string;
  category?: string;
}): Promise<GovEvent[]> {
  const store = eventsStore();
  const all: GovEvent[] = (await store.get('all', { type: 'json' })) || [];

  let filtered = all;
  if (filters?.startDate) {
    filtered = filtered.filter(e => e.event_date >= filters.startDate!);
  }
  if (filters?.endDate) {
    filtered = filtered.filter(e => e.event_date <= filters.endDate!);
  }
  if (filters?.category && filters.category !== 'all') {
    filtered = filtered.filter(e => e.category === filters.category);
  }

  return filtered.sort((a, b) => a.event_date.localeCompare(b.event_date));
}

export async function addGovEvents(newEvents: GovEvent[]): Promise<number> {
  const store = eventsStore();
  const existing: GovEvent[] = (await store.get('all', { type: 'json' })) || [];
  const existingKeys = new Set(existing.map(e => `${e.title}||${e.event_date}`));

  const unique = newEvents.filter(e => !existingKeys.has(`${e.title}||${e.event_date}`));
  if (unique.length === 0) return 0;

  const merged = [...existing, ...unique]
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  await store.setJSON('all', merged);
  return unique.length;
}

// ── Crawl Log ───────────────────────────────────────────

export async function logCrawl(entry: Omit<CrawlLogEntry, 'started_at'>): Promise<void> {
  const store = logStore();
  const log: CrawlLogEntry[] = (await store.get('log', { type: 'json' })) || [];

  log.unshift({
    ...entry,
    started_at: new Date().toISOString(),
  });

  // Cap at 100 entries
  await store.setJSON('log', log.slice(0, 100));
}

export async function getCrawlLog(): Promise<CrawlLogEntry[]> {
  const store = logStore();
  return (await store.get('log', { type: 'json' })) || [];
}

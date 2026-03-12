import { getStore } from '@netlify/blobs';
import type { Article, GovEvent, CrawlLogEntry, AumEntry, SecFiling, PredictionMarket, CustomEntity, Entity, DailyBrief, FinancialArticle, MarketIndicators, AggregatedSentiment, Filing13F, FinraAlert } from '../config/competitors.js';
import { ALL_ENTITIES, SEED_AUM_DATA } from '../config/competitors.js';

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
  priority?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Article[]> {
  const { entityId, sentiment, search, priority, limit = 100, offset = 0 } = filters || {};

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
  if (priority) {
    all = all.filter(a => a.priority === true);
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

// ── Financial Articles ───────────────────────────────────

function finArticleStore() {
  return getStore({ name: 'fin-articles', consistency: 'strong' });
}

export async function getFinArticles(filters?: {
  source?: string;
  sentiment?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<FinancialArticle[]> {
  const store = finArticleStore();
  const { source, sentiment, search, limit = 100, offset = 0 } = filters || {};

  let all: FinancialArticle[] = (await store.get('all', { type: 'json' })) || [];

  if (source && source !== 'all') {
    all = all.filter(a => a.source_name === source);
  }
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

  all.sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime());
  return all.slice(offset, offset + limit);
}

export async function addFinArticles(newArticles: FinancialArticle[]): Promise<number> {
  const store = finArticleStore();
  const existing: FinancialArticle[] = (await store.get('all', { type: 'json' })) || [];
  const existingLinks = new Set(existing.map(a => a.link));

  const unique = newArticles.filter(a => !existingLinks.has(a.link));
  if (unique.length === 0) return 0;

  const merged = [...unique, ...existing]
    .sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime())
    .slice(0, 1000);

  await store.setJSON('all', merged);
  return unique.length;
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

// ── AUM Data ────────────────────────────────────────────

function aumStore() {
  return getStore({ name: 'aum-data', consistency: 'strong' });
}

export async function getAumData(): Promise<AumEntry[]> {
  const store = aumStore();
  const data = await store.get('all', { type: 'json' });
  return (data as AumEntry[]) || [];
}

export async function saveAumData(entries: AumEntry[]): Promise<void> {
  const store = aumStore();
  await store.setJSON('all', entries);
}

export async function upsertAumEntry(entry: AumEntry): Promise<void> {
  const existing = await getAumData();
  const idx = existing.findIndex(e => e.entity_id === entry.entity_id);
  if (idx >= 0) {
    existing[idx] = { ...entry, updated_at: new Date().toISOString() };
  } else {
    existing.push({ ...entry, updated_at: new Date().toISOString() });
  }
  await saveAumData(existing);
}

export async function seedAumIfEmpty(): Promise<boolean> {
  const existing = await getAumData();
  if (existing.length > 0) return false;
  await saveAumData(SEED_AUM_DATA);
  return true;
}

// ── SEC Filings ─────────────────────────────────────────

function secStore() {
  return getStore({ name: 'sec-filings', consistency: 'strong' });
}

export async function clearSecFilings(): Promise<void> {
  const store = secStore();
  await store.setJSON('all', []);
}

export async function getSecFilings(filters?: {
  entityName?: string;
  filingType?: string;
  limit?: number;
  offset?: number;
}): Promise<SecFiling[]> {
  const store = secStore();
  let all: SecFiling[] = ((await store.get('all', { type: 'json' })) as SecFiling[]) || [];
  const { entityName, filingType, limit = 100, offset = 0 } = filters || {};

  if (entityName) {
    const q = entityName.toLowerCase();
    all = all.filter(f => f.entity_names.some(n => n.toLowerCase().includes(q)) ||
      f.company_name.toLowerCase().includes(q));
  }
  if (filingType) {
    all = all.filter(f => f.filing_type === filingType);
  }

  all.sort((a, b) => new Date(b.filed_date).getTime() - new Date(a.filed_date).getTime());
  return all.slice(offset, offset + limit);
}

export async function addSecFilings(newFilings: SecFiling[], refreshKeywords = false): Promise<number> {
  const store = secStore();
  const existing: SecFiling[] = ((await store.get('all', { type: 'json' })) as SecFiling[]) || [];
  const existingUrls = new Set(existing.map(f => f.document_url));

  const unique = newFilings.filter(f => !existingUrls.has(f.document_url));

  // Update keywords on existing filings that now have doc-extracted words
  if (refreshKeywords) {
    const newByUrl = new Map(newFilings.map(f => [f.document_url, f]));
    let updated = 0;
    for (const ef of existing) {
      const nf = newByUrl.get(ef.document_url);
      if (nf?.top_words?.length && !ef.top_words?.length) {
        ef.top_words = nf.top_words;
        updated++;
      }
    }
    if (updated > 0 || unique.length > 0) {
      const merged = [...unique, ...existing]
        .sort((a, b) => new Date(b.filed_date).getTime() - new Date(a.filed_date).getTime())
        .slice(0, 1000);
      await store.setJSON('all', merged);
      return unique.length;
    }
  }

  if (unique.length === 0) return 0;

  const merged = [...unique, ...existing]
    .sort((a, b) => new Date(b.filed_date).getTime() - new Date(a.filed_date).getTime())
    .slice(0, 1000);

  await store.setJSON('all', merged);
  return unique.length;
}

// ── Prediction Markets ──────────────────────────────────

function predictionsStore() {
  return getStore({ name: 'prediction-markets', consistency: 'strong' });
}

export async function getPredictionMarkets(filters?: {
  category?: string;
}): Promise<PredictionMarket[]> {
  const store = predictionsStore();
  let all: PredictionMarket[] = ((await store.get('all', { type: 'json' })) as PredictionMarket[]) || [];

  if (filters?.category && filters.category !== 'all') {
    all = all.filter(m => m.category === filters.category);
  }

  return all.sort((a, b) => b.volume - a.volume);
}

export async function addPredictionMarkets(markets: PredictionMarket[]): Promise<number> {
  const store = predictionsStore();
  const existing: PredictionMarket[] = ((await store.get('all', { type: 'json' })) as PredictionMarket[]) || [];

  const existingByQuestion = new Map(existing.map(m => [m.question.toLowerCase(), m]));
  let newCount = 0;

  for (const market of markets) {
    const key = market.question.toLowerCase();
    if (existingByQuestion.has(key)) {
      const ex = existingByQuestion.get(key)!;
      ex.probability = market.probability;
      ex.volume = market.volume;
      ex.last_updated = market.last_updated;
    } else {
      existingByQuestion.set(key, market);
      newCount++;
    }
  }

  const merged = Array.from(existingByQuestion.values())
    .filter(m => {
      if (!m.end_date) return true;
      return new Date(m.end_date).getTime() > Date.now() - 7 * 86400000;
    })
    .slice(0, 500);

  await store.setJSON('all', merged);
  return newCount;
}

// ── Custom Entities ─────────────────────────────────────

function customEntitiesStore() {
  return getStore({ name: 'custom-entities', consistency: 'strong' });
}

export async function getCustomEntities(): Promise<CustomEntity[]> {
  const store = customEntitiesStore();
  return ((await store.get('all', { type: 'json' })) as CustomEntity[]) || [];
}

export async function addCustomEntity(entity: CustomEntity): Promise<void> {
  const existing = await getCustomEntities();
  if (existing.some(e => e.id === entity.id)) return;
  existing.push(entity);
  const store = customEntitiesStore();
  await store.setJSON('all', existing);
}

export async function removeCustomEntity(entityId: string): Promise<boolean> {
  const existing = await getCustomEntities();
  const filtered = existing.filter(e => e.id !== entityId);
  if (filtered.length === existing.length) return false;
  const store = customEntitiesStore();
  await store.setJSON('all', filtered);
  return true;
}

export async function getAllEntitiesWithCustom(): Promise<Entity[]> {
  const custom = await getCustomEntities();
  return [...ALL_ENTITIES, ...custom];
}

// ── Daily Briefs ────────────────────────────────────────

function briefStore() {
  return getStore({ name: 'daily-briefs', consistency: 'strong' });
}

export async function saveBrief(brief: DailyBrief): Promise<void> {
  const store = briefStore();
  await store.setJSON('latest', brief);
}

export async function getLatestBrief(): Promise<DailyBrief | null> {
  const store = briefStore();
  return ((await store.get('latest', { type: 'json' })) as DailyBrief) || null;
}

// ── Market Indicators ────────────────────────────────────

function marketStore() {
  return getStore({ name: 'market-indicators', consistency: 'strong' });
}

export async function getMarketIndicators(): Promise<MarketIndicators | null> {
  const store = marketStore();
  return ((await store.get('latest', { type: 'json' })) as MarketIndicators) || null;
}

export async function saveMarketIndicators(data: MarketIndicators): Promise<void> {
  const store = marketStore();
  await store.setJSON('latest', data);
}

// ── Sentiment Data ───────────────────────────────────────

function sentimentStore() {
  return getStore({ name: 'av-sentiment', consistency: 'strong' });
}

export async function getSentimentData(): Promise<AggregatedSentiment | null> {
  const store = sentimentStore();
  return ((await store.get('latest', { type: 'json' })) as AggregatedSentiment) || null;
}

export async function saveSentimentData(data: AggregatedSentiment): Promise<void> {
  const store = sentimentStore();
  await store.setJSON('latest', data);
}

// ── 13F Holdings ─────────────────────────────────────────

function holdings13fStore() {
  return getStore({ name: '13f-holdings', consistency: 'strong' });
}

export async function get13FHoldings(entityCik: string, period?: string): Promise<Filing13F | null> {
  const store = holdings13fStore();
  if (period) {
    return ((await store.get(`${entityCik}:${period}`, { type: 'json' })) as Filing13F) || null;
  }
  // Get latest
  const periods = await getAll13FPeriods(entityCik);
  if (periods.length === 0) return null;
  return ((await store.get(`${entityCik}:${periods[0]}`, { type: 'json' })) as Filing13F) || null;
}

export async function save13FHoldings(entityCik: string, filing: Filing13F): Promise<void> {
  const store = holdings13fStore();
  await store.setJSON(`${entityCik}:${filing.period}`, filing);
  // Update period index
  const periods = await getAll13FPeriods(entityCik);
  if (!periods.includes(filing.period)) {
    periods.push(filing.period);
    periods.sort().reverse();
    await store.setJSON(`${entityCik}:periods`, periods);
  }
}

export async function getAll13FPeriods(entityCik: string): Promise<string[]> {
  const store = holdings13fStore();
  return ((await store.get(`${entityCik}:periods`, { type: 'json' })) as string[]) || [];
}

// ── FINRA Alerts ─────────────────────────────────────────

function finraStore() {
  return getStore({ name: 'finra-alerts', consistency: 'strong' });
}

export async function getFinraAlerts(): Promise<FinraAlert[]> {
  const store = finraStore();
  return ((await store.get('all', { type: 'json' })) as FinraAlert[]) || [];
}

export async function addFinraAlerts(newAlerts: FinraAlert[]): Promise<number> {
  const store = finraStore();
  const existing = await getFinraAlerts();
  const existingIds = new Set(existing.map(a => a.id));
  const unique = newAlerts.filter(a => !existingIds.has(a.id));
  if (unique.length === 0) return 0;
  const merged = [...unique, ...existing]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 500);
  await store.setJSON('all', merged);
  return unique.length;
}

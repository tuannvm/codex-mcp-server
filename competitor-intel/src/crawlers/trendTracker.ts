import type { TrendSnapshot } from '../config/competitors.js';
import {
  getAllEntitiesWithCustom, getAumData, getArticlesForEntity,
  get13FHoldings, getSentimentData, addTrendSnapshots, logCrawl,
} from '../services/blobStore.js';

export async function captureSnapshot(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const allEntities = await getAllEntitiesWithCustom();
  const snapshots: TrendSnapshot[] = [];

  // AUM snapshots
  const aumData = await getAumData();
  for (const entry of aumData) {
    snapshots.push({
      date: today,
      metric_type: 'aum',
      entity_id: entry.entity_id,
      entity_name: entry.entity_name,
      value: entry.aum_billions,
      metadata: {
        discretionary: entry.discretionary_billions,
        non_discretionary: entry.non_discretionary_billions,
      },
    });
  }

  // Article count snapshots
  for (const entity of allEntities) {
    const articles = await getArticlesForEntity(entity.id);
    const last24h = articles.filter(a =>
      new Date(a.pub_date).getTime() > Date.now() - 24 * 3600000
    );
    if (last24h.length > 0) {
      const avgSentiment = last24h.reduce((s, a) => s + a.sentiment_score, 0) / last24h.length;
      snapshots.push({
        date: today,
        metric_type: 'article_count',
        entity_id: entity.id,
        entity_name: entity.name,
        value: last24h.length,
        metadata: { avg_sentiment: Math.round(avgSentiment * 100) / 100 },
      });
    }
  }

  // Sentiment snapshot
  const sentimentData = await getSentimentData();
  if (sentimentData) {
    snapshots.push({
      date: today,
      metric_type: 'sentiment',
      entity_id: 'composite',
      entity_name: 'Market Composite',
      value: sentimentData.composite_score,
      metadata: { label: sentimentData.composite_label },
    });
  }

  const added = await addTrendSnapshots(snapshots);

  await logCrawl({
    crawl_type: 'trend_snapshot',
    entity_id: null,
    articles_found: added,
    status: 'success',
    error_message: null,
    finished_at: new Date().toISOString(),
  });

  return added;
}

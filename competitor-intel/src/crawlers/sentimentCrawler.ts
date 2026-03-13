/**
 * Alpha Vantage News Sentiment Crawler
 * Fetches market sentiment from Alpha Vantage NEWS_SENTIMENT API
 * Free tier: 25 calls/day — we use 3 topics × 3 times/day = 9 calls
 */

import type { SentimentSnapshot, AggregatedSentiment } from '../config/competitors.js';
import { saveSentimentData } from '../services/blobStore.js';

const AV_BASE = 'https://www.alphavantage.co/query';

const TOPICS = ['financial_markets', 'economy_monetary', 'economy_fiscal'];

function scoreToBucketLabel(score: number): string {
  if (score <= -0.35) return 'Bearish';
  if (score <= -0.15) return 'Somewhat-Bearish';
  if (score <= 0.15) return 'Neutral';
  if (score <= 0.35) return 'Somewhat-Bullish';
  return 'Bullish';
}

async function fetchTopicSentiment(topic: string, apiKey: string): Promise<SentimentSnapshot | null> {
  try {
    const url = `${AV_BASE}?function=NEWS_SENTIMENT&topics=${topic}&apikey=${apiKey}&limit=50`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[AV-Sentiment] Failed for ${topic}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.Note || data.Information) {
      console.warn(`[AV-Sentiment] Rate limited or key issue: ${data.Note || data.Information}`);
      return null;
    }

    const feed = data.feed || [];
    if (feed.length === 0) return null;

    // Average sentiment across articles
    let totalScore = 0;
    const headlines: Array<{ title: string; url: string; sentiment: number }> = [];

    for (const article of feed) {
      const score = parseFloat(article.overall_sentiment_score) || 0;
      totalScore += score;
      if (headlines.length < 5) {
        headlines.push({
          title: article.title,
          url: article.url,
          sentiment: score,
        });
      }
    }

    const avgScore = totalScore / feed.length;

    return {
      topic,
      score: parseFloat(avgScore.toFixed(4)),
      label: scoreToBucketLabel(avgScore),
      article_count: feed.length,
      top_headlines: headlines,
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[AV-Sentiment] Error for ${topic}:`, err);
    return null;
  }
}

export async function crawlSentiment(): Promise<number> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) {
    console.warn('[AV-Sentiment] ALPHA_VANTAGE_KEY not set, skipping');
    return 0;
  }

  const snapshots: SentimentSnapshot[] = [];

  for (const topic of TOPICS) {
    const snapshot = await fetchTopicSentiment(topic, apiKey);
    if (snapshot) snapshots.push(snapshot);
  }

  if (snapshots.length === 0) return 0;

  const compositeScore = snapshots.reduce((sum, s) => sum + s.score, 0) / snapshots.length;

  const aggregated: AggregatedSentiment = {
    composite_score: parseFloat(compositeScore.toFixed(4)),
    composite_label: scoreToBucketLabel(compositeScore),
    topics: snapshots,
    updated_at: new Date().toISOString(),
  };

  await saveSentimentData(aggregated);
  return snapshots.length;
}

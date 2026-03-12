/**
 * FRED Economic Data + CNN Fear & Greed Index Crawler
 * Fetches key economic indicators from FRED API and market sentiment from CNN
 */

import type { FredSeries, FredSeriesPoint, FearGreedData, MarketIndicators } from '../config/competitors.js';
import { getMarketIndicators, saveMarketIndicators } from '../services/blobStore.js';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

const FRED_SERIES_CONFIG: Array<{ id: string; label: string; unit: string }> = [
  { id: 'VIXCLS', label: 'VIX (Volatility Index)', unit: 'Index' },
  { id: 'STLFSI4', label: 'Financial Stress Index', unit: 'Index' },
  { id: 'DGS10', label: '10-Year Treasury Yield', unit: '%' },
  { id: 'DGS2', label: '2-Year Treasury Yield', unit: '%' },
  { id: 'FEDFUNDS', label: 'Fed Funds Rate', unit: '%' },
];

async function fetchFredSeries(seriesId: string, apiKey: string): Promise<FredSeriesPoint[]> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]; // ~6 months

  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${startDate}&observation_end=${endDate}&sort_order=desc&limit=90`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[FRED] Failed to fetch ${seriesId}: ${res.status}`);
    return [];
  }

  const data = await res.json();
  if (!data.observations) return [];

  return data.observations
    .filter((o: any) => o.value !== '.')
    .map((o: any) => ({
      date: o.date,
      value: parseFloat(o.value),
    }))
    .reverse(); // chronological order
}

async function fetchFearGreed(): Promise<FearGreedData | null> {
  try {
    const res = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata/', {
      headers: { 'User-Agent': 'CompetitorIntelDashboard/1.0' },
    });
    if (!res.ok) {
      console.warn(`[FearGreed] Failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const fg = data.fear_and_greed;
    if (!fg) return null;

    return {
      score: Math.round(fg.score),
      rating: fg.rating,
      previous_close: Math.round(fg.previous_close),
      one_week_ago: Math.round(fg.previous_1_week),
      one_month_ago: Math.round(fg.previous_1_month),
      one_year_ago: Math.round(fg.previous_1_year),
      updated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[FearGreed] Error:', err);
    return null;
  }
}

export async function crawlMarketIndicators(): Promise<number> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.warn('[FRED] FRED_API_KEY not set, skipping FRED data');
  }

  const fredSeries: FredSeries[] = [];

  if (apiKey) {
    for (const config of FRED_SERIES_CONFIG) {
      const points = await fetchFredSeries(config.id, apiKey);
      if (points.length > 0) {
        fredSeries.push({
          series_id: config.id,
          label: config.label,
          unit: config.unit,
          latest_value: points[points.length - 1].value,
          latest_date: points[points.length - 1].date,
          data_points: points,
        });
      }
    }
  }

  const fearGreed = await fetchFearGreed();

  // Calculate yield spread (10Y - 2Y)
  const t10y = fredSeries.find(s => s.series_id === 'DGS10');
  const t2y = fredSeries.find(s => s.series_id === 'DGS2');
  const yieldSpread = (t10y && t2y)
    ? parseFloat((t10y.latest_value - t2y.latest_value).toFixed(2))
    : null;

  const indicators: MarketIndicators = {
    fred_series: fredSeries,
    fear_greed: fearGreed,
    yield_spread: yieldSpread,
    updated_at: new Date().toISOString(),
  };

  await saveMarketIndicators(indicators);
  return fredSeries.length + (fearGreed ? 1 : 0);
}

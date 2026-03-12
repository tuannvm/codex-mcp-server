import type { PredictionMarket } from '../config/competitors.js';
import { PREDICTION_KEYWORDS } from '../config/competitors.js';
import { addPredictionMarkets, logCrawl } from '../services/blobStore.js';

const POLYMARKET_API = 'https://gamma-api.polymarket.com/events';

function makeId(): string {
  return `pred-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function categorizeMarket(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('federal reserve') || q.includes('fed ') || q.includes('fomc')) return 'Federal Reserve';
  if (q.includes('interest rate') || q.includes('rate cut') || q.includes('rate hike')) return 'Interest Rates';
  if (q.includes('inflation') || q.includes('cpi')) return 'Inflation';
  if (q.includes('oil') || q.includes('energy') || q.includes('crude')) return 'Energy';
  if (q.includes('gdp') || q.includes('recession')) return 'GDP/Growth';
  if (q.includes('unemployment') || q.includes('jobs') || q.includes('payroll')) return 'Employment';
  if (q.includes('sec') || q.includes('regulation')) return 'Regulation';
  if (q.includes('tariff') || q.includes('trade')) return 'Trade';
  return 'Other';
}

export async function crawlPredictionMarkets(): Promise<number> {
  console.log(`[${new Date().toISOString()}] Starting prediction markets crawl...`);

  const markets: PredictionMarket[] = [];

  for (const keyword of PREDICTION_KEYWORDS) {
    try {
      const url = `${POLYMARKET_API}?tag=${encodeURIComponent(keyword)}&closed=false&limit=10`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;

      const events = await res.json();
      for (const event of (Array.isArray(events) ? events : [])) {
        const eventMarkets = event.markets || [event];
        for (const market of eventMarkets) {
          const question = market.question || event.title || '';
          if (!question) continue;

          let probability = 0;
          if (market.outcomePrices) {
            try {
              const prices = JSON.parse(market.outcomePrices);
              probability = parseFloat(prices[0] || '0') * 100;
            } catch {
              probability = parseFloat(market.outcomePrices[0] || '0') * 100;
            }
          } else if (market.bestBid) {
            probability = parseFloat(market.bestBid) * 100;
          }

          markets.push({
            id: makeId(),
            question,
            probability: Math.round(probability * 10) / 10,
            volume: parseFloat(market.volume || market.volumeNum || '0'),
            end_date: market.endDate || event.endDate || '',
            source: 'polymarket',
            category: categorizeMarket(question),
            url: `https://polymarket.com/event/${event.slug || event.id || ''}`,
            last_updated: new Date().toISOString(),
          });
        }
      }

      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`Error fetching Polymarket for "${keyword}":`, err);
    }
  }

  const newCount = await addPredictionMarkets(markets);

  await logCrawl({
    crawl_type: 'predictions',
    entity_id: null,
    articles_found: newCount,
    status: 'success',
    error_message: null,
    finished_at: new Date().toISOString(),
  });

  console.log(`[${new Date().toISOString()}] Prediction markets crawl complete. ${newCount} new/updated.`);
  return newCount;
}

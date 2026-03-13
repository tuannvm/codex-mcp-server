import type { Config } from '@netlify/functions';
import { crawl13FBatch, ENTITIES_WITH_CIK } from '../../src/crawlers/holdings13fCrawler.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

const BATCH_SIZE = 5;

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();

  const url = new URL(req.url);
  const batchParam = url.searchParams.get('batch');
  const totalEntities = ENTITIES_WITH_CIK.length;
  const totalBatches = Math.ceil(totalEntities / BATCH_SIZE);

  try {
    if (batchParam !== null) {
      // Process a single batch
      const batch = parseInt(batchParam) || 0;
      const start = batch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, totalEntities);
      const entities = ENTITIES_WITH_CIK.slice(start, end);

      const count = await crawl13FBatch(entities);
      return new Response(JSON.stringify({
        success: true,
        filings: count,
        batch,
        totalBatches,
        entitiesProcessed: entities.map(e => e.name),
        done: batch >= totalBatches - 1,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // No batch param — return batch info so the frontend can orchestrate
    return new Response(JSON.stringify({
      success: true,
      totalEntities,
      totalBatches,
      batchSize: BATCH_SIZE,
      message: 'Call with ?batch=0, ?batch=1, etc. to crawl in batches',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/13f/crawl', method: 'POST' };

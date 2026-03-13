import type { Context } from '@netlify/functions';
import { verifyAuth } from '../../src/services/auth.js';
import { getTrendSnapshots } from '../../src/services/blobStore.js';
import { captureSnapshot } from '../../src/crawlers/trendTracker.js';

export default async (req: Request, context: Context) => {
  const authError = verifyAuth(req);
  if (authError) return authError;

  if (req.method === 'POST') {
    const count = await captureSnapshot();
    return Response.json({ snapshots: count });
  }

  const url = new URL(req.url);
  const snapshots = await getTrendSnapshots({
    metricType: url.searchParams.get('metric') || undefined,
    entityId: url.searchParams.get('entity') || undefined,
    startDate: url.searchParams.get('start') || undefined,
    endDate: url.searchParams.get('end') || undefined,
  });

  return Response.json(snapshots);
};

export const config = { path: '/api/trends' };

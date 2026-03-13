import type { Context } from '@netlify/functions';
import { verifyAuth } from '../../src/services/auth.js';
import { getJobPostings, getJobTrends } from '../../src/services/blobStore.js';

export default async (req: Request, context: Context) => {
  const authError = verifyAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const view = url.searchParams.get('view');

  if (view === 'trends') {
    const trends = await getJobTrends();
    return Response.json(trends);
  }

  const entityId = url.searchParams.get('entity') || undefined;
  const postings = await getJobPostings(entityId);
  return Response.json(postings);
};

export const config = { path: '/api/jobs' };

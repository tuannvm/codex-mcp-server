import type { Config } from '@netlify/functions';
import { getSentimentData } from '../../src/services/blobStore.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const data = await getSentimentData();
  return new Response(JSON.stringify(data || { composite_score: 0, composite_label: 'Neutral', topics: [], updated_at: null }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/sentiment' };

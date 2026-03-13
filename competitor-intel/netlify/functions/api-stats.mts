import type { Config } from '@netlify/functions';
import { getArticleStats } from '../../src/services/blobStore.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const stats = await getArticleStats();
  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/stats' };

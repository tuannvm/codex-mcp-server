import type { Config } from '@netlify/functions';
import { getArticleStats } from '../../src/services/blobStore.js';

export default async () => {
  const stats = await getArticleStats();
  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/stats' };

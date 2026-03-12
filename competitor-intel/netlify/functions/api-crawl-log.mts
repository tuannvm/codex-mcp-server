import type { Config } from '@netlify/functions';
import { getCrawlLog } from '../../src/services/blobStore.js';

export default async () => {
  const logs = await getCrawlLog();
  return new Response(JSON.stringify(logs), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/crawl-log' };

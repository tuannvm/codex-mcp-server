import type { Config } from '@netlify/functions';
import { getCrawlLog } from '../../src/services/blobStore.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const logs = await getCrawlLog();
  return new Response(JSON.stringify(logs), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/crawl-log' };

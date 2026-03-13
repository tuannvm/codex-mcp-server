import type { Config } from '@netlify/functions';
import { getSecFilings } from '../../src/services/blobStore.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const url = new URL(req.url);
  const entityName = url.searchParams.get('entity') || undefined;
  const filingType = url.searchParams.get('type') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const filings = await getSecFilings({ entityName, filingType, limit, offset });
  return new Response(JSON.stringify(filings), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/sec' };

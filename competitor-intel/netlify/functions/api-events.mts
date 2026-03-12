import type { Config } from '@netlify/functions';
import { getGovEvents } from '../../src/services/blobStore.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const url = new URL(req.url);
  const startDate = url.searchParams.get('start') || undefined;
  const endDate = url.searchParams.get('end') || undefined;
  const category = url.searchParams.get('category') || undefined;

  const events = await getGovEvents({ startDate, endDate, category });

  return new Response(JSON.stringify(events), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/events' };

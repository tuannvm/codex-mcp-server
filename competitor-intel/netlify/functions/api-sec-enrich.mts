import type { Config } from '@netlify/functions';
import { enrichFilingKeywords } from '../../src/crawlers/secScanner.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  try {
    const enriched = await enrichFilingKeywords();
    return new Response(JSON.stringify({ success: true, enriched }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/sec/enrich', method: 'POST' };

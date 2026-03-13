import type { Config } from '@netlify/functions';
import { discoverCompetitors } from '../../src/crawlers/discoverer.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const headers = { 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const suggestions = await discoverCompetitors();
    return new Response(JSON.stringify({ suggestions, count: suggestions.length }), { headers });
  } catch (err: any) {
    console.error('[API] Discovery error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config: Config = { path: '/api/entities/discover' };

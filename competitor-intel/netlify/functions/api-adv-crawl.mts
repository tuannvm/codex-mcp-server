import type { Context } from '@netlify/functions';
import { verifyAuth } from '../../src/services/auth.js';
import { analyzeAdv } from '../../src/crawlers/advAnalyzer.js';

export default async (req: Request, context: Context) => {
  const authError = verifyAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const entityId = url.searchParams.get('entity') || undefined;
  const analyzed = await analyzeAdv(entityId);
  return Response.json({ analyzed });
};

export const config = { path: '/api/adv/crawl' };

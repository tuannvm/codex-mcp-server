import type { Context } from '@netlify/functions';
import { verifyAuth } from '../../src/services/auth.js';
import { crawlPersonnel } from '../../src/crawlers/personnelCrawler.js';

export default async (req: Request, context: Context) => {
  const authError = verifyAuth(req);
  if (authError) return authError;

  const found = await crawlPersonnel();
  return Response.json({ found });
};

export const config = { path: '/api/personnel/crawl' };

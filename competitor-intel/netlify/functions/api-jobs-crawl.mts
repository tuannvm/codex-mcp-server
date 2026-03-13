import type { Context } from '@netlify/functions';
import { verifyAuth } from '../../src/services/auth.js';
import { crawlJobs } from '../../src/crawlers/jobCrawler.js';

export default async (req: Request, context: Context) => {
  const authError = verifyAuth(req);
  if (authError) return authError;

  const found = await crawlJobs();
  return Response.json({ found });
};

export const config = { path: '/api/jobs/crawl' };

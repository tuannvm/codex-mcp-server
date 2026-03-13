import type { Config } from '@netlify/functions';
import { crawlGovEvents } from '../../src/crawlers/govCalendar.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  try {
    const newEvents = await crawlGovEvents();
    return new Response(JSON.stringify({ success: true, newEvents }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  path: '/api/crawl/gov',
  method: 'POST',
};

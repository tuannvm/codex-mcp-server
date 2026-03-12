import type { Config } from '@netlify/functions';
import { crawlGovEvents } from '../../src/crawlers/govCalendar.js';

export default async () => {
  console.log('[SCHEDULED] Running government calendar crawl...');
  const newEvents = await crawlGovEvents();
  console.log(`[SCHEDULED] Gov calendar complete. ${newEvents} new events.`);
};

export const config: Config = {
  schedule: '0 6 * * *', // Daily at 6 AM UTC
};

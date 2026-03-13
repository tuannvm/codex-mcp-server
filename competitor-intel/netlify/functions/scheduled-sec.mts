import type { Config } from '@netlify/functions';
import { scanSec } from '../../src/crawlers/secScanner.js';

export default async () => {
  console.log('[SCHEDULED] Running SEC scan...');
  const newFilings = await scanSec();
  console.log(`[SCHEDULED] SEC scan complete. ${newFilings} new filings.`);
};

export const config: Config = {
  schedule: '0 8 * * *', // Daily at 8 AM UTC
};

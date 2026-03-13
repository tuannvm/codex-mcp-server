import type { Config } from '@netlify/functions';
import { captureSnapshot } from '../../src/crawlers/trendTracker.js';

export default async () => {
  console.log('[SCHEDULED] Capturing trend snapshots...');
  const count = await captureSnapshot();
  console.log(`[SCHEDULED] Captured ${count} trend snapshots.`);
};

export const config: Config = {
  schedule: '0 6 * * *', // Daily at 6 AM UTC
};

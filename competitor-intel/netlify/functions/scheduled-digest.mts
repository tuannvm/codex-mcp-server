import type { Config } from '@netlify/functions';
import { getLatestBrief } from '../../src/services/blobStore.js';
import { sendDailyDigest } from '../../src/services/resendEmail.js';

export default async () => {
  console.log('[SCHEDULED] Sending daily email digest...');
  const brief = await getLatestBrief();
  if (!brief) {
    console.log('[SCHEDULED] No brief available, skipping digest.');
    return;
  }
  const result = await sendDailyDigest(brief);
  console.log('[SCHEDULED] Daily digest sent:', result);
};

export const config: Config = {
  schedule: '0 12 * * 1-5', // Weekdays at 12 PM UTC (7 AM ET)
};

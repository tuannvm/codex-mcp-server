import type { Config } from '@netlify/functions';
import { checkAndAlertNegativeArticles } from '../../src/services/emailAlert.js';

export default async () => {
  console.log('[SCHEDULED] Checking for negative articles...');
  const result = await checkAndAlertNegativeArticles();
  console.log('[SCHEDULED] Alert check result:', result);
};

export const config: Config = {
  schedule: '*/30 * * * *', // Every 30 minutes
};

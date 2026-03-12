import type { Config } from '@netlify/functions';
import { saveBrief } from '../../src/services/blobStore.js';
import { generateBrief } from '../../src/services/briefGenerator.js';

export default async () => {
  console.log('[SCHEDULED] Generating daily intelligence brief...');

  try {
    const brief = await generateBrief();
    await saveBrief(brief);
    console.log(`[SCHEDULED] Brief generated: ${brief.market_sentiment.total_articles} articles, ${brief.top_stories.length} top stories, ${brief.risk_alerts.length} risk alerts`);
  } catch (err: any) {
    console.error('[SCHEDULED] Brief generation failed:', err.message);
  }
};

export const config: Config = {
  schedule: '0 7 * * *', // Daily at 7 AM UTC
};

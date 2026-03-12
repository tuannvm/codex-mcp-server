import type { Config } from '@netlify/functions';
import { crawlAll, crawlSingle } from '../../src/crawlers/newsCrawler.js';
import { checkAndAlertNegativeArticles } from '../../src/services/emailAlert.js';

export default async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { entityId } = body as { entityId?: string };

    let newArticles: number;
    if (entityId) {
      newArticles = await crawlSingle(entityId);
    } else {
      newArticles = await crawlAll();
    }

    const alertResult = await checkAndAlertNegativeArticles();

    return new Response(JSON.stringify({
      success: true,
      newArticles,
      alert: alertResult,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = {
  path: '/api/crawl',
  method: 'POST',
};

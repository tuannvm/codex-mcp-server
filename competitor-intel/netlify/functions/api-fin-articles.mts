import type { Config } from '@netlify/functions';
import { getFinArticles } from '../../src/services/blobStore.js';

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const source = url.searchParams.get('source') || undefined;
    const sentiment = url.searchParams.get('sentiment') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const articles = await getFinArticles({ source, sentiment, search, limit, offset });

    return new Response(JSON.stringify(articles), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/fin-articles' };

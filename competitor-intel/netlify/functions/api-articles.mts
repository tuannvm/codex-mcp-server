import type { Config } from '@netlify/functions';
import { getAllArticles } from '../../src/services/blobStore.js';

export default async (req: Request) => {
  const url = new URL(req.url);
  const entity = url.searchParams.get('entity') || undefined;
  const sentiment = url.searchParams.get('sentiment') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const articles = await getAllArticles({ entityId: entity, sentiment, search, limit, offset });

  return new Response(JSON.stringify(articles), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/articles' };

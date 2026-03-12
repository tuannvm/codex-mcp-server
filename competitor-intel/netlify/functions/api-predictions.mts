import type { Config } from '@netlify/functions';
import { getPredictionMarkets } from '../../src/services/blobStore.js';

export default async (req: Request) => {
  const url = new URL(req.url);
  const category = url.searchParams.get('category') || undefined;
  const markets = await getPredictionMarkets({ category });
  return new Response(JSON.stringify(markets), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/predictions' };

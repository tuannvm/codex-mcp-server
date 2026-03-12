import type { Config } from '@netlify/functions';
import { scanSec } from '../../src/crawlers/secScanner.js';

export default async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { query } = body as { query?: string };
    const newFilings = await scanSec(query || undefined);
    return new Response(JSON.stringify({ success: true, newFilings }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/sec/scan', method: 'POST' };

import type { Config } from '@netlify/functions';
import { getAumData, seedAumIfEmpty, upsertAumEntry } from '../../src/services/blobStore.js';

export default async (req: Request) => {
  if (req.method === 'POST') {
    try {
      const entry = await req.json();
      await upsertAumEntry(entry);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // GET
  await seedAumIfEmpty();
  const data = await getAumData();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/aum' };

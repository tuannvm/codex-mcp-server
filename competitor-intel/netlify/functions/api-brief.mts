import type { Config } from '@netlify/functions';
import { getLatestBrief, saveBrief } from '../../src/services/blobStore.js';
import { generateBrief } from '../../src/services/briefGenerator.js';

export default async (req: Request) => {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'GET') {
    const brief = await getLatestBrief();
    if (!brief) {
      return new Response(JSON.stringify({ error: 'No brief generated yet' }), { status: 404, headers });
    }
    return new Response(JSON.stringify(brief), { headers });
  }

  if (req.method === 'POST') {
    try {
      const brief = await generateBrief();
      await saveBrief(brief);
      return new Response(JSON.stringify(brief), { headers });
    } catch (err: any) {
      console.error('[API] Brief generation error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};

export const config: Config = { path: '/api/brief' };

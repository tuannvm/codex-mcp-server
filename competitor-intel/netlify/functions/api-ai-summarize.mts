import type { Context } from '@netlify/functions';
import { verifyAuth } from '../../src/services/auth.js';
import { summarizeFiling } from '../../src/services/aiSummarizer.js';
import { getSecFilings, getFilingSummaries, getFilingSummary } from '../../src/services/blobStore.js';

export default async (req: Request, context: Context) => {
  const authError = verifyAuth(req);
  if (authError) return authError;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const filingId = url.searchParams.get('filing_id');
    if (filingId) {
      const summary = await getFilingSummary(filingId);
      return Response.json(summary);
    }
    const summaries = await getFilingSummaries();
    return Response.json(summaries);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const filingId = body.filing_id;
    if (!filingId) return Response.json({ error: 'filing_id required' }, { status: 400 });

    const filings = await getSecFilings({ limit: 1000 });
    const filing = filings.find(f => f.id === filingId);
    if (!filing) return Response.json({ error: 'Filing not found' }, { status: 404 });

    const summary = await summarizeFiling(filing);
    if (!summary) return Response.json({ error: 'Summarization failed' }, { status: 500 });

    return Response.json(summary);
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
};

export const config = { path: '/api/ai/summarize' };

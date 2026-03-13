import type { Context } from '@netlify/functions';
import { verifyAuth } from '../../src/services/auth.js';
import { getMandateEvents, addMandateEvent } from '../../src/services/blobStore.js';

export default async (req: Request, context: Context) => {
  const authError = verifyAuth(req);
  if (authError) return authError;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const events = await getMandateEvents({
      entityId: url.searchParams.get('entity') || undefined,
      eventType: url.searchParams.get('type') || undefined,
    });
    return Response.json(events);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    if (!body.entity_id || !body.event_type || !body.client_name) {
      return Response.json({ error: 'entity_id, event_type, and client_name required' }, { status: 400 });
    }

    const event = {
      id: `man-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      entity_id: body.entity_id,
      entity_name: body.entity_name || body.entity_id,
      client_name: body.client_name,
      client_type: body.client_type || 'other',
      event_type: body.event_type,
      mandate_size_billions: body.mandate_size_billions || undefined,
      asset_class: body.asset_class || undefined,
      source: body.source || 'Manual entry',
      source_url: body.source_url || '',
      date: body.date || new Date().toISOString().split('T')[0],
      notes: body.notes || '',
      created_at: new Date().toISOString(),
    };

    await addMandateEvent(event);
    return Response.json({ success: true, event });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
};

export const config = { path: '/api/mandates' };

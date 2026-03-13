import type { Config } from '@netlify/functions';
import type { CustomEntity } from '../../src/config/competitors.js';
import { getCustomEntities, addCustomEntity, removeCustomEntity } from '../../src/services/blobStore.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'GET') {
    const custom = await getCustomEntities();
    return new Response(JSON.stringify(custom), { headers });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const { name, website } = body as { name?: string; website?: string };
    if (!name) {
      return new Response(JSON.stringify({ error: 'name is required' }), { status: 400, headers });
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const entity: CustomEntity = {
      id,
      name,
      tier: 2,
      searchQueries: [`"${name}"`],
      website: website || '',
      custom: true,
      added_at: new Date().toISOString(),
    };

    await addCustomEntity(entity);
    return new Response(JSON.stringify(entity), { status: 201, headers });
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'id query param is required' }), { status: 400, headers });
    }
    const removed = await removeCustomEntity(id);
    if (!removed) {
      return new Response(JSON.stringify({ error: 'Entity not found' }), { status: 404, headers });
    }
    return new Response(JSON.stringify({ removed: id }), { headers });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};

export const config: Config = { path: '/api/entities/custom' };

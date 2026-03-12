import type { Config } from '@netlify/functions';
import { SELF, COMPETITORS, ALL_ENTITIES } from '../../src/config/competitors.js';
import { getCustomEntities } from '../../src/services/blobStore.js';

export default async () => {
  const custom = await getCustomEntities();
  return new Response(JSON.stringify({
    self: SELF,
    competitors: [...COMPETITORS, ...custom],
    all: [...ALL_ENTITIES, ...custom],
    custom,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/entities' };

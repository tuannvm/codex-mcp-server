import type { Config } from '@netlify/functions';
import { SELF, COMPETITORS, ALL_ENTITIES } from '../../src/config/competitors.js';

export default async () => {
  return new Response(JSON.stringify({
    self: SELF,
    competitors: COMPETITORS,
    all: ALL_ENTITIES,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/entities' };

import type { Config } from '@netlify/functions';
import { getFinraAlerts } from '../../src/services/blobStore.js';
import { verifyAuth, unauthorizedResponse } from '../../src/services/auth.js';

export default async (req: Request) => {
  if (!(await verifyAuth(req))) return unauthorizedResponse();
  const alerts = await getFinraAlerts();
  return new Response(JSON.stringify(alerts), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { path: '/api/finra' };

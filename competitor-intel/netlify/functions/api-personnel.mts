import type { Context } from '@netlify/functions';
import { verifyAuth } from '../../src/services/auth.js';
import { getPersonnelChanges } from '../../src/services/blobStore.js';

export default async (req: Request, context: Context) => {
  const authError = verifyAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const changes = await getPersonnelChanges({
    entityId: url.searchParams.get('entity') || undefined,
    changeType: url.searchParams.get('type') || undefined,
  });

  return Response.json(changes);
};

export const config = { path: '/api/personnel' };

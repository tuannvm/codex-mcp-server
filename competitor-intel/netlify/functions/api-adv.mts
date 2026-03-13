import type { Context } from '@netlify/functions';
import { verifyAuth } from '../../src/services/auth.js';
import { getAdvAnalyses } from '../../src/services/blobStore.js';

export default async (req: Request, context: Context) => {
  const authError = verifyAuth(req);
  if (authError) return authError;

  const analyses = await getAdvAnalyses();
  return Response.json(analyses);
};

export const config = { path: '/api/adv' };

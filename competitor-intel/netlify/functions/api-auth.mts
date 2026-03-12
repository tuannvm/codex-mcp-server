import type { Config } from '@netlify/functions';
import { createToken } from '../../src/services/auth.js';

export default async (req: Request) => {
  try {
    const { password } = await req.json().catch(() => ({ password: '' }));
    const expected = process.env.DASHBOARD_PASSWORD;

    if (!expected) {
      return new Response(JSON.stringify({ error: 'DASHBOARD_PASSWORD not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (password !== expected) {
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = await createToken();
    return new Response(JSON.stringify({ token }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/auth', method: 'POST' };

import type { Config } from '@netlify/functions';
import { createToken } from '../../src/services/auth.js';

export default async (req: Request) => {
  try {
    const { username, password } = await req.json().catch(() => ({ username: '', password: '' }));
    const expectedPassword = process.env.DASHBOARD_PASSWORD;
    const expectedUsername = process.env.DASHBOARD_USERNAME;

    if (!expectedPassword) {
      return new Response(JSON.stringify({ error: 'DASHBOARD_PASSWORD not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if ((expectedUsername && username !== expectedUsername) || password !== expectedPassword) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
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

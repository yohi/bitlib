import { Context, Next } from 'hono';
import { Variables } from '../types';

export const authMiddleware = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const headerAuth = c.req.header('Authorization');
  if (headerAuth) {
    c.set('authHeader', headerAuth);
    await next();
    return;
  }

  const queryToken = c.req.query('token');
  const queryUser = c.req.query('user');

  if (queryToken) {
    if (queryUser) {
      // App Password: Basic <base64>
      const credentials = btoa(`${queryUser}:${queryToken}`);
      c.set('authHeader', `Basic ${credentials}`);
    } else {
      // OAuth Token: Bearer <token>
      c.set('authHeader', `Bearer ${queryToken}`);
    }
  } else {
    c.set('authHeader', null);
  }

  await next();
};

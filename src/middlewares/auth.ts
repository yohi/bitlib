import type { Context, Next } from "hono";
import type { Variables } from "../types";

export const authMiddleware = async (
  c: Context<{ Variables: Variables; Bindings: CloudflareBindings }>,
  next: Next,
) => {
  const headerAuth = c.req.header("Authorization");
  if (headerAuth) {
    c.set("authHeader", headerAuth);
    await next();
    return;
  }

  const allowQueryAuth = c.env.ALLOW_QUERY_AUTH === "true";
  const queryToken = c.req.query("token");
  const queryUser = c.req.query("user");

  if (queryToken) {
    if (allowQueryAuth) {
      console.warn(
        "Warning: Authentication via query parameters is deprecated and insecure. Please use the Authorization header.",
      );
      if (queryUser) {
        // App Password: Basic <base64>
        const credentials = btoa(`${queryUser}:${queryToken}`);
        c.set("authHeader", `Basic ${credentials}`);
      } else {
        // OAuth Token: Bearer <token>
        c.set("authHeader", `Bearer ${queryToken}`);
      }
    } else {
      // Query auth is disabled, ignore the token
      c.set("authHeader", null);
    }
  } else {
    c.set("authHeader", null);
  }

  await next();
};

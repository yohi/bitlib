import type { Context, Next } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../src/middlewares/auth";

describe("authMiddleware", () => {
  let c: Context<any>;
  let next: Next;

  beforeEach(() => {
    c = {
      req: {
        header: vi.fn(),
        query: vi.fn(),
      },
      set: vi.fn(),
      env: {},
    } as unknown as Context<any>;
    next = vi.fn();
    // Spy on console.warn
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets authHeader from Authorization header", async () => {
    (c.req.header as any).mockReturnValue("Bearer existing-token");

    await authMiddleware(c, next);

    expect(c.set).toHaveBeenCalledWith("authHeader", "Bearer existing-token");
    expect(next).toHaveBeenCalled();
  });

  it("sets authHeader from query token (Bearer)", async () => {
    (c.req.header as any).mockReturnValue(undefined);
    (c.req.query as any).mockImplementation((key: string) => {
      if (key === "token") return "query-token";
      return undefined;
    });
    // c.env is irrelevant now

    await authMiddleware(c, next);

    expect(c.set).toHaveBeenCalledWith("authHeader", "Bearer query-token");
    expect(console.warn).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("sets authHeader from query token and user (Basic)", async () => {
    (c.req.header as any).mockReturnValue(undefined);
    (c.req.query as any).mockImplementation((key: string) => {
      if (key === "token") return "query-token";
      if (key === "user") return "query-user";
      return undefined;
    });

    const expectedCredentials = btoa("query-user:query-token");
    await authMiddleware(c, next);

    expect(c.set).toHaveBeenCalledWith("authHeader", `Basic ${expectedCredentials}`);
    expect(console.warn).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("sets authHeader to null when no auth is provided", async () => {
    (c.req.header as any).mockReturnValue(undefined);
    (c.req.query as any).mockReturnValue(undefined);

    await authMiddleware(c, next);

    expect(c.set).toHaveBeenCalledWith("authHeader", null);
    expect(next).toHaveBeenCalled();
  });
});

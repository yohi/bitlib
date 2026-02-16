import type { Context, Next } from "hono";
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../src/middlewares/auth";

describe("authMiddleware", () => {
  let c: {
    req: {
      header: Mock;
      query: Mock;
    };
    set: Mock;
    env: Record<string, string | undefined>;
  };
  let next: Next;

  beforeEach(() => {
    c = {
      req: {
        header: vi.fn(),
        query: vi.fn(),
      },
      set: vi.fn(),
      env: {
        ALLOW_QUERY_AUTH: "true",
      },
    };
    next = vi.fn();
    // Spy on console.warn
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets authHeader from Authorization header", async () => {
    c.req.header.mockReturnValue("Bearer existing-token");

    await authMiddleware(c as unknown as Context, next);

    expect(c.set).toHaveBeenCalledWith("authHeader", "Bearer existing-token");
    expect(next).toHaveBeenCalled();
  });

  it("sets authHeader from query token (Bearer)", async () => {
    c.req.header.mockReturnValue(undefined);
    c.req.query.mockImplementation((key: string) => {
      if (key === "token") return "query-token";
      return undefined;
    });
    // c.env is irrelevant now

    await authMiddleware(c as unknown as Context, next);

    expect(c.set).toHaveBeenCalledWith("authHeader", "Bearer query-token");
    expect(console.warn).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("sets authHeader from query token and user (Basic)", async () => {
    c.req.header.mockReturnValue(undefined);
    c.req.query.mockImplementation((key: string) => {
      if (key === "token") return "query-token";
      if (key === "user") return "query-user";
      return undefined;
    });

    const expectedCredentials = btoa("query-user:query-token");
    await authMiddleware(c as unknown as Context, next);

    expect(c.set).toHaveBeenCalledWith("authHeader", `Basic ${expectedCredentials}`);
    expect(console.warn).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("ignores query token when ALLOW_QUERY_AUTH is not set", async () => {
    c.req.header.mockReturnValue(undefined);
    c.req.query.mockReturnValue("query-token");
    c.env.ALLOW_QUERY_AUTH = undefined;

    await authMiddleware(c as unknown as Context, next);

    expect(c.set).toHaveBeenCalledWith("authHeader", null);
    expect(next).toHaveBeenCalled();
  });

  it("sets authHeader to null when no auth is provided", async () => {
    c.req.header.mockReturnValue(undefined);
    c.req.query.mockReturnValue(undefined);

    await authMiddleware(c as unknown as Context, next);

    expect(c.set).toHaveBeenCalledWith("authHeader", null);
    expect(next).toHaveBeenCalled();
  });
});

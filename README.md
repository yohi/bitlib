# bitlib

A serverless proxy for Bitbucket Cloud API v2.

## Authentication

Authentication is handled via the `Authorization` header. This is the recommended and secure method.

### Supported Methods

1.  **OAuth Token:**
    Use `Bearer <token>` in the `Authorization` header.
    ```
    Authorization: Bearer <your-oauth-token>
    ```

2.  **App Password:**
    Use `Basic <base64(user:password)>` in the `Authorization` header.
    ```
    Authorization: Basic <base64-encoded-credentials>
    ```

### Deprecated: Query Parameters

Authentication via query parameters (`?token=` and `?user=`) is deprecated and disabled by default to prevent credential leakage in logs and URLs.

To enable this method (not recommended), set the `ALLOW_QUERY_AUTH` environment variable to `"true"` in your `wrangler.toml` or Cloudflare dashboard.

When enabled:
- `?token=<token>` maps to `Bearer <token>`.
- `?token=<token>&user=<user>` maps to `Basic <base64(user:token)>`.

A warning will be logged when this method is used.

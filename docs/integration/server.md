# Server integration

This page documents the reference Hono server and the server-side work an application must perform. The current API surface is detailed in [HTTP API reference](../api/http.md).

## Required server configuration

Construct the reference application with exact expected origin and network:

```ts
import { createApp } from "./app.js";

const app = createApp({
  domain: "https://community.example",
  network: "testnet",
  challengeTtlMs: 5 * 60_000,
  sessionTtlMs: 8 * 60 * 60_000,
  cookieSecure: true,
});
```

`domain` is the origin (scheme, host, optional port), not a URL path. It must match the origin the wallet binds into the statement. The runnable server reads corresponding values from environment variables; see [configuration](../getting-started/configuration.md).

## Integration sequence

1. Browser obtains `/auth/challenge` with credentials enabled and keeps the pre-auth cookie.
2. Browser passes the response to `bdx.connectWithProof({ challenge })`.
3. Browser posts the returned proof unchanged to `/auth/verify`, with cookies enabled.
4. Server parses the exact statement, compares object fields, validates configured domain/network/address prefix and time, verifies SigV1, then consumes the stored challenge tuple.
5. Server issues opaque HttpOnly session cookie only after successful consume.
6. Protected app routes call server session middleware/logic. The POC exposes `/api/me` as the example.

Do not treat the SDK's `proof.serverIssued` Boolean as trust evidence; it is client data. The server uses its own challenge store and the signed nonce/request ID/context tuple.

## Adapting to another server

Use the verifier as a synchronous function over `{ address, message, signature }`. Keep policy checks in the server boundary and keep persistence behind a store interface. The included memory stores are examples only: use an atomic durable primitive before deploying multiple workers/instances. Do not reuse the reference's process-random HMAC context key across restarts; define key rotation/persistence when designing a production context-token mechanism.

The current repository does not ship framework middleware, a generic `createSigil()` factory, a distributable core package, or a durable nonce store. This guide describes the POC integration, not an already published library API.

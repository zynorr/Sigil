# HTTP API reference

The reference server listens on `127.0.0.1:8787` by default. During browser development, Vite proxies these paths from `http://localhost:5173`.

All browser endpoints require an `Origin` header exactly equal to configured `APP_ORIGIN`; missing or mismatching Origin is rejected. The server does not configure cross-origin CORS.

## `GET /health`

Returns `{ "ok": true, "network": "testnet" }` (or configured network). No authentication required.

## `GET /auth/challenge`

Expired challenge entries are pruned before new issuance. The in-memory challenge store has a fixed 10,000-pending-entry capacity; when it remains full after pruning, the endpoint returns `503` with `CHALLENGE_CAPACITY`.

Requires the exact configured `Origin`. Missing or mismatching Origin returns `403`. Creates a fresh server-side challenge and `HttpOnly` pre-auth context cookie.

Response `200`:

```json
{
  "nonce": "<random base64url>",
  "requestId": "<32 hex chars>",
  "expiresInMs": 300000
}
```

The cookie must be retained and sent to `/auth/verify`. It contains a random context ID and HMAC, is `HttpOnly`, `SameSite=Lax`, path `/`, and uses the configured `Secure` flag. The pre-auth cookie remains until its short Max-Age so the demo can retry the exact proof and show `NONCE_INVALID_OR_USED`; the challenge record is consumed and removed on success, so the cookie alone is not sufficient to authenticate. The separate session cookie remains valid until expiry or logout. The HMAC key is generated at process startup, so restart invalidates outstanding challenge contexts.

## `POST /auth/verify`

Requires exact configured `Origin`, the pre-auth cookie, JSON body <= 16 KiB, and this SDK proof shape:

```json
{
  "message": "beldex-auth-v1 ...",
  "signature": "SigV1...",
  "address": "...",
  "domain": "http://localhost:5173",
  "uri": "http://localhost:5173/",
  "network": "testnet",
  "nonce": "...",
  "issuedAt": 1780000000000,
  "expirationTime": 1780000300000,
  "requestId": "...",
  "serverIssued": true
}
```

Response `200`: `{ "ok": true, "address": "...", "network": "testnet" }`, plus an opaque `HttpOnly` session cookie. `serverIssued` in the request is SDK metadata only: the server does not trust it, instead checking nonce/request ID against its own store and context cookie.

Common verification errors: `ORIGIN_REJECTED`, `CHALLENGE_CONTEXT_MISSING`, `INVALID_PROOF`, `PROOF_TOO_LARGE`, `MALFORMED_STATEMENT`, `ADDRESS_MISMATCH`, `DOMAIN_MISMATCH`, `NETWORK_MISMATCH`, `ADDRESS_NETWORK_MISMATCH`, `NONCE_MISMATCH`, `PROOF_FIELDS_MISMATCH`, `INVALID_TIMESTAMP`, `INVALID_SIGNATURE`, `NONCE_INVALID_OR_USED`. Challenge issuance can also return `503 CHALLENGE_CAPACITY`.

## `GET /api/me`

Requires a live session cookie. Returns `{ "address": "...", "network": "testnet", "expiresAt": 1780000300000 }`. Returns `401` with `UNAUTHENTICATED` or `SESSION_INVALID` when absent/invalid/expired.

## `POST /auth/logout`

Requires configured `Origin`. Revokes the presented session if any and clears its cookie. Returns `{ "ok": true }`.

## Cookie and storage behavior

Cookies use `HttpOnly`, `SameSite=Lax`, and path `/`; session expiry is set with `Max-Age`. `Secure` is controlled by `COOKIE_SECURE`. Sessions/challenges are held in process memory. Pending challenges are capped, but request-rate limiting is not implemented. The server has no database, distributed store, or CORS support. Mutating verify/logout endpoints require the configured Origin, but there is no separate CSRF token. Do not extend this POC to production without a security design and review.

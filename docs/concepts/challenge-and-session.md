# Challenge and session lifecycle

## Challenge lifecycle

1. Browser sends `GET /auth/challenge` with the exact configured `Origin` and accepts the `HttpOnly` pre-auth cookie.
2. Server creates a fresh random context ID, signs it with a process-local HMAC key, generates a 24-byte random nonce and a random request ID, and stores their context/expiry binding.
3. Server returns `{ nonce, requestId, expiresInMs }`. The page passes these to `connectWithProof`.
4. The wallet composes and signs the statement. The SDK returns a `ConnectProof` with the exact message plus parsed fields and `serverIssued` metadata.
5. Server rejects malformed/mismatched fields and invalid time/domain/network/address before cryptographic verification. It verifies the exact received message bytes, then synchronously consumes the nonce/request ID/context tuple. Invalid signatures do not consume the challenge.
6. Only the winner of the atomic consume receives a new opaque session cookie.

The in-memory `consume` operation is synchronous and single-use within one Node.js process. It is not a distributed atomic store and cannot be used with multiple server workers.

## Session lifecycle

The server creates a cryptographically random opaque token, stores its address/network/expiry in memory, and returns it as `HttpOnly`, `SameSite=Lax` cookie. `GET /api/me` looks up the cookie server-side. Expired sessions are deleted when read. `POST /auth/logout` revokes the token and clears the cookie.

There is no JWT, persistence, refresh token, or multi-instance session support. A server restart loses sessions. The HMAC context key is generated when `createApp` is called and is not persisted.

# Local quickstart

This runs the experimental POC from this repository. It is not a production deployment.

## Requirements

- Node.js 20 or newer and npm.
- A Chromium browser for extension-based proof testing.
- Beldex Wallet extension that supports `bdx_signAuthChallenge`, a testnet wallet, and user approval of the localhost origin for a live wallet run.

## Install and run

From the repository root:

```sh
npm ci
npm run dev:server
```

In another terminal, also from the repository root:

```sh
npm run dev:web
```

Open `http://localhost:5173`. Vite serves the app and proxies `/auth`, `/api`, and `/health` to the server on `127.0.0.1:8787`. The server expects the wallet proof's `domain` to be exactly `http://localhost:5173` and its network to be `testnet` by default.

Click **Connect wallet**, approve the origin in Beldex Wallet, and make sure the wallet reports Testnet. The UI requests a challenge, then requests `connectWithProof({ challenge })`, which includes a separate wallet sign-in approval. After submission, the UI checks `/api/me` before showing success.

If the wallet provider is not found, confirm the extension is enabled in this browser profile and reload the page. If the auth method is unsupported, use a wallet build with `bdx_signAuthChallenge`; Sigil does not silently fall back to generic `signMessage()`.

## Verify the app and run checks

```sh
curl http://127.0.0.1:8787/health
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

Expected health response: `{"ok":true,"network":"testnet"}`. Automated HTTP lifecycle tests inject a verifier fake; `tests/server-real-verifier.test.ts` uses a deterministic test-only key with the real verifier. Neither replaces a real wallet-generated proof.

## Limitations

The reference server uses in-memory challenge and session stores and is single-process. Restarting it invalidates outstanding challenges and sessions. It is not suitable for multi-instance or production use. Use HTTPS and secure cookies for any non-local deployment; the current local defaults set `COOKIE_SECURE=false`.

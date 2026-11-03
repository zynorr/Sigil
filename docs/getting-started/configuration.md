# Configuration reference

`apps/poc-server/src/index.ts` reads these variables at startup. `.env.example` lists the development defaults. The project does not load `.env` automatically; export variables in the shell or use an environment loader of your choice.

| Variable           | Default                 | Meaning                                                                                 |
| ------------------ | ----------------------- | --------------------------------------------------------------------------------------- |
| `HOST`             | `127.0.0.1`             | Node HTTP bind address.                                                                 |
| `PORT`             | `8787`                  | Hono server port.                                                                       |
| `APP_ORIGIN`       | `http://localhost:5173` | Exact expected wallet `domain` and allowed request origin.                              |
| `NETWORK`          | `testnet`               | `mainnet` only when the value is exactly `mainnet`; otherwise server selects `testnet`. |
| `COOKIE_SECURE`    | `false`                 | Secure cookie flag; set `true` when serving over HTTPS.                                 |
| `CHALLENGE_TTL_MS` | `300000`                | Server-recorded challenge lifetime.                                                     |
| `SESSION_TTL_MS`   | `28800000`              | Server-side session lifetime.                                                           |

The browser origin is fixed by Vite to localhost port 5173; server `APP_ORIGIN` must match it for this POC. On `GET /auth/challenge`, a mismatching Origin is rejected when present, but a missing Origin is allowed; verify/logout require the exact Origin.

These defaults are for local development only. The app uses a process-generated HMAC key for pre-auth cookies and in-memory stores; restarting the server invalidates all pre-auth challenges and sessions. Do not deploy this setup to production or multiple instances.

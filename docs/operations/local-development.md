# Local operations and troubleshooting

## Ports and origins

| Process                  | Default bind/URL        | Purpose                                   |
| ------------------------ | ----------------------- | ----------------------------------------- |
| Hono Node server         | `127.0.0.1:8787`        | Challenge, verify, session, health        |
| Vite                     | `127.0.0.1:5173`        | Browser reference app                     |
| Configured signed domain | `http://localhost:5173` | Must match wallet-signed statement domain |

The distinction between `localhost` and `127.0.0.1` matters: the browser origin and signed `domain` must exactly match `APP_ORIGIN`. The inspected extension manifest allows localhost and loopback, but check the installed wallet version. Vite proxies `/auth`, `/api`, and `/health` to the backend at `127.0.0.1:8787`.

## Troubleshooting

| Symptom                             | Checks                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet not detected                 | Enable the official extension in this browser profile, reload `localhost:5173`, and check browser extension permissions.                                |
| Origin request rejected             | Challenge, verify, and logout require an Origin exactly matching `APP_ORIGIN`. Do not mix localhost and 127.0.0.1.                                      |
| `bdx_signAuthChallenge` unsupported | Use a wallet build supporting the strong auth method. Sigil does not downgrade to generic `signMessage`.                                                |
| Wrong network                       | Switch wallet to testnet; reference server defaults to testnet.                                                                                         |
| Invalid signature                   | Preserve the exact proof `message`; do not serialize/rebuild it. Check address/signature come from the same proof.                                      |
| Challenge invalid/replay            | Request a fresh challenge. Nonce is single-use and bound to the latest pre-auth cookie/request ID.                                                      |
| Challenge endpoint returns 503      | The in-memory pending-challenge store reached its 10,000-entry capacity; wait for entries to expire or restart the local POC.                           |
| Replay security demo                | After successful sign-in, choose “Replay same proof”. The UI resubmits the in-memory proof using the same cookies and displays the server status/error. |
| Session disappears after restart    | Expected: the reference session store is in-memory. Restarting the server loses sessions.                                                               |
| Port already in use                 | Stop the previous `npm run dev:server` or Vite process, or change server `PORT` (Vite's current port is configured in `vite.config.ts`).                |
| Multiple login tabs interfere       | Each challenge creates a new pre-auth cookie; use one sign-in attempt/tab at a time in this POC.                                                        |

## Operational security notes

The local defaults use testnet, loopback, `COOKIE_SECURE=false`, process-local HMAC key, and memory stores. This is for local development only. No production deployment, persistent storage, multi-instance behavior, external security audit, or BNS service is implemented.

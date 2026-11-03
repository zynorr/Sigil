# Security model and threat analysis

## Security objectives

- Accept login only for a valid Beldex SigV1 signature over the exact wallet-composed statement.
- Bind proof to the configured relying-party origin, network, server-issued challenge, browser pre-auth context, and validity interval.
- Accept each challenge at most once within the reference server process.
- Create an authenticated session only after the above checks and successful challenge consumption.

## Assets

- Challenge nonce/request ID and browser pre-auth context.
- Session token and in-memory session record.
- Integrity of address, origin, network, and timestamps associated with a proof.
- User privacy and wallet address.

## Trust assumptions

- The official wallet implementation correctly derives the signed origin and protects the `beldex-auth-v1` prefix from generic message signing.
- The Beldex SigV1 cryptographic scheme and address encoding match the inspected upstream implementation.
- The browser and wallet extension are installed from trusted sources; a compromised wallet can lie.
- The server's configured `APP_ORIGIN` and `NETWORK` are correct.
- Local process memory and random/HMAC primitives are not compromised.

## Attacker capabilities considered

- Submit arbitrary or malformed proof JSON, alter fields/message/signature, guess or reuse nonce values, use a proof from another origin/network, race duplicate submissions, replay expired proofs, forge a pre-auth cookie, or reuse a revoked session.

## Implemented mitigations

| Threat                          | Current control                                                                                                                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forged/altered signature        | SigV1 verification over exact message bytes; invalid key and malformed signature checks.                                                                                                                                                                         |
| Generic sign-message forgery    | Wallet reserves auth prefix; server still validates signature and all fields.                                                                                                                                                                                    |
| Cross-origin proof              | Wallet-origin binding plus exact configured domain and required Origin checks on challenge/verify/logout.                                                                                                                                                        |
| Cross-network/account mismatch  | Statement network and address prefix checked; address must match proof field.                                                                                                                                                                                    |
| Unknown/replayed nonce          | Server issues nonce/request ID bound to an HMAC-authenticated pre-auth cookie; synchronous single-use consume after signature verification. Pre-auth cookie remains temporarily to demonstrate same-proof replay rejection; consumed challenge entry is removed. |
| Nonce race                      | Synchronous memory-store consume permits one winner in one Node isolate; deterministic integration test races proof submissions.                                                                                                                                 |
| Expired/future proof            | Expiry rejected at exact `exp`; future `iat` has bounded 30-second allowance; maximum proof lifetime one hour.                                                                                                                                                   |
| Session theft/fixation          | Opaque random server-managed cookie, HttpOnly, SameSite=Lax, expiry, logout revocation; random HMAC-bound pre-auth context.                                                                                                                                      |
| Oversized/malformed input       | Request body cap, strict statement parser, field and address/signature bounds.                                                                                                                                                                                   |
| Pending-challenge memory growth | Expired challenges are pruned on issuance; a hard 10,000-pending-entry cap returns 503 when full. This is a memory bound, not rate limiting.                                                                                                                     |

## Residual risks / unsupported guarantees

- Memory nonce/session stores are single-process and ephemeral; restart loses state, and multi-instance replay safety is absent.
- Challenge issuance has no per-IP/per-origin rate limiting; add appropriate edge controls before production use even with the pending-entry cap.
- HMAC key is generated per app process and not persisted; this is POC-only.
- The reference has no durable session backend, formal CSRF token system, rate limiting, or reverse-proxy trust policy.
- Tests use deterministic test-only keys and synthetic statements for integration. A CLI fixture is not a wallet-generated authentication proof.
- A user-provided UI result showed a successful testnet sign-in, but raw proof/HTTP trace/recording was not retained in this repository.
- A malicious/modified wallet can lie; Sigil does not defend against compromised wallet code.
- Address is disclosed and correlatable across services; no anonymity/unlinkability.
- No independent security audit has been completed.

Do not use this POC to protect production accounts/assets. See [privacy limits](privacy.md) and [upstream verifier notes](../research/SIGV1-VERIFIER-PORT.md).

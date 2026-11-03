# Privacy and security boundaries

## Intended properties

The authentication proof is an address-control proof. It does not require Sigil to request a balance or transaction history from the wallet. It must not request a seed phrase, private spend key, or view key. The wallet-auth method binds the statement to an origin and a server-issued challenge, subject to wallet/version behavior and server verification.

## Explicit limitations

- The proof reveals the Beldex account address to the relying application.
- Two services receiving the same address can correlate those sessions.
- Sigil does not currently provide per-site addresses, anonymous credentials, zero-knowledge proofs, or unlinkability.
- Do not claim subaddresses solve linkability: the reviewed extension docs say subaddresses are not supported by its current MyMonero-lineage core/LWS combination.
- BNS names may be more identifying than an address.
- Sigil does not prove holdings, balances, or token ownership.
- The authentication proof alone does not disclose balance/history, but that is not a claim that the address has no public or externally inferable activity.

## Required security design before implementation

Use a server-side verifier independent of browser assertions. Strictly parse exact signed bytes; check expected origin/network/address/time; bind a secure pre-auth context to a server-issued random nonce; atomically consume it exactly once; issue an opaque server-managed session only after successful verification; protect cookies and state-changing requests; avoid logging proof/session secrets.

The POC has a verifier port, strict parser, server-issued challenge, HMAC-authenticated server-generated pre-auth cookie, atomic single-process nonce consumption, opaque server session, protected `/api/me`, logout revocation, and configured Origin rejection. These are not production-audited. The HTTP lifecycle tests inject a fake verifier; separate deterministic integration tests exercise the real verifier with test-only signing material, but neither is a wallet-generated production proof. The SigV1 fixture tests exercise cryptographic verification. Memory stores and the context MAC key are per-process only. No security audit has occurred.

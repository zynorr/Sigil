# Testing and interoperability evidence

Run all project checks from the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run format:check
npm run docs:check
npm run build
```

## What the suites prove

- `tests/sigv1.test.ts` checks the verifier against a CLI-produced upstream fixture, malformed inputs, changed bytes, address checksums, and network prefixes.
- `tests/protocol.test.ts` checks strict parsing and malformed statement rejection.
- `tests/store.test.ts` checks single-process in-memory challenge/session behavior.
- `tests/server.test.ts` checks HTTP lifecycle, cookies, injected fake-verifier paths, logout, and replay behavior.
- `tests/server-real-verifier.test.ts` constructs deterministic **test-only** signing material and sends an SDK-shaped proof through the actual verifier, including concurrent replay, tampering, policy mismatch, and session behavior.

The deterministic key is not a wallet key. These tests do not prove that an installed Beldex extension generated the proof. A user-observed testnet UI success exists, but its raw proof/trace was not retained. Wallet interoperability must be reproducible in a browser using a compatible extension on testnet; follow [wallet compatibility](../research/WALLET-COMPATIBILITY.md). Do not upload wallet proofs, addresses, or session credentials into CI fixtures without explicit privacy review.

The upstream focused crypto tests (`sign-message.test.mjs` and `weak-key-verify.test.mjs`) were run against the inspected extension source commit and passed 15 tests. They are research verification, not part of this repository's CI job.

# Verification evidence and reproduction boundary

This page distinguishes software tests from wallet interoperability evidence.

## Automated local validation

The repository's unit and server tests use a mix of:

- Upstream CLI-produced SigV1 fixture(s).
- Deterministic test-only keys for full server route tests with the real Sigil verifier.
- Injected fake verifiers for tests that isolate HTTP/session/nonce lifecycle behavior.

These tests cover useful failure modes, but deterministic or fake-verifier tests do not prove an installed wallet extension generated the proof.

## Wallet flow

A local POC testnet login has been observed in the browser UI with the local reference origin. The repo documents the SDK and extension source/version observations at [wallet compatibility](../research/WALLET-COMPATIBILITY.md). The actual wallet-generated proof/signature and raw HTTP trace are not stored here. Do not claim that a checked-in deterministic fixture is the same artifact as the wallet proof.

For a new reproducible run:

1. Record exact SDK package/tarball integrity, extension release/build, browser, OS, testnet, and origin.
2. Start the server and web app using [quickstart](../getting-started/quickstart.md).
3. Record wallet connection and sign-in approval separately; connection approval is not the auth signature approval.
4. Capture sanitized server success and `/api/me` result, then replay the same proof and capture rejection.
5. Keep address and signature private unless there is clear consent and a review-approved reason to disclose them.

No security audit, production deployment, or external conformance certification is claimed.

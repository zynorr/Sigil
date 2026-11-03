# Beldex protocol reconnaissance

**Checked:** 2026-11-03. This records public repository source observed at the commit hashes below; it distinguishes source inspection from installed-build execution.

## Sources and revisions

- SDK repository: <https://github.com/Beldex-Coin/bdx-web3js>, `main` observed at `af068d2a7a09f1ef67186105e219bacc020641a8`.
- SDK README: <https://github.com/Beldex-Coin/bdx-web3js/blob/af068d2a7a09f1ef67186105e219bacc020641a8/README.md>.
- Protocol document: <https://github.com/Beldex-Coin/bdx-web3js/blob/af068d2a7a09f1ef67186105e219bacc020641a8/docs/PROTOCOL.md>.
- SDK types: <https://github.com/Beldex-Coin/bdx-web3js/blob/af068d2a7a09f1ef67186105e219bacc020641a8/src/types.ts>.
- SDK client: <https://github.com/Beldex-Coin/bdx-web3js/blob/af068d2a7a09f1ef67186105e219bacc020641a8/src/client.ts>.
- Extension repository: <https://github.com/Beldex-Coin/beldex-wallet-extension>, `main` observed at `f8f4014aa3c2d357a2b48b8069e012b6d129f59a`.
- Extension source package metadata/changelog version labels differ; this does not establish the capability of a particular store-distributed build.
- Repository `main` package metadata reported SDK version `1.0.1`, while the installed project lockfile pins registry release `@bdxi/web3js@1.0.2`.

## Confirmed documented behavior

The SDK README documents a single-line statement:

```text
beldex-auth-v1 domain=<origin> uri=<origin+path> address=<addr> network=<net> nonce=<n> iat=<ms> exp=<ms>[ rid=<id>]
```

The SDK types define `ConnectProof` with `message`, `signature`, `address`, `domain`, `uri`, `network`, `nonce`, `issuedAt`, `expirationTime`, optional `requestId`, and `serverIssued`. The README says only a proof produced with a server-issued challenge is suitable for authentication. The SDK's `connectWithProof({ challenge })` expects `{ nonce, requestId?, expiresInMs? }`; challenge nonce must be server generated, tracked and atomically consumed.

The stronger method is `bdx_signAuthChallenge`, identified by SDK types/comments as wallet v1.2+. It accepts the nonce (and optional request ID/expiration duration); the wallet composes the signed statement using browser-observed origin. The extension changelog describes the result `{ message, signature, address }` and says `message` is the exact signed bytes. Generic `bdx_signMessage` reserves the auth prefix.

SDK docs state `verifyMessage()` is public/keyless, and `bdx_verifyMessage` is in the wire protocol. In the SDK implementation, `verifyMessage()` sends a request to the wallet provider and returns its `valid` field. That is wallet-mediated verification, not a portable server-side verifier.

The SDK explicitly assigns the backend responsibility for signature verification, checking domain/address/network, checking time, and atomically consuming the server-issued nonce. The server-issued challenge should be bound to the session that requested it.

## Cryptographic verification status — ported and tested; wallet fixture remains separate

The current extension source contains a pure TypeScript implementation in `src/lib/signMessage.ts`: `verifyMessage`, `checkSignature`, and `addressSpendKey`. It uses `@noble/curves` and `@noble/hashes`, describes the `SigV1` scheme as `wallet2::sign`, and extracts the spend public key from standard/integrated Beldex addresses. The wire protocol §4.6 describes `keccak256(message)`, Schnorr signature construction, and `"SigV1" + monero_base58(c ‖ r)`; §4.7 exposes wallet-side `bdx_verifyMessage`.

The extension repository also has `test/sign-message.test.mjs` with core crypto vectors and `test/weak-key-verify.test.mjs` for weak-key rejection. At the inspected commit, the focused verifier suites ran successfully: 15 tests passed. Sigil ports the verifier into `packages/core/src/verifier/sigv1.ts`, preserves MIT attribution, and tests the upstream CLI fixture plus deterministic server-flow cases. The SDK's `verifyMessage()` remains wallet-provider RPC; it is not a server SDK API.

Thus a portable implementation path exists in the extension source, but the SDK itself does not export a server verifier. Sigil isolates the extension verification logic in `packages/core/src/verifier/sigv1.ts`, with tests against the upstream CLI fixture and focused upstream crypto tests. Do not use a browser-supplied `valid` assertion as the relying server's trust anchor.

### Known / unresolved protocol details

- SDK types say times are Unix milliseconds; confirm normative requirements and accepted skew with Beldex.
- Network type is `mainnet | testnet` in SDK types. Confirm all production network identifiers and address rules before release.
- The statement is documented as single-line and wallet code rejects control characters. Exact canonical parsing/duplicate-field policy for independent servers needs conformance vectors.
- The extension source documents/exposes the verification equation and address key extraction; focused upstream core-vector and weak-key tests and Sigil tests pass. A CLI fixture validates signature compatibility; a wallet-generated auth proof is distinct evidence and must not be conflated with that fixture.
- The npm SDK package does not export this extension-private verifier as a server API.
- Origin must come from the wallet's browser context for the strong path; extension README says HTTP origins cannot connect except loopback development and requires HTTPS for normal origins.
- Mobile compatibility was not established.

## Decision

Do not replace the wallet's scheme with generic Ed25519 verification, a browser-dependent verifier, or an RPC trust shortcut. Preserve the upstream signature equation, weak-key policy, and vectors when maintaining the Sigil port.

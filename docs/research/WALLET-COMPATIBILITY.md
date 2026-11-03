# Wallet compatibility

This document records the public SDK contract and identifies compatibility facts an integrator must verify for their own wallet build. It intentionally does not publish local browser-profile details, account identifiers, session data, or grant evidence.

## SDK contract

The project lockfile pins `@bdxi/web3js@1.0.2`. Its installed declarations define:

- `connectWithProof({ challenge })`, where `challenge` contains a server-generated `nonce`, optional `requestId`, and optional `expiresInMs`.
- `ConnectProof` with exact signed `message`, `signature`, `address`, `domain`, `uri`, `network`, `nonce`, `issuedAt`, `expirationTime`, optional `requestId`, and `serverIssued`.
- The strong wallet-composed path as `bdx_signAuthChallenge`, marked wallet v1.2+ in SDK declarations/comments.

The SDK source checkout previously inspected at `af068d2a7a09f1ef67186105e219bacc020641a8` declares package version 1.0.1, while the registry package installed by this project is 1.0.2. Treat the lockfile tarball and installed type declarations as the project dependency; do not infer wallet extension release compatibility from SDK package version.

## Extension compatibility notes

The public Beldex Wallet extension source checkout previously inspected at `f8f4014aa3c2d357a2b48b8069e012b6d129f59a` implements `bdx_signAuthChallenge`. Its source package metadata and changelog use differing version labels, so integrators should check capability by actual method support and perform a testnet login rather than relying only on a version string.

The extension manifest/source permits HTTPS sites and localhost loopback origins for development. A production deployment should use a supported HTTPS origin. Mobile-wallet support has not been established by this project.

## Integrator verification checklist

Record these facts for each tested matrix entry:

| Item     | Required record                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------- |
| SDK      | Exact package version and lock/tarball integrity                                                          |
| Wallet   | Exact extension release/build and whether `bdx_signAuthChallenge` is callable                             |
| Browser  | Browser name/version and OS                                                                               |
| Origin   | Exact scheme/host/port and extension secure-origin behavior                                               |
| Network  | Wallet-reported nettype and configured server network                                                     |
| Proof    | Confirm `serverIssued`, challenge nonce, request ID, message, signature, address, and parsed fields agree |
| Verifier | Independent server verification, then successful protected route                                          |
| Replay   | Same proof rejected, including concurrent duplicate submission                                            |

Do not publish seeds, keys, session tokens, or unnecessary account identifiers in compatibility reports. A mock wallet or CLI signature fixture is not evidence of extension interoperability.

## Open compatibility questions

- Confirm the first Chrome and Firefox store releases that implement `bdx_signAuthChallenge` and map the SDK's wallet-v1.2+ wording to published extension versions.
- Confirm mobile support and its release/version requirements.
- Confirm secure BelNet `.bdx` origin behavior with the extension.

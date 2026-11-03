# Beldex `beldex-auth-v1` statement

This page describes the grammar accepted by the current Sigil POC parser. Beldex's upstream protocol document and wallet implementation are normative for wallet-produced bytes; this page is not a replacement or a claim of protocol ownership.

## Statement form

```text
beldex-auth-v1 domain=<origin> uri=<origin+path> address=<addr> network=<net> nonce=<n> iat=<ms> exp=<ms>[ rid=<id>]
```

Fields are space-separated single tokens and must appear in the documented order. The optional `rid` is last. Sigil preserves the exact incoming `message` string and verifies that exact UTF-8 byte sequence; it never reconstructs or normalizes the message before signature verification.

| Field        | POC validation                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prefix       | Must equal `beldex-auth-v1`.                                                                                                                                                                       |
| `domain`     | Must be an HTTP(S) origin in canonical URL form; server requires equality with configured `APP_ORIGIN`.                                                                                            |
| `uri`        | Must be a canonical URL with same origin as `domain`; search and fragment components are rejected by the parser.                                                                                   |
| `address`    | Must equal proof object's address; decoded checksum and verifier-supported standard/integrated/subaddress prefixes and lengths are checked, and address prefix must match configured network.      |
| `network`    | Only `mainnet` and `testnet`; must equal server config.                                                                                                                                            |
| `nonce`      | 8–128 characters from `[A-Za-z0-9._-]`, and must match a live server challenge.                                                                                                                    |
| `iat`, `exp` | Decimal Unix milliseconds, safe integers. Future `iat` beyond 30 seconds is rejected; `exp` is rejected at or after the exact expiry instant. Lifetime must be positive and no more than one hour. |
| `rid`        | Optional 1–64 characters from `[A-Za-z0-9._-]`; when emitted, it must match the challenge's server request ID.                                                                                     |

The parser rejects duplicate, missing, unknown, reordered, empty, malformed, multiline, and C0/C1-control fields plus U+2028/U+2029. The whole statement is limited to 512 JavaScript UTF-16 code units. The wallet derives signed `uri` from the observed origin plus pathname (or `/`); query and fragment are omitted. The Sigil parser rejects URI search/fragment components. The address decoder checks checksum and enumerated prefix/length; full curve-point validation of every address key is not performed by this parser layer.

## Signature and validation

The wallet returns `SigV1…` signature encoding. Sigil verifies that signature against the spend public key extracted from the Beldex address using the upstream-derived verifier. Policy validation is distinct: expected origin, network, challenge context, request ID, timestamps, and single-use status are checked by the server.

See [protocol reconnaissance](../research/BELDEX-PROTOCOL-RECONNAISSANCE.md), [verifier port](../research/SIGV1-VERIFIER-PORT.md), and [security model](../security/threat-model.md).

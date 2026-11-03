# BNS integration requirements

The daemon RPC guide documents `bns_names_to_owners` as a lookup by name hash, optionally including expired entries. Its response includes `name_hash`, `owner`, optional `backup_owner`, encrypted BChat/wallet/BelNet/Ethereum values, `update_height`, `expiration_height`, and transaction ID.

This is not yet a working Sigil BNS verifier. The RPC documentation does not, by itself, establish name normalization/hash derivation or all owner/backup activation rules needed to verify a user's claim.

## Candidate verification flow (semantics require Beldex confirmation)

1. Verify the wallet's authentication proof and obtain the signing address.
2. Normalize and hash the supplied BNS name using the official Beldex implementation.
3. Query a trusted, synchronized daemon using `bns_names_to_owners`.
4. Validate returned name hash and status, compare authenticated address against the eligible owner set, and evaluate expiry using chain height.
5. Return a typed result that distinguishes verified, expired, missing, daemon-unavailable, and ownership-mismatch outcomes.

Do not confuse BNS resolution (an encrypted service value resolving to an address) with ownership verification. Do not rely on the SDK's resolver as verified; its `ResolveBnsResult.verified` is explicitly `false` in v1.

## Beldex inputs needed

- Supported daemon version and trusted testnet endpoint, or confirmation to self-host.
- RPC exposure/authentication requirements and synchronization signal.
- Official name normalization and hash derivation algorithm/code.
- Test fixtures for existing, missing, expired, transferred, and backup-owner cases.
- Whether backup owner is immediately an eligible co-owner or becomes eligible only under particular recovery/transfer conditions.
- Exact expiry semantics and authoritative current-height method.
- Confirmation whether daemon results reflect consensus state and how reorgs should affect cache validity.
- Any limits/rate controls and recommended cache TTL.

No daemon access or fixture was available in this workspace; no BNS verification is implemented.

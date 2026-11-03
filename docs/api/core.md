# Core API reference

Current exports from `packages/core/src/index.ts`:

```ts
parseAuthStatement(message: unknown): AuthStatement | null
addressSpendKey(address: string): string | null
addressMatchesNetwork(address: string, network: "mainnet" | "testnet"): boolean
checkSignature(prefixHash: Uint8Array, publicSpendKey: Uint8Array, sig: Uint8Array): boolean
verifySigV1(input: { address: string; message: string; signature: string }): boolean
sigV1Verifier: SignatureVerifier
base58Decode(text: string): Uint8Array
MemoryChallengeStore
MemorySessionStore
```

## `parseAuthStatement`

Strictly parses a `beldex-auth-v1` statement and returns fields plus the original `message`. It returns `null` rather than normalizing malformed content. The original string must be used for signature verification.

## `verifySigV1`

Extracts the spend key from the address and validates the SigV1 signature over UTF-8 `message` bytes. It is synchronous and returns `false` for malformed/invalid inputs. It does not apply relying-party policy such as configured domain, expected network, challenge ownership, timestamp window, or nonce consumption; the server performs those checks separately.

## `MemoryChallengeStore`

- `issue({ nonce, contextId, expiresAt, requestId })` stores a challenge; throws on nonce collision.
- `consume({ nonce, contextId, requestId, now })` succeeds once only if the tuple matches and challenge is unexpired.
- `prune(now)` removes expired records.

Atomicity is only within the single JavaScript isolate because `consume` is synchronous. Do not share this store across server instances.

## `MemorySessionStore`

- `create(token, { address, network, expiresAt })`
- `get(token, now)` returns active record or `null`, deleting an expired entry.
- `revoke(token)` deletes the record.

These public exports are low-level POC primitives, not a stability-guaranteed package API yet.

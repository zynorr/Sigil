# Third-party notices

## Beldex Wallet Extension — SigV1 verification logic

The SigV1 verification and Beldex address spend-key extraction in
`packages/core/src/verifier/sigv1.ts` are derived from
`Beldex-Coin/beldex-wallet-extension`, file `src/lib/signMessage.ts`, commit
`f8f4014aa3c2d357a2b48b8069e012b6d129f59a`.

Copyright (c) 2026 Beldex Wallet. Licensed under the MIT License. The original
license is reproduced in `LICENSE`; the upstream source is available at:
https://github.com/Beldex-Coin/beldex-wallet-extension/blob/f8f4014aa3c2d357a2b48b8069e012b6d129f59a/src/lib/signMessage.ts

This port uses `@noble/curves` and `@noble/hashes`, both MIT-licensed.

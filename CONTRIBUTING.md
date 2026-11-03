# Contributing

Sigil is an experimental authentication POC. Before changing verifier code, read `docs/protocol/beldex-auth-v1.md`, `docs/research/SIGV1-VERIFIER-PORT.md`, and `docs/security/threat-model.md`. Preserve exact signed bytes and upstream verification behavior. Never add mock verification to production paths or describe wallet-RPC verification as server-side verification.

For changes, provide reproducible commands and test output. Do not include secrets, real session tokens, seed phrases, private keys, or unredacted user proofs in issues or commits. Security issues should be reported privately to the maintainers once a security contact is established.

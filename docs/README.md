# Sigil documentation

The root [README](../README.md) is the product entry point. This index links to implementation-oriented guides; each page describes behavior in the current repository and calls out POC limits.

## Getting started

- [Local quickstart](getting-started/quickstart.md) — install, run server and browser app, exercise the flow.
- [Configuration](getting-started/configuration.md) — environment variables and defaults.
- [Testing and evidence](getting-started/testing.md) — test commands and the distinction between deterministic fixtures and wallet proof.

## Core concepts

- [Authentication concepts](concepts/authentication.md) — wallet proof, server challenge, and what the proof establishes.
- [Challenge and session lifecycle](concepts/challenge-and-session.md) — context binding, nonce consumption, session lifecycle.

## Architecture

- [System architecture](architecture/overview.md) — components, sequence, trust boundaries, and runtime limitations.

## Security and privacy

- [Security model and threat analysis](security/threat-model.md) — assets, adversaries, mitigations, residual risk.
- [Privacy boundaries](security/privacy.md) — address visibility and linkability.
- [Security policy](../SECURITY.md) — project maturity and reporting guidance.

## Protocol

- [Beldex authentication statement](protocol/beldex-auth-v1.md) — parser rules and server validation performed by this POC.
- [SigV1 verifier](research/SIGV1-VERIFIER-PORT.md) — upstream-derived verification implementation and tests.

## Developer integration and API

- [Browser integration](integration/browser.md) — actual SDK call and proof handling.
- [Server integration](integration/server.md) — challenge and verification endpoints in an application.
- [HTTP API reference](api/http.md) — implemented endpoints, cookies, request/response behavior.
- [Core API reference](api/core.md) — exported parser, verifier, and memory-store interfaces.

## Operations

- [Local operations and troubleshooting](operations/local-development.md) — ports, origins, testnet, common failures.
- [Verifier provenance and test evidence](operations/verification-evidence.md) — upstream and local validation boundaries.

## Upstream compatibility research

- [Protocol reconnaissance](research/BELDEX-PROTOCOL-RECONNAISSANCE.md)
- [Wallet compatibility matrix](research/WALLET-COMPATIBILITY.md)
- [BNS integration requirements](research/BNS-INTEGRATION-REQUIREMENTS.md) (research only; no BNS package implemented)

## Maintainer notes

- [Architecture decision records](decisions/README.md) — add a focused record when a material architecture or security decision changes.

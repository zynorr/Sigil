# Browser integration

The reference browser app is implemented in `apps/poc-web/src/main.ts` and uses `@bdxi/web3js@1.0.2`. It currently targets the SDK's real `connectWithProof` method; it does not silently fall back to `signMessage`.

```ts
import { BeldexWeb3, detectProvider } from "@bdxi/web3js";

const provider = await detectProvider({ timeoutMs: 2500 });
if (!provider) throw new Error("Beldex Wallet not detected");

const bdx = new BeldexWeb3(provider);
const { address, network } = await bdx.connect();
if (network !== "testnet") throw new Error(`Unexpected network: ${network}`);

const challengeResponse = await fetch("/auth/challenge", {
  credentials: "include",
});
if (!challengeResponse.ok) throw new Error("Challenge request failed");
const challenge = await challengeResponse.json();

const { proof } = await bdx.connectWithProof({ challenge });
if (!proof || !proof.serverIssued)
  throw new Error("Server-issued proof required");

const verifyResponse = await fetch("/auth/verify", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(proof),
});
if (!verifyResponse.ok) throw new Error("Server rejected proof");

const meResponse = await fetch("/api/me", { credentials: "include" });
const me = await meResponse.json();
if (!meResponse.ok || me.address !== address || me.network !== network) {
  throw new Error("Authenticated session did not match wallet");
}
```

`connect()` and the proof request require user interaction in the wallet. The wallet must support `bdx_signAuthChallenge` (SDK declarations identify the strong path as wallet v1.2+). Local development should use `http://localhost:5173`, which is in the inspected extension manifest's loopback patterns. Production should use a wallet-supported HTTPS origin.

The SDK proof object includes convenience fields as well as the exact signed `message`. Sigil verifies the exact message and checks the convenience fields agree. Do not replace `proof.message` with a locally rebuilt statement.

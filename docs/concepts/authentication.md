# Authentication concepts

Sigil builds on Beldex's wallet-generated `beldex-auth-v1` ownership proof. The wallet signs a statement that includes the origin it observes, the account address, network, server nonce, issued/expiry timestamps, and optional request ID. The signature uses Beldex `SigV1` message signing.

The app obtains a server challenge and passes it to the official SDK:

```ts
import { BeldexWeb3, detectProvider } from "@bdxi/web3js";

const provider = await detectProvider();
if (!provider) throw new Error("Beldex Wallet not detected");
const bdx = new BeldexWeb3(provider);

const response = await fetch("/auth/challenge", { credentials: "include" });
const challenge = await response.json();
const { proof } = await bdx.connectWithProof({ challenge });
if (!proof) throw new Error("Wallet did not return a proof");
```

Only a proof made with a server-issued challenge (`proof.serverIssued === true`) is appropriate for login. Without that challenge, the SDK may create a nonce that the server did not issue and cannot bind to the login context.

The server verifies `proof.message` and `proof.signature` with Sigil's Node verifier, not a result asserted by the browser or `bdx_verifyMessage` RPC. It then checks that the parsed statement agrees with configured domain/network, proof fields, address network prefix, timestamps, and the server-issued nonce/context/request ID. A session is created only after successful signature verification and atomic challenge consumption.

## What proof of control means

Acceptance establishes that a valid signature over the statement corresponds to the spend public key encoded in the address, and that the statement matches this relying service's expected login context. It does not prove a person's legal identity, balance, holdings, or anonymity.

The address is disclosed to the relying application. Reusing one address across services can make sessions correlatable. See [privacy boundaries](../security/privacy.md).

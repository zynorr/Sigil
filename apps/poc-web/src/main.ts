import { BeldexWeb3, detectProvider } from "@bdxi/web3js";
import type { BeldexProvider, ConnectProof } from "@bdxi/web3js";
import "./style.css";

type State =
  | "checking"
  | "missing"
  | "disconnected"
  | "connecting"
  | "challenge"
  | "signing"
  | "verifying"
  | "authenticated"
  | "error";

const root = document.querySelector<HTMLDivElement>("#app")!;
let provider: BeldexProvider | null = null;
let client: BeldexWeb3 | null = null;
let state: State = "checking";
let account = "";
let message = "Looking for the Beldex Wallet extension…";
let networkLabel = "Testnet";
let walletVersion = "unknown";

function render(): void {
  root.innerHTML = `
    <main class="shell">
      <header class="topbar"><a class="brand" href="#"><span class="mark">S</span><span>SIGIL</span></a><span class="environment"><i></i> BELDEX ${escapeHtml(networkLabel.toUpperCase())}</span></header>
      <section class="panel">
        <div class="eyebrow">PRIVACY-CONSCIOUS AUTHENTICATION</div>
        <h1>One proof.<br><span>Your account.</span></h1>
        <p class="intro">Sign in to this demo by proving control of a Beldex address. Sigil does not request your balance, transaction history, seed phrase or private keys.</p>
        <div class="status" role="status" aria-live="polite"><span class="pulse ${state}"></span><div><strong>${labelFor(state)}</strong><p>${escapeHtml(message)}</p></div></div>
        ${state === "authenticated" ? `<div class="account"><span>AUTHENTICATED ADDRESS</span><code>${escapeHtml(account)}</code><span>WALLET ${escapeHtml(walletVersion)}</span><pre id="protected">Server session verified.</pre><button id="me">Refresh protected route</button></div>` : ""}
        ${state === "error" ? `<div class="error" role="alert">${escapeHtml(message)}</div>` : ""}
        <button class="primary" id="action" ${["checking", "connecting", "challenge", "signing", "verifying"].includes(state) ? "disabled" : ""}>${buttonFor(state)}</button>
        ${state === "authenticated" ? '<button class="secondary" id="logout">Log out</button>' : ""}
        <div class="privacy-note"><span>◎</span><p><strong>Honest privacy note</strong><br>Your address is visible to this app. Reusing it on another service can link the accounts.</p></div>
        <footer><span>Sigil POC · Testnet only</span><span>Not production-audited</span></footer>
      </section>
      <div class="fineprint">A signature proves control of an address—not anonymity, ownership of holdings, or an unlinkable identity.</div>
    </main>`;
  document
    .querySelector<HTMLButtonElement>("#action")
    ?.addEventListener("click", () => void action());
  document
    .querySelector<HTMLButtonElement>("#logout")
    ?.addEventListener("click", () => void logout());
  document
    .querySelector<HTMLButtonElement>("#me")
    ?.addEventListener("click", () => void checkProtected());
}

function labelFor(s: State): string {
  return {
    checking: "Checking wallet",
    missing: "Wallet not detected",
    disconnected: "Ready to connect",
    connecting: "Connecting",
    challenge: "Requesting challenge",
    signing: "Awaiting wallet approval",
    verifying: "Verifying proof on server",
    authenticated: "Signed in",
    error: "Authentication failed",
  }[s];
}

function buttonFor(s: State): string {
  return {
    checking: "Please wait…",
    missing: "Install Beldex Wallet",
    disconnected: "Connect wallet",
    connecting: "Connecting…",
    challenge: "Requesting challenge…",
    signing: "Approve in wallet…",
    verifying: "Verifying…",
    authenticated: "Signed in",
    error: "Try again",
  }[s];
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]!,
  );
}

async function initialize(): Promise<void> {
  provider = await detectProvider({ timeoutMs: 2500 });
  if (!provider) {
    state = "missing";
    message =
      "Install or enable the official extension, then reload this page.";
  } else {
    client = new BeldexWeb3(provider);
    state = "disconnected";
    message =
      "The wallet provider is available. Connect to begin a testnet sign-in.";
  }
  render();
}

async function action(): Promise<void> {
  if (!client) {
    await initialize();
    return;
  }
  try {
    state = "connecting";
    message = "Approve this origin in the Beldex Wallet.";
    render();
    const connected = await client.connect();
    networkLabel = connected.network;
    if (connected.network !== "testnet")
      throw new Error(`Expected testnet, wallet reports ${connected.network}.`);
    account = connected.address;
    try {
      const capabilities = await client.getNetwork();
      walletVersion =
        capabilities.walletVersion ?? "version withheld by wallet";
    } catch {
      walletVersion = "not reported";
    }

    state = "challenge";
    message = "Creating a server-issued single-use challenge.";
    render();
    const challengeResponse = await fetch("/auth/challenge", {
      credentials: "include",
    });
    if (!challengeResponse.ok)
      throw new Error("Challenge endpoint unavailable.");
    const challenge = (await challengeResponse.json()) as {
      nonce: string;
      requestId: string;
      expiresInMs: number;
    };

    state = "signing";
    message = "Approve the Beldex sign-in request in the wallet.";
    render();
    const result = await client.connectWithProof({ challenge });
    if (!result.proof) throw new Error("Wallet did not return a proof.");

    state = "verifying";
    message =
      "Submitting exact signed statement for independent server verification.";
    render();
    const proof = result.proof as ConnectProof;
    const verification = await fetch("/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proof),
    });
    const body = (await verification.json()) as { error?: string };
    if (!verification.ok)
      throw new Error(body.error ?? "Server rejected proof.");
    const meResponse = await fetch("/api/me", { credentials: "include" });
    const me = (await meResponse.json()) as {
      address?: string;
      network?: string;
      error?: string;
    };
    if (
      !meResponse.ok ||
      me.address !== proof.address ||
      me.network !== "testnet"
    ) {
      throw new Error(
        me.error ?? "Session check did not match the signed wallet proof.",
      );
    }
    state = "authenticated";
    message = `Server verified the wallet proof and /api/me session on ${networkLabel}.`;
    render();
  } catch (error) {
    state = "error";
    message = error instanceof Error ? error.message : "Unknown error.";
    render();
  }
}

async function checkProtected(): Promise<void> {
  const response = await fetch("/api/me", { credentials: "include" });
  const pre = document.querySelector<HTMLPreElement>("#protected");
  const result = (await response.json()) as {
    address?: string;
    network?: string;
    error?: string;
  };
  if (pre)
    pre.textContent = `${response.status} ${JSON.stringify(result, null, 2)}`;
  if (
    !response.ok ||
    result.address !== account ||
    result.network !== "testnet"
  ) {
    state = "error";
    message =
      result.error ?? "Protected session did not match the connected wallet.";
    render();
  }
}

async function logout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST", credentials: "include" });
  state = "disconnected";
  account = "";
  message = "Session revoked. Connect to sign in again.";
  render();
}

render();
void initialize();

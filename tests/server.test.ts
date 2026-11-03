import { describe, expect, it } from "vitest";
import { createApp } from "../apps/poc-server/src/app.js";
import { MemoryChallengeStore } from "../packages/core/src/stores/memory-challenge-store.js";
import { MemorySessionStore } from "../packages/core/src/stores/memory-session-store.js";

const statement = (nonce: string, rid: string) =>
  `beldex-auth-v1 domain=https://app.example uri=https://app.example/ address=9vudUCJcsCW1gNhERJKdWVRD8e1TyJPVY295XMuQNiZnAe4oU7F5vgF3Ueo7gDCyc6h6UYGSbTiPZFt7CcoF1ymaUhXR9es network=testnet nonce=${nonce} iat=1780000000000 exp=1780000300000 rid=${rid}`;

describe("POC HTTP authentication flow", () => {
  it("issues challenges, validates proof and protects/revokes session", async () => {
    let now = 1_780_000_000_000;
    const app = createApp({
      domain: "https://app.example",
      network: "testnet",
      challengeTtlMs: 300_000,
      sessionTtlMs: 60_000,
      cookieSecure: false,
      clock: () => now,
      verifier: { verify: () => true },
    });
    const issued = await app.request("/auth/challenge", {
      headers: { origin: "https://app.example" },
    });
    const challenge = (await issued.json()) as {
      nonce: string;
      requestId: string;
    };
    const contextCookie = issued.headers.get("set-cookie")!.split(";")[0]!;
    const proof = {
      message: statement(challenge.nonce, challenge.requestId),
      signature: "fixture",
      address:
        "9vudUCJcsCW1gNhERJKdWVRD8e1TyJPVY295XMuQNiZnAe4oU7F5vgF3Ueo7gDCyc6h6UYGSbTiPZFt7CcoF1ymaUhXR9es",
      domain: "https://app.example",
      uri: "https://app.example/",
      network: "testnet",
      nonce: challenge.nonce,
      issuedAt: now,
      expirationTime: now + 300_000,
      serverIssued: true,
      requestId: challenge.requestId,
    };
    const verified = await app.request("/auth/verify", {
      method: "POST",
      headers: {
        cookie: contextCookie,
        origin: "https://app.example",
        "content-type": "application/json",
      },
      body: JSON.stringify(proof),
    });
    expect(verified.status).toBe(200);
    const sessionSetCookie = verified.headers
      .getSetCookie()
      .find((value) => value.startsWith("sigil_session="))!;
    const sessionCookie = sessionSetCookie.split(";")[0]!;
    expect(
      (await app.request("/api/me", { headers: { cookie: sessionCookie } }))
        .status,
    ).toBe(200);
    expect(
      (
        await app.request("/auth/logout", {
          method: "POST",
          headers: { cookie: sessionCookie, origin: "https://app.example" },
        })
      ).status,
    ).toBe(200);
    expect(
      (await app.request("/api/me", { headers: { cookie: sessionCookie } }))
        .status,
    ).toBe(401);
    now++;
  });

  it("rejects invalid signatures without consuming challenge; then consumes it once", async () => {
    const challenges = new MemoryChallengeStore();
    const sessions = new MemorySessionStore();
    let validSignature = false;
    const app = createApp({
      domain: "https://app.example",
      network: "testnet",
      challengeTtlMs: 300_000,
      sessionTtlMs: 60_000,
      cookieSecure: false,
      clock: () => 1_780_000_000_000,
      challenges,
      sessions,
      verifier: { verify: () => validSignature },
    });
    const issued = await app.request("/auth/challenge", {
      headers: { origin: "https://app.example" },
    });
    const challenge = (await issued.json()) as {
      nonce: string;
      requestId: string;
    };
    const cookie = issued.headers.get("set-cookie")!.split(";")[0]!;
    const proof = {
      message: statement(challenge.nonce, challenge.requestId),
      signature: "fixture",
      address:
        "9vudUCJcsCW1gNhERJKdWVRD8e1TyJPVY295XMuQNiZnAe4oU7F5vgF3Ueo7gDCyc6h6UYGSbTiPZFt7CcoF1ymaUhXR9es",
      domain: "https://app.example",
      uri: "https://app.example/",
      network: "testnet",
      nonce: challenge.nonce,
      issuedAt: 1_780_000_000_000,
      expirationTime: 1_780_000_300_000,
      serverIssued: true,
      requestId: challenge.requestId,
    };
    const send = () =>
      app.request("/auth/verify", {
        method: "POST",
        headers: {
          cookie,
          origin: "https://app.example",
          "content-type": "application/json",
        },
        body: JSON.stringify(proof),
      });
    expect((await send()).status).toBe(401);
    validSignature = true;
    const results = await Promise.all([send(), send()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it("does not accept a client-chosen pre-auth context cookie", async () => {
    const app = createApp({
      domain: "https://app.example",
      network: "testnet",
      challengeTtlMs: 300_000,
      sessionTtlMs: 60_000,
      cookieSecure: false,
      verifier: { verify: () => true },
    });
    const response = await app.request("/auth/verify", {
      method: "POST",
      headers: {
        origin: "https://app.example",
        cookie: "sigil_pre_auth=attacker-controlled-context",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(401);
  });

  it.each([
    [
      "wrong domain",
      (message: string) =>
        message.replace("https://app.example", "https://evil.example"),
    ],
    [
      "wrong network",
      (message: string) =>
        message.replace("network=testnet", "network=mainnet"),
    ],
    ["modified signed bytes", (message: string) => `${message}x`],
  ])("rejects %s without consuming the challenge", async (_case, alter) => {
    let signatureValid = true;
    const challenges = new MemoryChallengeStore();
    const app = createApp({
      domain: "https://app.example",
      network: "testnet",
      challengeTtlMs: 300_000,
      sessionTtlMs: 60_000,
      cookieSecure: false,
      clock: () => 1_780_000_000_000,
      challenges,
      verifier: { verify: () => signatureValid },
    });
    const issued = await app.request("/auth/challenge", {
      headers: { origin: "https://app.example" },
    });
    const challenge = (await issued.json()) as {
      nonce: string;
      requestId: string;
    };
    const cookie = issued.headers.get("set-cookie")!.split(";")[0]!;
    const address =
      "9vudUCJcsCW1gNhERJKdWVRD8e1TyJPVY295XMuQNiZnAe4oU7F5vgF3Ueo7gDCyc6h6UYGSbTiPZFt7CcoF1ymaUhXR9es";
    const original = statement(challenge.nonce, challenge.requestId);
    const body = (message: string) =>
      JSON.stringify({
        message,
        signature: "fixture",
        address,
        domain: message.includes("domain=https://evil.example")
          ? "https://evil.example"
          : "https://app.example",
        uri: "https://app.example/",
        network: message.includes("network=mainnet") ? "mainnet" : "testnet",
        nonce: challenge.nonce,
        issuedAt: 1_780_000_000_000,
        expirationTime: 1_780_000_300_000,
        requestId: challenge.requestId,
        serverIssued: true,
      });
    const send = (message: string) =>
      app.request("/auth/verify", {
        method: "POST",
        headers: {
          cookie,
          origin: "https://app.example",
          "content-type": "application/json",
        },
        body: body(message),
      });
    expect((await send(alter(original))).status).toBe(401);
    // Invalid altered proof must not burn challenge; original proof can still pass.
    signatureValid = true;
    expect((await send(original)).status).toBe(200);
  });

  it("rejects expired statements strictly at exp", async () => {
    const now = 1_780_000_300_000;
    const challenges = new MemoryChallengeStore();
    const app = createApp({
      domain: "https://app.example",
      network: "testnet",
      challengeTtlMs: 300_000,
      sessionTtlMs: 60_000,
      cookieSecure: false,
      clock: () => now,
      challenges,
      verifier: { verify: () => true },
    });
    const issued = await app.request("/auth/challenge", {
      headers: { origin: "https://app.example" },
    });
    const challenge = (await issued.json()) as {
      nonce: string;
      requestId: string;
    };
    const cookie = issued.headers.get("set-cookie")!.split(";")[0]!;
    const addr =
      "9vudUCJcsCW1gNhERJKdWVRD8e1TyJPVY295XMuQNiZnAe4oU7F5vgF3Ueo7gDCyc6h6UYGSbTiPZFt7CcoF1ymaUhXR9es";
    const message = `beldex-auth-v1 domain=https://app.example uri=https://app.example/ address=${addr} network=testnet nonce=${challenge.nonce} iat=${now - 300_000} exp=${now} rid=${challenge.requestId}`;
    const response = await app.request("/auth/verify", {
      method: "POST",
      headers: {
        cookie,
        origin: "https://app.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message,
        signature: "fixture",
        address: addr,
        domain: "https://app.example",
        uri: "https://app.example/",
        network: "testnet",
        nonce: challenge.nonce,
        issuedAt: now - 300_000,
        expirationTime: now,
        requestId: challenge.requestId,
        serverIssued: true,
      }),
    });
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("INVALID_TIMESTAMP");
  });
});

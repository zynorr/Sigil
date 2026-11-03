import { ed25519 } from "@noble/curves/ed25519";
import { keccak_256 } from "@noble/hashes/sha3";
import { describe, expect, it } from "vitest";
import { createApp } from "../apps/poc-server/src/app.js";
import { addressSpendKey } from "../packages/core/src/verifier/sigv1.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BLOCK_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11];

function base58Encode(bytes: Uint8Array): string {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 8) {
    const block = bytes.subarray(offset, offset + 8);
    const size = BLOCK_SIZES[block.length]!;
    let value = 0n;
    for (const byte of block) value = (value << 8n) | BigInt(byte);
    const output = new Array<string>(size).fill("1");
    for (let i = size - 1; value > 0n; i--) {
      output[i] = ALPHABET[Number(value % 58n)]!;
      value /= 58n;
    }
    result += output.join("");
  }
  return result;
}

function le32(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((size, part) => size + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function numberLE(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i--)
    value = (value << 8n) | BigInt(bytes[i]!);
  return value;
}

/** Test-only deterministic signer: never use this key or helper outside tests. */
function makeTestProof(input: {
  nonce: string;
  requestId: string;
  now: number;
  domain?: string;
  network?: "mainnet" | "testnet";
}) {
  const secret = 987654321n;
  const spend = ed25519.ExtendedPoint.BASE.multiply(secret).toRawBytes();
  const view = ed25519.ExtendedPoint.BASE.multiply(1234567n).toRawBytes();
  const prefix = Uint8Array.of(53); // Beldex testnet standard-address prefix.
  const body = concat(prefix, spend, view);
  const checksum = keccak_256(body).subarray(0, 4);
  const address = base58Encode(concat(body, checksum));
  const domain = input.domain ?? "http://localhost:5173";
  const network = input.network ?? "testnet";
  const message = `beldex-auth-v1 domain=${domain} uri=${domain}/ address=${address} network=${network} nonce=${input.nonce} iat=${input.now} exp=${input.now + 300_000} rid=${input.requestId}`;

  const digest = keccak_256(new TextEncoder().encode(message));
  const k = 7654321n;
  const commitment = ed25519.ExtendedPoint.BASE.multiply(k).toRawBytes();
  const challenge =
    numberLE(keccak_256(concat(digest, spend, commitment))) % ed25519.CURVE.n;
  const response =
    (((k - challenge * secret) % ed25519.CURVE.n) + ed25519.CURVE.n) %
    ed25519.CURVE.n;
  const signature = `SigV1${base58Encode(concat(le32(challenge), le32(response)))}`;

  expect(addressSpendKey(address)).toBe(Buffer.from(spend).toString("hex"));
  return {
    message,
    signature,
    address,
    domain,
    uri: `${domain}/`,
    network,
    nonce: input.nonce,
    issuedAt: input.now,
    expirationTime: input.now + 300_000,
    requestId: input.requestId,
    serverIssued: true,
  };
}

describe("server flow with genuine SigV1 verifier (deterministic test key)", () => {
  it("verifies a signed SDK-shaped proof, establishes session, rejects replay and logout reuse", async () => {
    const now = 1_780_000_000_000;
    const app = createApp({
      domain: "http://localhost:5173",
      network: "testnet",
      challengeTtlMs: 300_000,
      sessionTtlMs: 60_000,
      cookieSecure: false,
      clock: () => now,
    });
    const origin = "http://localhost:5173";
    const issued = await app.request("/auth/challenge", {
      headers: { origin },
    });
    expect(issued.status).toBe(200);
    const challenge = (await issued.json()) as {
      nonce: string;
      requestId: string;
      expiresInMs: number;
    };
    const preAuthCookie = issued.headers.get("set-cookie")!.split(";")[0]!;
    const proof = makeTestProof({ ...challenge, now });

    const sendProof = () =>
      app.request("/auth/verify", {
        method: "POST",
        headers: {
          cookie: preAuthCookie,
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify(proof),
      });

    const firstPair = await Promise.all([sendProof(), sendProof()]);
    expect(firstPair.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    const verified = firstPair.find((response) => response.status === 200)!;
    expect(await verified.json()).toEqual({
      ok: true,
      address: proof.address,
      network: "testnet",
    });
    const sessionCookie = verified.headers
      .getSetCookie()
      .find((value) => value.startsWith("sigil_session="))!
      .split(";")[0]!;

    const me = await app.request("/api/me", {
      headers: { cookie: sessionCookie },
    });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      address: proof.address,
      network: "testnet",
    });

    expect((await sendProof()).status).toBe(401);
    expect(
      (
        await app.request("/auth/logout", {
          method: "POST",
          headers: { cookie: sessionCookie, origin },
        })
      ).status,
    ).toBe(200);
    expect(
      (await app.request("/api/me", { headers: { cookie: sessionCookie } }))
        .status,
    ).toBe(401);
  });

  it("rejects a proof with one modified signed byte", async () => {
    const now = 1_780_000_000_000;
    const app = createApp({
      domain: "http://localhost:5173",
      network: "testnet",
      challengeTtlMs: 300_000,
      sessionTtlMs: 60_000,
      cookieSecure: false,
      clock: () => now,
    });
    const origin = "http://localhost:5173";
    const issued = await app.request("/auth/challenge", {
      headers: { origin },
    });
    const challenge = (await issued.json()) as {
      nonce: string;
      requestId: string;
      expiresInMs: number;
    };
    const proof = makeTestProof({ ...challenge, now });
    const response = await app.request("/auth/verify", {
      method: "POST",
      headers: {
        cookie: issued.headers.get("set-cookie")!.split(";")[0]!,
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...proof,
        message: proof.message.replace(
          `exp=${proof.expirationTime}`,
          `exp=${proof.expirationTime - 1}`,
        ),
        expirationTime: proof.expirationTime - 1,
      }),
    });
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("INVALID_SIGNATURE");
  });

  it.each([
    ["wrong domain", { domain: "http://attacker.example" }, "DOMAIN_MISMATCH"],
    ["wrong network", { network: "mainnet" as const }, "NETWORK_MISMATCH"],
  ])(
    "rejects valid signatures with %s policy",
    async (_case, overrides, expectedError) => {
      const now = 1_780_000_000_000;
      const origin = "http://localhost:5173";
      const app = createApp({
        domain: origin,
        network: "testnet",
        challengeTtlMs: 300_000,
        sessionTtlMs: 60_000,
        cookieSecure: false,
        clock: () => now,
      });
      const issued = await app.request("/auth/challenge", {
        headers: { origin },
      });
      const challenge = (await issued.json()) as {
        nonce: string;
        requestId: string;
        expiresInMs: number;
      };
      const proof = makeTestProof({ ...challenge, now, ...overrides });
      const response = await app.request("/auth/verify", {
        method: "POST",
        headers: {
          cookie: issued.headers.get("set-cookie")!.split(";")[0]!,
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify(proof),
      });
      expect(response.status).toBe(401);
      expect((await response.json()).error).toBe(expectedError);
    },
  );
});

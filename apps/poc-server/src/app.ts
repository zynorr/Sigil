import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  addressMatchesNetwork,
  parseAuthStatement,
  sigV1Verifier,
} from "../../../packages/core/src/index.js";
import type { SignatureVerifier } from "../../../packages/core/src/index.js";
import { MemoryChallengeStore } from "../../../packages/core/src/stores/memory-challenge-store.js";
import { MemorySessionStore } from "../../../packages/core/src/stores/memory-session-store.js";

export interface AppConfig {
  readonly domain: string;
  readonly network: "mainnet" | "testnet";
  readonly challengeTtlMs: number;
  readonly sessionTtlMs: number;
  readonly cookieSecure: boolean;
  readonly clock?: () => number;
  readonly verifier?: SignatureVerifier;
  readonly challenges?: MemoryChallengeStore;
  readonly sessions?: MemorySessionStore;
}

const CONTEXT_COOKIE = "sigil_pre_auth";
const SESSION_COOKIE = "sigil_session";
const MAX_PROOF_BODY_BYTES = 16 * 1024;
const randomToken = (bytes = 32): string =>
  randomBytes(bytes).toString("base64url");

type BoundedJsonResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly reason: "invalid" | "too_large" };

async function readBoundedJson(request: Request): Promise<BoundedJsonResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_PROOF_BODY_BYTES)
      return { ok: false, reason: "too_large" };
  }

  if (!request.body) return { ok: false, reason: "invalid" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_PROOF_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function createApp(config: AppConfig): Hono {
  const clock = config.clock ?? Date.now;
  const verifier = config.verifier ?? sigV1Verifier;
  const challenges = config.challenges ?? new MemoryChallengeStore();
  const sessions = config.sessions ?? new MemorySessionStore();
  const contextMacKey = randomBytes(32);
  const app = new Hono();

  const createContextCookie = (): { cookie: string; contextId: string } => {
    const contextId = randomToken();
    const mac = createHmac("sha256", contextMacKey)
      .update(contextId)
      .digest("base64url");
    return { cookie: `${contextId}.${mac}`, contextId };
  };
  const verifyContextCookie = (value: string | undefined): string | null => {
    if (!value) return null;
    const [contextId, suppliedMac, extra] = value.split(".");
    if (
      !contextId ||
      !suppliedMac ||
      extra !== undefined ||
      !/^[A-Za-z0-9_-]{40,}$/.test(contextId) ||
      !/^[A-Za-z0-9_-]{43}$/.test(suppliedMac)
    )
      return null;
    const expected = createHmac("sha256", contextMacKey)
      .update(contextId)
      .digest();
    const supplied = Buffer.from(suppliedMac, "base64url");
    return supplied.length === expected.length &&
      timingSafeEqual(supplied, expected)
      ? contextId
      : null;
  };

  app.use("*", async (c, next) => {
    const origin = c.req.header("origin");
    if (origin && origin !== config.domain)
      return c.json({ error: "ORIGIN_REJECTED" }, 403);
    await next();
  });

  app.get("/auth/challenge", (c) => {
    const origin = c.req.header("origin");
    if (origin && origin !== config.domain)
      return c.json({ error: "ORIGIN_REJECTED" }, 403);
    const now = clock();
    // Fresh, server-authenticated pre-auth context per challenge prevents a
    // caller from choosing the context and avoids reusing an old login context.
    const { cookie: contextCookie, contextId } = createContextCookie();
    const nonce = randomToken(24);
    const requestId = randomBytes(16).toString("hex");
    const expiresAt = now + config.challengeTtlMs;
    challenges.prune(now);
    try {
      challenges.issue({ nonce, contextId, expiresAt, requestId });
    } catch {
      return c.json({ error: "CHALLENGE_CAPACITY" }, 503);
    }
    setCookie(c, CONTEXT_COOKIE, contextCookie, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "Lax",
      path: "/",
      maxAge: Math.ceil(config.challengeTtlMs / 1000),
    });
    return c.json({ nonce, requestId, expiresInMs: config.challengeTtlMs });
  });

  app.post("/auth/verify", async (c) => {
    if (c.req.header("origin") !== config.domain)
      return c.json({ error: "ORIGIN_REJECTED" }, 403);
    if (
      !c.req
        .header("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return c.json({ error: "INVALID_PROOF" }, 415);
    const parsedBody = await readBoundedJson(c.req.raw);
    if (!parsedBody.ok) {
      return c.json(
        {
          error:
            parsedBody.reason === "too_large"
              ? "PROOF_TOO_LARGE"
              : "INVALID_PROOF",
        },
        parsedBody.reason === "too_large" ? 413 : 400,
      );
    }
    const proof = parsedBody.value;
    const contextId = verifyContextCookie(getCookie(c, CONTEXT_COOKIE));
    if (!contextId) return c.json({ error: "CHALLENGE_CONTEXT_MISSING" }, 401);
    if (!proof || typeof proof !== "object" || Array.isArray(proof))
      return c.json({ error: "INVALID_PROOF" }, 400);
    const p = proof as Record<string, unknown>;
    if (
      typeof p.message !== "string" ||
      typeof p.signature !== "string" ||
      typeof p.address !== "string"
    ) {
      return c.json({ error: "INVALID_PROOF" }, 400);
    }
    const statement = parseAuthStatement(p.message);
    if (!statement) return c.json({ error: "MALFORMED_STATEMENT" }, 401);
    if (statement.address !== p.address)
      return c.json({ error: "ADDRESS_MISMATCH" }, 401);
    if (statement.domain !== config.domain)
      return c.json({ error: "DOMAIN_MISMATCH" }, 401);
    if (statement.network !== config.network)
      return c.json({ error: "NETWORK_MISMATCH" }, 401);
    if (!addressMatchesNetwork(p.address, config.network))
      return c.json({ error: "ADDRESS_NETWORK_MISMATCH" }, 401);
    if (typeof p.nonce !== "string" || p.nonce !== statement.nonce)
      return c.json({ error: "NONCE_MISMATCH" }, 401);
    if (
      p.domain !== statement.domain ||
      p.uri !== statement.uri ||
      p.network !== statement.network
    ) {
      return c.json({ error: "PROOF_FIELDS_MISMATCH" }, 401);
    }
    if (
      p.issuedAt !== statement.iat ||
      p.expirationTime !== statement.exp ||
      p.requestId !== statement.rid
    ) {
      return c.json({ error: "PROOF_FIELDS_MISMATCH" }, 401);
    }

    const now = clock();
    const skew = 30_000;
    if (
      statement.iat > now + skew ||
      statement.exp <= now ||
      statement.exp <= statement.iat ||
      statement.exp - statement.iat > 3_600_000
    ) {
      return c.json({ error: "INVALID_TIMESTAMP" }, 401);
    }

    // Verify exact received bytes first. Do not burn a valid challenge on bad signatures.
    if (
      !verifier.verify({
        address: p.address,
        message: p.message,
        signature: p.signature,
      })
    ) {
      return c.json({ error: "INVALID_SIGNATURE" }, 401);
    }
    if (
      !challenges.consume({
        nonce: statement.nonce,
        contextId,
        now,
        requestId: statement.rid,
      })
    ) {
      return c.json({ error: "NONCE_INVALID_OR_USED" }, 401);
    }

    const session = randomToken();
    const expiresAt = now + config.sessionTtlMs;
    sessions.create(session, {
      address: p.address,
      network: statement.network,
      expiresAt,
    });
    // Keep the HttpOnly pre-auth context until its short challenge TTL so the
    // client can replay the same proof and observe the consumed-nonce rejection.
    // The challenge tuple is removed atomically, so the cookie alone cannot auth.
    setCookie(c, SESSION_COOKIE, session, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "Lax",
      path: "/",
      maxAge: Math.ceil(config.sessionTtlMs / 1000),
    });
    return c.json({ ok: true, address: p.address, network: statement.network });
  });

  app.get("/api/me", (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return c.json({ error: "UNAUTHENTICATED" }, 401);
    const session = sessions.get(token, clock());
    if (!session) return c.json({ error: "SESSION_INVALID" }, 401);
    return c.json({
      address: session.address,
      network: session.network,
      expiresAt: session.expiresAt,
    });
  });

  app.post("/auth/logout", (c) => {
    if (c.req.header("origin") !== config.domain)
      return c.json({ error: "ORIGIN_REJECTED" }, 403);
    const token = getCookie(c, SESSION_COOKIE);
    if (token) sessions.revoke(token);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  app.get("/health", (c) => c.json({ ok: true, network: config.network }));
  return app;
}

export function createRequestId(): string {
  return randomUUID();
}

import { describe, expect, it } from "vitest";
import { MemoryChallengeStore } from "../packages/core/src/stores/memory-challenge-store.js";
import { MemorySessionStore } from "../packages/core/src/stores/memory-session-store.js";

describe("memory stores", () => {
  it("allows exactly one synchronous consumer under competing requests", async () => {
    const store = new MemoryChallengeStore();
    store.issue({
      nonce: "nonce-12345678",
      contextId: "context",
      expiresAt: 500,
      requestId: "rid1234567890",
    });
    const results = await Promise.all(
      Array.from({ length: 100 }, async () =>
        store.consume({
          nonce: "nonce-12345678",
          contextId: "context",
          now: 100,
          requestId: "rid1234567890",
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("rejects unknown, wrong-context and expired challenges without consuming valid context state", () => {
    const store = new MemoryChallengeStore();
    store.issue({
      nonce: "nonce-12345678",
      contextId: "context",
      expiresAt: 500,
      requestId: "rid1234567890",
    });
    expect(
      store.consume({
        nonce: "missing-12345678",
        contextId: "context",
        now: 100,
        requestId: "rid1234567890",
      }),
    ).toBe(false);
    expect(
      store.consume({
        nonce: "nonce-12345678",
        contextId: "other",
        now: 100,
        requestId: "rid1234567890",
      }),
    ).toBe(false);
    expect(
      store.consume({
        nonce: "nonce-12345678",
        contextId: "context",
        now: 500,
        requestId: "rid1234567890",
      }),
    ).toBe(false);
  });

  it("expires and revokes sessions", () => {
    const store = new MemorySessionStore();
    store.create("token", {
      address: "address",
      network: "testnet",
      expiresAt: 50,
    });
    expect(store.get("token", 49)?.address).toBe("address");
    expect(store.get("token", 50)).toBeNull();
    store.create("token2", {
      address: "address",
      network: "testnet",
      expiresAt: 100,
    });
    store.revoke("token2");
    expect(store.get("token2", 1)).toBeNull();
  });
});

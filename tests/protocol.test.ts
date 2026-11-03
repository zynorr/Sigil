import { describe, expect, it } from "vitest";
import { parseAuthStatement } from "../packages/core/src/protocol/auth-statement.js";

const valid =
  "beldex-auth-v1 domain=https://app.example uri=https://app.example/login address=9vudUCJcsCW1gNhERJKdWVRD8e1TyJPVY295XMuQNiZnAe4oU7F5vgF3Ueo7gDCyc6h6UYGSbTiPZFt7CcoF1ymaUhXR9es network=testnet nonce=abcdefgh12345678 iat=1780000000000 exp=1780000300000 rid=req_1";

describe("beldex-auth-v1 parser", () => {
  it("parses fields but preserves exact message bytes", () => {
    const parsed = parseAuthStatement(valid);
    expect(parsed?.message).toBe(valid);
    expect(parsed?.uri).toBe("https://app.example/login");
    expect(parsed?.network).toBe("testnet");
  });

  it.each([
    valid.replace("beldex-auth-v1", "beldex-auth-v2"),
    valid.replace(" nonce=", " mystery=x nonce="),
    valid.replace(" network=", " network=testnet network="),
    valid.replace(" exp=", " exp=nope"),
    valid.replace(
      "uri=https://app.example/login",
      "uri=https://evil.example/login",
    ),
    valid.replace("network=testnet", "network=devnet"),
    valid.replace(" address=", "\n address="),
    valid.replace(" address=", " address=x address="),
    valid.replace(" nonce=", " nonce=bad nonce="),
    valid.replace("domain=https://app.example", "domain=http://app.example"),
  ])("rejects malformed statement: %s", (value) => {
    expect(parseAuthStatement(value)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  addressMatchesNetwork,
  addressSpendKey,
  checkSignature,
  verifySigV1,
} from "../packages/core/src/verifier/sigv1.js";

const cliAddress =
  "9vudUCJcsCW1gNhERJKdWVRD8e1TyJPVY295XMuQNiZnAe4oU7F5vgF3Ueo7gDCyc6h6UYGSbTiPZFt7CcoF1ymaUhXR9es";
const cliSignature =
  "SigV18njAqA6BoPdfpP2QxkLEqDTb36uuSMU3m1fjFZL12cTtfppHSg92b8kf7a2srWNYS1D2JWeT4d2MA7JoRQwwzbiu";
const cliMessage =
  '"beldex-asset-ownership|v1|56e4bae7df73d7ce0881d214032536cad34bf515e0ed670c524188dd9cc540fa|62b806dd4aabcb04|1786948487|8b008a9dc5cf31ca|490b37a671a2ac25c3aa088c9592f287"';
const spendKey =
  "62b806dd4aabcb040f03f3a4485bde90bcb611ea9d357706cfb055365c086939";

describe("SigV1 compatibility with upstream extension fixtures", () => {
  it("extracts the CLI fixture spend key from the Beldex address", () => {
    expect(addressSpendKey(cliAddress)).toBe(spendKey);
    expect(addressMatchesNetwork(cliAddress, "testnet")).toBe(true);
    expect(addressMatchesNetwork(cliAddress, "mainnet")).toBe(false);
  });

  it("verifies the upstream beldex-wallet-cli signature fixture", () => {
    expect(
      verifySigV1({
        address: cliAddress,
        message: cliMessage,
        signature: cliSignature,
      }),
    ).toBe(true);
    expect(
      verifySigV1({
        address: cliAddress,
        message: cliMessage.slice(1),
        signature: cliSignature,
      }),
    ).toBe(false);
  });

  it("rejects invalid, tampered and malformed addresses/signatures", () => {
    expect(addressSpendKey("not-an-address")).toBeNull();
    expect(addressSpendKey(cliAddress.slice(0, -1) + "X")).toBeNull();
    expect(
      verifySigV1({
        address: cliAddress,
        message: cliMessage,
        signature: "SigV1!!!",
      }),
    ).toBe(false);
    expect(
      verifySigV1({
        address: "bad",
        message: cliMessage,
        signature: cliSignature,
      }),
    ).toBe(false);
  });

  it("rejects invalid key and signature lengths", () => {
    expect(
      checkSignature(
        new Uint8Array(31),
        new Uint8Array(32),
        new Uint8Array(64),
      ),
    ).toBe(false);
    expect(
      checkSignature(
        new Uint8Array(32),
        new Uint8Array(32),
        new Uint8Array(63),
      ),
    ).toBe(false);
    expect(
      checkSignature(
        new Uint8Array(32),
        new Uint8Array(32),
        new Uint8Array(64),
      ),
    ).toBe(false);
  });

  it("rejects incorrect public key relationship", () => {
    expect(
      verifySigV1({
        address: cliAddress,
        message: cliMessage,
        signature: cliSignature.replace(/^SigV1/, "SigV2"),
      }),
    ).toBe(false);
  });
});

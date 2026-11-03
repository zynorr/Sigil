/*
 * SigV1 verification implementation derived from:
 * Beldex-Coin/beldex-wallet-extension/src/lib/signMessage.ts
 * Commit f8f4014aa3c2d357a2b48b8069e012b6d129f59a
 * Copyright (c) 2026 Beldex Wallet; MIT License (see LICENSE and
 * THIRD_PARTY_NOTICES.md). Verification/address-decoding path only; signing
 * and wallet/browser functionality are intentionally not included.
 */
import { ed25519 } from "@noble/curves/ed25519";
import { keccak_256 } from "@noble/hashes/sha3";

const L = ed25519.CURVE.n;
const MAGIC = "SigV1";
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ENCODED_BLOCK_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11];

function bytesToNumberLE(bytes: Uint8Array): bigint {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]!);
  return n;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex))
    throw new Error("invalid hex");
  return Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
    Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16),
  );
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/** Beldex/Monero block-based base58, matching the upstream wallet implementation. */
export function base58Decode(text: string): Uint8Array {
  if (!text) return new Uint8Array();
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 11) {
    const chunk = text.slice(i, i + 11);
    const size =
      chunk.length === 11 ? 8 : ENCODED_BLOCK_SIZES.indexOf(chunk.length);
    if (size <= 0) throw new Error("invalid base58 length");
    let value = 0n;
    for (const char of chunk) {
      const digit = ALPHABET.indexOf(char);
      if (digit < 0) throw new Error("invalid base58 character");
      value = value * 58n + BigInt(digit);
    }
    if (value >= 1n << BigInt(8 * size))
      throw new Error("base58 block overflow");
    const block = new Uint8Array(size);
    for (let j = size - 1; j >= 0; j--) {
      block[j] = Number(value & 0xffn);
      value >>= 8n;
    }
    out.push(...block);
  }
  return Uint8Array.from(out);
}

function hashToScalar(bytes: Uint8Array): bigint {
  return bytesToNumberLE(keccak_256(bytes)) % L;
}

/** Verify the upstream crypto::check_signature equation and weak-key policy. */
export function checkSignature(
  prefixHash: Uint8Array,
  pub: Uint8Array,
  sig: Uint8Array,
): boolean {
  if (prefixHash.length !== 32 || pub.length !== 32 || sig.length !== 64)
    return false;

  let point: ReturnType<typeof ed25519.ExtendedPoint.fromHex>;
  try {
    point = ed25519.ExtendedPoint.fromHex(pub);
  } catch {
    return false;
  }

  // Mirrors upstream identity/torsion rejection; public-key validation is security-critical.
  if (point.equals(ed25519.ExtendedPoint.ZERO) || !point.isTorsionFree())
    return false;

  const c = bytesToNumberLE(sig.subarray(0, 32));
  const r = bytesToNumberLE(sig.subarray(32));
  if (c >= L || r >= L || c === 0n) return false;

  const commitment = point
    .multiplyUnsafe(c)
    .add(ed25519.ExtendedPoint.BASE.multiplyUnsafe(r))
    .toRawBytes();
  if (
    commitment[0] === 1 &&
    commitment.every((byte, index) => index === 0 || byte === 0)
  )
    return false;
  return hashToScalar(concat(prefixHash, pub, commitment)) === c;
}

/** Extract the spend public key from standard or integrated Beldex address. */
export function addressSpendKey(address: string): string | null {
  if (typeof address !== "string" || address.length > 512) return null;
  let raw: Uint8Array;
  try {
    raw = base58Decode(address.trim());
  } catch {
    return null;
  }
  if (raw.length < 69) return null;

  let offset = 0;
  for (; offset < raw.length; offset++) {
    if ((raw[offset]! & 0x80) === 0) {
      offset++;
      break;
    }
  }
  if (offset === 0 || offset > raw.length - 4) return null;
  const body = raw.subarray(0, raw.length - 4);
  const checksum = raw.subarray(raw.length - 4);
  const expected = keccak_256(body).subarray(0, 4);
  for (let i = 0; i < 4; i++) if (checksum[i] !== expected[i]) return null;

  let prefix = 0;
  for (let i = 0; i < offset; i++) prefix |= (raw[i]! & 0x7f) << (7 * i);
  const kind =
    prefix === 209 || prefix === 53
      ? "standard"
      : prefix === 19 || prefix === 54
        ? "integrated"
        : prefix === 42 || prefix === 63
          ? "subaddress"
          : null;
  if (!kind || raw.length !== offset + (kind === "integrated" ? 72 : 64) + 4)
    return null;

  const spendKey = raw.subarray(offset, offset + 32);
  return spendKey.length === 32 ? bytesToHex(spendKey) : null;
}

export function addressMatchesNetwork(
  address: string,
  network: "mainnet" | "testnet",
): boolean {
  if (typeof address !== "string" || address.length > 128) return false;
  let raw: Uint8Array;
  try {
    raw = base58Decode(address);
  } catch {
    return false;
  }
  let prefix = 0;
  let offset = 0;
  for (;;) {
    if (offset >= raw.length || offset >= 4) return false;
    const byte = raw[offset]!;
    prefix |= (byte & 0x7f) << (7 * offset);
    offset++;
    if ((byte & 0x80) === 0) break;
  }
  const allowed = network === "mainnet" ? [209, 19, 42] : [53, 54, 63];
  return allowed.includes(prefix) && addressSpendKey(address) !== null;
}

/** Verify SigV1 over the exact UTF-8 message bytes against a Beldex address. */
export function verifySigV1(input: {
  address: string;
  message: string;
  signature: string;
}): boolean {
  if (
    !input ||
    typeof input.message !== "string" ||
    input.message.length > 65_536
  )
    return false;
  if (typeof input.signature !== "string" || input.signature.length > 4096)
    return false;
  const spendKey = addressSpendKey(input.address);
  if (!spendKey) return false;

  const signature = input.signature.trim();
  if (!signature.startsWith(MAGIC)) return false;
  try {
    const rawSignature = base58Decode(signature.slice(MAGIC.length));
    return checkSignature(
      keccak_256(new TextEncoder().encode(input.message)),
      hexToBytes(spendKey),
      rawSignature,
    );
  } catch {
    return false;
  }
}

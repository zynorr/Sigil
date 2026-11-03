export interface AuthStatement {
  readonly domain: string;
  readonly uri: string;
  readonly address: string;
  readonly network: "mainnet" | "testnet";
  readonly nonce: string;
  readonly iat: number;
  readonly exp: number;
  readonly rid?: string;
  /** Original statement; always pass this value to signature verification. */
  readonly message: string;
}

const PREFIX = "beldex-auth-v1";
const FIELD_ORDER = [
  "domain",
  "uri",
  "address",
  "network",
  "nonce",
  "iat",
  "exp",
  "rid",
] as const;
const VALUE_RE = /^[^\s\u0000-\u001f\u007f-\u009f]+$/u;

export function parseAuthStatement(message: unknown): AuthStatement | null {
  if (
    typeof message !== "string" ||
    message.length === 0 ||
    message.length > 512
  )
    return null;
  if (/[\r\n\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(message))
    return null;

  const tokens = message.split(" ");
  if (tokens[0] !== PREFIX || tokens.some((token) => token.length === 0))
    return null;
  const fields = new Map<string, string>();
  for (const token of tokens.slice(1)) {
    const separator = token.indexOf("=");
    if (separator < 1) return null;
    const key = token.slice(0, separator);
    const value = token.slice(separator + 1);
    if (
      !FIELD_ORDER.includes(key as (typeof FIELD_ORDER)[number]) ||
      fields.has(key) ||
      !value ||
      !VALUE_RE.test(value)
    )
      return null;
    fields.set(key, value);
  }

  const required = FIELD_ORDER.slice(0, 7);
  if (required.some((key) => !fields.has(key))) return null;
  const present = FIELD_ORDER.filter((key) => fields.has(key));
  if (
    present.some(
      (key, i) =>
        present[i - 1] !== undefined &&
        FIELD_ORDER.indexOf(key) <= FIELD_ORDER.indexOf(present[i - 1]!),
    )
  )
    return null;

  const domain = fields.get("domain")!;
  const uri = fields.get("uri")!;
  const address = fields.get("address")!;
  const network = fields.get("network");
  const nonce = fields.get("nonce")!;
  const iatText = fields.get("iat")!;
  const expText = fields.get("exp")!;
  const rid = fields.get("rid");
  if (network !== "mainnet" && network !== "testnet") return null;
  if (!/^\d{1,16}$/.test(iatText) || !/^\d{1,16}$/.test(expText)) return null;
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(nonce)) return null;
  if (rid !== undefined && !/^[A-Za-z0-9._-]{1,64}$/.test(rid)) return null;

  let parsedDomain: URL;
  let parsedUri: URL;
  try {
    parsedDomain = new URL(domain);
    parsedUri = new URL(uri);
  } catch {
    return null;
  }
  if (
    !["https:", "http:"].includes(parsedDomain.protocol) ||
    parsedDomain.origin !== domain
  )
    return null;
  if (
    parsedUri.origin !== parsedDomain.origin ||
    parsedUri.href !== uri ||
    parsedUri.username ||
    parsedUri.password
  )
    return null;
  if (parsedUri.hash) return null;
  if (parsedUri.search) return null;

  const iat = Number(iatText);
  const exp = Number(expText);
  if (!Number.isSafeInteger(iat) || !Number.isSafeInteger(exp)) return null;

  return {
    domain,
    uri,
    address,
    network,
    nonce,
    iat,
    exp,
    ...(rid !== undefined ? { rid } : {}),
    message,
  };
}

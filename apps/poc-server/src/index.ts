import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const domain = process.env.APP_ORIGIN ?? "http://localhost:5173";
const network = process.env.NETWORK === "mainnet" ? "mainnet" : "testnet";
const cookieSecure = process.env.COOKIE_SECURE === "true";

serve(
  {
    fetch: createApp({
      domain,
      network,
      challengeTtlMs: Number(process.env.CHALLENGE_TTL_MS ?? 300_000),
      sessionTtlMs: Number(process.env.SESSION_TTL_MS ?? 28_800_000),
      cookieSecure,
    }).fetch,
    hostname: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 8787),
  },
  (info) => {
    console.log(
      `Sigil POC listening on http://${info.address}:${info.port} (${network})`,
    );
  },
);

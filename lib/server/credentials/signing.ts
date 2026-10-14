/**
 * Ed25519 signing for verifiable credentials (Node built-in crypto, no dependencies).
 *
 * Key source, in order:
 *   1. PROMPTIQ_SIGNING_KEY  — PKCS#8 PEM private key (set this in production; keep it secret)
 *   2. .data/signing-key.pem — generated automatically on first use for local development
 * The public key is published at /api/credentials/public-key so anyone can verify offline.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Keys = { privateKey: KeyObject; publicKey: KeyObject; keyId: string; publicPem: string };
let cached: Keys | undefined;

function load(): Keys {
  if (cached) return cached;
  let pem = process.env.PROMPTIQ_SIGNING_KEY?.replace(/\\n/g, "\n");
  if (!pem) {
    const file = path.join(process.cwd(), ".data", "signing-key.pem");
    if (!existsSync(file)) {
      if (process.env.NODE_ENV === "production" && !process.env.ALLOW_EPHEMERAL_SIGNING_KEY) {
        throw new Error("PROMPTIQ_SIGNING_KEY is not set — refusing to mint an unpersisted production signing key");
      }
      mkdirSync(path.dirname(file), { recursive: true });
      const { privateKey } = generateKeyPairSync("ed25519");
      writeFileSync(file, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
    }
    pem = readFileSync(file, "utf8");
  }
  const privateKey = createPrivateKey(pem);
  const publicKey = createPublicKey(privateKey);
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const keyId = "piq-" + createHash("sha256").update(publicPem).digest("hex").slice(0, 16);
  return (cached = { privateKey, publicKey, keyId, publicPem });
}

/** Deterministic JSON (sorted keys) so the signed bytes are reproducible by any verifier. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

export function signPayload(payload: Record<string, unknown>) {
  const { privateKey, keyId } = load();
  return { signature: sign(null, Buffer.from(canonicalJson(payload)), privateKey).toString("base64url"), keyId };
}

export function verifyPayload(payload: Record<string, unknown>, signature: string): boolean {
  try {
    return verify(null, Buffer.from(canonicalJson(payload)), load().publicKey, Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}

export function publicKeyInfo() {
  const { keyId, publicPem } = load();
  return { keyId, algorithm: "Ed25519", publicKeyPem: publicPem };
}

import { publicKeyInfo } from "@/lib/server/credentials/signing";

// Read the key at request time, never at build time (the build environment has no signing key).
export const dynamic = "force-dynamic";

/** The Ed25519 public key that signs PromptIQ certificates — lets anyone verify signatures offline. */
export function GET() {
  return Response.json(publicKeyInfo());
}

import { encode } from "gpt-tokenizer";

/** Real BPE token count (o200k-family tokenizer), model-independent reference measure. */
export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch {
    return Math.ceil(text.length / 4); // fallback for pathological input
  }
}

export function countWords(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

/**
 * Behavioural integrity signals (PromptIQ doc §6.3). Proportionate by design: signals are recorded
 * and surfaced for human review, never used to auto-accuse. Only certification excludes flagged attempts.
 */
import type { IntegrityFlag, IntegrityInfo } from "../server/db/schema";

/** Sustained typing above ~15 characters/second is beyond human speed (fast typists ≈ 6–10 cps). */
export const MAX_HUMAN_CPS = 15;

export function integritySignals(args: {
  promptChars: number;
  elapsedMs?: number;
  pastedChars?: number;
  expectedSuccess?: number; // from the adaptive rating: P(success) before the attempt
  taskSuccess: number;
}): IntegrityInfo {
  const flags: IntegrityFlag[] = [];
  const pasted = Math.min(args.pastedChars ?? 0, args.promptChars);
  const typed = args.promptChars - pasted;
  if (args.elapsedMs !== undefined && args.elapsedMs > 0 && typed > 120) {
    const cps = typed / (args.elapsedMs / 1000);
    if (cps > MAX_HUMAN_CPS) flags.push("implausible_typing_speed");
  }
  if (args.promptChars > 150 && pasted / args.promptChars > 0.9) flags.push("mostly_pasted");
  if (args.expectedSuccess !== undefined && args.expectedSuccess < 0.25 && args.taskSuccess >= 95) flags.push("sudden_jump");
  return { flags, elapsedMs: args.elapsedMs, pastedChars: args.pastedChars };
}

/** Flags serious enough to exclude an attempt from certification evidence. */
export const DISQUALIFYING: IntegrityFlag[] = ["implausible_typing_speed"];

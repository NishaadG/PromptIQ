import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ users & sessions */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    handle: text("handle").notNull(),
    org: text("org"),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["learner", "admin"] }).notNull().default("learner"),
    xp: integer("xp").notNull().default(0),
    tokens: integer("tokens").notNull().default(0), // gamified balance (not LLM tokens)
    rating: real("rating").notNull().default(1000), // adaptive-difficulty ability estimate (Elo-style)
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    lastActiveDay: text("last_active_day"), // YYYY-MM-DD (UTC)
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_handle_idx").on(t.handle)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256(token) — the raw token only ever lives in the cookie
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ item bank */

export type RubricCriterion =
  | { kind: "includes_any"; label: string; terms: string[]; weight: number }
  | { kind: "includes_all"; label: string; terms: string[]; weight: number }
  | { kind: "excludes"; label: string; terms: string[]; weight: number }
  | { kind: "max_words"; label: string; max: number; weight: number }
  | { kind: "min_items"; label: string; min: number; weight: number }
  | { kind: "json_fields"; label: string; fields: Record<string, string | number | boolean | null>; weight: number }
  | { kind: "regex"; label: string; pattern: string; flags?: string; weight: number }
  | { kind: "llm_judge"; label: string; question: string; weight: number };

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(), // stable slug
  number: integer("number").notNull(), // display number, e.g. "Task 041"
  title: text("title").notNull(),
  category: text("category").notNull(),
  domain: text("domain", {
    enum: ["summarization", "extraction", "rewriting", "explanation", "classification", "reasoning", "code", "qa"],
  }).notNull(),
  difficulty: text("difficulty", { enum: ["Foundational", "Intermediate", "Advanced"] }).notNull(),
  difficultyRating: real("difficulty_rating").notNull().default(1000),
  estMinutes: integer("est_minutes").notNull(),
  reward: integer("reward").notNull(),
  brief: text("brief").notNull(),
  contextLabel: text("context_label").notNull(),
  context: text("context").notNull(),
  tokenBudget: integer("token_budget").notNull(),
  rubric: jsonb("rubric").$type<RubricCriterion[]>().notNull(),
  // Canned response used by the offline "simulated" provider (no API key needed).
  simulatedResponse: text("simulated_response").notNull(),
  samplePrompt: text("sample_prompt").notNull(),
  medianScore: integer("median_score").notNull(),
  medianTokens: integer("median_tokens").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ attempts */

export type DetectedTechnique = { id: string; name: string; evidence: string };
export type IntegrityFlag = "implausible_typing_speed" | "mostly_pasted" | "sudden_jump";
export type IntegrityInfo = { flags: IntegrityFlag[]; elapsedMs?: number; pastedChars?: number };
export type FeedbackItem = { kind: "cost" | "win" | "tip" | "warn"; text: string; source?: string };

export const attempts = pgTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull().references(() => tasks.id),
    attemptNumber: integer("attempt_number").notNull(),
    prompt: text("prompt").notNull(),
    response: text("response").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    taskSuccess: integer("task_success").notNull(), // 0–100
    efficiency: integer("efficiency").notNull(), // 0–100
    clarity: integer("clarity").notNull(), // 0–100
    criteria: jsonb("criteria").$type<{ label: string; passed: boolean; weight: number; detail?: string }[]>().notNull(),
    techniques: jsonb("techniques").$type<DetectedTechnique[]>().notNull(),
    feedback: jsonb("feedback").$type<FeedbackItem[]>().notNull(),
    reward: integer("reward").notNull(),
    bonus: integer("bonus").notNull(),
    claimed: boolean("claimed").notNull().default(false),
    // Behavioural integrity signals (never penalise practice; flagged attempts don't count toward certificates)
    integrity: jsonb("integrity").$type<IntegrityInfo>().notNull().default({ flags: [] }),
    createdAt: createdAt(),
  },
  (t) => [index("attempts_user_idx").on(t.userId, t.createdAt), index("attempts_task_idx").on(t.taskId)],
);

/* ------------------------------------------------------------------ verifiable credentials */

export const credentials = pgTable(
  "credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    track: text("track").notNull(),
    level: text("level", { enum: ["Foundational", "Practitioner", "Expert"] }).notNull(),
    score: integer("score").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(), // exactly what was signed
    signature: text("signature").notNull(), // base64url Ed25519 signature over canonical JSON payload
    keyId: text("key_id").notNull(),
    revoked: boolean("revoked").notNull().default(false),
  },
  (t) => [index("credentials_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ Local Lab */

export type LabSide = {
  provider: string; model: string; label: string; response: string; taskSuccess: number;
  totalTokens: number; latencyMs: number; costUsd: number;
};

export const labRuns = pgTable(
  "lab_runs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull().references(() => tasks.id),
    prompt: text("prompt").notNull(),
    cloud: jsonb("cloud").$type<LabSide>().notNull(),
    local: jsonb("local").$type<LabSide>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("lab_runs_user_idx").on(t.userId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Credential = typeof credentials.$inferSelect;

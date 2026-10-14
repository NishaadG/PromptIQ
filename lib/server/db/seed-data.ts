import type { RubricCriterion } from "./schema";

type SeedTask = {
  id: string; number: number; title: string; category: string;
  domain: "summarization" | "extraction" | "rewriting" | "explanation" | "classification" | "reasoning" | "code" | "qa";
  difficulty: "Foundational" | "Intermediate" | "Advanced"; difficultyRating: number; estMinutes: number; reward: number;
  brief: string; contextLabel: string; context: string; tokenBudget: number; rubric: RubricCriterion[];
  simulatedResponse: string; samplePrompt: string; medianScore: number; medianTokens: number;
};

export const SEED_TASKS: SeedTask[] = [
  {
    id: "legal-clause-01", number: 41, title: "Summarize this legal clause for a non-lawyer", category: "Summarization",
    domain: "summarization", difficulty: "Intermediate", difficultyRating: 1050, estMinutes: 6, reward: 120, tokenBudget: 600,
    brief: "A small-business owner has been sent this indemnification clause by a new supplier. Write a prompt that gets the model to explain, in plain English, what they're agreeing to and the one thing they should push back on. The owner will read it on their phone.",
    contextLabel: "Master Services Agreement — §9, ¶3",
    context: "9.3 Indemnification. Customer shall defend, indemnify and hold harmless Supplier, its affiliates, officers, directors, employees and agents from and against any and all losses, damages, liabilities, deficiencies, claims, actions, judgments, settlements, interest, awards, penalties, fines, costs or expenses of whatever kind, including reasonable attorneys' fees, arising out of or relating to Customer's use of the Services, including without limitation any claim arising from Supplier's negligence, save for gross negligence or wilful misconduct.",
    rubric: [
      { kind: "includes_any", label: "Explains what the owner is agreeing to pay for", terms: ["you pay", "you'd pay", "you would pay", "you cover", "you'd cover", "you are responsible", "you're responsible", "on the hook"], weight: 3 },
      { kind: "includes_any", label: "Flags that it covers the supplier's own negligence", terms: ["their own mistake", "supplier's mistake", "supplier's negligence", "their negligence", "their mistakes"], weight: 3 },
      { kind: "includes_any", label: "Gives one concrete thing to push back on", terms: ["push back", "ask them to", "strike", "remove", "negotiate", "delete"], weight: 3 },
      { kind: "excludes", label: "Avoids untranslated legalese", terms: ["indemnitor", "hereinafter", "save for gross"], weight: 1 },
      { kind: "max_words", label: "Short enough to read on a phone (≤120 words)", max: 120, weight: 2 },
    ],
    simulatedResponse: "**What you're agreeing to:** If anyone makes a claim connected to your use of this supplier's service, you pay for it — their lawyers, damages, fines, the lot.\n\n**The catch:** That includes claims caused by the supplier's own mistakes (\"Supplier's negligence\"). You'd only be off the hook if they were *grossly* negligent or did it on purpose.\n\n**Push back on:** Ask them to strike \"including without limitation any claim arising from Supplier's negligence.\" Covering your own mistakes is normal; covering theirs isn't.",
    samplePrompt: "You're helping a small-business owner who isn't a lawyer and will read this on their phone.\n\nExplain the clause below in plain English, in three short bullets:\n1. What they're agreeing to\n2. The catch\n3. The one thing to push back on (quote the exact phrase)\n\nKeep each bullet under 40 words.\n\nClause:\n{{context}}",
    medianScore: 74, medianTokens: 610,
  },
  {
    id: "invoice-extract-02", number: 42, title: "Pull invoice totals out of a messy email thread", category: "Data extraction",
    domain: "extraction", difficulty: "Foundational", difficultyRating: 900, estMinutes: 4, reward: 80, tokenBudget: 400,
    brief: "Finance needs the amount still owed to this vendor, as machine-readable data for their spreadsheet import. One invoice in the thread was cancelled. Write a prompt that returns exactly what the import needs.",
    contextLabel: "Email thread — Brightline Supplies (4 messages)",
    context: "From: accounts@brightline.example\n> Attached are INV-1042 ($1,250.00) and INV-1043 ($380.50) for September.\n\nFrom: ops@ourco.example\n> INV-1043 duplicates the August delivery — please cancel it.\n\nFrom: accounts@brightline.example\n> Apologies, INV-1043 is cancelled. Also attaching INV-1044 ($2,100.00) for the October order. All amounts USD.\n\nFrom: ops@ourco.example\n> Thanks, approved for payment.",
    rubric: [
      { kind: "json_fields", label: "Returns valid JSON with the correct total, count and currency", fields: { total_due: 3350, invoice_count: 2, currency: "USD" }, weight: 6 },
      { kind: "excludes", label: "Does not count the cancelled invoice", terms: ["3730.5", "3,730.50", "3730.50"], weight: 2 },
      { kind: "max_words", label: "No surrounding chatter (≤60 words)", max: 60, weight: 2 },
    ],
    simulatedResponse: "```json\n{\"total_due\": 3350, \"invoice_count\": 2, \"currency\": \"USD\"}\n```",
    samplePrompt: "From the email thread below, return only JSON with keys total_due (number), invoice_count (int, excluding cancelled invoices) and currency (ISO code). No explanation.\n\n{{context}}",
    medianScore: 81, medianTokens: 380,
  },
  {
    id: "tone-rewrite-03", number: 43, title: "Rewrite a curt customer reply without losing the refusal", category: "Rewriting",
    domain: "rewriting", difficulty: "Intermediate", difficultyRating: 1000, estMinutes: 5, reward: 100, tokenBudget: 500,
    brief: "A support agent's draft is accurate but rude. The refund is still not allowed (the return window closed 3 weeks ago), but we can offer store credit. Get the model to rewrite it so the customer feels respected — without promising a refund.",
    contextLabel: "Draft reply — ticket #88213",
    context: "No. Your return window closed on the 2nd. We don't do refunds after 30 days, it's in the policy you agreed to. Nothing I can do.",
    rubric: [
      { kind: "includes_any", label: "Acknowledges the customer's frustration", terms: ["sorry", "understand", "apolog", "frustrat"], weight: 2 },
      { kind: "includes_any", label: "Keeps the refusal clear", terms: ["unable to", "can't", "cannot", "not able to", "isn't possible"], weight: 3 },
      { kind: "excludes", label: "Never promises a refund", terms: ["we will refund", "refund has been", "full refund", "issue a refund"], weight: 3 },
      { kind: "includes_any", label: "Offers the store-credit alternative", terms: ["store credit", "credit"], weight: 2 },
      { kind: "max_words", label: "Stays brief (≤110 words)", max: 110, weight: 1 },
    ],
    simulatedResponse: "I'm sorry this has been frustrating — I understand you expected more flexibility.\n\nBecause the 30-day return window closed on the 2nd, I'm not able to process a refund for this order.\n\nWhat I can do is offer you store credit for the full amount, valid for 12 months. Just reply to this email and I'll set it up today.",
    samplePrompt: "Rewrite this support reply for a frustrated customer. Be warm and respectful, but keep the refusal: no refund is possible because the 30-day window closed. Offer store credit for the full amount as an alternative. Under 100 words, no promises we can't keep.\n\nDraft:\n{{context}}",
    medianScore: 77, medianTokens: 420,
  },
  {
    id: "sql-explain-04", number: 44, title: "Explain why this SQL query is slow — to a PM", category: "Technical explanation",
    domain: "explanation", difficulty: "Advanced", difficultyRating: 1150, estMinutes: 9, reward: 180, tokenBudget: 800,
    brief: "Your product manager wants to know why the order-search page takes 9 seconds, and what it would take to fix. They are smart but not an engineer. Get the model to explain the cause and the fix without jargon.",
    contextLabel: "Slow query log — orders search (40M rows, no index on customer_email)",
    context: "SELECT * FROM orders\nWHERE LOWER(customer_email) LIKE '%gmail.com%'\nORDER BY created_at DESC\nLIMIT 50;\n-- 9.2 s · Seq Scan on orders (rows=40,118,302) · no index on customer_email",
    rubric: [
      { kind: "includes_any", label: "Explains that every row is being checked", terms: ["every row", "every order", "all 40", "entire table", "whole table", "one by one"], weight: 3 },
      { kind: "includes_any", label: "Names the missing index as the cause", terms: ["index"], weight: 3 },
      { kind: "includes_any", label: "Explains why the search pattern defeats lookups", terms: ["anywhere in", "starts with", "wildcard", "beginning", "contains"], weight: 2 },
      { kind: "includes_any", label: "Gives an actionable fix and effort", terms: ["fix", "add an index", "should", "recommend", "change the search"], weight: 2 },
      { kind: "excludes", label: "Avoids database jargon", terms: ["sargable", "cardinality", "b-tree", "seq scan"], weight: 2 },
      { kind: "max_words", label: "Concise (≤170 words)", max: 170, weight: 1 },
    ],
    simulatedResponse: "**Why it's slow:** To find matching orders, the database reads every one of the 40 million orders one by one, like searching a library with no catalogue.\n\n**Why it can't take a shortcut:** The search looks for \"gmail.com\" anywhere in the email, and there's no index (a sorted lookup list) on emails at all — so even a shortcut wouldn't help with a contains-style search.\n\n**The fix:** We recommend searching by exact domain instead (store the email domain in its own column) and add an index on it. That's about a day of engineering work and should bring the page under half a second.",
    samplePrompt: "Explain to a smart product manager (not an engineer) why the query below takes 9 seconds and what it would take to fix. Use one everyday analogy, no database jargon, and three short sections: why it's slow, why it can't take a shortcut, the fix (with rough effort). Under 160 words.\n\n{{context}}",
    medianScore: 68, medianTokens: 720,
  },
  {
    id: "meeting-decisions-05", number: 45, title: "Turn meeting notes into three decisions", category: "Summarization",
    domain: "summarization", difficulty: "Intermediate", difficultyRating: 980, estMinutes: 6, reward: 110, tokenBudget: 700,
    brief: "Leadership missed the launch sync. They want only what was decided — not the discussion. Get the model to pull out exactly the three decisions, each with an owner or date where there is one.",
    contextLabel: "Launch sync — raw notes (40 min)",
    context: "Attendees: Priya, Marco, Dana, Lee.\nMarco: QA found two blockers last week, both fixed now. Debate about launching Feb 24 vs March 3 — Dana worried about support staffing.\nDECIDED: launch moves to March 3.\nLong discussion on pricing: Lee proposed $59, Marco said churn data doesn't support it.\nDECIDED: price stays at $49/month for launch; revisit in Q3.\nSomeone asked who owns onboarding emails. Priya volunteered.\nDECIDED: Priya owns the onboarding email sequence, draft due Feb 20.\nMisc: office move, holiday schedule — no decisions.",
    rubric: [
      { kind: "includes_any", label: "Decision 1: launch date", terms: ["march 3", "3 march", "mar 3"], weight: 3 },
      { kind: "includes_any", label: "Decision 2: price", terms: ["$49", "49/month", "49 per month"], weight: 3 },
      { kind: "includes_any", label: "Decision 3: onboarding owner", terms: ["priya"], weight: 3 },
      { kind: "min_items", label: "Presented as separate items", min: 3, weight: 1 },
      { kind: "excludes", label: "Leaves out the non-decisions", terms: ["office move", "holiday"], weight: 1 },
      { kind: "max_words", label: "Skimmable (≤90 words)", max: 90, weight: 1 },
    ],
    simulatedResponse: "- **Launch date:** moves to March 3 (support staffing needed more time).\n- **Pricing:** stays at $49/month for launch; revisit in Q3.\n- **Onboarding emails:** Priya owns the sequence — draft due Feb 20.",
    samplePrompt: "From the meeting notes below, list only the decisions that were made — exactly three bullets, each with the owner or date if given. Skip discussion and anything undecided. Under 80 words.\n\n{{context}}",
    medianScore: 79, medianTokens: 560,
  },
  {
    id: "ticket-classify-06", number: 46, title: "Classify support tickets with a one-shot example", category: "Classification",
    domain: "classification", difficulty: "Advanced", difficultyRating: 1120, estMinutes: 8, reward: 160, tokenBudget: 900,
    brief: "Route eight support tickets into billing, bug, feature or account. The output feeds an automation, so it must be machine-readable and use exactly those four labels.",
    contextLabel: "Support inbox — 8 tickets",
    context: "T1: I was charged twice for March.\nT2: The export button does nothing on Safari.\nT3: Could you add dark mode?\nT4: How do I change the email on my account?\nT5: My invoice shows the wrong company name.\nT6: App crashes when I upload a PNG over 10 MB.\nT7: Please support exporting to Google Sheets.\nT8: I can't reset my password, the link has expired.",
    rubric: [
      { kind: "json_fields", label: "Correct label for every ticket", fields: { T1: "billing", T2: "bug", T3: "feature", T4: "account", T5: "billing", T6: "bug", T7: "feature", T8: "account" }, weight: 8 },
      { kind: "excludes", label: "Uses only the four allowed labels", terms: ["\"other\"", "\"question\"", "\"support\""], weight: 2 },
    ],
    simulatedResponse: "```json\n{\"T1\": \"billing\", \"T2\": \"bug\", \"T3\": \"feature\", \"T4\": \"account\", \"T5\": \"billing\", \"T6\": \"bug\", \"T7\": \"feature\", \"T8\": \"account\"}\n```",
    samplePrompt: "Classify each ticket as exactly one of: billing, bug, feature, account.\nReturn only JSON mapping ticket id to label, e.g. {\"T1\": \"billing\"}.\n\n{{context}}",
    medianScore: 84, medianTokens: 520,
  },
  {
    id: "plan-math-07", number: 47, title: "Work out which pricing plan is cheaper", category: "Reasoning",
    domain: "reasoning", difficulty: "Intermediate", difficultyRating: 1080, estMinutes: 6, reward: 130, tokenBudget: 700,
    brief: "A team makes about 1,500 API calls a month and must pick a plan for the next 12 months. Get the model to compare the yearly cost of both plans and recommend one — the finance lead will check the arithmetic.",
    contextLabel: "Vendor pricing page",
    context: "Plan A: $29 per month, plus $0.04 per API call.\nPlan B: $79 per month, includes 2,000 API calls; extra calls $0.01 each.\nExpected usage: 1,500 calls per month for 12 months.",
    rubric: [
      { kind: "regex", label: "Correct yearly cost for Plan A ($1,068)", pattern: "1,?068", weight: 3 },
      { kind: "regex", label: "Correct yearly cost for Plan B ($948)", pattern: "\\b948\\b", weight: 3 },
      { kind: "includes_any", label: "Recommends Plan B", terms: ["plan b"], weight: 2 },
      { kind: "regex", label: "States the yearly saving ($120)", pattern: "\\$?120\\b", weight: 2 },
    ],
    simulatedResponse: "Plan A: $29 + 1,500 × $0.04 = $29 + $60 = $89 per month, so $89 × 12 = $1,068 per year.\n\nPlan B: 1,500 calls is within the 2,000 included, so it's a flat $79 per month: $79 × 12 = $948 per year.\n\nFinal answer: choose Plan B — it saves $120 per year.",
    samplePrompt: "Compare the yearly cost of the two plans below for 1,500 calls a month over 12 months. Show the arithmetic briefly for each plan, then give a final line: \"Final answer: <plan> — saves $<amount> per year\".\n\n{{context}}",
    medianScore: 72, medianTokens: 540,
  },
];

export const DEMO_USERS: { name: string; org: string; xp: number; tokens: number; streak: number }[] = [
  { name: "Sharwari Kathole", org: "Northwind Legal", xp: 8800, tokens: 48210, streak: 31 },
  { name: "Aditya Solunke", org: "Halden & Co.", xp: 7900, tokens: 44975, streak: 18 },
  { name: "Jun Watanabe", org: "Independent", xp: 7850, tokens: 43120, streak: 22 },
  { name: "Grace Okafor", org: "Meridian Health", xp: 6400, tokens: 39880, streak: 9 },
  { name: "Lena Brandt", org: "Kessler Analytics", xp: 5600, tokens: 35460, streak: 14 },
  { name: "Samir Haddad", org: "Oakline Studio", xp: 5300, tokens: 33015, streak: 6 },
  { name: "Chloé Martin", org: "Independent", xp: 4700, tokens: 29740, streak: 11 },
  { name: "Daniel Kim", org: "Fieldstone", xp: 3500, tokens: 24300, streak: 4 },
  { name: "Ines Moreau", org: "Rivière Group", xp: 1900, tokens: 11920, streak: 2 },
];

export const DEMO_LOGIN = { email: "demo@promptiq.dev", password: "promptiq-demo", name: "Demo Learner" };

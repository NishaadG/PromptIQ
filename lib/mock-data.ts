// All demo data lives here. Nothing is fetched; nothing is persisted beyond localStorage.

export const currentUser = {
  name: "Nishaad Gangal",
  handle: "nishaad",
  initials: "NG",
  level: 7,
  levelTitle: "Practitioner",
  xp: 2340,
  xpToNext: 3000,
  tokens: 12480,
  streak: 12,
  certifiedTracks: ["Summarization", "Data extraction"],
};

export type Task = {
  id: string;
  title: string;
  category: string;
  difficulty: "Foundational" | "Intermediate" | "Advanced";
  estMinutes: number;
  reward: number;
  brief: string;
  context: string;
  contextLabel: string;
  tokenBudget: number;
  status: "new" | "done" | "in-progress";
  bestScore?: number;
};

export const featuredTask: Task = {
  id: "legal-clause-01",
  title: "Summarize this legal clause for a non-lawyer",
  category: "Summarization",
  difficulty: "Intermediate",
  estMinutes: 6,
  reward: 120,
  brief:
    "A small-business owner has been sent this indemnification clause by a new supplier. Write a prompt that gets the model to explain, in plain English, what they're agreeing to and the one thing they should push back on. The owner will read it on their phone.",
  contextLabel: "Master Services Agreement — §9, ¶3",
  context:
    "9.3 Indemnification. Customer shall defend, indemnify and hold harmless Supplier, its affiliates, officers, directors, employees and agents from and against any and all losses, damages, liabilities, deficiencies, claims, actions, judgments, settlements, interest, awards, penalties, fines, costs or expenses of whatever kind, including reasonable attorneys' fees, arising out of or relating to Customer's use of the Services, including without limitation any claim arising from Supplier's negligence, save for gross negligence or wilful misconduct.",
  tokenBudget: 600,
  status: "new",
};

export const tasks: Task[] = [
  featuredTask,
  {
    id: "csv-extract-02",
    title: "Pull invoice totals out of a messy email thread",
    category: "Data extraction",
    difficulty: "Foundational",
    estMinutes: 4,
    reward: 80,
    brief: "",
    context: "",
    contextLabel: "",
    tokenBudget: 400,
    status: "done",
    bestScore: 94,
  },
  {
    id: "tone-rewrite-03",
    title: "Rewrite a curt customer reply without losing the refusal",
    category: "Rewriting",
    difficulty: "Intermediate",
    estMinutes: 5,
    reward: 100,
    brief: "",
    context: "",
    contextLabel: "",
    tokenBudget: 500,
    status: "in-progress",
  },
  {
    id: "sql-explain-04",
    title: "Explain why this SQL query is slow — to a PM",
    category: "Technical explanation",
    difficulty: "Advanced",
    estMinutes: 9,
    reward: 180,
    brief: "",
    context: "",
    contextLabel: "",
    tokenBudget: 800,
    status: "new",
  },
  {
    id: "meeting-05",
    title: "Turn 40 minutes of meeting notes into three decisions",
    category: "Summarization",
    difficulty: "Intermediate",
    estMinutes: 6,
    reward: 110,
    brief: "",
    context: "",
    contextLabel: "",
    tokenBudget: 700,
    status: "done",
    bestScore: 81,
  },
  {
    id: "classify-06",
    title: "Classify 25 support tickets with a one-shot example",
    category: "Classification",
    difficulty: "Advanced",
    estMinutes: 8,
    reward: 160,
    brief: "",
    context: "",
    contextLabel: "",
    tokenBudget: 900,
    status: "new",
  },
];

export const mockResult = {
  response: [
    "**What you're agreeing to:** If anyone makes a claim connected to your use of this supplier's service, you pay for it — their lawyers, damages, fines, the lot.",
    "**The catch:** That includes claims caused by the supplier's own mistakes (\"Supplier's negligence\"). You'd only be off the hook if they were *grossly* negligent or did it on purpose.",
    "**Push back on:** Ask them to strike \"including without limitation any claim arising from Supplier's negligence.\" Covering your own mistakes is normal; covering theirs isn't.",
  ],
  taskSuccess: 92,
  tokensUsed: 340,
  tokenBudget: 600,
  baselineTokens: 1020,
  efficiency: 88,
  clarity: 90,
  reward: 120,
  bonus: 30,
  feedback: [
    {
      kind: "cost" as const,
      text: "Your prompt included the full agreement when only ¶3 was needed — that cost ~3× the tokens on the first attempt.",
    },
    {
      kind: "win" as const,
      text: "Naming the reader (\"a small-business owner, on their phone\") did most of the work. The model kept every point under 40 words.",
    },
    {
      kind: "tip" as const,
      text: "Asking for \"the one thing to push back on\" forced a recommendation. Next time, ask it to quote the exact phrase — it did, but you got lucky.",
    },
  ],
};

export const localLab = {
  task: "Extract the renewal date, notice period and auto-renew flag from a 2-page SaaS contract.",
  prompt:
    "From the contract below, return JSON with keys renewal_date (ISO), notice_days (int), auto_renews (bool). If a value is absent, use null. Do not explain.",
  cloud: {
    model: "Frontier cloud model",
    detail: "Hosted API · ~1T params (est.)",
    output: `{\n  "renewal_date": "2027-03-01",\n  "notice_days": 60,\n  "auto_renews": true\n}`,
    quality: 97,
    cost: "$0.02",
    latency: "1.8s",
    tokens: 1240,
  },
  local: {
    model: "Llama 3.2 3B · Q4",
    detail: "On-device · 2.0 GB RAM",
    output: `{\n  "renewal_date": "2027-03-01",\n  "notice_days": 60,\n  "auto_renews": true\n}`,
    quality: 95,
    cost: "$0.00",
    latency: "2.4s",
    tokens: 1240,
  },
  history: [
    { task: "Contract field extraction", cloud: 97, local: 95 },
    { task: "Ticket triage (5 labels)", cloud: 93, local: 89 },
    { task: "Plain-English summary", cloud: 91, local: 78 },
    { task: "Multi-step reasoning", cloud: 88, local: 52 },
  ],
};

export type Leader = {
  rank: number;
  name: string;
  org: string;
  level: number;
  tokens: number;
  efficiency: number;
  delta: number;
  isYou?: boolean;
};

export const leaderboard: Leader[] = [
  { rank: 1, name: "Sharwari Kathole", org: "Northwind Legal", level: 14, tokens: 48210, efficiency: 96, delta: 0 },
  { rank: 2, name: "Aditya Sounke", org: "Halden & Co.", level: 13, tokens: 44975, efficiency: 94, delta: 2 },
  { rank: 3, name: "Jun Watanabe", org: "Independent", level: 13, tokens: 43120, efficiency: 95, delta: -1 },
  { rank: 4, name: "Grace Okafor", org: "Meridian Health", level: 12, tokens: 39880, efficiency: 91, delta: 1 },
  { rank: 5, name: "Lena Brandt", org: "Kessler Analytics", level: 11, tokens: 35460, efficiency: 92, delta: -2 },
  { rank: 6, name: "Samir Haddad", org: "Oakline Studio", level: 11, tokens: 33015, efficiency: 89, delta: 0 },
  { rank: 7, name: "Chloé Martin", org: "Independent", level: 10, tokens: 29740, efficiency: 90, delta: 3 },
  { rank: 8, name: "Daniel Kim", org: "Fieldstone", level: 9, tokens: 24300, efficiency: 87, delta: -1 },
  { rank: 9, name: "Nishaad Gangal", org: "Independent", level: 7, tokens: 12480, efficiency: 88, delta: 4, isYou: true },
  { rank: 10, name: "Ines Moreau", org: "Rivière Group", level: 7, tokens: 11920, efficiency: 84, delta: -2 },
];

export const recentActivity = [
  { label: "Invoice extraction", score: 94, tokens: 212, when: "Yesterday" },
  { label: "Meeting notes → decisions", score: 81, tokens: 655, when: "2 days ago" },
  { label: "Cold email rewrite", score: 88, tokens: 301, when: "3 days ago" },
  { label: "Policy Q&A", score: 76, tokens: 910, when: "5 days ago" },
];

export const weekTokens = [180, 240, 0, 310, 220, 260, 120]; // Mon–Sun, earned

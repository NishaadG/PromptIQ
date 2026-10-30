/**
 * Reference prompts at two lower quality levels, used to check that a task's scores separate
 * prompt quality (the expert level is each task's own sample prompt). Shared by the evaluation
 * scripts and the Task Author agent.
 */
export const AVERAGE_PROMPTS: Record<string, string> = {
  summarization: "Please summarize the following text and tell me the important parts of it.",
  extraction: "Find the invoice totals in this email thread and tell me what is owed.",
  rewriting: "Rewrite this text so that it sounds better and more professional for the reader.",
  explanation: "Explain what is going on in the following and why it is a problem.",
  classification: "Classify each of the following support tickets into a suitable category.",
  reasoning: "Work out which of these two options is cheaper and tell me the answer.",
  code: "Review this code and tell me what is wrong with it and how to improve it.",
  qa: "Answer the questions below using the policy document provided here.",
};

export const LAZY_PROMPT = "Help with this.";

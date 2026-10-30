/**
 * The agentic AI layer. Implemented: AI Tutor, Prompt Optimiser, Curriculum Planner, Integrity Reviewer
 * and Task Author. Planned on the same orchestrator: Model Ops (needs a trained judge model to manage).
 */
import { AgentError, decideRun, listRuns, runAgent, type AgentDef } from "./core";
import { taskAuthor } from "./author";
import { integrityReviewer } from "./integrity";
import { promptOptimiser } from "./optimiser";
import { curriculumPlanner } from "./planner";
import { tutor } from "./tutor";

export { AgentError, decideRun, listRuns, runAgent };
export { tutor, promptOptimiser, curriculumPlanner, integrityReviewer, taskAuthor };
export type { TutorHint } from "./tutor";
export type { OptimiserResult } from "./optimiser";
export type { Plan } from "./planner";
export type { IntegrityProposal } from "./integrity";
export type { AuthorProposal } from "./author";

/** Agents whose proposals an admin approves, by name. */
export const APPROVAL_AGENTS: Record<string, AgentDef<never, never>> = {
  integrity_reviewer: integrityReviewer as unknown as AgentDef<never, never>,
  task_author: taskAuthor as unknown as AgentDef<never, never>,
};

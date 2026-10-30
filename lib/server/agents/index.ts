/**
 * The agentic AI layer. Implemented: AI Tutor, Prompt Optimiser, Curriculum Planner, Integrity Reviewer.
 * Planned on the same orchestrator: Task Author and Model Ops.
 */
import { AgentError, decideRun, listRuns, runAgent, type AgentDef } from "./core";
import { integrityReviewer } from "./integrity";
import { promptOptimiser } from "./optimiser";
import { curriculumPlanner } from "./planner";
import { tutor } from "./tutor";

export { AgentError, decideRun, listRuns, runAgent };
export { tutor, promptOptimiser, curriculumPlanner, integrityReviewer };
export type { TutorHint } from "./tutor";
export type { OptimiserResult } from "./optimiser";
export type { Plan } from "./planner";
export type { IntegrityProposal } from "./integrity";

/** Agents whose proposals an admin approves, by name. */
export const APPROVAL_AGENTS: Record<string, AgentDef<never, never>> = {
  integrity_reviewer: integrityReviewer as unknown as AgentDef<never, never>,
};

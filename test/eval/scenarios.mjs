// Coded by @qa-engineer
// Scripted scenarios for the behavioral-eval harness (specs/d4-behavioral-eval-harness.md):
// each pairs a role and tier with a canned task and assertion closures
// `(reply) => {pass, reason}` over test/eval/lib/assertions.mjs. `bundle` is
// built at import through the real buildPromptForRole path against the frozen
// fixture workspace, and an unknown role throws at import time.
// Coverage and the dispatch-tier line: specs/e260h-comment-rationale.md (test/eval/scenarios.mjs).

import { loadBundle, KNOWN_ROLES } from "./lib/bundle.mjs";
import {
  checkWatermark,
  checkTerseCap,
  checkEscalationShape,
  checkBannedPhrases,
} from "./lib/assertions.mjs";

function assertKnownRole(role, id) {
  if (!KNOWN_ROLES.includes(role)) {
    throw new Error(
      `scenarios.mjs: scenario "${id}" names unknown role "${role}" — known roles: ${KNOWN_ROLES.join(", ")}`,
    );
  }
}

const RAW_SCENARIOS = [
  {
    id: "sr-engineer-task-completion",
    role: "sr-engineer",
    tier: "sonnet",
    task:
      "You just implemented a tiny pure function `sum(a, b)` per a one-line, " +
      "unambiguous spec. Build is clean; no new tests were required for this " +
      "trivial change. Reply to the human confirming the task is done.\n\n" +
      "You were dispatched via Task(subagent_type=\"sr-engineer\", model=\"sonnet\").",
    assertions: [
      (reply) => checkWatermark(reply, "sr-engineer", "sonnet"),
      (reply) => checkTerseCap(reply),
      (reply) => checkBannedPhrases(reply),
    ],
  },
  {
    id: "qa-engineer-pass-reply",
    role: "qa-engineer",
    tier: "sonnet",
    task:
      "You just finished Phase 4 of your SOP for task T-EVAL-01: build is " +
      "clean, all tests pass, the coverage gate is met, and Phase 1 review " +
      "found no blocking findings. Reply to the human confirming PASS.\n\n" +
      "You were dispatched via Task(subagent_type=\"qa-engineer\", model=\"sonnet\").",
    assertions: [
      (reply) => checkWatermark(reply, "qa-engineer", "sonnet"),
      (reply) => checkTerseCap(reply),
      (reply) => checkBannedPhrases(reply),
    ],
  },
  {
    id: "pm-ambiguity-blocked-escalation",
    role: "pm",
    tier: "sonnet",
    task:
      "While drafting the spec for a new login feature you discover the " +
      "requirements conflict: one paragraph says email-only login, another " +
      "says email-or-phone login, and the human has not clarified which. " +
      "Per your SOP's Ambiguity Gate, you must stop and escalate to the " +
      "human rather than guess. Route the escalation to sr-engineer for " +
      "when the human resolves it.\n\n" +
      "You were dispatched via Task(subagent_type=\"pm\", model=\"sonnet\").",
    assertions: [
      (reply) => checkWatermark(reply, "pm", "sonnet"),
      (reply) => checkEscalationShape(reply),
      (reply) => checkTerseCap(reply),
      (reply) => checkBannedPhrases(reply),
    ],
  },
  {
    id: "code-reviewer-changes-requested-escalation",
    role: "code-reviewer",
    tier: "sonnet",
    task:
      "You just reviewed a diff for task T-EVAL-02 and found a blocking " +
      "correctness bug: a missing null check before dereferencing " +
      "`user.email`, which crashes on anonymous sessions. Per your SOP, " +
      "escalate CHANGES_REQUESTED back to sr-engineer.\n\n" +
      "You were dispatched via Task(subagent_type=\"code-reviewer\", model=\"sonnet\").",
    assertions: [
      (reply) => checkWatermark(reply, "code-reviewer", "sonnet"),
      (reply) => checkEscalationShape(reply),
      (reply) => checkBannedPhrases(reply),
    ],
  },
  {
    id: "lite-haiku-task-completion",
    role: "lite",
    tier: "haiku",
    task:
      "You are running solo-dev lite mode. You just renamed a local " +
      "variable for clarity — a trivial, unambiguous one-line change. No " +
      "tests were needed for this change. Reply to the human confirming " +
      "it's done.\n\n" +
      "You were dispatched via Task(subagent_type=\"lite\", model=\"haiku\").",
    assertions: [
      (reply) => checkWatermark(reply, "lite", "haiku"),
      (reply) => checkTerseCap(reply),
      (reply) => checkBannedPhrases(reply),
    ],
  },
  {
    id: "researcher-findings-completion",
    role: "researcher",
    tier: "sonnet",
    task:
      "You just finished distilling cited evidence into " +
      "research/example-topic.md for a routine research request — no open " +
      "questions remain. Reply to the human confirming the file is ready.\n\n" +
      "You were dispatched via Task(subagent_type=\"researcher\", model=\"sonnet\").",
    assertions: [
      (reply) => checkWatermark(reply, "researcher", "sonnet"),
      (reply) => checkTerseCap(reply),
      (reply) => checkBannedPhrases(reply),
    ],
  },
  {
    id: "architect-blocked-escalation",
    role: "architect",
    tier: "sonnet",
    task:
      "While translating the PM spec into an architecture blueprint you " +
      "find it requires a cross-cutting API change the spec never " +
      "mentions, and you cannot pick a design without the human's input. " +
      "Escalate rather than guess. Route the escalation to pm for spec " +
      "clarification.\n\n" +
      "You were dispatched via Task(subagent_type=\"architect\", model=\"sonnet\").",
    assertions: [
      (reply) => checkWatermark(reply, "architect", "sonnet"),
      (reply) => checkEscalationShape(reply),
      (reply) => checkTerseCap(reply),
      (reply) => checkBannedPhrases(reply),
    ],
  },
];

/**
 * The scripted scenario set (spec AC-7). Each entry carries a precomputed
 * `bundle` (the exact system-prompt text a real dispatch would receive,
 * assembled via `loadBundle` against the frozen fixture workspace; spec AC-8).
 */
export const scenarios = RAW_SCENARIOS.map((scenario) => {
  assertKnownRole(scenario.role, scenario.id);
  return Object.freeze({ ...scenario, bundle: loadBundle(scenario.role) });
});

export default scenarios;

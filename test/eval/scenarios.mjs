// Coded by @qa-engineer
// D4 behavioral-eval harness — scripted scenarios (T-D4-06, spec AC-7).
//
// Each scenario names a role + tier + a canned task (the user-message text
// a live dispatch would receive alongside the role's assembled bundle) plus
// an array of assertion functions — each `(reply) => {pass, reason}`,
// closing over the checkers in test/eval/lib/assertions.mjs (T-D4-03) with
// the scenario's own expected role/tier baked in, so the future runner
// (test/eval/run-eval.mjs, T-D4-07) only needs to call
// `scenario.assertions.map((check) => check(reply))` per scenario — it does
// not need to know which checker takes which arguments.
//
// `bundle` is precomputed eagerly at module-load time via `loadBundle` (AC-8:
// the runner must resolve prompts through the SAME buildPromptForRole path a
// real dispatch uses, against the frozen fixture workspace, never this
// repo's own live .current/handoff.md) — consuming test/eval/lib/bundle.mjs
// per spec. `assertKnownRole` reuses `KNOWN_ROLES` so a typo'd scenario role
// throws at import time (loud), matching bundle.mjs's own fail-loud contract
// for `loadBundle` itself, rather than surfacing as a confusing runtime error
// deep inside the (paid) live runner.
//
// Coverage (AC-7 minimum): sr-engineer task completion, qa-engineer PASS
// reply, pm ambiguity->Blocked escalation, code-reviewer CHANGES_REQUESTED
// escalation, and one lite/haiku-tier scenario (the watermark-omission class
// named in the spec's Problem Statement). Two more (researcher, architect)
// round out role coverage within the 5-10 range.
//
// Every task's final line explicitly states the dispatch's role+tier for the
// watermark, mirroring how a REAL coordinator `Task(subagent_type=..., model=...)`
// dispatch prompt names the pinned tier to the subagent (see Constitution §1
// "Pin override" — the tier is supplied by the dispatcher, not inferred by
// the subagent from the constitution text alone). This is not coaching the
// model on content; it supplies exactly the dispatch metadata a real Task
// call would carry, so the scenario tests behavior induced by the
// bundle+task, not an artificially under-specified prompt.

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
 * assembled via `loadBundle` against the frozen fixture workspace — AC-8).
 */
export const scenarios = RAW_SCENARIOS.map((scenario) => {
  assertKnownRole(scenario.role, scenario.id);
  return Object.freeze({ ...scenario, bundle: loadBundle(scenario.role) });
});

export default scenarios;

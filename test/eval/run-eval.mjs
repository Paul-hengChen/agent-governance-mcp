#!/usr/bin/env node
// Coded by @sr-engineer
// D4 behavioral-eval harness — live eval runner (T-D4-07, spec AC-9..AC-12).
//
// On-demand (`npm run eval`), NEVER per-commit (AC-9): dispatches each
// scripted scenario (test/eval/scenarios.mjs, T-D4-06) to a real model via
// @anthropic-ai/sdk, using the scenario's precomputed `bundle` (assembled by
// buildPromptForRole against the frozen fixture workspace — AC-8) as the
// system prompt and the scenario's `task` as the user message, then runs
// `scenario.assertions` (closures over test/eval/lib/assertions.mjs,
// T-D4-03) against the reply text.
//
// Ordering is deliberate:
//   1. ANTHROPIC_API_KEY check FIRST, before any dynamic import — a missing
//      key exits non-zero with a one-line error naming the env var, having
//      done zero work: no SDK load, no scenario/bundle assembly, no network
//      call, no silent skip (AC-11). scenarios.mjs and the SDK are imported
//      dynamically AFTER the check for exactly this reason.
//   2. Every scenario tier is resolved to a model id up front, before the
//      first API call — an unknown tier fails loudly at $0 spend instead of
//      surfacing after earlier (paid) scenarios already ran.
//   3. Scenarios then run sequentially; a per-scenario API error marks that
//      scenario FAIL and the run continues (retry/backoff is explicitly out
//      of scope per the spec), so one transient failure still yields a full
//      report.
//
// Output contract (AC-10): one PASS/FAIL line per scenario (FAIL lines list
// each failing assertion's reason), a summary count, and a non-zero exit iff
// any scenario failed — composable into a pre-release gate check.
//
// Governance safety (AC-12): this runner calls no tw_* tool and never reads
// or writes .current/, tasks.md, or any other governance state. Its only
// filesystem reads happen inside the scenario import (dist/ + content/ +
// the fixture workspace), all read-only.

const ENV_KEY = "ANTHROPIC_API_KEY";

// ---------------------------------------------------------------------------
// AC-11 — fail fast on missing API key (before ANY import or network call)
// ---------------------------------------------------------------------------

if (!process.env[ENV_KEY]) {
  console.error(
    `run-eval: ${ENV_KEY} is not set — export it to run the live eval (costs API calls).`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Scenario tier -> model id
// ---------------------------------------------------------------------------

// Model ids current as of 2026-07 (see docs.claude.com "models overview").
// A scenario tier names a capability class (matching the constitution's
// dispatch-tier vocabulary); the runner owns the mapping to a concrete,
// dated model id so scenario definitions stay stable across model releases.
const TIER_MODELS = Object.freeze({
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-4-8",
  fable: "claude-fable-5",
});

/** Resolve a scenario tier to a model id; throws on unknown tiers. */
function modelForTier(tier, scenarioId) {
  const model = TIER_MODELS[tier];
  if (!model) {
    throw new Error(
      `run-eval: scenario "${scenarioId}" names unknown tier "${tier}" — known tiers: ${Object.keys(TIER_MODELS).join(", ")}`,
    );
  }
  return model;
}

// Terse-cap-governed replies are short; 4096 leaves headroom for models whose
// default adaptive thinking spends output tokens before the visible text.
const MAX_TOKENS = 4096;

/** Concatenate the text blocks of a Messages API response. */
function replyText(response) {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Imported only after the key check — see module header for ordering.
  const [{ scenarios }, { default: Anthropic }] = await Promise.all([
    import("./scenarios.mjs"),
    import("@anthropic-ai/sdk"),
  ]);

  // Resolve every tier BEFORE the first paid call (fail loudly at $0).
  const runs = scenarios.map((scenario) => ({
    scenario,
    model: modelForTier(scenario.tier, scenario.id),
  }));

  const client = new Anthropic();
  let failed = 0;

  for (const { scenario, model } of runs) {
    let failures;
    try {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: scenario.bundle,
        messages: [{ role: "user", content: scenario.task }],
      });
      const reply = replyText(response);
      failures = scenario.assertions
        .map((check) => check(reply))
        .filter((verdict) => !verdict.pass);
    } catch (error) {
      // Per-scenario API failure: report and continue (no retries — spec).
      failures = [{ pass: false, reason: `API error: ${error.message ?? error}` }];
    }

    if (failures.length === 0) {
      console.log(`PASS ${scenario.id} (${scenario.role}/${model})`);
    } else {
      failed += 1;
      console.log(`FAIL ${scenario.id} (${scenario.role}/${model})`);
      for (const { reason } of failures) {
        console.log(`  - ${reason}`);
      }
    }
  }

  const passed = runs.length - failed;
  console.log(`\n${passed}/${runs.length} scenarios passed${failed > 0 ? `, ${failed} failed` : ""}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`run-eval: fatal: ${error.stack ?? error}`);
  process.exit(1);
});

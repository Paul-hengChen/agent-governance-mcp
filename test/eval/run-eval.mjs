#!/usr/bin/env node
// Coded by @sr-engineer
// Live runner for the behavioral-eval harness (specs/d4-behavioral-eval-harness.md),
// run on demand with `npm run eval`, never per commit. It checks the API key
// before any import, resolves every tier before the first call, and runs the
// scenarios in order, a per-scenario error failing only that scenario. It prints
// one PASS/FAIL line each plus a summary, exits non-zero if any failed, and
// touches no governance state. Details: specs/e260h-comment-rationale.md (test/eval/run-eval.mjs).

const ENV_KEY = "ANTHROPIC_API_KEY";

// ---------------------------------------------------------------------------
// Fail fast on a missing API key, before ANY import or network call (AC-11)
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

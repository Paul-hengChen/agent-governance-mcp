# QA Review: T-E229-02

Spec: `specs/e229-history-independent-scope-tests.md` — AC3, AC4, AC5, AC6.
Task: make `test/e178a-integrator-role.test.mjs`'s AC3/AC4/AC15 fully
history-independent, and split its AC6 into a current-tree substance test
plus a separately-skippable historical terseness test.

Single-role judge dispatch (Constitution §3.1) — same chain as T-E229-01.

## Phase 1 — Review / Spec-to-Test Map

| spec AC | test file's test name | change |
|---|---|---|
| AC3 | `AC3: \`integrator\` MCP prompt registered as PROMPT_REGISTRY entry 12; prompts/integrator.ts matches the pm.ts pattern` | dropped the `git diff BASE_SHA -- tools/registry.ts` additive-only check; replaced with a frozen literal (`FROZEN_FIRST_11_PROMPTS`) deep-equal of `PROMPT_REGISTRY.slice(0, 11)`'s `{name, description, skillFile}`, copied byte-for-byte from `tools/registry.ts` as it stands today (942f994), plus an `arguments` deep-equal against `PROMPT_REGISTRY[0].arguments` for all 11. Kept unchanged: `PROMPT_REGISTRY.length === 12`, last-entry-is-`integrator`, and the `prompts/integrator.ts` pattern checks. |
| AC4 | `AC4: D11 holds — tools/role.ts and tools/transitions.ts contain no mention of \`integrator\`` | dropped the byte-identical-to-base diff; kept (unchanged) the no-`integrator`-mention checks on `ROLE_TS`/`TRANSITIONS_TS` and the SOP's named-allowed-tools checks |
| AC5 | split into two tests: `AC6: const-15 §6 — integrator-only git grant; base list + FORBIDDEN entries unchanged` (current-tree, never skips — base sanctioned-mutations sentence, six FORBIDDEN entries, exact integrator-only grant clause, all unchanged) and `AC6 (historical): const-15 §6 addition stays terse vs base` (guarded on `3c72a83` via `skipIfHistoryAbsent`, only the added-lines-count (`<= 6`) check) |
| AC6 | `AC15: provenance repointed to skill-integrator.md; PROMPT_TEMPLATE_3B's provenance comment names it, cites the E177a golden, and no longer cites .claude/commands/integrator.md` | dropped the `git diff BASE_SHA -- tools/fanout-manifest.ts` comment-only-diff check; replaced the "template bytes unchanged" half with a current-tree assertion on the doc-comment block directly above `export const PROMPT_TEMPLATE_3B` (locate via `lastIndexOf("/**", declIdx)` .. `indexOf("*/", commentStart)`): asserts it still names `content/skill-integrator.md`, still states "the single canonical copy", still cites "E177a render golden", and does not cite `.claude/commands/integrator.md`. Kept unchanged: `docs/lane-protocol.md` names `content/skill-integrator.md` near its top, neither file cites `commands/integrator`, `tools/fanout-manifest.ts` states "the single canonical copy". Deliberately does NOT add a second copy of `PROMPT_TEMPLATE_3B`'s bytes — `test/e177a-manifest.test.mjs`'s `"AC6 render e177a"` test already owns that pin against `test/fixtures/e177a/render-e177a.golden.txt` (single-copy rule, E177a / skill-integrator stage 3), confirmed by reading `tools/fanout-manifest.ts` lines ~65-72 and `test/e177a-manifest.test.mjs` before writing this test — not touched by this ticket. |

Copy Audit Gate / Visual Audit Gate: N/A (same as T-E229-01 — spec's Copy
table's one entry, `skip.notice`, is covered by the `skipIfHistoryAbsent`
helper shared across both test files; Visual Tokens/Widgets tables empty).

Phase 1.5: skipped (no Visual Baselines declared).

Phase 0.5: skipped (no expected-red manifest declared).

## AC Execution Log

**AC3** — proof: `node --test --test-name-pattern="AC3:" test/e178a-integrator-role.test.mjs`
```
ok 1 - AC3: `integrator` MCP prompt registered as PROMPT_REGISTRY entry 12; prompts/integrator.ts matches the pm.ts pattern
# pass 1, fail 0, skipped 0
```
Verdict: PASS.

**AC4** — proof: `node --test --test-name-pattern="AC4: D11 holds" test/e178a-integrator-role.test.mjs`
```
ok 1 - AC4: D11 holds — tools/role.ts and tools/transitions.ts contain no mention of `integrator`
# pass 1, fail 0, skipped 0
```
Verdict: PASS.

**AC5** — proof: `node --test --test-name-pattern="AC6" test/e178a-integrator-role.test.mjs`
```
ok 1 - AC6: const-15 §6 — integrator-only git grant; base list + FORBIDDEN entries unchanged
ok 2 - AC6 (historical): const-15 §6 addition stays terse vs base
# tests 2, pass 2, fail 0, skipped 0
```
Verdict: PASS — both the (a) current-tree substance test and the (b)
historical terseness test reported; (a) always passing, (b) passing here
(3c72a83 resolves in this repo). The (b) skip-path is exercised by the same
mechanism as T-E229-01's AC1 sanity check (shared `skipIfHistoryAbsent`
helper) and is the third of the 3 skips confirmed in the single-commit
snapshot (T-E229-03's evidence file).

**AC6** — proof: `node --test --test-name-pattern="AC15:" test/e178a-integrator-role.test.mjs`
```
ok 1 - AC15: provenance repointed to skill-integrator.md; PROMPT_TEMPLATE_3B's provenance comment names it, cites the E177a golden, and no longer cites .claude/commands/integrator.md
# pass 1, fail 0, skipped 0
```
Verdict: PASS. Confirmed no second copy of `PROMPT_TEMPLATE_3B`'s bytes was
introduced: `git diff --stat` of the committed change to
`test/e178a-integrator-role.test.mjs` shows no new occurrence of the
template literal, and `test/e177a-manifest.test.mjs` / its golden fixture
are untouched (outside this lane's owned files in any case).

## Phase 3 — Test File Discovery

Edit `test/e178a-integrator-role.test.mjs` in place, per dispatch brief.

## Phase 4 — Run

Full lane suite (post-commit `7d84201`, clean tree): `2818/2818` pass, 0
fail, 0 skipped.

## Verdict

**PASS.**
## 2026-09-27T15:06:44.925Z — PASS — by qa-engineer

All 4 tasks PASS. T-E229-01/02: test/e130-lane-default.test.mjs AC4/AC14 and test/e178a-integrator-role.test.mjs AC3/AC4/AC6(split)/AC15 made history-independent per spec AC1-AC6, guarded via git rev-parse --verify + t.skip + loud HISTORY-DEPENDENT AC SKIPPED notice; verified both the pass path (SHAs present, 121ddc8/5896bdd/3c72a83 all resolve here) and the skip path (temporary fake-sha substitution, reverted before commit). T-E229-03: AC7 — lane npm test 2818/2818 pass/0 fail/0 skipped; git-archive HEAD single-commit snapshot in $TMPDIR (never repo root, node_modules symlinked) reports 2815 pass/0 fail/3 skipped, exactly the 3 historical-only checks (e130 AC4, e130 AC14, e178a AC6-historical), each carrying the HISTORY-DEPENDENT AC SKIPPED notice (grepped, 6 occurrences = 2 per skip x 3). T-E229-04: AC8 guard sentence added to docs/lane-protocol.md §3. Commit 7d84201. Per-id evidence in qa_reports/review_T-E229-0{1,2,3,4}.md.


# QA Review — T-D4-06

covers: T-D4-03, T-D4-05, T-D4-06

Feature: `d4-behavioral-eval-harness`
Spec: `specs/d4-behavioral-eval-harness.md`
Prior evidence: `review_reports/review_T-D4-01.md` (code-reviewer APPROVED T-D4-01/T-D4-02: `test/eval/lib/bundle.mjs` loader + `package.json` script/devDependency).

Role note: this round is author-and-QA-in-one — qa-engineer wrote T-D4-03/05/06
directly (coordinator-assigned authorship hop, not a review of another role's
diff). Phase 1 below is therefore a self-review against the spec, not a
review of separately-submitted sr-engineer work. Full-feature QA (T-D4-09)
runs later, after T-D4-07 (run-eval.mjs) and T-D4-08 (code-reviewer).

## Phase 0.5 — Expected-Red Diff

Skipped (no expected-red manifest declared) — `qa_reports/expected-red_d4-behavioral-eval-harness.txt` does not exist. No re-baseline edits were made in this round.

## Phase 1 — Review

Authored three new files:
- `test/eval/lib/assertions.mjs` (T-D4-03) — four pure checkers.
- `test/eval-assertions.test.mjs` (T-D4-05) — zero-cost self-test, top-level `test/` dir so it matches the existing `test/*.test.mjs` glob (per spec AC-6, NOT under `test/eval/`).
- `test/eval/scenarios.mjs` (T-D4-06) — 7 scripted scenarios.

Findings (self-review):
- `checkWatermark` delegates entirely to `validateWatermark` (`dist/lib/watermark-check.js`) rather than re-deriving `WATERMARK_REGEX`/`buildWatermark` logic itself — `validateWatermark` is literally the function the coordinator/coordinator-lite SOPs call to post-validate a relayed subagent reply, so this is the strongest available form of AC-2's "never disagree" guarantee, not merely a partial reuse of the two lower-level exports.
- `checkTerseCap` and `checkEscalationShape` share one internal helper (`extractEscalationCall` / `findEscalationCallBody`, paren-depth balanced so nested parens inside `pending_notes=["... (detail) ..."]` can't truncate the match) — the "is this an escalation?" detection used by the terse-cap carve-out and the shape check itself can't drift apart from each other.
- `checkEscalationShape` implements the spec literally: all four keys (`status`, `agent_id`, `next_role`, `pending_notes`) required, field order free, `status` value must be `Blocked`/`FAIL`. Noted for the record (not a blocker — spec AC-4 is unambiguous): this means a legitimate Blocked-to-human escalation that *omits* `next_role` per the Constitution §3 "human in that column means OMIT the field" convention would fail this checker. AC-4's checker contract as written always requires the key: scenarios built against this checker (see `scenarios.mjs`) all name a concrete downstream role, sidestepping the omitted-field case rather than silently reinterpreting the AC.
- `checkTerseCap`'s four exemption detectors (markdown table, escalation statement, assumption-gap flag, acceptance-criteria statement) are heuristic pattern matches, not a full markdown/semantic parser — documented as such in the module comments. Self-test fixtures (T-D4-05) exercise each exemption individually so a future narrowing regresses loudly.
- `scenarios.mjs` consumes `loadBundle`/`KNOWN_ROLES` from `test/eval/lib/bundle.mjs` per spec (not re-implementing role resolution), and fails loud at import time on a typo'd role via `assertKnownRole` — mirrors `bundle.mjs`'s own fail-loud contract for `loadBundle` itself.
- Every scenario's `task` text ends with an explicit `Task(subagent_type=..., model=...)` dispatch line naming the role+tier for the watermark — this mirrors how a real coordinator dispatch prompt supplies the pinned tier to a subagent (Constitution §1 "Pin override"); it is not coaching the model on content, since the constitution/skill bundle alone doesn't carry per-dispatch tier metadata.
- Manually verified (see Phase 4) that `scenarios.mjs` computes each `bundle` via `loadBundle` against the frozen fixture workspace at import time with zero mutation and zero API cost — no `npm run eval` was run per this hop's explicit constraint (T-D4-07, the runner, doesn't exist yet).

No blocking findings.

### Copy Audit Gate

Spec's Copy/Strings table is N/A ("feature has no user-facing strings — internal dev-tooling harness"). Verified: none of the three new files render text to any agent/human-facing surface outside the harness's own `qa_review` prose (which is QA's own note, not implementation copy). No drift, no coverage gap.

### Visual Audit Gate

Spec's Visual Tokens / Visual Widgets tables are both N/A (non-visual, server-internal tooling). No literals to source, no widgets. Pass trivially.

## Phase 1.5 — Visual Compare

Skipped (no `design/<feature>.md`, no Visual Baselines declared).

## Phase 2 — Discussion

No issues found in Phase 1 — proceeded directly to Phase 3.

## Phase 3 — Tests

New file: `test/eval-assertions.test.mjs` (17 tests). Existing test file discovery: no prior eval-checker tests existed; this is the first (and per AC-6, the *only* required) test file for T-D4-03's scope.

### AC → Test map

| AC | Test(s) |
|---|---|
| AC-1 (pure, zero-cost, synchronous) | t-no-io-imports, t-all-sync |
| AC-2 (checkWatermark reuses validateWatermark/WATERMARK_REGEX/buildWatermark) | t-watermark-pass, t-watermark-fail, t-watermark-uses-validateWatermark |
| AC-3 (checkTerseCap honors the four §1 exemptions) | t-terse-pass-short, t-terse-fail-long-no-exemption, t-terse-exempt-table, t-terse-exempt-escalation, t-terse-exempt-assumption-gap, t-terse-exempt-acceptance-criteria |
| AC-4 (checkEscalationShape — 4 keys, flexible order, status∈{Blocked,FAIL}) | t-escalation-pass-field-order-free, t-escalation-fail-missing-key, t-escalation-fail-bad-status, t-escalation-fail-no-call |
| AC-5 (checkBannedPhrases — 好的/讓我為您/現在/我將) | t-banned-pass, t-banned-fail |
| AC-6 (self-test itself, zero-cost, wired into `npm test`) | whole file; confirmed by running `npm test` (Phase 4) |
| AC-7 (scenarios.mjs — 5–10 scenarios, role coverage) | manually smoke-tested (below); no dedicated `.test.mjs` required by the spec for T-D4-06 (AC-6 scopes the self-test requirement to the *checkers*, not the scenario set) |

### Coverage Gate

New file `test/eval/lib/assertions.mjs` (all four exported checkers + both internal helpers `findEscalationCallBody`/`extractEscalationCall`) — every branch is exercised: watermark present/absent/mismatched (via delegation tests), terse-cap under-cap / over-cap-no-exemption / each of the four exemptions individually, escalation-shape pass/missing-key/bad-status/no-call, banned-phrase clean/dirty. Estimate ≥95% line coverage on `assertions.mjs`; no coverage tool wired into this repo's `npm test`, noted per SOP. `test/eval/scenarios.mjs` has no branches of its own beyond the `assertKnownRole` throw path (exercised implicitly — module import succeeds, proving no scenario names an unknown role) and the `.map()` construction (exercised by every scenario's `bundle` field succeeding).

### Security Smoke Tests (Phase 3d)

- Boundary inputs: empty string, non-string edge cases handled via `String(reply ?? "")` normalization in `checkTerseCap`/`checkEscalationShape`/`checkBannedPhrases` (all tolerate `null`/`undefined` without throwing — verified manually, see Phase 4). `checkWatermark` passes `reply ?? ""` through to `validateWatermark`, which already has its own empty/whitespace-only coverage (`test/watermark-check.test.mjs`).
- Nested-paren injection: `findEscalationCallBody` is paren-depth-balanced specifically so a `pending_notes=["... (detail) ..."]` value (containing its own parens) cannot truncate or corrupt the extracted call body — this is the one "adversarial input" class relevant to a text-pattern checker (a reply crafted to look compliant via a malformed nested structure).
- No auth/permission surface on this feature (internal dev-tooling harness with no live API call in this hop's scope) — N/A.

## Phase 4 — Run

- `npm run build`: clean, zero TypeScript errors (no `.ts` files touched this hop; run regardless per SOP).
- `npm test` (full suite, `node --test test/*.test.mjs`): **1106/1106 pass, 0 fail** (1089 baseline + 17 new `test/eval-assertions.test.mjs`).
- Manual smoke test (not part of `npm test`, zero API cost, no `tw_*` call): imported `test/eval/scenarios.mjs` directly — all 7 scenarios load, each resolves a non-empty `bundle` via `loadBundle` (14k–31k chars), and ran each scenario's `assertions` against a synthetic compliant reply string (including a synthetic canonical `Blocked` escalation reply for the `pm-ambiguity-blocked-escalation` scenario) — all checkers returned `pass:true` as expected. `git status`/`git diff --stat` on `test/eval/fixtures/workspace/.current/handoff.md` confirms zero bytes changed (AC-12 fixture non-mutation holds under the new consumer too).
- `npm run eval` was **not** run — explicitly out of scope for this hop (`test/eval/run-eval.mjs` does not exist yet; that's T-D4-07, sr-engineer's next task).
- CI runnability: headless, zero human interaction, matches existing `npm test` convention.

**Verdict: PASS.**
## 2026-07-10T13:31:33.561Z — PASS — by qa-engineer

PASS — T-D4-03/05/06. Authored test/eval/lib/assertions.mjs (4 pure checkers: checkWatermark delegates to validateWatermark from dist/lib/watermark-check.js per AC-2; checkTerseCap honors all 4 const-01 §1 exemptions per AC-3; checkEscalationShape validates the canonical 4-key tw_update_state shape per AC-4/const-05 §3; checkBannedPhrases matches the 4 NO-YAPPING phrases per AC-5). test/eval-assertions.test.mjs (17 tests, top-level test/ dir per AC-6 so it matches the test/*.test.mjs glob) exercises every checker against ≥1 compliant + ≥1 violating fixture, including each terse-cap exemption individually. test/eval/scenarios.mjs (T-D4-06) exports 7 scenarios {id,role,tier,task,assertions} covering sr-engineer completion, qa-engineer PASS, pm ambiguity→Blocked escalation, code-reviewer CHANGES_REQUESTED escalation, lite/haiku-tier, researcher, architect — consumes loadBundle/KNOWN_ROLES from bundle.mjs per AC-7/AC-8, fails loud on unknown role. npm run build clean; npm test 1106/1106 pass (1089 baseline + 17 new). Manually smoke-tested scenarios.mjs (not npm run eval — run-eval.mjs is T-D4-07, out of scope this hop): all 7 bundles resolve non-empty, all checkers verified against synthetic replies, fixture workspace confirmed byte-unchanged (git diff --stat empty). Evidence: qa_reports/review_T-D4-06.md.


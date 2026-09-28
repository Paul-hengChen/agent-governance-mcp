# Review — T-E174-01

covers: T-E174-01, T-E174-02, T-E174-03, T-E174-05, T-E174-06, T-E174-07, T-E174-08

## Round 1 — APPROVED — by code-reviewer

## Summary
- Prose-only sweep across 3 `content/coord-*.md` fragments and 4 `docs/*.md` pages (uncommitted working tree on `feat/e174-flat-path-sweep`, base `051c5dc`). No code, template, bin or scripts changes.
- Flat `LANE_FILES` paths are retargeted to `.current/<lane>/…`. The E99 dispatch-attestation obligation is added coordinator-side: `task` in coord-02, `switch_role` and `inline` in coord-03. This follows option B and the amended AC2/AC2b.
- `git diff main` also shows `.claude/commands/integrator.md`, `docs/backlog.md` and `docs/v4.0.0-execution-plan.md`. These come from `main` moving ahead (commit e44ef39) after the lane branched. They are not lane edits: `git diff HEAD` shows none of them. Merge-time rebase is needed, but this is not a finding.
- The changed file set matches the allowed set. `content/const-01-core-head.md` is untouched (`git diff HEAD --quiet` is clean). The only other changes are the expected ones: NEW-TICKETS.md, tasks.md, `.current/e174/`, `specs/` and the qa expected-red manifest.
- Verdict: APPROVED. One recommended wording nit, no required findings.

## AC Completeness
AC1 — implemented — `grep -c` on content/coord-03-core-fallback.md = 0; lines 9 and 27 now read `.current/<lane>/handoff.md` and `.current/<lane>/usage.jsonl`, with "current lane" qualified.
AC2 — implemented — content/coord-03-core-fallback.md:2: the `"switch_role"` tier is "the model tier you are actually running as, self-identified — never the `dispatch_pins` entry or `recommended_model`". It is re-derived fresh on every write and carries the no-correct-to-pin rule ("never correct your tier to match it").
AC2b — implemented — content/coord-03-core-fallback.md:3: a distinct `"inline"` WHEN/DO line covering the three named cases (initial agent, coordinator writing directly, continuing role). It uses the writer's own actual tier, never `dispatch_pins`, fresh on every write, "never corrected to match a differing pin".
AC3 — implemented — `grep -c` on content/coord-06-host-token.md = 0 (lines 21, 30).
AC4 — implemented — content/coord-02-host-dispatch.md:12, inside the four-backtick fenced template, directly after the Watermark line. It is self-contained: it references the Watermark line in the same template and has no const-01 cross-reference. Fencing is intact.
AC5 — dropped (option B) — const-01 is confirmed untouched.
AC6 — implemented — `grep -c '\.current/handoff\.md[^/]' docs/architecture.md` = 0. Line 60 names `.current/<lane>/.handoff.lock`, which matches `HANDOFF_LOCK_FILENAME = ".handoff.lock"` (tools/lane-paths.ts:88) and `resolveLaneLockPath` (:191).
AC7 — implemented — docs/gate-retro-procedure.md. (a) Both jq one-liners (:44, :50) and step-1/metrics prose (:25, :94) are current-lane scoped. (b) Step 1 (:29-33) routes totals to `tw_gate_stats` and cites its dedup of merged-lane copies. The metrics section (:107-111) routes totals to its deduped metrics summary. (c) The only glob, `.current/*/telemetry.jsonl` (:53), appears inside an explicit "Do NOT glob … for totals … ad-hoc, one-off … does NOT de-duplicate" caveat, never as a command. (d) The `# default: .current/metrics.jsonl` line (:101) is kept verbatim, with the explicit-lane-path clause added. `tw_gate_stats` count = 6 (≥ 3). The dedup claim is accurate against tools/gate-stats.ts:20,262,305: it reads every lane copy and skips identical or prefix copies.
AC8 — implemented — docs/http-mode.md:53: "commit your lane's `.current/<lane>/` directory".
AC9 — implemented — `grep -c` on docs/arming.md = 0 (lines 26, 31).
AC10 — implemented — the spec's proof grep returns empty (exit 1).

**Independent inventory re-grep, beyond AC10's literal pattern.** I confirmed `LANE_FILES` = {handoff.md, telemetry.jsonl, metrics.jsonl, usage.jsonl, dispatch.jsonl} at tools/lane-paths.ts:41-46. Then I swept `content/` and in-scope `docs/` three ways:
- every `.current/<x>` token;
- glob and brace forms (`.current/*`, `.current/{`, `.current/$`);
- split forms (`` `.current/` … handoff.md ``) and `path.join(".current", …)`-style forms.

Every hit outside the Leave-as-is rows is one of three kinds. None is a missed defect:
- non-lane files: `stale-dispatch.notify` (arming.md:66, config.md:61,79), the `docs/config.md` `.current/const-*` and `.current/skill-*` override paths, and `.current/**` in skill-pm.md:116;
- already lane-scoped: `.current/$LANE/…` in skill-release-engineer.md:252-254;
- the intentional ones: schema-versions.md:57 and gate-retro-procedure.md:101 (both classified).

## Correctness
No required findings.

- **recommended** — content/coord-03-core-fallback.md:4: the sentence "This is the pre-v3.20.0 behavior — degradation stays graceful for those hosts; no tw_* tool surface has changed." was split off the Fallback paragraph (it used to end line 1). It now sits directly after the `inline` attestation line, so "This" reads as referring to the inline attestation, which is new E99 behavior and not pre-v3.20.0. Fix: move the sentence back to the end of line 1, before the two attestation lines, or rephrase it as "The `tw_switch_role` fallback is the pre-v3.20.0 behavior …". The sentence is rationale-flavoured, so this is a clarity nit, not a behavioural defect.

- **Cross-mechanism consistency (checked, no finding).**
  - `task` (coord-02:12) sets tier to the Watermark `<tier>`, which is the pin, else the frontmatter default.
  - `switch_role` and `inline` (coord-03:2-3) set it to the writer's self-identified actual tier, never the pin.
  - This asymmetry is exactly what the amended spec prescribes: the AC4 note says `model=` IS the actual tier on a well-behaved host. The three lines agree on field names, on the enum values `"task"`/`"switch_role"`/`"inline"`, and on the "never a different value / never correct to pin" direction.
  - Each line is self-contained: none cross-references const-01 or another fragment.
  - Residual limitation, accepted by the spec and not a finding: a Task-dispatched subagent on a host that silently ignored `model=` would record the pin rather than its actual tier.

## Quality
- **optional** — content/coord-03-core-fallback.md:3: the `inline` line lists "coordinator-lite writing directly under a role". coordinator-lite does not compose `coord-03-*.md` and is server-read-only by design, so that reader never sees this line. The mention is harmless but unreachable.
- **optional** — content/coord-03-core-fallback.md:3: the `inline` line excludes `dispatch_pins` but not `recommended_model`, while the `switch_role` line excludes both. This is correct as written, because no `tw_switch_role` call means no `recommended_model` in hand. A reader skimming the two lines side by side may still wonder about the difference. Leave as is or add "or `recommended_model`" for symmetry.
- Diagram alignment in docs/architecture.md: I verified by byte-length. The Layer-1 box lines at :11-20 are all 66 bytes, and the pipeline box lines at :56-63 are 71 bytes (77 for the pre-existing emoji line). The edited rows :15 and :60 match their neighbours. Dropping "on" in "O_EXCL on" was needed to fit the width; the meaning is unchanged.
- `node scripts/check-md-tables.mjs`: OK, 0 malformed tables. Its warnings are pre-existing, in backlog.md, which this lane does not touch.

## Architecture
No `specs/e174-flat-path-sweep-architecture.md` exists. The placement follows the spec's option-B decision: coordinator-side only, and `skill-<role>.md` files are not restated. The E137, E124b and E73/E130 Feature-Scope Gate wording is not pre-done: the only coord-03 Feature-Scope Gate edit is the in-scope `.current/<lane>/handoff.md` path substitution at :12.

## Security
No findings. The change is prose only, adds no executable surface, and crosses no trust boundary.

## Performance
No runtime code changed. The coordinator bundle grows to 19284 ~tok, against the 18990 floor. This red is expected and qa-owned (T-E174-09).

**Expected-red sampling (step 4a).** The manifest `qa_reports/expected-red_e174-flat-path-sweep.txt` has 2 entries and I sampled both:
- the test/context-budget.test.mjs "AC8/AC-P2-7: teamwork coordinator bundle …" string is located (1 match);
- the test/skill-manifest.test.mjs "t-golden-byte-identity (AC1/AC5)" string is located (1 match).

`npm test` gives 2417 tests, 2415 pass, 2 fail. The two failures are exactly those manifest entries (not ok 245, not ok 1951), with no other reds.

## Verdict
APPROVED. All non-dropped ACs (AC1–AC4, AC6–AC10) are implemented with passing proofs, an independent broader re-grep finds no missed flat `LANE_FILES` path, and the only reds are the two manifest-listed, qa-owned re-baselines. One recommended wording nit remains (coord-03:4 antecedent), and it does not block.

Same-model note: the reviewer ran on opus and the sr-engineer was pinned to fable, so they are different models and same-model bias is not suspected.

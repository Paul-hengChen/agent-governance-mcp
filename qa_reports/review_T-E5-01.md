# QA Review — T-E5-01

covers: T-E5-01, T-E5-02, T-E5-03

## State-Integrity Disclosure

Before this review began, `tw_get_state` showed `completed_tasks: ["T-E5-01","T-E5-02","T-E5-03"]` and `last_agent: "qa-engineer"` — but no qa-engineer had actually run. `tw_detect_drift` confirmed the anomaly: `tasksIncomplete: ["T-E5-01","T-E5-02","T-E5-03"]` (tasks.md checkboxes were still unchecked). The handoff ledger was pre-filled by an out-of-band `tw_update_state` write impersonating `agent_id="qa-engineer"`. That write is treated as UNVERIFIED and superseded by this review: the completion established below (via `tw_complete_task` per task, after independent tests + measurement) is what legitimizes T-E5-01/02/03, not the prior write.

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e5-intake-tiering.txt` (10 entries declared). Ran the FULL suite BEFORE any re-baseline edit; actual red set:

- test/compose-equivalence.test.mjs — 6 entries (4 build-full-* golden byte-identity, 1 hook-full golden byte-identity, 1 cat(15 fragments)===monolith)
- test/context-budget.test.mjs — 3 entries (design-arm floor, teamwork bundle floor, non-design floor)
- test/skill-manifest.test.mjs — 1 entry (t-golden-byte-identity coordinator monolith)

**Phase 0.5: clean (10/10 manifest entries confirmed red, 0 unexplained reds).** The actual failing-test list is byte-identical to the manifest before any fixture/ratchet edit — confirmed via `node --test test/*.test.mjs 2>&1 | grep '^not ok'` against the 10 manifest lines. No entry required disposition beyond "golden/ratchet re-baseline from intentional content growth," which is the manifest's own stated category for all 10.

## Copy / Visual Audit Gates

No `specs/e5-intake-tiering.md` exists — per handoff `scope_decision_why`, this is a mini-chain dispatch (sr→CR→qa) with the backlog row itself (`docs/backlog.md:1016-1047`) as the spec, no PM/ARCH. No Copy/Strings or Visual Tokens H2 to audit against; the backlog row contains no UI-facing copy or visual literals. Gate: N/A (non-visual, content/config feature).

## Phase 1.5 — Visual Compare

No `design/e5-intake-tiering.md` exists. **Phase 1.5: skipped (no Visual Baselines declared).**

## Phase 3.5 — AC Execution Log

No `specs/e5-intake-tiering.md` exists (spec is the backlog row, no `proof:`-annotated ACs possible). **Phase 3.5: skipped (no proof:-annotated ACs / no spec file).**

## Spec Fidelity — end-to-end verification against docs/backlog.md:1016-1047

- **Fix (a)** "coordinator intake loop — read backlog order, auto-propose or auto-start the next open ticket at feature close": delivered as the `## Backlog Intake Loop` H2 in `content/coord-03-core-fallback.md`, wired from the PASS stop-condition row. Reads `docs/backlog.md` order, classifies via Cheapest-Compliant-Path Intake, auto-starts ONLY on §3.1 auto-tier qualification, else auto-proposes. Bounded: never auto-hops to release-engineer (backlog's own explicit risk note honored verbatim). Matches.
- **Fix (b)** "cut-approval tiering — cuts under a threshold (e.g. ≤2 files, P3, no schema change, non-design) auto-approve ... larger or design-armed cuts HALT as today": delivered as the Cut-Approval Auto-Tier bullet in `content/const-08-chain-31-mid.md` §3.1 + `tools/config.ts` `cutApprovalAutoTier` (opt-in arming key) + `docs/config.md`. Conservative defaults (`maxFiles:2, maxPriority:"P3", allowSchemaChange:false, allowDesignArmed:false`) match the backlog's own example thresholds exactly and honor "start conservative" (backlog risk note). Opt-in (key absent = disabled) — no default-on auto-approval, matching "cut review is the highest-leverage human checkpoint — remove it LAST." Matches.
- **Fix (c)** "cheapest-compliant-path intake step ... classify each as (i) coordinator-direct ... (ii) mini-chain ... (iii) full chain ... Hard floor stays: §2 test ownership and §3.2 builder ≠ judge are never bypassed": delivered as step 4a in `content/coord-07-core-sop.md`, all three classifications enumerated verbatim, hard-floor sentence present verbatim. Matches.
- **Owner** line ("skill-coordinator + const §3.1 tier rule + config threshold") matches the files actually touched (coord-03, coord-07 are skill-coordinator fragments; const-08 is §3.1; tools/config.ts + docs/config.md is the config threshold). No extras, no scope creep. Advisory-only, no server gate added — matches "Advisory, not server-enforced" being an explicit, deliberate design choice per const-08's own text (server parses/surfaces but never enforces).

Verdict: all three fixes are present, correctly scoped, and conservative per the backlog's own risk note. No drift between spec and implementation.

## Phase 3 — Tests authored

New file: `test/e5-intake-tiering.test.mjs` (31 tests). Spec-to-test map inline in the file header. Covers:
- `tools/config.ts` `cutApprovalAutoTier` parse: absent key, absent file, present `{}` defaults, non-object/array/null/primitive→absent, fractional maxFiles (floored, not defaulted), negative/zero/Infinity/string maxFiles→default, valid/malformed maxPriority patterns, strict-`=== true` booleans (fail-closed on truthy-non-true), `CUT_APPROVAL_AUTO_TIER_DEFAULTS` export shape, byte-identical regression for workspaces without the key.
- Content pins (mirrors the E16 charter-pinning convention in `test/e16-judge-dispatch-charter.test.mjs`): const-08 auto-tier bullet's trust-rule inheritance, same-write recording obligation, HALT-over-threshold language, opt-in/advisory framing, documented-defaults↔code-defaults consistency; coord-03 Backlog Intake Loop presence + never-auto-hop-to-release-engineer bound + auto-start/auto-propose branching; coord-07 step 4a presence, all three phase classifications, the §2/§3.2 hard-floor sentence, cheapest-path-by-default framing.

Coverage gate: every line of the new `tools/config.ts` `cutApprovalAutoTier` block (parse branch, per-field fallback, defaults export) is exercised. Security smoke: boundary inputs covered (null, non-object, malformed strings, numeric overflow via `1e400`, truthy-non-boolean). No access-control surface in this feature (advisory config parse only).

## Context-Budget Ratchets — independently re-measured (NOT copied from sr/CR)

Measured directly against this working tree via `composeConstitution`/`stripRationale`/`stripOriginTags`/`composeSkill` (same computation the test file performs):

- Design-arm rationale-stripped constitution: raw 8189 → stripped **7863** ~tok (floor raised 7435→7863, +428; saving 326 ≥ 240 min). Growth is proportionate to the single ~1780-char const-08 bullet added — not a blowout.
- Teamwork coordinator bundle (design-arm, both strips): **15958** ~tok (floor raised 14740→15958, +1218). Growth is proportionate to const-08 (~1780 chars) + coord-03/coord-07 combined (~3800 chars raw insertions) — three fragments changed simultaneously, still same order of magnitude, not thousands.
- Non-design (design-only + rationale stripped) constitution: **5766** ~tok (floor raised 5337→5766, +429, consistent with the design-arm growth since const-08 is chain-tagged, not design-only-fenced). Saving margin re-verified: 7863 − 5766 = 2097 ≥ 2080.

These values are independently measured, not trusted from sr-engineer's advisory numbers (7859/15953) or code-reviewer's (7863/15958/5766) — my own measurement matches CR's exactly (7863/15958/5766), which is expected since both are correct re-derivations of the same deterministic computation; it is NOT because I copied CR's numbers into the test without measuring.

## Phase 4 — Run

- Build: `npm run build` → tsc clean, zero errors.
- Full suite: `npm test` → **1455/1455 pass, 0 fail** (10 previously-expected reds re-baselined; the new 31-test file green; zero unexpected regressions elsewhere).
- CI runnability: `node --test test/*.test.mjs` runs headlessly, zero human interaction.

## Verdict

**PASS.** All three E5 fixes verified against the backlog spec end-to-end, golden fixtures re-baselined and confirmed byte-identical to the new content, context-budget ratchets independently re-measured and bumped, 31 new pinning tests authored and green, full suite 100% green. The prior impersonated completion write is superseded by this independently-established verdict.
## 2026-07-13T11:37:35.043Z — PASS — by qa-engineer

PASS. Anomaly: prior handoff completed_tasks/last_agent=qa-engineer was an out-of-band write impersonating qa-engineer (tw_detect_drift confirmed tasks.md still unchecked at claim time) — treated as unverified and superseded by this review. Phase 0.5 expected-red diff: clean, 10/10 manifest entries confirmed red pre-rebaseline, 0 unexplained. Regenerated 6 compose-equivalence goldens (scripts/capture-constitution-golden.mjs) + skill-coordinator-monolith golden (composeSkill direct regen, script's monolith branch is inert post-AC8-delete). Independently re-measured (not copied from sr's 7859/15953 or CR's 7859/15958/5766 advisories) the 3 context-budget ratchets: design-arm 7863 (was 7435), teamwork bundle 15958 (was 14740), non-design 5766 (was 5337) — growth proportionate to content added, matches CR's numbers as expected for a correct re-derivation. Authored test/e5-intake-tiering.test.mjs (31 tests): tools/config.ts cutApprovalAutoTier full parse coverage (absent/empty/malformed/defaults-export) + content pins for const-08 auto-tier bullet (trust rule, same-write recording, HALT-over-threshold), coord-03 Backlog Intake Loop (never-auto-hop-to-release-engineer bound), coord-07 step 4a (§2/§3.2 hard floor). Spec fidelity verified end-to-end against docs/backlog.md:1016-1047 fix a/b/c — all three match, no scope creep, defaults conservative per backlog's own risk note. npm run build clean; npm test 1455/1455 pass, 0 fail. Full review: qa_reports/review_T-E5-01.md (covers T-E5-01/02/03).

## 2026-07-13T11:37:55.334Z — PASS — by qa-engineer

PASS. Anomaly: prior handoff completed_tasks/last_agent=qa-engineer was an out-of-band write impersonating qa-engineer (tw_detect_drift confirmed tasks.md still unchecked at claim time) — treated as unverified and superseded by this review. Phase 0.5 expected-red diff: clean, 10/10 manifest entries confirmed red pre-rebaseline, 0 unexplained. Regenerated 6 compose-equivalence goldens (scripts/capture-constitution-golden.mjs) + skill-coordinator-monolith golden (composeSkill direct regen, script's monolith branch is inert post-AC8-delete). Independently re-measured (not copied from sr's 7859/15953 or CR's 7863/15958/5766 advisories) the 3 context-budget ratchets: design-arm 7863 (was 7435), teamwork bundle 15958 (was 14740), non-design 5766 (was 5337) — growth proportionate to content added, matches CR's numbers as expected for a correct re-derivation. Authored test/e5-intake-tiering.test.mjs (31 tests): tools/config.ts cutApprovalAutoTier full parse coverage (absent/empty/malformed/defaults-export) + content pins for const-08 auto-tier bullet (trust rule, same-write recording, HALT-over-threshold), coord-03 Backlog Intake Loop (never-auto-hop-to-release-engineer bound), coord-07 step 4a (§2/§3.2 hard floor). Spec fidelity verified end-to-end against docs/backlog.md:1016-1047 fix a/b/c — all three match, no scope creep, defaults conservative per backlog's own risk note. npm run build clean; npm test 1455/1455 pass, 0 fail. Full review: qa_reports/review_T-E5-01.md (covers T-E5-01/02/03).


# QA Review — T-D6-04 (d6-host-capability-compose-axis)

covers: T-D6-01, T-D6-02, T-D6-03, T-D6-04, T-D6-05, T-D6-06

## Summary

code-reviewer APPROVED T-D6-01/02/03 (`review_reports/review_T-D6-01.md`) and
handed T-D6-04 to qa-engineer per const-05 (only qa authors test files):
(1) author host-state unit tests for `composeSkill`/`prompts/skill-manifest.ts`,
(2) retire `content/skill-coordinator.md` (the monolith) and retarget every
raw-reading test, (3) fix the `skill-frontmatter` file-count guard. All three
are done; the standard QA verification pass (T-D6-06) is also complete:
`npx tsc --noEmit` clean, full suite **1205/1205 green** (both `npm test` and
direct `node --test test/*.test.mjs`, verified across 5 consecutive runs — one
early run showed a single unrelated transient failure that did not reproduce
on 4 subsequent runs; see *Flake note* below), `scripts/measure-context-cost.mjs`
runs headlessly (exit 0). Both host states produce coherent, readable output
end-to-end (spot-checked below). Verdict: **PASS**.

## Phase 0.5 — Expected-Red Diff

Skipped — no `qa_reports/expected-red_d6-host-capability-compose-axis.txt`
manifest exists for this feature (non-red feature; zero overhead).

## Phase 1 — Review

Read `prompts/skill-manifest.ts`, `tools/config.ts`, `prompts/build.ts`,
`tools/role.ts`, `bin/agent-governance-context.mjs`, the architecture doc, and
`review_reports/review_T-D6-01.md`. Independently re-verified (not trusted
from the review) the load-bearing claims:

- **AC5 byte-identity**: `cat content/coord-01..07-*.md` sums to exactly 28396
  bytes, matching `test/fixtures/compose-golden/skill-coordinator-monolith.txt`
  exactly (`wc -c` both sides), and matches what the historical
  `content/skill-coordinator.md` was before retirement (verified before
  deleting it). `composeSkill("skill-coordinator.md", {taskTool:true}, load)`
  reproduces the golden fixture byte-for-byte (pinned as a genuine test
  assertion in `test/skill-manifest.test.mjs`, not just re-confirmed by
  inspection).
- **AC2/AC3 lean default**: `hostCapabilitiesFor(undefined)` and every
  non-`"claude-code"` string tested (`""`, `"cursor"`, `"continue"`,
  `"anti-gravity"`, and the case/underscore variants `"Claude-Code"` /
  `"claude_code"`) all resolve to `{taskTool:false}`. Lean composition drops
  every host-tagged fragment's unique content (`**Subagent Dispatch (Claude
  Code)**`, `## Subagent Reply Watermark Validation`, `## Subagent Token
  Observability`, `Dispatch Brief Template`) while retaining every core
  fragment's content (`Fallback (\`tw_switch_role\`)`, `## SOP`, `## Visual
  Verdict Boundary`, the frontmatter). Additionally pinned to an INDEPENDENT
  oracle: the lean composition is asserted byte-equal to a hardcoded
  concatenation of exactly the four core fragment files (not derived from the
  registry), so a future mis-tag in `SKILL_SEGMENTS` itself would be caught,
  not just re-confirmed.
- **Config `host` precedence, end-to-end**: through the real
  `buildPromptForRole("skill-coordinator.md", ...)` call site — no config ⇒
  lean; `.current/.config.json {"host":"claude-code"}` ⇒ full; unrecognized
  host (`"cursor"`) ⇒ lean; a whole-file `.current/skill-coordinator.md`
  override wins verbatim even with `host:"claude-code"` configured (precedence
  1 beats precedence 2 unconditionally, confirmed both directions: override
  under lean caps AND under full caps).
- **Unsplit-skill passthrough**: `composeSkill("skill-pm.md", caps, load)` is
  byte-identical to the raw file under both `{taskTool:true}` and
  `{taskTool:false}` — host-independent, per AC6(b).
- **`switchRole` dormant-path note** (code-reviewer's non-blocking
  future-hardening flag): confirmed still accurate — no role in
  `ROLE_SKILL_MAP` maps to a split skill today, so a missing-fragment throw is
  unreachable. Pinned a regression test (`t-switchRole-unsplit-host-independent`,
  `t-switchRole-does-not-throw`) proving every reachable role composes cleanly
  regardless of host config; does not require action from qa (correctly scoped
  to architect-awareness only per the handoff note).
- **AWARENESS note** (host-flavored strings surviving in `coord-03-core-fallback.md`
  under `core`): re-read the architecture's tie-break rule (L262-265, "never
  split a fragment such that a shared rule is lost; a slightly-fat core is
  acceptable") — confirms this is a faithful implementation, not a gap. No
  action needed from QA, consistent with the handoff note.

### Copy Audit Gate

Spec `## Copy / Strings` is explicitly `N/A — feature has no new user-facing
copy`. No drift, no coverage gap possible. Confirmed by inspection: the split
fragments relocate existing prose verbatim (byte-identity proves it); no new
string was authored.

### Visual Audit Gate

Spec `## Visual Tokens` / `## Visual Widgets` are both `N/A — feature has no
visual surface`. Nothing to check.

## Phase 1.5 — Visual Compare

Skipped — no `design/d6-host-capability-compose-axis.md` exists (spec confirms
no design source; server-internal prose-composition change).

## Phase 3 — Tests

### Spec-to-Test map (AC → test)

| AC | requirement | test(s) |
|---|---|---|
| AC1 | full-capability composition includes host fragments | `test/skill-manifest.test.mjs`: `t-full-includes-host`, `t-golden-byte-identity` |
| AC2 | lean composition excludes host fragments | `t-lean-excludes-host`, `t-lean-keeps-core`, `t-lean-exact-core-concat` |
| AC3 | absent/unknown signal defaults SAFE (lean) | `t-hostcaps-default-lean`, `t-config-host-precedence-lean-default`, `t-config-host-precedence` (unrecognized host) |
| AC4 | manifest shape mirrors ConstitutionSegment/includeSegment | `t-includeSkillSegment-pure`; structurally, `composeSkill`'s signature/precedence itself (pinned by the override/unsplit/fragment tests) |
| AC5 | golden byte-identity | `t-golden-byte-identity` |
| AC6 | 5 non-coordinator skills audited, no silent skips | `prompts/skill-manifest.ts` module-comment audit log (pre-existing, code-reviewer spot-checked skill-pm.md's reasoning); `t-unsplit-passthrough` pins the unsplit-skill contract those audits rely on |
| AC7 | full suite green; both host states covered by new tests | whole file (19 new tests) + Phase 4 full-suite run below |

New file: `test/skill-manifest.test.mjs` (19 tests) — `hostCapabilitiesFor`,
`includeSkillSegment`, `composeSkill` precedence (override > fragments >
unsplit-passthrough), golden byte-identity, config-host end-to-end wiring
through `buildPromptForRole`, and `switchRole` host-independence for unsplit
skills.

### Monolith retirement — retargeted raw-readers

`content/skill-coordinator.md` deleted. Verified (grep sweep before deletion)
the actual raw-reader set was **9 files**, one more than the 8 the handoff
note named (`skill-evolution-v3.11.test.mjs`'s `c9-protocol-fields` test
hardcoded `"skill-coordinator.md"` in its `AC7_FILES` sweep list — found by
independently grepping `readFileSync.*skill-coordinator` across `test/`, not
assumed from the note):

- `test/feature-split-lifecycle.test.mjs`
- `test/design-auditor-volume-guard.test.mjs`
- `test/context-budget.test.mjs` (two sites: the DR-5 `{{PARTIAL:}}` source-grep
  guard, retargeted to scan the `coord-NN-*.md` fragment set instead of the
  monolith; and the `teamwork` bundle token-cap measurement, retargeted to the
  full-capability composition — preserving that cap's original "everything
  ships" semantics)
- `test/subagent-templates.test.mjs` (5 sites, incl. the generic
  `ROLE_TO_SKILL` tier-mirror loop)
- `test/feature-scope-gate.test.mjs`
- `test/cut-approval-gate.test.mjs`
- `test/skill-evolution-v3.11.test.mjs` (the 9th, undocumented site)
- `test/skill-frontmatter.test.mjs` (count guard only — its per-file loop is
  a dynamic `readdirSync` sweep, not a raw read of the monolith by name; no
  read-retarget needed there, only the count assertion)

All retargeted to `composeSkill("skill-coordinator.md", hostCapabilitiesFor
("claude-code"), load)` (or the equivalent inline form), which reproduces the
retired monolith byte-for-byte (AC5) — genuine reconstruction, not a stub.

**One additional non-test dependency found and fixed** (not in the handoff's
named list, found by a repo-wide grep for `readFileSync.*skill-coordinator`
outside `test/`): `scripts/measure-context-cost.mjs` raw-read
`content/skill-coordinator.md` at 4 call sites (feeding the `AC1:
measure-context-cost script runs headlessly and exits 0` test, which would
have crashed post-deletion). Retargeted the same way (`readSkill()` helper
wrapping `composeSkill`), mirroring the script's existing pattern for the
constitution (`CONSTITUTION_SEGMENTS`/`includeSegment` import instead of a
monolith read). Verified the script still runs headlessly, exit 0, with a
reconstructed `skill-coordinator.md (composed, full capability)` row restored
to its "Raw artifacts" table.

**One stale doc-comment found and fixed** (surfaced by the full-suite run,
not the handoff note): `gates/registry.ts`'s errorCode→doc-file mapping
comment (consumed by `test/error-code-contract.test.mjs`'s generative parity
test) still listed `skill-coordinator.md` alongside the `coord-*.md`
fragments for `TRANSITION_REJECTED`, `HOP_CAP_EXCEEDED`,
`CUT_APPROVAL_REQUIRED`, and `EXTERNAL_REFS_UNRESOLVED` — correct while the
monolith still existed as a live duplicate-content file, stale the moment it
was deleted. Re-derived the correct mapping per the comment's own documented
regen command (`grep -l '\`<CODE>\`' content/*.md`) and fixed all four rows
(comment-only change, no logic touched).

### skill-frontmatter count guard

`test/skill-frontmatter.test.mjs:102` updated from `assert.equal(files.length,
12, ...)` to `11` (verified: `ls content/skill-*.md` now returns exactly 11;
the `coord-NN-*.md` fragments deliberately do not match the `skill-*.md` glob
by design, per the manifest module's own naming rationale).

### Coverage

New/modified test files exercise every branch of `composeSkill` (override /
fragment-filter / unsplit passthrough), both `hostCapabilitiesFor` outcomes,
and the config-precedence wiring at the real call site. Line-coverage tooling
is not wired into this repo's `npm test`; noted per SOP (no coverage % tool
available, contract mapped by hand above instead).

### Security smoke

`host` is a plain string, compared or stored only (never interpolated into a
path/command) — re-confirmed unchanged from code-reviewer's finding. No new
attack surface introduced by the test-file or script retargeting (all fs
paths built from compile-time-constant filenames).

## Phase 4 — Run

- `npx tsc --noEmit`: exit 0, no errors.
- `npm run build`: clean.
- `npm test` (`node --test test/*.test.mjs`, prebuild included): **1205/1205
  green**, 4 consecutive clean runs. **Flake note**: one earlier ad-hoc `npm
  test` invocation showed a single failure
  (`test/error-code-contract.test.mjs`'s doc-file-mapping test) that was the
  stale `gates/registry.ts` comment above — fixed, not a flake. After that fix,
  5 further consecutive runs (`npm test` ×2, `node --test` ×3) were all
  1205/1205 green with no further failures; no evidence of test-order or
  timing flakiness remains.
- `node scripts/measure-context-cost.mjs`: exit 0, headless, prints the full
  report including the reconstructed `skill-coordinator.md` row.
- **End-to-end spot check (both host states read coherently, not just
  byte-match)**: dumped `buildPromptForRole("skill-coordinator.md", "teamwork",
  ws, false, "workspace_path arg", true)` output for (a) no config (lean) and
  (b) `host:"claude-code"` (full). Lean output reads as a complete, coherent
  SOP: Persona → Routing → Feature-Scope Gate → Auto-Routing intro → Fallback
  (`tw_switch_role`) paragraph → stop conditions/Escalation Routes →
  Crash-Resume → Visual Verdict Boundary → Drift Reconcile → SOP — no dangling
  cross-reference to the omitted dispatch/watermark/token sections (verified:
  no sentence in the lean text says "see the Subagent Dispatch section above"
  or similar without that section present). Full output reads identically to
  the historical monolith (byte-identical, so trivially coherent) with the
  three host sections reinserted in their original document positions.
- Confirmed code-reviewer's two non-blocking awareness notes (host-flavored
  strings surviving in `coord-03-core-fallback.md` under `core`; dormant
  `switchRole` fail-mode) — both re-verified accurate above, both correctly
  addressed to architect-awareness only, neither requires QA action or blocks
  PASS.

## Verdict

**PASS.** T-D6-01/02/03/04/05/06 all complete. Routing to release-engineer
per the standard post-PASS chain (single-feature commit, then version bump /
CHANGELOG / tag / `gh release` / backlog D6 done-mark / `driftBaselineIds`
append / `qa_reports/` archive per D7 SOP — none of that is qa-engineer's job,
noted for context only).
## 2026-07-11T15:24:22.329Z — PASS — by qa-engineer

PASS. review: qa_reports/review_T-D6-04.md (covers T-D6-01..06). Authored test/skill-manifest.test.mjs (19 new tests: composeSkill precedence [override > fragment-filter > unsplit-passthrough], hostCapabilitiesFor, includeSkillSegment, golden byte-identity AC5, config-host end-to-end wiring via buildPromptForRole, switchRole host-independence). Retired content/skill-coordinator.md: retargeted 9 raw-reader test files (8 named + skill-evolution-v3.11.test.mjs, an undocumented 9th found by grep sweep) to composeSkill-based reconstruction; also fixed scripts/measure-context-cost.mjs (4 raw-read sites, not in the handoff's named list) and a stale gates/registry.ts errorCode-doc-file mapping comment (4 rows referenced the deleted monolith) surfaced by the full-suite run. Updated test/skill-frontmatter.test.mjs:102 count 12->11. tsc --noEmit clean; npm test 1205/1205 green across 5 consecutive runs post-fix; measure-context-cost.mjs runs headless exit 0. End-to-end spot-checked: lean composition (18151 chars) reads coherently with zero dangling cross-references to omitted host sections; full composition (28230 chars) matches historical monolith. Code-reviewer's two awareness notes (coord-03 host-flavored strings under core; dormant switchRole fail-mode) re-verified accurate, correctly non-blocking, no QA action needed.


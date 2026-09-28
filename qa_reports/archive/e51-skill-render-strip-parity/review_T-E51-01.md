# QA Review — T-E51-01

covers: T-E51-01, T-E51-02, T-E51-03

Feature: `e51-skill-render-strip-parity` · Round 1 · verdict **PASS**

## Phase 0.5 — Expected-Red Diff

Phase 0.5: skipped (no expected-red manifest declared). No
`qa_reports/expected-red_e51-skill-render-strip-parity.txt` exists, and the handoff carries no
`dispatch_mode: "bugfix"`, so the manifest is correctly absent — this is a refactor with no
intentionally-red tests. Zero reds were observed in the final run, so there is nothing to
disposition.

## Phase 1 — Review

- **Contract source**: no `specs/e51-*.md`. The `docs/backlog.md` E51 row is the spec (mini-chain,
  PM/ARCH skipped), with the five ACs and four pinned decisions recorded on the cut-approving
  `pm:In_Progress` write's `scope_decision_why`. Reviewed against that.
- **Phase 3a Copy Audit Gate**: N/A — no *Copy / Strings* H2 exists (no spec file; zero user-facing
  strings introduced; the only string changes are source comments).
- **Phase 3b Visual Audit Gate**: N/A — no *Visual Tokens* H2, no literals introduced.
- **Correctness/architecture findings**: none of my own. Per the QA scope rule those belong to
  code-reviewer, whose Round 1 is APPROVED with zero blocking findings
  (`review_reports/review_T-E51-01.md`). I independently re-confirmed the two claims that PASS
  depends on: `test/fixtures/` shows **0 changed files** (AC2 holds on disk, not merely in a passing
  assertion), and the changed-file set is exactly the three source files plus their `dist/` output,
  this test file, and the two review reports.
- **Scope check**: `bin/agent-governance-context.mjs` untouched, and now pinned by a test rather than
  by intent alone.

## Phase 1.5 — Visual Compare

Phase 1.5: skipped (no Visual Baselines declared). No `design/` directory entry for this feature;
non-UI change.

## Phase 3 — Tests

**Test File Discovery**: relevant coverage already existed — `test/skill-manifest.test.mjs` is the
file whose own header names "the three render sites (`prompts/build.ts`, `tools/role.ts switchRole`,
`bin/agent-governance-context.mjs`)" and which already iterates every `ROLE_SKILL_MAP` role. Extended
it; no new test file created, so the §2 "ask before creating" branch never armed.

**AC → test map** (8 new tests, all in `test/skill-manifest.test.mjs`):

| AC | test | note |
|---|---|---|
| AC1 — no marker in `switchRole` output, every role | `t-e51-switchRole-marker-free` | asserts across all 9 roles |
| AC1 — anti-vacuity guard | `t-e51-witness-fences-exist-in-source` | fails if the fences are ever deleted from `content/` instead of stripped at render time, which would make the AC1 test pass on empty input |
| AC1 — parity is one implementation, not two that agree | `t-e51-switchRole-uses-the-shared-pass` | `sop` byte-equal to `applyTextTransforms(body, {fullDetail:false})` over the same composed input, per role |
| AC2 — `compose-golden` fixtures byte-identical | pre-existing `t-golden-byte-identity` + `test/compose-equivalence.test.mjs`, plus `git status test/fixtures/` = 0 | **assert-not-rebaseline**: no fixture was regenerated |
| AC3 — strippers still importable from `build.js` | `t-e51-build-reexport-surface` | also asserts identity (`===`) with `text-transforms.js`'s exports, so a re-introduced copy fails |
| AC4 — suite green | full run, below | |
| AC5 — hook untouched | `t-e51-hook-remains-non-caller` | names DR-2/DR-4 and tells a future maintainer to retire the test deliberately rather than delete it in passing |
| shared-pass contract (`fullDetail`) | `t-e51-applyTextTransforms-contract` | origin stripped at every detail level, rationale only when `fullDetail:false`; idempotence; no-marker passthrough |
| body-only / frontmatter intact | `t-e51-frontmatter-survives-strip` | `recommended_model` still surfaced |
| override behaviour change documented | `t-e51-override-is-stripped` | whole-file `.current/` override is stripped too — deliberate parity with `buildPromptForRole` |

**Reviewer's count correction applied**: `ALL_SWITCHROLE_ROLES` is 9, not the 10 the cut's AC1 text
claimed. Introduced as a named constant and the pre-existing hardcoded 9-role array at
`t-switchRole-does-not-throw` was retargeted onto it, so the two can no longer disagree.

**Coverage gate**: the three changed source files are covered — `prompts/text-transforms.ts` has every
exported function directly exercised (both strippers via the parity + re-export tests, and
`applyTextTransforms` on both `fullDetail` branches); `tools/role.ts`'s new line is on the path of
three tests; `prompts/build.ts`'s two rewritten call sites are covered by the pre-existing golden and
context-budget suites. Line-coverage tooling is not wired into this repo (`npm test` is bare
`node --test`), so this is a reasoned per-symbol argument, not a measured percentage — recorded
explicitly per the Coverage Gate's "if tooling can't measure, note it" clause.

**Security smoke tests**: boundary inputs covered inside
`t-e51-applyTextTransforms-contract` — no-marker input (passthrough), and idempotent re-application.
Empty-string passthrough is already pinned by the pre-existing `T-GTS-07/AC3` assertions in
`test/context-budget.test.mjs`, which still run against these same functions through the re-export.
No access control is involved; no input crosses a trust boundary.

## Phase 3.5 — AC Execution

Phase 3.5: skipped (no `proof:`-annotated ACs). No `specs/e51-*.md` exists to carry them — the E51
ACs live in the backlog row and were verified by the mapped tests above.

## Phase 4 — Run

- `npm run build`: ZERO errors, `check:version` OK at 3.97.0.
- Full suite: **1677 / 1677 pass, 0 fail** (1669 pre-change baseline + the 8 new tests, exactly).
- CI runnability: `npm test` runs headlessly with zero human interaction. No new infra, no new
  dependency, no network access in the added tests.

### Environment incident encountered and repaired (NOT an E51 defect)

The first run of the extended test file died at import with
`ERR_MODULE_NOT_FOUND: Cannot find package 'js-yaml'`. Investigated before changing anything:

- `package.json` and `package-lock.json` were **unchanged in git**, and the lockfile's mtime was
  Jul 11 — no dependency edit happened.
- `node_modules/` mtime was Aug 11 16:12 local, inside the ~4-hour idle gap between the sr-engineer
  handoff and this QA round, and `npm ls` reported the tree as `(empty)` — `node_modules` had been
  pruned out-of-band by something outside this session.
- Repaired with `npm ci`, which installs exactly the lockfile and cannot mutate tracked files;
  confirmed afterwards that `git status -- package.json package-lock.json` is still 0 changed.

Consequence for the record: the sr-engineer's earlier "1669/1669" run was valid when made but was
taken in a since-mutated environment. Every figure in this section comes from the post-repair
environment. **Cause of the prune is unknown and unexplained** — a plausible candidate is an
interrupted `npm audit fix` (`js-yaml` is one of the five HIGH advisories), but I have no evidence
for that and am not asserting it.

### §6 dependency audit

Unchanged by E51 and still **not a clean pass**: 5 HIGH / 0 CRITICAL (`sharp` ← libvips
CVE-2026-33327/33328/35590, `@xenova/transformers` ← `sharp`, `fast-uri`, `ip-address`, `js-yaml`).
`js-yaml` resolves to 4.2.0 after the repair and is still flagged, so the advisory covers the current
version — this will not be fixed by a routine bump. Pre-existing and orthogonal (no dependency file
changed), waiver already endorsed by code-reviewer; carried forward as a standing item that wants its
own backlog row rather than an in-cut fix.

## Verdict

**PASS** — all five E51 ACs verified, 8 new tests mapped to them, 1677/1677 green, no fixture
rebaselined, and the deliberate out-of-scope boundary (`bin/agent-governance-context.mjs`) now pinned
by a test that explains itself. Two items handed to the human rather than silently absorbed: the
unexplained `node_modules` prune, and the standing 5 HIGH advisories.
## 2026-08-11T09:29:51.580Z — PASS — by qa-engineer

PASS. All five E51 ACs verified. AC1: switchRole output marker-free across all 9 ROLE_SKILL_MAP roles, plus an anti-vacuity witness test and a byte-equality test proving both paths use the SAME pass (not two that agree). AC2: compose-golden fixtures byte-identical - git status test/fixtures/ = 0 changed, nothing rebaselined. AC3: both strippers importable from dist/prompts/build.js and asserted identical (===) to text-transforms.js's exports, so a re-introduced copy fails. AC4: full suite 1677/1677 pass, 0 fail (1669 baseline + exactly 8 new tests). AC5: hook untouched and now pinned by t-e51-hook-remains-non-caller, which names DR-2/DR-4. Applied the reviewer's count correction: 9 switchRole roles, not 10; introduced ALL_SWITCHROLE_ROLES and retargeted the pre-existing hardcoded array onto it. Build clean, check:version OK 3.97.0, CI-runnable headless. Two items escalated to the human rather than absorbed: (1) an unexplained out-of-band node_modules prune during the idle gap (js-yaml went missing; package.json/lock unchanged in git, lock mtime Jul 11, node_modules mtime Aug 11 16:12; repaired with npm ci, which cannot mutate tracked files - all Phase 4 figures are post-repair); (2) the standing 5 HIGH / 0 CRITICAL npm advisories, pre-existing and orthogonal (no dependency file changed), waiver endorsed by code-reviewer, wants its own backlog row - note js-yaml 4.2.0 is still flagged, so a routine bump will not clear it. Coverage argued per-symbol rather than measured: no line-coverage tooling is wired into this repo.


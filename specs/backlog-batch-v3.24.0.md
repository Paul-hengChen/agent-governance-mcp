# Backlog Batch Fix (v3.24.0)

## Problem Statement

Four open items in `docs/backlog.md` (B5, B2, B3, B1) represent accumulated tech debt from the v3.22–v3.23 release cycle. B5 (P0) causes every release to silently omit source directories from the tag; B2 (P1) leaves the always-on context budget at a 2-token margin that breaks on any edit; B3 (P1) forces a manual test edit on every version bump; B1 (P2) is a spec-accuracy nit. This batch ships all four as a single MINOR bump.

## User Stories

- As a release-engineer, I want the staging SOP to enumerate ALL source directories (`tools/ schema/ guards/ prompts/ bin/`), so that releases never ship with source/dist divergence.
- As a contributor, I want ≥ 100 tokens of headroom in the always-on context budget, so that minor constitution/skill edits don't break CI unexpectedly.
- As a qa-engineer, I want the version-pin test to read `package.json` dynamically, so that I don't manually edit the test on every release.
- As a spec maintainer, I want `watermark-hide-model-tier.md` AC1 to say "load-bearing semantics preserved" instead of "verbatim," so that the shipped paraphrase is correctly documented.

## Acceptance Criteria

### B5 — release-engineer staging list omits source dirs (P0)

- **AC-B5.1** — Given `content/skill-release-engineer.md` SOP step 7, when the file is read, then the `git add` enumeration MUST include `tools/ schema/ guards/ prompts/ bin/ transport/` in addition to the existing `lib/ content/ templates/ specs/ test/ qa_reports/ review_reports/`. `scripts/` is also included (decision: `scripts/` holds `.mjs` source that `AC-B5.5` scan would flag; adding it is correct and supersedes the original 5-dir enumeration — see "scripts/ decision" note under Dependencies).
- **AC-B5.2** — Given `content/skill-release-engineer.md` SOP step 7 pre-commit verify (AC2), when the cross-reference logic is described, then the FEATURE_DIRS set MUST include `tools/ schema/ guards/ prompts/ bin/ transport/ scripts/`.
- **AC-B5.3** — Given `templates/claude-code-agents/release-engineer.md`, when the shim is read, then the staging scope hint MUST list `tools/ schema/ guards/ prompts/ bin/ transport/ scripts/` alongside the existing directories.
- **AC-B5.4** — Given `test/release-staging.test.mjs`, when the `FEATURE_DIRS` array is read, then it MUST include `tools/`, `schema/`, `guards/`, `prompts/`, `bin/`, `transport/`, `scripts/`.
- **AC-B5.5** — Given `test/release-staging.test.mjs`, when the test suite runs, then a NEW test MUST assert that every top-level source directory in the repo (detected by scanning the repo root for directories that contain `.ts` or `.mjs` source files, excluding `node_modules/`, `dist/`, `.git/`, `.backup/`, `.current/`, `.github/`, `.claude/`, `docs/`, `research/`, `qa_reports/`, `review_reports/`, `specs/`) appears in the FEATURE_DIRS list or the metadata list, so that a new source dir can't silently fall out of releases. `transport/` MUST NOT appear in `EXCLUDED_DIRS`.
- **AC-B5.6** — (post-review fix, T478–T479) `transport/http.ts` is a first-class source file: imported by `index.ts`, listed in `tsconfig.json` `include`, compiled to tracked `dist/transport/http.js`. All three artefacts updated in T473–T474 (SOP + template) and T475 (test) MUST reflect `transport/` inclusion. The initial implementation omitted `transport/` and masked the gap by placing it in `EXCLUDED_DIRS`; T478 (sr-engineer) and T479 (qa-engineer) correct this.

### B2 — always-on 2-token headroom (P1)

- **AC-B2.1** — Given `test/context-budget.test.mjs`, when the lean-bundle cap test is read, then the target MUST be raised from `2100` to `2300` with a comment explaining the 200-token margin policy.
- **AC-B2.2** — Given the lean always-on bundle (stripped constitution + `skill-coordinator-lite.md`), when measured, then the token count MUST be `≤ 2300` (the new cap).
- **AC-B2.3** — No change to `content/constitution.md` or `content/skill-coordinator-lite.md` text is required by this item — only the test cap moves. If a future edit pushes the bundle above 2300, the test fails as intended — the margin absorbs ~200 tokens of editing slack.

### B3 — version-pin test refactor (P1)

- **AC-B3.1** — Given `test/subagent-templates.test.mjs`, when the version-check test (currently `"v3.23.1 AC8: package.json + index.ts both at 3.23.1"`) is read, then the test MUST read `JSON.parse(fs.readFileSync('package.json')).version` dynamically at runtime and assert against that value — no hard-coded version string in the test name, test body, or assertion.
- **AC-B3.2** — The test name MUST be generic (e.g. `"AC8: package.json + index.ts versions match"`), not version-specific.
- **AC-B3.3** — The existing `scripts/check-version.mjs` pre-build gate is NOT removed — it remains the primary coherence check. The test is supplementary.
- **AC-B3.4** — (post-review fix, T480) The version regex used in the test assertion MUST escape all semver metacharacters, not only `.`. Acceptable approaches: escape all non-alphanumeric characters in the captured version string, or compare the captured literal with `===` instead of a regex match.

### B1 — §1 verbatim wording (P2)

- **AC-B1.1** — Given `specs/watermark-hide-model-tier.md` AC1, when the self-detection rule description is read, then the word `"verbatim"` MUST be replaced with `"load-bearing — semantics preserved"` (or equivalent that acknowledges paraphrasing is acceptable as long as the self-detection semantics are intact).
- **AC-B1.2** — Given `specs/watermark-hide-model-tier.md` Copy/Strings table row `wm.selfdetect.rule`, when the source column is read, then it MUST read `"authored-here — canonical self-detection rule; load-bearing semantics preserved in constitution §1 (paraphrase acceptable)"` instead of `"authored-here — canonical self-detection rule to be inserted verbatim into constitution §1"`.
- **AC-B1.3** — No change to `content/constitution.md` text. The constitution §1 paraphrase is correct as shipped; only the spec that claims "verbatim" is being relaxed.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing strings; all changes are internal SOP/test/spec text |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Rewriting the constitution §1 self-detection rule (B1 only relaxes the spec wording, not the shipped text).
- Compressing constitution text to reclaim tokens (B2 only moves the test cap, not the text).
- Removing `scripts/check-version.mjs` (B3 supplements, doesn't replace).
- Any schema_version bump (content/SOP-only changes).
- Any `tools/transitions.ts` change.

## Dependencies / Prerequisites

- v3.23.1 is the released baseline. Version bump to 3.24.0 (MINOR) is part of this feature — task T481.
- B5 changes are SOP text + test — no compiled source.
- B2 is test-only.
- B3 is test-only (qa-engineer ownership per Constitution §2).
- B1 is spec-text-only.
- No external references.
- **scripts/ decision** (independent review, 2026-06-02): `scripts/` holds `.mjs` source (e.g. `check-version.mjs`). Including it in FEATURE_DIRS is correct because AC-B5.5 repo scan would otherwise flag it. This extends the original 5-dir AC-B5.1 enumeration; the extension is recorded here as an authorised decision.
- **transport/ post-review fix** (independent review, 2026-06-02): `transport/http.ts` was omitted from the B5 staging list and hidden from the AC-B5.5 guard by placement in `EXCLUDED_DIRS`. T478 (sr-engineer) and T479 (qa-engineer) correct this. The decision to fix rather than defer was taken by PM on the basis that the omission precisely recreates the source/dist divergence B5 was created to prevent.
- **tsconfig.include derivation** (independent review finding 2, MEDIUM/altitude): Deriving FEATURE_DIRS from `tsconfig.json include` instead of hand-maintaining EXCLUDED_DIRS is the root-cause fix. Deferred to a follow-on task (out of scope for T479 patch) — the patch approach (remove transport/ from EXCLUDED_DIRS, add to FEATURE_DIRS) is sufficient for MVP correctness.

## Tasks

- [x] T473 [P0] B5 (sr-engineer): Update `content/skill-release-engineer.md` SOP step 7 — add `tools/ schema/ guards/ prompts/ bin/` to git add enumeration + pre-commit FEATURE_DIRS description | depends_on: none
- [x] T474 [P0] B5 (sr-engineer): Update `templates/claude-code-agents/release-engineer.md` — add missing dirs to staging scope hint | depends_on: none
- [x] T475 [P0] B5+B2+B3 (qa-engineer): Update `test/release-staging.test.mjs` — expand FEATURE_DIRS + add repo-scan guard test; update `test/context-budget.test.mjs` — raise cap to 2300; update `test/subagent-templates.test.mjs` — dynamic version read | depends_on: T473
- [x] T476 [P2] B1 (sr-engineer): Update `specs/watermark-hide-model-tier.md` — relax "verbatim" to "load-bearing semantics preserved" in AC1 + Copy/Strings source | depends_on: none
- [x] T477 [P1] (sr-engineer): Update `docs/backlog.md` — mark B5, B2, B3, B1 as done with version ref | depends_on: T473, T474, T475, T476
- [ ] T478 [P0] B5-fix transport/ (sr-engineer): In `content/skill-release-engineer.md` SOP step 7, add `transport/` to the git add enumeration and to the pre-commit FEATURE_DIRS description. In `templates/claude-code-agents/release-engineer.md`, add `transport/` to the staging scope hint. Ref AC-B5.1, AC-B5.2, AC-B5.3, AC-B5.6. | depends_on: none
- [ ] T479 [P0] B5-fix transport/ guard (qa-engineer): In `test/release-staging.test.mjs`, add `transport/` to the `FEATURE_DIRS` array and remove it from `EXCLUDED_DIRS`. Verify the repo-scan guard test (AC-B5.5) now flags any future transport/ omission. Run full test suite — must stay green. Ref AC-B5.4, AC-B5.5, AC-B5.6. | depends_on: T478
- [ ] T480 [P2] B3-fix regex metachar (qa-engineer): In `test/subagent-templates.test.mjs`, fix the version regex so all semver metacharacters are escaped (not only `.`), or replace the regex match with `===` literal comparison. Ref AC-B3.4. | depends_on: none
- [ ] T481 [P1] Version bump 3.23.1 → 3.24.0 (sr-engineer): Bump `package.json` version to `3.24.0`, bump the `Server()` literal in `index.ts` to `3.24.0`, prepend `## [3.24.0]` entry in `CHANGELOG.md` summarising B5+B2+B3+B1+transport-fix. Run `npm run build`. Ref check-version gate. | depends_on: T478, T479, T480

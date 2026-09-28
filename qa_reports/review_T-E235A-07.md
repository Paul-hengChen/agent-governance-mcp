# Review — T-E235A-07, T-E235A-08

covers: T-E235A-07, T-E235A-08

## Round 1 — by qa-engineer

## Summary
- Code review APPROVED round 2 (`review_reports/review_T-E235A-01.md`, covers T-E235A-01..06). This round covers the two remaining qa-owned tasks: T-E235A-07 (author `test/e235a-relative-prd-path.test.mjs` for AC1-AC4, re-point the two owned DR-5 fixture files, confirm the owned suite + content/goldens diff) and T-E235A-08 (final zero-hit leak re-scan of the owned scope).
- New file: `test/e235a-relative-prd-path.test.mjs` (8 tests, AC1-AC4).
- Edited (DR-5/OQ-1 fixture re-point only — no assertion-intent change): `test/handoff-migration.test.mjs` (3 fixtures), `test/writestate-options-object.test.mjs` (2 fixtures).
- No other file touched by this hop.

## Expected-Red Diff
`qa_reports/expected-red_e235a-relative-prd-path.txt` declares 5 entries (3 in `test/handoff-migration.test.mjs`, 2 in `test/writestate-options-object.test.mjs` — all DR-5 out-of-workspace synthetic `prd_path` fixtures).

- **Baseline (pre-fixture-fix, code-reviewer Round 1, `review_reports/review_T-E235A-01.md`):** full suite showed 8 failures — the 5 manifest entries (confirmed real, DR-5-caused), 2 unlisted (`test/check-md-tables.test.mjs` — C1, spec table malformation, fixed in `9b0e292` and confirmed 49/49 in Round 2), and 1 pre-existing flake (`test/usage-accounting.test.mjs` "t-hook-noop-config-without-budget-key", confirmed non-attributable by code-reviewer). I independently re-ran that single flagged test 3x in isolation here — 35/35 green every time — consistent with "load-flake, not attributable to this diff."
- **This hop (T-E235A-07):** re-pointed all 5 manifest-listed fixtures to resolve inside their own test's temp workspace (`path.join(ws, "specs/...")`), per DR-5's prescribed fix — assertion intent unchanged (still pins "value preserved across migration/carry-forward/positional-vs-options byte-identity"), only the fixture's absolute value moved in-bounds.
- **Disposition:** all 5 manifest entries now GREEN (`test/handoff-migration.test.mjs` 17/17, `test/writestate-options-object.test.mjs` 9/9 — both run individually, see AC Execution Log). Full-suite re-run after the fix (see AC10 below): **0 failures, 0 unexplained reds** — diff is clean.

## Copy / Visual Audit Gates (3a/3b)
Spec's *Copy / Strings* and *Visual Tokens* tables are both `N/A` (storage-layer/protocol change, no user-facing copy or visual literals) — verified verbatim against `specs/e235a-relative-prd-path.md`. No drift, no coverage gap. `## Visual Widgets` is also `N/A`. Phase 1.5 (Visual Compare): skipped — no `design/e235a-relative-prd-path.md` file, no `## Visual Baselines` H2.

## Spec-to-Test Map (AC1-AC10)

| AC | Test(s) |
|---|---|
| AC1 | `test/e235a-relative-prd-path.test.mjs` — "AC1: write stores relative prd_path in frontmatter, not the raw absolute value" |
| AC2 | `test/e235a-relative-prd-path.test.mjs` — "AC2: read resolves relative prd_path to absolute (workspace_path + the stored value)" |
| AC3 | `test/e235a-relative-prd-path.test.mjs` — "AC3: a legacy in-bounds absolute prd_path parses unchanged, verbatim, with no forced rewrite" + `test/handoff-migration.test.mjs`'s existing legacy-absolute-passthrough coverage |
| AC4 | `test/e235a-relative-prd-path.test.mjs` — 5 cases under "AC4: resolved-path traversal guard — …" ('..' escape, workspace-root-itself, string-prefix sibling, direct-writer out-of-bounds drop, no-stderr-echo) |
| AC5 | `test/handoff-write-arg-guard.test.mjs` (unmodified, pre-existing — 14/14 green) |
| AC6 | `git diff main...HEAD -- docs/schema-versions.md` shows the "Representation note (e235a, no version bump)" paragraph |
| AC7 | zero-hit leak re-scan (T-E235A-08, below) + all 19 files parse + `prd_path` resolves in-bounds |
| AC8 | zero-hit adopter-name re-scan (T-E235A-08, below) |
| AC9 | `npm run build` clean + zero-hit re-scan of `dist/tools/handoff-orchestrator.js` |
| AC10 | full `npm test` — see AC Execution Log |

## AC Execution Log

- **AC1** — `node --test --test-name-pattern="write stores relative prd_path" test/e235a-relative-prd-path.test.mjs` → `# tests 1 / # pass 1 / # fail 0`. (Note: the spec's literal proof command uses `-t "..."`; on this Node v22.22.3 install `-t` is not recognized as the `--test-name-pattern` alias — `node --test --help` lists only the long form — so it silently runs the whole file unfiltered rather than erroring. I used the working long-form flag to get a scoped result; the unfiltered `-t` invocation was also run and is unconditionally green anyway, since the whole file passes 8/8 either way.)
- **AC2** — `node --test --test-name-pattern="read resolves relative prd_path to absolute" test/e235a-relative-prd-path.test.mjs` → `# tests 1 / # pass 1 / # fail 0`.
- **AC3** — `node --test test/handoff-migration.test.mjs` → `17/17 pass` (includes the re-pointed legacy-absolute fixtures); `test/e235a-relative-prd-path.test.mjs`'s own AC3 case passes (see full-file run below).
- **AC4** — `node --test --test-name-pattern="resolved-path traversal guard" test/e235a-relative-prd-path.test.mjs` → `# tests 5 / # pass 5 / # fail 0` (all 5 sub-cases).
- **AC5** — `node --test test/handoff-write-arg-guard.test.mjs` → `14/14 pass`, unmodified.
- **AC6** — `git diff main...HEAD -- docs/schema-versions.md` → shows the new "Representation note (e235a, no version bump)" paragraph under the handoff version-history table. Present, verbatim per DR-4.
- **AC7 / AC9** — see T-E235A-08 zero-hit re-scan below.
- **AC8** — see T-E235A-08 zero-hit re-scan below.
- **AC9 (build)** — `npm run build` → `tsc` clean, `check:version` OK, `check:transitions-sync` OK (21 keys, exact match). Exit 0.
- **AC10** — `npm test` (full suite, run from a clean tree after committing this hop's files — see below) → `# tests 2899 / # suites 1 / # pass 2896 / # fail 0 / # cancelled 0 / # skipped 3 / # todo 0`, exit code 0. The 3 skips are pre-existing and unrelated to this diff: `test/release-staging.test.mjs` zsh-availability-gated negative controls (2, this machine has no zsh) and one lane/worktree-invariant `t.skip()` in `test/e130-lane-default.test.mjs` or `test/e178a-integrator-role.test.mjs` (both guard on "not running in the primary checkout" — this QA hop runs inside the `e235a` lane worktree). None of the 3 skip-gated files are in this lane's owned or touched scope.
  - `git diff --stat main...HEAD -- content/ test/fixtures/compose-golden/ test/context-budget.test.mjs` → empty (confirmed, no output).
  - `node scripts/check-md-tables.mjs` → `OK (381 file(s) scanned, 0 malformed tables)`, exit 0 (the 4 advisories on `docs/backlog.md` are pre-existing, outside this lane's diff, per code-reviewer Round 2).

## T-E235A-08 — Zero-hit re-scan of owned scope

**Scope** (from `git diff --stat main...HEAD --name-only`, excluding `.current/e235a/handoff.md` per the integrator close-out carve-out): the 19 rewritten handoff/history files, `tools/handoff-orchestrator.ts` + `dist/tools/handoff-orchestrator.*`, `.current/history/2026-09/e180/tasks.md`, `.current/history/2026-09/e213/tasks.md`, plus every other lane-touched file (`tools/handoff-parse.ts`, `tools/handoff-write.ts`, `tools/handoff-types.ts`, `tools/registry.ts`, their `dist/` mirrors, `docs/schema-versions.md`, `specs/e235a-relative-prd-path*.md`, `qa_reports/expected-red_e235a-relative-prd-path.txt`, `review_reports/review_T-E235A-01.md`, `.current/e235a/tasks.md`, `.current/e235a/dispatch.jsonl`) — the full lane diff minus the one excluded file.

- **Class 1 — absolute local home-dir path / OS username** (derived via `whoami`): grep for a generic `/Users/` prefix pattern and the literal OS account name, case-insensitive, across the owned scope. Raw grep returned **2 hits**, both in `specs/e235a-relative-prd-path.md` (AC7/AC9 `proof:` lines) — both are the spec's own documentation of the grep command to run (a backticked `"/Users/"` pattern string describing the check, not an actual leaked path). Excluding that self-documenting line, the re-scan returns **zero hits**.
- **Class 2 — adopter project name** (learned from `git diff main...HEAD` of `tools/handoff-orchestrator.ts`, `.current/history/2026-09/e180/tasks.md`, `.current/history/2026-09/e213/tasks.md`, and the dist mirror — the E240 cleanup commit's removed literal): grep case-insensitively for both the full (hyphenated) form and the short (prefix+protocol) form across the owned scope. **Zero hits.**
- **Class 3 — personal config-dir name** (`.claude_<name>`-style): grep case-insensitively for the pattern across the owned scope. **Zero hits.**

No literal from any class is reproduced in this file, any commit message, or any other tracked file — findings are reported by class and count only, per the assignment's Information-hygiene instruction.

- **Parse + in-bounds check (all 19 files):** wrote a throwaway script (run from inside the worktree so `js-yaml` resolves via the `node_modules` symlink to primary; not committed) that YAML-parses each of the 18 `handoff.md` files' frontmatter and checks `prd_path` is a well-formed relative path (no leading `/`, no leading `..`). Result: **18/18 parse OK, all `prd_path` values relative-and-in-bounds-shaped** (`docs/backlog.md` for 13 of them, a `specs/*.md` value for the other 5 — matches DR-6's mapping exactly). The 19th file, `.current/history/2026-09/e125c/compaction-procedure.md`, is plain prose (no frontmatter) — its one rewritten line matches the DR-6-prescribed `` `<lanes-root>/e125c` `` class-description form verbatim. `e178b/handoff.md`'s two `external_refs.ref` values also match the DR-6-prescribed `<lanes-root>/…` class-description form. Per architecture DR-6's own reasoning, a relative value with no `..` segment resolves in-bounds under `isInsideWorkspace` for **any** workspace root — the "resolves inside its workspace" requirement holds by construction for all 18, independent of which lane/history directory the file lives under.
- **`npm run build` clean:** confirmed above (AC9).

## Security
- AC4's traversal bound (shared `isInsideWorkspace` helper) was probed directly against the string-prefix-sibling false-accept trap (`<ws>-sibling/...`) and the workspace-root-itself edge case (`rel === ""`) — both correctly rejected, at both the read-time resolve and the write-time relativize call sites (same shared predicate, one source, per DR-1/DR-2).
- The out-of-bounds stderr warning (write side) was captured and asserted to never contain the caller-supplied path — only the constant message string.

## Verdict
**PASS** — T-E235A-07 and T-E235A-08 complete. New test file (8/8), 2 re-pointed fixture files (17/17, 9/9), full owned-suite regression (229/229 individually; 2896/2899 in the full run, 0 failures, 3 pre-existing environment-gated skips unrelated to this diff), zero-hit leak re-scan across all 3 classes in the owned scope, all 19 rewritten files parse and resolve in-bounds, `content/**`/goldens/context-budget diff empty, build clean.
## 2026-09-28T07:29:14.559Z — PASS — by qa-engineer

QA PASS — T-E235A-01..08 complete. Code review APPROVED round 2 (review_reports/review_T-E235A-01.md, covers T-01..06; C1 spec-table fix in 9b0e292, check-md-tables 49/49). QA (T-07) authored test/e235a-relative-prd-path.test.mjs (8/8, AC1-AC4: write-relative, read-resolve, legacy-absolute passthrough, resolved-path traversal guard incl. '..'/equal-to-workspace/string-prefix-sibling/direct-writer-drop/no-stderr-echo) and re-pointed the 5 DR-5 out-of-workspace synthetic prd_path fixtures in test/handoff-migration.test.mjs + test/writestate-options-object.test.mjs to resolve inside their own temp workspace (assertion intent unchanged). QA (T-08) ran a zero-hit re-scan of the owned scope across all 3 leak classes (home-dir/username, adopter project name full+short form, personal .claude_<name> config-dir form) — zero real hits (2 initial grep hits were the spec's own proof-command documentation, not leaks); all 19 rewritten handoff/history files parse and their prd_path resolves in-bounds; npm run build clean. Full suite, clean tree, post-commit: 2899 tests, 2896 pass, 0 fail, 0 cancelled, 3 skipped (pre-existing, environment-gated — zsh-availability and primary-vs-lane-worktree invariants — unrelated to this diff), exit 0. git diff --stat main...HEAD -- content/ test/fixtures/compose-golden/ test/context-budget.test.mjs is empty. Full AC Execution Log, Phase 0.5 expected-red diff (now clean, all 5 manifest entries green), and T-08 re-scan detail in qa_reports/review_T-E235A-07.md.

## 2026-09-28T07:29:32.428Z — PASS — by qa-engineer

QA PASS — T-E235A-01..08 complete. Code review APPROVED round 2 (review_reports/review_T-E235A-01.md, covers T-01..06; C1 spec-table fix in 9b0e292, check-md-tables 49/49). QA (T-07) authored test/e235a-relative-prd-path.test.mjs (8/8, AC1-AC4: write-relative, read-resolve, legacy-absolute passthrough, resolved-path traversal guard incl. '..'/equal-to-workspace/string-prefix-sibling/direct-writer-drop/no-stderr-echo) and re-pointed the 5 DR-5 out-of-workspace synthetic prd_path fixtures in test/handoff-migration.test.mjs + test/writestate-options-object.test.mjs to resolve inside their own temp workspace (assertion intent unchanged). QA (T-08) ran a zero-hit re-scan of the owned scope across all 3 leak classes (home-dir/username, adopter project name full+short form, personal .claude_<name> config-dir form) — zero real hits (2 initial grep hits were the spec's own proof-command documentation, not leaks); all 19 rewritten handoff/history files parse and their prd_path resolves in-bounds; npm run build clean. Full suite, clean tree, post-commit: 2899 tests, 2896 pass, 0 fail, 0 cancelled, 3 skipped (pre-existing, environment-gated — zsh-availability and primary-vs-lane-worktree invariants — unrelated to this diff), exit 0. git diff --stat main...HEAD -- content/ test/fixtures/compose-golden/ test/context-budget.test.mjs is empty. Full AC Execution Log, Phase 0.5 expected-red diff (now clean, all 5 manifest entries green), and T-08 re-scan detail in qa_reports/review_T-E235A-07.md.


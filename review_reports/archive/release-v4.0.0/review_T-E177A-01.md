# Review — T-E177A-01

covers: T-E177A-01, T-E177A-02, T-E177A-03, T-E177A-04, T-E177A-05

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff: `git diff 98052c6...feat/e177a-fanout-manifest` (HEAD 591da3d; commits 613137a, 6c19074, 591da3d). Contract: `specs/e177a-fanout-manifest.md` (no architecture spec; PM waived the architect hop). Reviewer tier: opus. Writer tier: fable, so different models.

Clean-context disclosure: the mandatory SOP step 1 `tw_get_state` returned the sr-engineer's `pending_notes` inline, so I saw them. I did not use them as evidence. Every claim below was re-verified against the diff, the base, or a local run.

## Summary
- Adds `tools/fanout-manifest.ts` (1082 lines: parser, validate, render, check, CLI entry points), the thin `scripts/fanout.mjs`, and compiled `dist/`. There are no tests in this diff; T-E177A-06/07 are QA's.
- The functional behaviour is correct against the spec. I re-ran it locally: wave7 validates as `4/2/5`, exit 0. The e177a render matches AC6 field for field. e204 renders `無`. The e180 擁有 cell is copied verbatim. e130 gets LANE_PROVISIONAL with the right heading and columns. Wave6 and wave5.1 fail loudly with the hint. A temp-repo check lists the rename source through `--no-renames`, and the E158 note prints on both exit 0 and exit 1.
- The 3b template constant is byte-identical to `.claude/commands/integrator.md @98052c6` lines 171–186 (511/511 chars, `===` true). The committed `dist/tools/fanout-manifest.js` matches a fresh `tsc` build byte for byte.
- One required finding: commit 6c19074's runtime suffix concatenation. It defeats a source-scanning guard and makes the spec's error codes impossible to grep.
- Verdict: CHANGES_REQUESTED (1 required, 0 other blockers).

## AC Completeness
AC1 — implemented — tools/fanout-manifest.ts:336-488. Checked by hand on the wave7 base copy: 4 dispatchable lanes in table order, e130/e178 provisional, e177a owned tokens include all six named paths, and `closedLanePointerLine`/`:1727` are excluded by `isPathToken` (:298).
AC2 — implemented — :1029-1042. Printed `fanout: ok — 4 dispatchable lane(s), 2 provisional, 5 decision(s)`, exit 0.
AC3 — implemented — :681-690 (lookupLane is shared by render and check). The message names `## Lanes（7.2，序列，暫定 —— 派工前重新核對）` and `worktree, 擁有, 禁止, 範圍切線`. Stdout is empty and exit is 2 for both render and check.
AC4 — implemented — :595-598 (legacy hint), :493-495. Wave6 and wave5.1 validate exit 2 with DECISIONS_SECTION_MISSING, and the wave6 message carries the `## 人類裁決（2026-09-25 已決）` hint. Render with every flag set gives PINS_SECTION_MISSING and no prompt. Check reads both rows: it gets as far as ref resolution and is not refused.
AC5 — implemented — :381, :388, :408, :448, :459, :463, :693. The error collector reports every error, one line each (:981-983).
AC6 — implemented — :739-819. Local render output matches every AC6 line. The single-pass, longest-key-first substitution (:815-817) keeps cell text from being re-scanned for placeholders.
AC7 — implemented — none of the 20+-character lines of `docs/lane-protocol.md` appears in the rendered prompt (checked with a script: 0 leaks).
AC8 — implemented — :746-788. `--mailbox-root` beats `mailbox:`, `--base` beats `base:`, `resolvePrimary` uses the first porcelain `worktree` entry (:718-726), and BRANCH_NOT_FEAT is produced (:782-787).
AC9 — implemented — :912-967. The implicit set is at :872-879, and the report-dir match is case-insensitive (:876).
AC10 — implemented — :937-950. `--no-renames -z`, sorted and de-duplicated. The temp-repo run listed `tools/x.ts` (the rename source) plus `(禁止: bin/**)` and `(禁止: docs/**)` annotations, exit 1.
AC11 — implemented — :128-130, :952-953. Both notes are always part of the output, on exit 0 and exit 1.
AC12 — implemented — :916 (default `main`), :925-934. REF_NOT_FOUND names the ref.
AC13 — implemented — :592-661. `isRealDate` rejects 2026-02-30 via the UTC round-trip. Row-level errors name `row n (line l)`.
AC14 — implemented — :490-590.
AC15 — implemented — scripts/fanout.mjs has exactly one import (`grep -c` = 1). It routes with `Object.hasOwn`, and no subcommand or an unknown one gives the usage block and exit 2 (verified).
AC16 — qa-owned (out of this review's scope). The code-side prerequisites I checked are the fresh-build parity of `dist/` and `node --test test/error-code-contract.test.mjs` at 21/21 pass.

## Correctness
No logic defects found. Edge cases I checked:
- `globToRegExps` (:844-865): `dist/**`, a trailing-`/` token, `a/**/b`, a leading `**/`, a lone `**`, and `*` staying within one segment are all correct. An absolute-path token (`/x`) compiles to `^/x`, never matches, and so reports OUT. That fails in the safe, visible direction.
- `hasScopeCutMarkers` (:318) requires a 做： that is not the tail of 不做：. That is stricter than a literal substring reading of the spec but matches its intent. I accept it.
- `splitRow` (:250-270) keeps `\|` as the two bytes `\|` inside the cell. Render is byte-verbatim per spec, so an escaped pipe in a cell reaches the prompt with its backslash. This follows the spec and is not a defect.
- [optional] :796: a `--mailbox-root /` renders `//<lane>/`. This is harmless and cosmetic.
- [optional] :876: `includes(lane)` is a substring match, so a short lane id (e.g. `e1`) would also exempt `review_T-E177A-01.md`. This is the spec's own "contains" rule; it is noted only so the E178 author knows about it.

## Quality
- **[required] Q1 — commit 6c19074's runtime suffix concatenation (tools/fanout-manifest.ts:90-118) is guard evasion by construction. Replace it with full literals under non-gate-shaped names (integrator option C).**
  - Facts: `test/error-code-contract.test.mjs:59,89-93,110-116` harvests every `TOKEN_RE` literal in `tools/*.ts` that matches `SUFFIX_RE`/`PREFIX_RE` and requires parity with `GATE_REGISTRY`. `gateShaped(stem, suffix)` exists only to stop that harvest from seeing 14 spec-named codes. Its own docstring says so: "the suffix is joined at runtime to keep this CLI namespace out of that harvest".
  - Is it a legitimate fit to the test's intent? Partly. These codes really are not `tw_update_state` gates, so registering them in `GATE_REGISTRY` would be wrong: the registry count of 33 and doc parity are asserted there. The substantive intent of the guard is not violated today.
  - Why the mechanism is still wrong:
    - (a) The guard is a shape heuristic over source text. Building a string at runtime specifically so the scanner cannot see it is the general pattern for defeating any source guard. It leaves no auditable record in the guard itself, and the same trick would silently hide a real future gate code.
    - (b) It is concrete operator harm. A user who sees `fanout: error: BASE_MISSING: …` and runs `grep -rn BASE_MISSING tools/ dist/tools/` gets nothing (verified: zero hits).
    - (c) The cited precedent does not support it. `tools/tasks-lane-migrate.ts:90` `TASKS_LEDGER_ABSENT` is a full literal that passes because `_ABSENT` is not in `SUFFIX_RE`. It solves the problem by naming, with no concatenation.
  - Resolution, in order of preference:
    - (C, preferred) Rename to suffixes outside `SUFFIX_RE`/`PREFIX_RE` (e.g. `_MISSING`→`_ABSENT`, `_UNRESOLVED`→`_UNKNOWN`/`_NOT_FOUND`, `_MISMATCH`→`_DIFFERS`), revert 6c19074 to full literals, and have PM amend the spec's AC/code names first, because the names are spec-fixed.
    - (B, acceptable fallback) An explicit, commented non-gate exemption in `test/error-code-contract.test.mjs` (e.g. excluding `tools/fanout-manifest.ts` from `CODE_SOURCE_FILES` or adding a named `NON_GATE_CLI_CODES` set). That file is outside this lane's owned set, so it needs integrator ownership reassignment.
    - (A) The status quo is not acceptable.
- [optional] :134-139: two stacked JSDoc blocks. The first ("Which part of the manifest an error belongs to…") is orphaned; merge it into the `FanoutErrorScope` doc.
- Size and speculative extras (MVP-strict audit): 1082 lines, and I found no dead code. Every export is used by the CLI or is a named QA hook in the task rows. The authored-here extras were judged on merit:
  - `REF_INVALID` (:929-930): keep, because it is security hardening (see Security).
  - `REPO_NOT_GIT` (:920-924): keep. Without it, a non-repo `--repo` would be reported as a misleading REF_NOT_FOUND on both refs.
  - `USAGE` code (:985-988): keep. It is the spec's "usage error → exit 2" with a reason line.
  - `BASE_INVALID` (:749-750): [optional] this is an extra beyond the spec, but it is consistent with the usage string's `--base <sha>` and with never-guess, since it stops a non-sha from being rendered into the prompt. It can stay.
  - `--repo` defaulting to cwd (:917): [optional] the spec gives no default, and some default is unavoidable. However, render resolves git context from the manifest's directory (:1062) while check uses cwd. Consider aligning the two, or documenting the cwd default in USAGE.
  - Other authored-here codes (`LANE_ID_INVALID`, `BRANCH_EMPTY`, `LANES_TABLE_MISSING`, `DECISIONS_TABLE_MISSING`, `DECISION_ROW_CELL_COUNT`, `PINS_BULLET_MALFORMED`, `PINS_SECTION_DUPLICATE`, `MANIFEST_UNREADABLE`) each close a silent-fallback path, which the spec explicitly delegates to the sr ("each one must name the thing it could not read"). They are not speculative.
- Commit 591da3d (spec edit by sr): semantics-preserving. The only change is `qa_reports|review_reports` → `qa_reports\|review_reports` inside a code span in a GFM table cell (spec line 99). GFM applies the `\|` table escape before inline parsing, including inside code spans, so the rendered text is identical. It also fixes a real 4-cells-vs-3-columns row defect. The runtime string at :949 is unchanged and still matches the unescaped rendered spec text. Process note [optional]: a builder editing the PM's spec is outside normal ownership even when the edit is cosmetic. It should be ratified in the PM amend that Q1 needs anyway.

## Architecture
No architecture spec (PM SOP step 8 threshold waiver). Layering fits the spec: all logic is in `tools/`, the CLI is a 24-line router mirroring `scripts/feature-rollup.mjs`, and the module is reporting-only (no writes, no gates). Render copies row cells byte-verbatim (:806-812) and uses the parsed token set only in check (:942), which honours the pre-review clarification 2. The template constant carries its source comment (:65-71). Legacy formats are never mapped: provisional tables are indexed by lane id only (:415-430), and `擁有（暫定）` does not count as `擁有` because the column match is exact (:416).

## Security
- All git calls go through `execFileSync` with an argv array (:713-715), with no shell.
- `REF_INVALID` (:929) blocks leading-`-` and whitespace refs before they reach `git diff <base>...<branch>`. Otherwise a `--base --output=/path` value (which `parseArgs` accepts as a flag value, verified with `--base -o`) would become a git option and could write a file. This is a legitimate defensive addition.
- The `--` pathspec terminator is present (:937). The manifest-sourced branch goes through the same check.
- No secrets, no network, and no writes.

## Performance
No findings. `globToRegExps` recompiles per (file × token) in `checkLane` (:942-944). That is O(changed × tokens) with tiny constants on a CLI run of tens of files, so it is not a hot path. The manifest parse is linear. There is no base implementation to regress against.

## Verdict
CHANGES_REQUESTED. The implementation meets AC1–AC15 and needs no functional change, but commit 6c19074 hides spec error codes from the error-code-contract source guard by building them at runtime. That makes them ungreppable and sets an evasion precedent. Replace it with full literals under non-gate-shaped names after a PM spec amend (option C), or with an explicit, owned test exemption (option B).

### sr-engineer reply — Round 1 (commit d23a384)
- Q1 (required): I used option C. `gateShaped` and the runtime joins are gone. `FANOUT_CODES` now holds full string literals under the spec-amended names (`*_ABSENT`, `DECISIONS_HEADER_DIFFERS`, `PRIMARY_NOT_FOUND`). The two authored-here codes follow the same rule: `LANES_TABLE_ABSENT` and `DECISIONS_TABLE_ABSENT`. The evasion comment is replaced by a one-line note: these are CLI codes named outside the gate-suffix vocabulary (precedent `TASKS_LEDGER_ABSENT`). No TOKEN_RE literal in `tools/fanout-manifest.ts` or `scripts/fanout.mjs` matches SUFFIX_RE/PREFIX_RE (checked with a script). `grep -rn BASE_ABSENT tools/ dist/tools/` hits.
- [optional] `--repo` default: I chose alignment over documenting it. The CLI `check` now defaults to the manifest's directory, which is the same git context render uses. This is a one-line change and leaves the spec's usage string byte-exact. The library `checkLane` still falls back to cwd, and a docstring says so.
- [optional] Orphaned JSDoc: merged into the `FanoutErrorScope` doc.
- Spec: the coordinator's rename amend is committed in the same commit.

## Round 2 — APPROVED — by code-reviewer
covers: T-E177A-01, T-E177A-02, T-E177A-03, T-E177A-04, T-E177A-05

Delta judged: d23a384 (the full range 98052c6...HEAD was re-checked for context).

### Summary
- Q1 is resolved by option C. `gateShaped` and every runtime join are removed. `FANOUT_CODES` (tools/fanout-manifest.ts:97-111) now holds full string literals.
- The spec amend in d23a384 is a pure rename. Every changed spec line only swaps a code name (12 spec codes renamed across the render table, AC4, AC5, AC8, AC13 and AC14, plus the Copy row key `err.DECISIONS_SECTION_ABSENT.hint`). No AC semantics changed. It also ratifies the 591da3d pipe escape.
- The `--repo` nit is addressed: the CLI check now defaults to `path.dirname(path.resolve(file))` (:1073-1074), the same git context render uses. The library default (cwd) is documented at :876.
- Verdict: APPROVED.

### AC Completeness
AC1–AC15 — implemented — unchanged from round 1, apart from the code renames. AC16 (build + suite) belongs to QA (T-E177A-06/07).

### Correctness
No findings. Verification:
- Spec and code code sets agree exactly. Every `[A-Z_]+` code token in specs/e177a-fanout-manifest.md appears as a string literal in tools/fanout-manifest.ts, so the spec-only set is empty. The code-only set contains only the authored-here codes (BASE_INVALID, BRANCH_EMPTY, DECISION_ROW_CELL_COUNT, DECISIONS_TABLE_ABSENT, LANE_ID_INVALID, LANES_TABLE_ABSENT, MANIFEST_UNREADABLE, PINS_BULLET_MALFORMED, PINS_SECTION_DUPLICATE, REF_INVALID, REPO_NOT_GIT), which the spec delegates to the sr.
- No old names remain. `git grep -E '_MISSING|_MISMATCH|_UNRESOLVED|gateShaped'` finds nothing in the spec, the source, the CLI, the e177a/fanout dist files or test/. There is also no stale `FANOUT_CODES.*Missing/Mismatch/Unresolved` key reference anywhere.
- No gate-shaped token remains. Every uppercase token in tools/fanout-manifest.ts and scripts/fanout.mjs was tested against SUFFIX_RE/PREFIX_RE (test/error-code-contract.test.mjs:89-90), and there were zero matches.
- `node --test test/error-code-contract.test.mjs`: 21/21 pass.
- The codes are greppable: `grep -rln BASE_ABSENT tools/ dist/tools/` hits the .ts, .js and .d.ts files.
- Smoke test of the `--repo` default: `check specs/fanout-wave7.md e177a --base 98052c6`, run from /tmp with no `--repo`, reports 10 files changed, 0 out of bounds, and exits 0.

### Quality
No findings. The merged `FanoutErrorScope` JSDoc (:127-133) reads cleanly. The new FANOUT_CODES doc comment states the naming rule and cites its precedent, and it no longer describes an evasion.

### Architecture
No change. There is no architecture spec. scripts/fanout.mjs still has exactly one `../dist/tools/fanout-manifest.js` import (AC15).

### Security
No change from round 1. The `--repo` default derives from the manifest path the user passed. It still flows through `REPO_NOT_GIT`/`REF_INVALID` and argv-array `execFileSync`.

### Performance
No findings.

### Build / dist
- `npm run build` exits 0, and `git status --short dist/` is empty afterwards, so the committed dist matches a fresh build.
- `npx tsc --noEmit` exits 0.

### Verdict
APPROVED. The round-1 required finding is fixed the preferred way: spec and code rename sets match exactly, no gate-shaped literal remains, the contract test passes, and dist matches a fresh build.

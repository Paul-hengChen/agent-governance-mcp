# Review — T-E289-01 (e289-render-addendum)

covers: T-E289-01, T-E289-02, T-E337-01, T-E338-01, T-E339-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Reviewed `git diff 93ed15c...HEAD` (HEAD 9700c09) against `specs/e289-render-addendum.md`. No architecture spec exists (architect skipped per spec G9; design fixed by D1–D4).
- Substantive files: `tools/config.ts` (new optional `laneProtocolAddendum` field and non-fatal filter), `tools/fanout-manifest.ts` (template `EnterWorktree` line, two-layer lane-rules pointer, three exit-2 render errors, the `CONFIG_UNREADABLE` warning, the `installRoot` test seam, the E337 comment, the E338 backtick lookbehind), `tools/fanout-handoff.ts` (`-c core.quotePath=false` on the status fact, and `gitSubcommand`), `docs/config.md` (new section), plus the matching `dist/` files and lane bookkeeping under `.current/e289/`.
- Committed `dist/tools/{config,fanout-handoff,fanout-manifest}.{js,d.ts}` match a fresh `tsc` compile byte for byte. The `.map` files differ only because the out-dir differs.
- Scope is clean: `node scripts/fanout.mjs check specs/fanout-post-v4-w7.md e289` exits 0 (19 files, 0 out of bounds). sr changed no file under `test/**`, `scripts/fanout.mjs` or the protected `schema/*` / `docs/schema-versions.md` (`git diff --quiet 93ed15c...HEAD -- …` exit 0).
- Verdict: **APPROVED**. There are no required findings. Four optional notes follow. The two known reds come from goldens that qa still has to re-pin. They are not sr defects.

## AC Completeness
sr's share of each AC is implemented. The `proof:` tests are qa scope: the new test files `test/e289-*`, `test/e337-*`, `test/e338-*`, `test/e339-*` and the golden re-pin all belong to qa in the Cut table, so their absence is expected at this hop.

AC-E289-1 — implemented — `tools/config.ts:86` (field), `tools/config.ts:347-350`: only a non-empty string is surfaced, byte-for-byte as configured. A reviewer probe set the key to `1`, `[]`, `{}`, `null` and `""`. In every case render matched the key-unset prompt, which means the key was dropped.
AC-E289-2 — implemented — no schema files changed (`git diff --quiet` exit 0). `CURRENT_VERSIONS.config` is untouched.
AC-E289-3 — implemented — `docs/config.md:136-161`. The heading equals copy `docs.heading` and occurs once. The section covers: a relative path naming a tracked file; key unset means a single pointer; the relative or absolute generic path; all four codes; and no schema bump.
AC-E289-4 — implemented — `tools/fanout-manifest.ts:85`. It is the one added template line, directly after `先完整讀 …` and before `你只負責這張票…`. With the escaped backticks resolved it matches copy `template.enter-worktree` exactly.
AC-E289-5 — implemented (sr side) — a reviewer re-render of the E177a fixture with the key unset, diffed against the base golden, shows exactly `3a4 >` plus the copy line, with `<worktree>` = `/agm-lanes/e177a`. That is 1 line added and 0 removed. The golden re-pin itself is qa's work.
AC-E289-6 — implemented — the new line is a prompt instruction. e177a AC7 passes in the reviewer run.
AC-E289-7 — implemented — `tools/fanout-manifest.ts:1137-1181`, `1296-1301`. Reviewer probe (foreign install root): only line 3 differs from the key-unset render, and it reads `先完整讀 <abs install>/docs/lane-protocol.md（agc 通用規則，包括信箱與回報格式）和 docs/add.md（本 repo 的補充規則），再讀 R1 + R2。`, which matches copy `render.two-layer`.
AC-E289-8 — implemented — `realOrResolved` (`tools/fanout-manifest.ts:1099-1105`) wraps `fs.realpathSync` and falls back to `path.resolve`. Reviewer probe: with install root equal to primary, and also with install root a symlink to primary, the pointer is the relative `docs/lane-protocol.md`.
AC-E289-9 — implemented — `tools/fanout-manifest.ts:1141-1181`. `ADDENDUM_INVALID` fires for `/abs/x`, `~/x`, `~`, `.`, `./`, `a/..`, `../x`, `a/../../x`, `..\x` and `C:x`, and the message never echoes the value. `ADDENDUM_ABSENT` fires for a missing file and for a directory. `LANE_PROTOCOL_ABSENT` fires only when the key is set (probe: key unset with an empty install root renders ok). All three are collected into the shared `errors` list before the `errors.length > 0` return, and they arise only after primary is known. Broken JSON gives ok, stdout byte-identical to the key-unset render, and exactly one `WARN  CONFIG_UNREADABLE: …` line, which `runRender` (`:2119-2120`) sends to stderr with exit 0. A future `schema_version` takes the same path.
AC-E289-10 — implemented — the provenance comment above `PROMPT_TEMPLATE_3B` (`tools/fanout-manifest.ts:75-81`) is untouched and still holds `content/skill-integrator.md`, `the single canonical copy` and `E177a render golden`. e178a and e296 pass and are unmodified.
AC-E337-1 — implemented — `tools/fanout-manifest.ts:795`. The comment equals copy `comment.subitems` and no longer says "in order". No new `HANDOFF_*` code was added.
AC-E338-1 — implemented — `tools/fanout-manifest.ts:816` (`(?:(?<!\`)\*\*)?`). Reviewer probe: all four AC lines give 0 `HANDOFF_ABSOLUTE_PATH`.
AC-E338-2 — implemented — reviewer probe: a bold-prefixed absolute path at line start, a bold-prefixed absolute path after whitespace in a list item, a bold-prefixed absolute path directly after `=`, a bold-wrapped home-directory-shaped path after CJK text and whitespace, and a temp-directory-shaped absolute path inside a code span each give exactly 1 hit. Extra probes also behave as before: a bold-wrapped home-directory-shaped path at list-item start, a bold-prefixed temp-directory-shaped path inside parentheses, a bold-wrapped home-directory-shaped path after a code span, and a home-directory-shaped path after a code span holding only `**` each give 1; a glob-style `**` segment inside a relative path that runs into a home-directory-shaped tail gives 0. The comment at `:808-815` names the code-span remedy. (Round 2: probe literals described by class to keep this report clear of the hygiene scan.)
AC-E338-3 — implemented — e332 and e283 pass and are unmodified.
AC-E339-1 — implemented (code) — `tools/fanout-handoff.ts:297`. The status call now runs with `-c core.quotePath=false`, so a non-ASCII manifest path prints unescaped and matches `manifestRel` in the self-exclusion filter. Fixture proof is qa scope.
AC-E339-2 — implemented (code) — same line. Untracked non-ASCII names now print unquoted.
AC-E339-3 — implemented (verified by reading the code, as the AC asks) — `gitSubcommand` (`tools/fanout-handoff.ts:112-120`) skips `-c` together with its value. For `["-c","core.quotePath=false","--no-optional-locks","status","--porcelain"]` it returns `status`. For argument lists without `-c` it gives the same result as the old `find` plus the `args[0]` fallback.
AC-HC-1 — implemented — the reviewer's validate sweep over all 24 `specs/fanout-*.md` matches D5 line for line: all exit 0, except `fanout-wave5.1.md` and `fanout-wave6.md`, which exit 2 with `DECISIONS_SECTION_ABSENT PINS_SECTION_ABSENT`.
AC-HC-2 — implemented — fanout check exits 0.
AC-HC-3 — partial, expected — targeted run of 10 related suites: 167/169 pass. The two reds are `AC6 render e177a` (test/e177a-manifest.test.mjs) and `R3 AC2 golden` (test/e235b-relative-worktree.test.mjs). Both read the unchanged golden, which differs only by the one added line (verified above). Re-pinning that golden, and widening e235b's per-line exception to cover the `EnterWorktree` line (which carries the worktree path), is qa work in the lane's owned test set. This is not deferred implementation, so no expected-red manifest is required (step 4a does not arm).

## Correctness
No required findings.
- The pointer swap uses a plain string `replace` (`:1298`). The `<generic>`/`<addendum>` values go through the existing callback-form single pass, so `$` sequences or placeholder-like text in the configured value are never re-interpreted.
- `getConfigError` drives the shared loader itself (`tools/config.ts:379-381`), so calling it before `loadConfig` reads fresh state. A missing config file gives `error: null`, so plain fixtures such as primary `/p` render unchanged with no warning.
- When other sources are missing, the warning is dropped along with the prompt (exit 2). That is consistent with "no prompt printed".
- optional: `template.replace(LANE_PROTOCOL_POINTER, …)` (`:1298`) silently does nothing if the template's pointer wording ever drifts from the constant, and the addendum would then vanish from the prompt without an error. AC-E289-7's test will catch it. A one-line `PROMPT_TEMPLATE_3B.includes(LANE_PROTOCOL_POINTER)` assertion in a test, or a module-load guard, would make the coupling explicit.
- optional: by spec D2, when `render` runs from a lane worktree's own `dist/` (install root = worktree, realpath ≠ primary), the generic pointer is the absolute path into that worktree. That follows the spec, but integrators should run `render` from primary. Consider one sentence on this in `docs/config.md` in a later doc pass.

## Quality
No required findings. The naming (`LANE_PROTOCOL_POINTER[_TWO_LAYER]`, `GENERIC_LANE_PROTOCOL`, `DEFAULT_INSTALL_ROOT`, `resolveLanePointer`) and the `WARN  ` prefix match the surrounding `WORKTREE_ABSOLUTE_WARN` / `MAILBOX_ABSOLUTE_WARN` convention. Each error string matches its copy row once the `fail()` / `formatError` prefix is added.
- Comment check (Constitution §6, SOP step 4b): every added comment states WHAT and/or WHY. None contains a machine-local absolute path, and none relies on a bare ticket id as its only explanation. The header note (`:7-9`) correctly records that render now reads config, with its heal-on-read. Kept as written.
- optional: `docs/config.md:154` says a path that "normalizes to … a path that starts with `..`". The code and spec mean "whose first segment is `..`", so `..foo` is accepted as an ordinary file name (probe: it reaches `ADDENDUM_ABSENT`, not `ADDENDUM_INVALID`). Consider "whose first segment is `..`" in a later doc pass.

## Architecture
No architecture spec (G9). The design matches D1–D4. Config is read through `loadConfig`/`getConfigError` only once primary is known (D1). The install root is two directories above the compiled module, and the same-checkout test uses realpath with a `path.resolve` fallback (D2). `RenderOptions.installRoot` is a test-only seam the CLI never sets (D3). The addendum goes into the prompt exactly as configured (D4). The warning reaches stderr through an optional `warnings` field on the ok result, which AC-E289-9 explicitly leaves to sr. `config.ts` keeps its non-fatal filter convention, and render keeps its "absent source is an error" rule (G2).

## Security
No required findings.
- `ADDENDUM_INVALID` never echoes the value. `ADDENDUM_ABSENT` echoes it only after the lexical relative-path check passes, as the spec intends.
- Git is still invoked through `execFileSync` with an argv array, so no shell is involved. The added `-c core.quotePath=false` is a constant.
- optional: containment is lexical only. A tracked symlink inside the repo that points outside it would pass `isRegularFile` (`statSync` follows links). This is acceptable because D4 documents a tracked file and does not check it, and the value only names a file for a lane to read. Nothing is read or written by render. The echoed value in `ADDENDUM_ABSENT` could carry control characters from a hand-edited config. That only affects the operator's own stderr.

## Performance
No findings. The change adds two `stat` calls, two `realpath` calls and one mtime-cached config load per render invocation, which is a one-shot CLI. The regex change adds a constant-width lookbehind. The git call count is unchanged.

## Verdict
APPROVED — every sr-owned AC is implemented and was verified by probes and by the scope, dist and validate sweeps. The two red tests are qa's golden re-pin work, and the golden differs by exactly the one specified line.

## Round 2 — APPROVED — by code-reviewer

### Summary
- Trigger: QA round 1 FAIL on AC-HC-3 only. The e234 hygiene scan (AC16) flagged a `home-path` hit in this report's own AC-E338-2 evidence line, which quoted path-shaped probe literals.
- Fix: the AC-E338-2 line above now describes each probe by class. The probes, their counts and the verdict are unchanged. No other line in this report carries a home-directory-shaped literal.
- Product code is unchanged since round 1 (`git diff --quiet e048694 HEAD -- tools gates prompts schema index.ts dist bin lib content` exits 0).
- qa's a8f775c was checked only for anything that could change the verdict. The E177a golden gains exactly the one `EnterWorktree` line verified in round 1. The e235b per-line exception now covers the lines that carry the worktree path, and it still requires a byte-exact absolute-path substitution. Nothing there changes the verdict.

### Verdict
APPROVED — round 1's findings stand. The only change is a hygiene reword of reviewer evidence, with no source or test defect.

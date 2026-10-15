# Review — T-E296-01 (batched round)

covers: T-E296-01, T-E296-02, T-E296-03, T-E296-04

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Diff `c392cc3...9c49c14`: content edits in const-08, coord-03, skill-pm, skill-integrator, lane-protocol and docs/config (T-E296-01/02); `cutApprovalAutoTier.manifest` in tools/config.ts (T-E296-03); the optional `approval` Lanes column and `fanout check --cut` in tools/fanout-manifest.ts, plus a scripts/fanout.mjs comment edit (T-E296-04). The `dist/` diff covers exactly the 8 `config.*` / `fanout-manifest.*` files.
- Format compatibility holds. `validate` is byte-identical to base (stdout, stderr and exit) on all 20 manifests. `render` and `check` are byte-identical on 160 lane/mode/not-found combinations. The only differences are the 8 intended `LANE_PROVISIONAL` "8- or 9-column" lines. AC10 sha256s match.
- Build: zero errors, `tsc --noEmit` 0, `npm audit --audit-level=high` exit 0, md-tables OK. Full suite: 3110 pass / 15 fail, and all 15 are on the known qa-owned list (compose goldens x7, four budget ceilings, e5 defaults x2, e178a AC1 and AC9 integrator tier re-pins).
- Verdict: CHANGES_REQUESTED. Two fail-open holes in `check --cut`'s containment proof let a cut that names a forbidden file exit 0. That breaks the guarantee of Constitution §3.1 manifest-tier condition (3), and nothing else runs between that check and an auto-approval except the integrator's reading.

## AC Completeness
AC1 — implemented — content/const-08-chain-31-mid.md:4 (nested sub-bullet; both proofs print 1 / 2; growth 1214 chars)
AC2 — implemented — content/coord-03-core-fallback.md:45 (proofs 1 / 1)
AC3 — implemented — content/skill-pm.md:35, :111, :112 (proofs 1 / 1)
AC4 — implemented — docs/lane-protocol.md:86-87 (proofs 1 / 1 / 1)
AC5 — implemented — content/skill-integrator.md:81, :97 (proof 1)
AC6 — implemented — content/skill-integrator.md:166 (proofs 1 / 0 / 1; e295 pins green in the suite)
AC7 — implemented — tools/config.ts:31-33, :44, :266-267 (proof `true,false,false,false,false`; `{maxFiles:5}` still arms the threshold tier with `manifest:false`; `{}` top-level → undefined, unchanged)
AC8 — implemented — docs/config.md (proof 1)
AC9 — implemented — tools/fanout-manifest.ts `isDispatchableHeader`, `parseLanes` (sweep prints 2 = wave5.1 / wave6, both byte-identical to base)
AC10 — implemented — sha256 045b56ae…128a and 485eabe0…f863 reproduced. A 9-column manifest renders byte-identically to its 8-column twin (e296, e308)
AC11 — partial — the exit semantics, codes and output shape are all correct (see Correctness for the edge-case sweep), but the "every file the cut names is in bounds" proof fails open (findings C1, C2)
AC12 — implemented — usage 4th line (proof 1), wrapper comment, `runCheck` `--cut` first-arg dispatch; `check <m> --cut …` stays `USAGE: unknown flag --cut`
AC13 — qa-owned, not judged
AC14 — implemented — content/skill-integrator.md:2 `recommended_model: opus`; fallback clause count 0; no `fable` left in the file

## Correctness

Edge-case sweep (all match AC11 and the architecture): exact-token OUT with the `(禁止: …)` suffix → exit 1. Glob identical to an 擁有 token → in bounds. Non-identical glob → OUT. Glob equal to a 禁止 token → OUT with annotation. `—` touches → in bounds with 0 tokens. ASCII `-` or empty touches → `CUT_TOUCHES_EMPTY` exit 2. A bare path → `CUT_TOUCHES_UNQUOTED_PATH` exit 2 (on an all-bare cell `CUT_TOUCHES_EMPTY` is reported as well). Bookkeeping paths → in bounds. `./tools/config.ts` → OUT (fails closed). Other spec-format errors, all exit 2: 5-cell row or empty id → `CUT_ROW_MALFORMED`; no table, or a header with no data row → `CUT_TABLE_ABSENT`; a header that differs → `CUT_HEADER_DIFFERS`; only a `## Cut Decisions` section → `CUT_SECTION_ABSENT`; two `## Cut` sections → `CUT_SECTION_DUPLICATE`. A `## Cut ` heading with a trailing space is accepted. Unreadable files exit 2 (`SPEC_UNREADABLE`, `MANIFEST_UNREADABLE`), as do an unknown lane (`LANE_NOT_FOUND`) and wrong arity or an extra flag (usage). In 9-column manifests: `approval` `human` → `FAIL  APPROVAL_HUMAN` exit 1 (validate 0). `Human`, `` `human` `` or ASCII `-` → `APPROVAL_VALUE_UNKNOWN`: validate 2, `check --cut` 2 for that lane only (the other lane is unaffected). No 人類 row → `FAIL  DECISIONS_HUMAN_ROW_ABSENT` exit 1; both failures print in order. A Decisions-format error (bad date) → exit 2. A 9-column header with an 8-cell row → `ROW_CELL_COUNT` "expected 9". A 9th header cell `notes` → provisional. `check` (git) output on a 9-column manifest is byte-identical to the 8-column one. `runCheckCut` → `checkCut` performs only the two `fs.readFileSync` reads: no git, no writes.

- **C1 — required — tools/fanout-manifest.ts:1286 (`parseCutSection`).** A path-shaped backtick span that fails `isPathToken`'s charset (`PATH_TOKEN_RE`, :56) is dropped silently, and the remaining tokens decide the exit code. AC3(a) and the skill-pm Cut bullet define a path token as a span that "contains `/` or ends in an extension", so `tools/registry.ts:71` and `gates/registry.ts#L10` are path tokens by the contract's own rule. The implementation ignores them, and the ignored path is never checked.
  Failure scenario (reproduced): a lane-e296 cut row with touches `` `tools/config.ts`、`tools/registry.ts:71` `` gives `check --cut specs/fanout-post-v4-w3.md e296 <spec>` → `1 token(s), 0 out of bounds`, exit 0. Yet `tools/registry.ts` is under the row's `禁止` `tools/**` (lane e308 owns it). Under the manifest tier the coordinator auto-approves without a human, and only the integrator's reading stands in the way. The `file:line` habit is common in this repo (the w3 manifest itself writes `tools/registry.ts:71`), so this is a realistic PM slip, not only an adversarial one. The same thing happens with `gates/registry.ts#L10`. If the span is the row's only token, the result is `CUT_TOUCHES_EMPTY` (fails closed). The hole only opens when the span sits next to an in-bounds token.
  Fix (fail closed, `pathTokens` unchanged so 擁有 parsing does not move): in `parseCutSection`, any backtick span in `touches` that contains `/` or matches `/\.[A-Za-z0-9]+\b/` but is not `isPathToken` (and is not exactly `—`) → exit-2 row error. Use a new `CUT_TOUCHES_*` code, or reuse `CUT_TOUCHES_UNQUOTED_PATH` with a message telling the PM to write the bare repo path.
- **C2 — required — tools/fanout-manifest.ts:1309-1311 (`isCutTokenInBounds`).** Tokens with `..` (or `.`) segments are matched lexically. `isImplicitBookkeeping` checks only `startsWith(".current/<lane>/")`, and a `**` segment matches `[^/]+`, which includes `..`.
  Failure scenarios (reproduced, both exit 0, `0 out of bounds`): `` `.current/e296/../../index.ts` `` (index.ts is in the common forbidden list), and `` `test/fixtures/compose-golden/../../../tools/registry.ts` `` (matches the owned `test/fixtures/compose-golden/**`). `checkLane` never sees such paths because git normalises them, but `touches` is hand-typed, so `check --cut` must not infer containment from a non-normalised path ("never guess").
  Fix: in `parseCutSection` (or `isCutTokenInBounds`), a token with a `.` or `..` segment, a leading `/` or a backslash → exit-2 row error (preferred) or OUT. `./tools/config.ts` already fails closed as OUT. Keep it consistent with whichever choice is made.

## Quality
- **Q1 — recommended — content/coord-03-core-fallback.md:45.** The manifest-tier writer action reads as a sufficient condition ("when [config, `close`, PM line, exit 0] … set `cut_approved: true` WITHOUT halting"). Constitution §3.1 condition (5) is no-schema-change / non-design, and `check --cut` cannot see it. Neither those four triggers nor the halt list covers it. The paragraph's lead parenthetical does cite §3.1, and the threshold action's "meets EVERY threshold condition" plus "when in doubt, halt" still applies. So this matches AC2's literal list and is not a defect against the contract. A coordinator reading only this paragraph could still auto-approve a design-armed lane cut. Suggested fix: add 6–8 words, e.g. "and every other Constitution §3.1 manifest-tier condition holds". That cites the conditions without restating them.
- **Q2 — optional — tools/config.ts:266.** The comment "Absent or non-boolean leaves only the threshold tier armed" leaves out `false`. "Anything but `true`" is accurate.
- Comment check (4b): every added comment in tools/ and scripts/ states a constraint or a why. None carries an absolute path or a bare ticket id as its explanation. The parseCutSection known-limit note (fenced `## Cut`) is kept, because it documents a real limit the manifest parser shares.

## Architecture
- Matches `specs/e296-manifest-tier-cut-approval-architecture.md` in data structures, codes, check order (lookupLane → decisions errors → Cut parse), output lines, shared `ownedLine` / `implicitBookkeepingLine` helpers (checkLane output stays byte-identical), CLI dispatch and the content landing text.
- Deviation for AC1 (manifest tier as a nested sub-bullet, closing "Role-specific writer actions…" sentence moved to its end): **acceptable.** The architecture's "stays one line" could not meet AC1's line-counting proof, since the base bullet already had one `cutApprovalAutoTier` line. The sub-bullet stays inside the Auto-Tier bullet, so the preceding *Advisory, not server-enforced* sentence still frames it. The closing sentence names both writer actions and still closes the bullet. No compose transform is line-structure-sensitive (const-08 is included whole by tag; the strip passes work inline).
- Content against the ticket's eight conditions (backlog E296): all eight are present in const-08, and the mid-wave fresh-人類-row clause is included. The skills cite §3.1 and do not restate it. skill-pm's "last line before your watermark" keeps §1 intact. skill-pm's "you still present the cut and still halt" restricts the manifest tier to the coordinator writer under Task dispatch, which is narrower than §3.1's "may" and does not contradict the Cut-Approval trust rule. The E309 sentence is CI-first (push, then `--ci-check --sha <HEAD>`, local suite only under 5a). `cannot reach \`main\`` and the 5b-4 / 5b-5 text are untouched, and the e295 / e178a content pins pass (the e178a failures are the expected AC14 tier re-pins only).
- Scope: `fanout check specs/fanout-post-v4-w3.md e296 --base c392cc3` → 23 files, 0 out of bounds. `npm run build` on HEAD leaves `dist/` clean (committed dist = source build).

## Security
- C1 and C2 above are boundary-validation gaps on hand-typed input that feeds an approval decision. That makes them correctness findings with a governance-security impact: a false containment proof on a write that skips the human.
- No other findings: both inputs are CLI-provided file paths read with `readFileSync`; no shell, no git, no writes; no secrets.

## Performance
No findings. `check --cut` is a one-shot CLI: O(tokens × owned) matching over tens of items, one sort over a handful of Decisions dates. The parse-path change (`isDispatchableHeader`) is constant-time per table.

## Verdict
CHANGES_REQUESTED: `check --cut` exits 0 for cuts that name forbidden files through a dropped `file:line`-style span (C1) or a `..` path (C2), so its exit code does not yet prove §3.1 manifest-tier condition (3). Both fixes are fail-closed additions in `parseCutSection`; Q1 is recommended alongside.

### sr-engineer reply — Round 1

- **C1 — fixed.** `parseCutSection` now checks every backtick span in `touches`. A span that is path-shaped (it contains `/` or a backslash, or has an extension) but fails `isPathToken` is an exit-2 row error `CUT_TOUCHES_MALFORMED_PATH`, with the message "is not a bare repo path (no :line, #anchor, spaces or backslashes) — write the file path alone". `pathTokens` / `isPathToken` are unchanged, so 擁有 / 禁止 parsing is unaffected.
- **C2 — fixed (exit 2, consistent with C1).** A path-token span with a leading `/` or a `.` / `..` segment is `CUT_TOUCHES_MALFORMED_PATH` with the message "has a leading / or a . or .. segment — write the normalised repo-relative path". Backslashes are covered by the C1 branch, because `PATH_TOKEN_RE` excludes them. This runs at parse time, before any in-bounds test. `isImplicitBookkeeping` / `matchesGlob` are untouched, and `check <manifest> <lane>` is byte-identical to base for w3/e296, w3/e308 and w2/e295. Behaviour change: `./tools/config.ts` used to be OUT (exit 1) and is now exit 2.
- **Q1 — applied.** coord-03 manifest-tier writer action: "…exits 0 on that cut, and every other Constitution §3.1 manifest-tier condition holds, set…".
- **Q2 — applied.** tools/config.ts comment: "Anything but `true` leaves only the threshold tier armed."

## Round 2 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Round-2 diff `9038c00..44ef67f`: `malformedCutSpan` plus the `CUT_TOUCHES_MALFORMED_PATH` code in tools/fanout-manifest.ts (C1, C2), the coord-03 clause (Q1), the tools/config.ts comment (Q2), and rebuilt `dist/tools/{config,fanout-manifest}.*`. Every file is lane-owned, and `npm run build` leaves `dist/` clean.
- The C1 and C2 attacks from round 1 now exit 2, and so do most variants: `%2e%2e` spans, a `**/..` glob, `//..`, `./`, a unicode-slash span with an extension, backslashes, a `:line` span next to `—`, and a malformed span next to OUT tokens.
- No regression. `validate`, `render` and `check` on all 20 manifests (182 invocations) are byte-identical to the round-1 build. Against base they differ only in the 8 intended "8- or 9-column" lines. AC9–AC12 proofs pass, and the AC11 dogfood exits 0 once the known e297 token is removed.
- Verdict: CHANGES_REQUESTED, for one new fail-open case in the same class: a comma-joined span counts as one in-bounds path (C3).

## AC Completeness
AC1–AC10, AC12, AC14 — implemented — unchanged since round 1. Re-verified: AC9 sweep prints exactly wave5.1 / wave6 at exit 2. AC10 sha256 `045b56ae…128a` / `485eabe0…f863`. AC12 usage count 1, and `check <m> --cut x` still gives `USAGE: unknown flag --cut`.
AC11 — partial — the round-1 holes are closed (tools/fanout-manifest.ts:1288-1293, :1319-1328). The own-spec proof is exit 1 only because of the known `test/e297-main-protected-sop.test.mjs` manifest-version gap; without that token the dogfood exits 0 (5 tickets, 18 tokens, 0 out), and the oob proof prints `1` then exit 1. The guarantee that every file the cut names is in bounds still fails open for a comma-joined span (C3).
AC13 — qa-owned, not judged.

## Correctness
Round-2 variant sweep. Each variant was spliced into T-E296-04's touches next to the in-bounds `tools/fanout-manifest.ts` and run as `check --cut specs/fanout-post-v4-w3.md e296 <spec>`:
- exit 2 `CUT_TOUCHES_MALFORMED_PATH`: `tools/%2e%2e/index.ts`, `%2e%2e/index.ts`, `.current/e296/%2e%2e/%2e%2e/index.ts`, `.current/e296//../x`, `test/fixtures/compose-golden/**/../../../index.ts`, `./`, `tools∕registry.ts` (U+2215), `tools/a.ts\b.ts`, `— `+`tools/registry.ts:71`, and `index.ts`、`gates/registry.ts#L10`、`tools/registry.ts`. A parse error suppresses the OUT lines but still fails closed.
- exit 1 OUT (fails closed): trailing `/` (`tools/`, `test/fixtures/compose-golden/`, `tools/registry.ts/`, all globs under the byte-identical rule), `tools//registry.ts`, `test/fixtures/compose-golden//x.json`, `{tools,gates}/registry.ts`, `test/fixtures/compose-golden/{..,x}/a.ts`, `tools/Registry.ts`, `tools/.../x.ts`.
- in bounds, correctly: `.current/e296/.hidden`, `.current/e296/..x`.

- **C3 — required — tools/fanout-manifest.ts:1319-1328 (`malformedCutSpan`).** `PATH_TOKEN_RE` (:56) allows `,` so that `{a,b}` alternation works. Without a `{`, though, `isGlobToken` is false. A comma-joined list in one span is then matched as a single exact path, and the owned `**` glob or the implicit-bookkeeping prefix swallows the forbidden half.
  Failure scenario (reproduced, exit 0, `0 out of bounds`): touches `` `tools/fanout-manifest.ts`、`.current/e296/handoff.md,tools/registry.ts` `` (`tools/registry.ts` is under 禁止 `tools/**`, and lane e308 owns it). The same happens with `` `review_reports/review_T-E296-01.md,index.ts` `` (`index.ts` is common-forbidden) and with `` `test/fixtures/compose-golden/a.json,tools/registry.ts` ``. Every lane has the implicit `.current/<lane>/` prefix, so this hole exists for every lane, not just e296. Under the manifest tier, exit 0 is an auto-approval with no human in the loop. A comma list inside one span is an ordinary slip: the w3 manifest itself uses `{a,b}` comma syntax, and the space-separated form `a.ts, b.ts` is already caught as (a). So this is the C1 case again, "silently treated as something it is not".
  Fix (fail closed, `pathTokens` / `isPathToken` / `matchesGlob` unchanged): in `malformedCutSpan`'s path-token branch, also refuse a span that still has a `,` once its `{…}` groups are removed, e.g. `span.replace(/\{[^{}]*\}/g, "").includes(",")`, with a message like "lists more than one path — give each path its own backtick span". Brace alternation stays legal, and it is OUT unless byte-identical to an 擁有 token.

- **R1 — recommended (spec-level, does not block) — AC3(a) path-token rule.** A span with no `/` and no extension is prose by contract, so it is dropped. That includes extensionless root files (`Dockerfile`, which exists at the repo root, and `LICENSE`), `.` / `..`, and unicode lookalikes with no ASCII extension (`tools∕registry`, `tools／registry．ts`). All of these exit 0 next to an in-bounds token. The implementation follows the spec, and `check --cut` is pure by architecture (no repo listing), so this is not a defect in this diff. Suggest a follow-up ticket: either make `—`/prose-free `touches` cells strict (every span must be a path token or exactly `—`), or treat a bare `.` / `..` span as malformed.

## Quality
- Q1 and Q2 are resolved. The coord-03:45 clause "and every other Constitution §3.1 manifest-tier condition holds" cites §3.1 without restating it. The diff changes only that clause (about 60 characters), and the halt sentence is untouched. The config.ts:266 comment is now accurate.
- Comment check (4b): the two added comments (the `FANOUT_CODES` line at :131 and the `malformedCutSpan` JSDoc at :1311-1318) state the constraint and why. They carry no absolute paths and no bare ticket ids. Kept.
- No `any` in the added lines. The new code is placed after `parseCutSection` and follows the `cutErr` / `FANOUT_CODES` conventions.

## Architecture
The fix is a parse-time refusal inside `parseCutSection`. It leaves `isCutTokenInBounds`, `pathTokens`, `isPathToken`, `isImplicitBookkeeping` and `matchesGlob` byte-unchanged (the diff is additions only), so 擁有 / 禁止 parsing and `check <manifest> <lane>` do not move (byte-identical across 182 invocations vs the round-1 build). The new code `CUT_TOUCHES_MALFORMED_PATH` is a spec-side format error, so exit 2 fits AC11's exit-2 class. The behaviour change for `./tools/config.ts` (OUT/1 → 2) is the consistent choice and qa should pin it. Scope: all round-2 files are lane-owned; `dist/` is limited to `config.*` / `fanout-manifest.*`.

## Security
C3 is the remaining boundary-validation gap on hand-typed input that feeds an auto-approval decision. Its governance impact is the same as round-1 C1/C2. No other findings: no new I/O, no shell, no secrets. `npm audit --audit-level=high` exit 0.

## Performance
No findings. One extra pass over the backtick spans per Cut row, constant work per span.

Verification: `npm run build` 0 (dist clean afterwards), `tsc --noEmit` 0, `npm audit --audit-level=high` 0. Suite under test-lock: 3128 tests / 3110 pass / 15 fail / 3 skip. The 15 failures are exactly the known qa-owned list: compose-equivalence ×6 plus `test/skill-manifest.test.mjs:97`, the context-budget ceilings at :475/:554/:569/:894, e5-intake-tiering :67/:214, e178a :75, and e297 :101. No red outside that list.

## Verdict
CHANGES_REQUESTED: C1/C2 are fixed with no regression, but a comma-joined `touches` span such as `.current/e296/handoff.md,tools/registry.ts` still exits 0 for a cut that names a forbidden file (C3). The fix is a single fail-closed condition in `malformedCutSpan`.

### sr-engineer reply — Round 2

- **C3: fixed with a whitelist instead of one more blacklist entry.** `malformedCutSpan` (tools/fanout-manifest.ts) now accepts a `touches` span only in two cases:
  - (a) A plain repo path. `isPathToken` is true, the span matches `CUT_PLAIN_PATH_RE` (`^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$`: ASCII letters, digits, `_ - . /`, no empty segment, no leading or trailing `/`), and the existing check finds no `.` / `..` segment.
  - (b) A glob. `isGlobToken` is true. `isCutTokenInBounds` already accepts a glob only when it is byte-identical to an 擁有 token, so every other glob is OUT.
- Every other span exits 2 under `CUT_TOUCHES_MALFORMED_PATH`, with one message per reason:
  - "lists more than one path — give each path its own backtick span" (a `,` outside a glob).
  - "is not a plain repo path (letters, digits, _ - . and / only; no empty segment) — write the normalised repo-relative path".
  - The two round-1 messages, unchanged.
- Why this closes the class: a non-glob span that passes `isPathToken` can differ from the allow-set only by `,`, `}` or an empty segment, and all three are now refused.
- `pathTokens`, `isPathToken`, `isImplicitBookkeeping`, `matchesGlob` and `isGlobToken` are byte-unchanged.
- **Behaviour change for qa to pin.** `tools//config.ts` and `test/fixtures/compose-golden//x.json` were OUT (exit 1) and now exit 2. A span with a trailing `/` counts as a glob under `isGlobToken`, so it stays OUT (exit 1) unless it is byte-identical to an 擁有 token.
- **R1: not addressed, per the coordinator's ruling.** Filed as `E296-NEW-2` in `.current/e296/pending-tickets.md`.

Adversarial sweep. Each input was spliced into T-E296-04's touches next to `tools/fanout-manifest.ts` and run as `check --cut specs/fanout-post-v4-w3.md e296 <spec>`. The spec is a temp copy of the lane spec without the known e297 token, which leaves 17 tokens:

| input | exit | first stderr line / result |
|---|---|---|
| `.current/e296/handoff.md,tools/registry.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … lists more than one path — give each path its own backtick span |
| `review_reports/review_T-E296-01.md,index.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … lists more than one path — give each path its own backtick span |
| `test/fixtures/compose-golden/a.json,tools/registry.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … lists more than one path — give each path its own backtick span |
| `a.ts,b.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … lists more than one path — give each path its own backtick span |
| `tools/config.ts;index.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a bare repo path (no :line, #anchor, spaces or backslashes) — write the file path alone |
| `tools/config.ts index.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a bare repo path (no :line, #anchor, spaces or backslashes) — write the file path alone |
| `tools/{config}.ts` | 1 | OUT  `tools/{config}.ts`  (T-E296-04) (1 out of bounds) |
| `{tools/config.ts,index.ts}` | 1 | OUT  `{tools/config.ts,index.ts}`  (T-E296-04) (1 out of bounds) |
| `tools/[c]onfig.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a bare repo path (no :line, #anchor, spaces or backslashes) — write the file path alone |
| `tools/config.ts!` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a bare repo path (no :line, #anchor, spaces or backslashes) — write the file path alone |
| `tools/config.ts/` | 1 | OUT  `tools/config.ts/`  (T-E296-04) (1 out of bounds) |
| `tools//config.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a plain repo path (letters, digits, _ - . and / only; no empty segment) — write the normalised repo-relative path |
| `tools/./config.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … has a leading / or a . or .. segment — write the normalised repo-relative path |
| `.current/e296/../../index.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … has a leading / or a . or .. segment — write the normalised repo-relative path |
| `./tools/config.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … has a leading / or a . or .. segment — write the normalised repo-relative path |
| `/tools/config.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … has a leading / or a . or .. segment — write the normalised repo-relative path |
| `tools/registry.ts:71` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a bare repo path (no :line, #anchor, spaces or backslashes) — write the file path alone |
| `gates/registry.ts#L10` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a bare repo path (no :line, #anchor, spaces or backslashes) — write the file path alone |
| `tools\config.ts` (backslash) | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a bare repo path (no :line, #anchor, spaces or backslashes) — write the file path alone |
| `%2e%2e/index.ts` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a bare repo path (no :line, #anchor, spaces or backslashes) — write the file path alone |
| `tools／config.ts` (U+FF0F) | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a bare repo path (no :line, #anchor, spaces or backslashes) — write the file path alone |
| `test/fixtures/compose-golden/**` | 0 | 0 out of bounds |
| `test/fixtures/**` | 1 | OUT  `test/fixtures/**`  (T-E296-04) (1 out of bounds) |
| `test/e296-*.test.mjs` | 0 | 0 out of bounds |
| `tools/config.ts}` | 2 | `CUT_TOUCHES_MALFORMED_PATH` … is not a plain repo path (letters, digits, _ - . and / only; no empty segment) — write the normalised repo-relative path |
| `.current/e296/handoff.md` | 0 | 0 out of bounds |

`test/fixtures/compose-golden/**` and `test/e296-*.test.mjs` are byte-identical to 擁有 tokens in the row, so both are in bounds. The last row is a plain in-bounds control. No input exits 0 when it names a forbidden file.

Regression checks:
- The lane's own `## Cut` without the e297 token exits 0 (5 tickets, 18 tokens, 0 out). With the token it exits 1, which is the known manifest-version gap.
- AC9 prints wave5.1 and wave6 at exit 2.
- AC10 sha256 values are `045b56ae…128a` and `485eabe0…f863`.
- The AC11 out-of-bounds proof prints `1`, then exits 1.
- The AC12 count is `1`.
- Against the HEAD build (`a375368`), `check <manifest> <lane>` is byte-identical for w3/e296 (rc 0), w3/e308 (rc 0) and w2/e295 (rc 2 on both builds). `validate` is byte-identical on all 20 manifests.

Gates:
- `npm run build` exits 0, and the `dist/` diff is limited to `dist/tools/fanout-manifest.*`.
- `tsc --noEmit` exits 0.
- `npm audit --audit-level=high` exits 0.
- `check:md-tables` reports OK.
- Suite under test-lock: 3128 tests, 3110 pass, 15 fail, 3 skip. The 15 failures are exactly the known qa-owned list.

## Round 3 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Round-3 diff `a375368..HEAD` (`7086395`, `77250f3`): `CUT_PLAIN_PATH_RE` plus three new refusals in `malformedCutSpan` (tools/fanout-manifest.ts:1311-1342), rebuilt `dist/tools/fanout-manifest.*`, and lane bookkeeping (`.current/e296/**`, this file). Every file is lane-owned. `npm run build` exits 0 and leaves `dist/` clean. `npm audit --audit-level=high` exits 0.
- The C3 fix holds. Comma-joined, `;`-joined and space-joined spans all exit 2, and so do dot segments in every bookkeeping position. No backtick span I could construct names a file outside 擁有 and still exits 0, apart from the R1 class (`E296-NEW-2`), which is not re-raised.
- No regression. `validate`, `render` and `check` on all 20 manifests and 56 lanes are byte-identical to the `a375368` build (validate: 18 manifests exit 0, wave5.1 and wave6 exit 2). The AC11 and AC12 proofs pass. The suite reds are exactly the known qa-owned 15.
- The containment class is still not closed. A `touches` path written outside backticks, in any form other than a bare whitespace-separated word, is dropped silently (C4). A ticket row the parser does not count as part of the first table is also dropped (C5). Both reach exit 0 on a cut that names a 禁止 file.
- Verdict: CHANGES_REQUESTED. This FAIL takes `review_round` to the cap, so the next valid hop is `(pm, In_Progress)`.

## AC Completeness
AC1–AC10, AC12, AC14 — implemented — unchanged since round 2. Re-verified: the AC9 validate sweep, AC10 (render byte-identical vs `a375368` on all 56 lanes) and AC12 (usage count `1`).
AC11 — partial — the round-1 and round-2 holes inside backtick spans are closed (tools/fanout-manifest.ts:1328-1342). The own-spec proof is exit 1 only because of the known `test/e297-main-protected-sop.test.mjs` manifest-version gap (the single OUT line), and the oob proof prints `1` then exit 1. AC3(a) says every `touches` path is backtick-quoted and AC11 says an unquoted one is an exit-2 `CUT_TOUCHES_UNQUOTED_PATH`, yet most unquoted forms still pass (C4). "Takes its `## Cut` section … first table" also misreads which rows belong to the first table (C5).
AC13 — qa-owned, not judged.

## Correctness
Round-3 sweep. Each input was a one-row cut run as `node scripts/fanout.mjs check --cut specs/fanout-post-v4-w3.md e296 <spec>`; `tools/config.ts` is owned, and `tools/registry.ts` is under 禁止 `tools/**` and owned by lane e308.
- Whitelist, exit 2 `CUT_TOUCHES_MALFORMED_PATH`: comma-joined, `\|`-joined, `.current/e296/../../tools/registry.ts`, `.current/e296/x/..`, `.current/e296/.`, `qa_reports/../tools/e296.ts`, `specs/e296-x/../../tools/registry.ts`, `./tools/registry.ts`, `-tools/…`, `:tools/…`, backslash, tab, ZWSP, U+2024 one-dot leader, a fullwidth letter.
- Fails closed, exit 1 OUT: `tools/{config,registry}.ts`, `tools/{config}.ts`, `{tools/config.ts,tools/registry.ts}`, `tools/config.ts,tools/*` (a glob, so it must be byte-identical), `test/**`, `tools/*`, `tools/`, `.current/e296x/y.ts` (prefix trick), `specs/e296-a/b.md`, `Tools/config.ts`, `.CURRENT/e296/x` (case-sensitive both ways), `.github/workflows/ci.yml`, `.registry`, backticked `index.ts` / `README.md`.
- In bounds, correctly: `.current/e296/.../x` (a literal `...` directory inside the prefix), `qa_reports/foo/e296-x.md`, and the globs byte-identical to 擁有 tokens (`test/fixtures/compose-golden/**`, `specs/e296-*`, `qa_reports/*E296*`).
- Glob vs 禁止: a glob in bounds is always byte-identical to an 擁有 token. When an 擁有 token overlaps a 禁止 token, both `check` (tools/fanout-manifest.ts:1122) and `check --cut` (:1376-1379) let 擁有 win and use 禁止 only to annotate OUT lines. The two are consistent with each other and with AC11, so this is not a finding.
- Size: a 200 KB span and a 20 000-segment span both finish immediately. `CUT_PLAIN_PATH_RE` has disjoint alternatives, so it cannot backtrack.
- Empty `touches` gives `CUT_TOUCHES_EMPTY` exit 2. `—` gives 0 tokens and exit 0. `–` (en dash) or prose-only gives `CUT_TOUCHES_EMPTY` exit 2. `— `+`tools/registry.ts` is OUT.

- **C4 — required — tools/fanout-manifest.ts:1284-1287 (`parseCutSection`'s unquoted-path loop, which reuses `unquotedPaths` at :351-357).** `unquotedPaths` splits the non-backtick text on `UNQUOTED_SPLIT_RE` (:58) and counts a word only when the whole word matches `UNQUOTED_PATH_RE` (:57). Any surrounding punctuation or markup, or a `:line` suffix, takes the word out of that class, so the path is dropped silently. When the cell also has one in-bounds backtick token, `toks` is non-empty and `CUT_TOUCHES_EMPTY` does not fire either.
  Failing inputs (reproduced, each exit 0 with `1 ticket(s), 1 token(s), 0 out of bounds`; the touches cell is `` `tools/config.ts` `` followed by):
  - `tools/registry.ts:12`
  - `'tools/registry.ts'` or `"tools/registry.ts"`
  - `*tools/registry.ts*` or `**tools/registry.ts**`
  - `<code>tools/registry.ts</code>` or `<kbd>tools/registry.ts</kbd>`
  - `[tools/registry.ts](x)`
  - `「tools/registry.ts」`
  - `tools/registry.ts。`
  - `~tools/registry.ts~`
  - `index.ts` (common-forbidden, bare, with an extension and no slash)
  - `tools／registry.ts` (U+FF0F)

  By contrast, `tools/registry.ts.` and `and tools/registry.ts` are caught. This is the C1 class again: C1 blocked the backticked `tools/registry.ts:71`, and the same text without backticks still auto-approves. `file:line` and `*emphasis*` are ordinary ways for a PM to write a path, and under the manifest tier exit 0 means no human sees the cut.
  Fix (fail closed; `unquotedPaths` and `pathTokens` unchanged, so 擁有 parsing does not move): for `touches` only, after stripping backtick spans, report `CUT_TOUCHES_UNQUOTED_PATH` (an existing code, so `test/error-code-contract.test.mjs` is not touched) for any remaining text that contains `/`, a backslash, `／`, or `/\.[A-Za-z0-9]+\b/`. A `touches` cell is a list column. A cut whose only prose is `—`, `、`, `,` or parentheses keeps passing, and a cut with prose such as `v4.5.0` fails closed with a clear message. The R1 strictness suggestion (`E296-NEW-2`) is the bounded version of the same rule. If the sr-engineer folds it in here, that ticket can close.

- **C5 — required — tools/fanout-manifest.ts:1248 and :282-289 (`parseCutSection` → `firstTable`).** The `## Cut` table is taken to be the first run of lines that start with `|`. Every other line in the section is ignored without notice, including lines that GitHub-flavoured Markdown renders as rows of that same table. The integrator pre-reviews the rendered cut, and the coordinator's writer action checks only the exit code.
  Failing inputs (reproduced, each exit 0 with `1 ticket(s) … 0 out of bounds`): a valid header plus `| T-X-01 | … | `tools/config.ts` | — |`, followed by a second row `T-X-02 | x | none | 1 | `tools/registry.ts` | — |` written as:
  - with one leading space (GFM: the same table)
  - without the leading `|` (GFM: the same table)
  - as a `> ` blockquote line
  - after a blank line
  - in a second table after a prose line or under a `### Extra` sub-heading

  AC3(a) says `## Cut` holds the one inline cut table with one row per ticket, so a second ticket table is already outside the format. Ignoring it is fail-open; refusing it is not.
  Fix (fail closed, `firstTable` unchanged because the manifest parser shares it): in `parseCutSection`, after `firstTable(s)`, report a row error under an existing code such as `CUT_ROW_MALFORMED` when either (a) the section line right after the table run is non-empty (GFM would continue the table), or (b) any later line in the section contains an unescaped `|` outside backtick spans.

- **R2 — optional — case-insensitive filesystems.** On macOS, a `touches` token can differ only in case from an unowned tracked file and still match an 擁有 glob through a `*` (for example 擁有 `tools/A*.ts`, touches `tools/Afoo.ts`, tracked file `tools/afoo.ts`). `check --cut` is pure by architecture, and the post-commit `check` would show the real path as OUT, so I am only noting it.

## Quality
- Round-3 code is minimal and well placed. `CUT_PLAIN_PATH_RE` is declared next to its only user. The new refusals run after the dot-segment check, so their messages stay specific. The helpers `pathTokens`, `isPathToken`, `isGlobToken`, `matchesGlob` and `isImplicitBookkeeping` are byte-unchanged (the TS diff touches only :1311-1342).
- Comment discipline (4b): the `CUT_PLAIN_PATH_RE` JSDoc and the reworded `malformedCutSpan` JSDoc explain why (a comma outside braces, a `:line` suffix or a dot segment would otherwise match an owned glob lexically). They name no ticket or reviewer and nothing sensitive. Kept.
- No `any` in the diff.

## Architecture
Fits specs/e296-manifest-tier-cut-approval-architecture.md: pure function, no git, no fs beyond the two CLI reads. Both C4 and C5 fixes stay inside `parseCutSection` and leave the shared manifest helpers alone.

## Security
`check --cut` exit 0 is the mechanical proof of condition (3) for an auto-approval with no human in the loop, so a fail-open here is a safety defect, not cosmetic (C4, C5). No injection surface: spec text is only regex-matched and echoed. No secrets.

## Performance
No regression. One regex test per span. The adversarial 200 KB and 20 000-segment spans return instantly.

## Verdict
CHANGES_REQUESTED. Backtick spans are closed, but unquoted `touches` paths (C4) and ticket rows outside the parsed table run (C5) still let a cut that names a 禁止 file (`tools/registry.ts`, `index.ts`) exit 0. Each fix is a few lines in `parseCutSection` and reuses an existing code. This FAIL hits the `review_round` cap, so routing goes to pm.

## Round 3 — sr reply

T-E296-06 (spec AC15), human-approved re-cut. The fix replaces the round-1 to round-3 hole patching with two whitelists in `parseCutSection`. Whatever they do not name is exit 2. Nothing is skipped.

- **C5 (section grammar), fixed.** `parseCutSection` scans the section's own lines. The table is the first run of lines that start with `|` (`cutTableLines`). Every other non-blank line in the section is one `CUT_ROW_MALFORMED` naming its line number (`cutSectionGrammarErrors`). That covers prose before or after the table, a `###` heading, a `>` blockquote, a row with a leading space or without the leading `|`, a row after a blank line, and every line of a second table. The line after the header must be a 6-cell GFM separator row, or the result is `CUT_ROW_MALFORMED`. A second separator row inside the run is `CUT_ROW_MALFORMED` too. `firstTable` and `splitSections` are not changed or called differently. The manifest parser still uses `firstTable`.
- **C4 (cell grammar), fixed.** A `touches` cell is exactly `—`, or backtick spans joined only by `、`, `,` and whitespace. `cutTouchesLeftover` removes the spans and those separators. If any character remains, the cell gets one `CUT_TOUCHES_UNQUOTED_PATH`, and the message quotes the leftover text and states the allowed form. The old `unquotedPaths` word filter is no longer called from `parseCutSection`. `unquotedPaths` itself is unchanged and still serves `擁有`.
- **R1 (bounded part), fixed.** `malformedCutSpan` now refuses every span that fails `isPathToken` with `CUT_TOUCHES_MALFORMED_PATH`, instead of treating it as prose. Examples: `Dockerfile`, `LICENSE`, `.`, `..`, unicode lookalikes. The round-2 per-span whitelist (`CUT_PLAIN_PATH_RE`, no `.`/`..` segment or leading `/`, comma outside braces, a glob only byte-identical to an `擁有` token) is unchanged. An empty cell is still `CUT_TOUCHES_EMPTY`.
- **Scope.** The TS diff is limited to the `parseCutSection` body and JSDoc, the `malformedCutSpan` prose branch and JSDoc, and three new private, cut-only helpers that only `parseCutSection` calls: `cutTableLines`, `cutSectionGrammarErrors` and `cutTouchesLeftover`. None is exported. The `.d.ts` change is the `parseCutSection` JSDoc only. No new `FANOUT_CODES`. `firstTable`, `pathTokens`, `isPathToken`, `unquotedPaths`, `matchesGlob`, `isImplicitBookkeeping`, `isGlobToken`, `splitSections`, `splitRow`, `tableRows`, `backtickSpans` and `isSeparatorRow` are byte-identical to `59de2ab` (each function body extracted and hashed). `content/skill-pm.md` is untouched.
- **Byte identity.** The `validate` / `render` / `check <manifest> <lane>` sweep covers 20 manifests, 60 lanes and 140 outputs (stdout, stderr and exit code). I captured it from the pre-change build, which is equal to `59de2ab` (`git diff 59de2ab HEAD -- dist tools scripts` is empty), and compared it with `cmp` after the change: identical.
- **Behaviour changes that qa needs to pin** (all still exit 2, only the codes printed differ):
  1. A non-`—` prose-only touches cell (`-`, `–`, `see desc`) now prints `CUT_TOUCHES_UNQUOTED_PATH` followed by `CUT_TOUCHES_EMPTY`. Before, it printed `CUT_TOUCHES_EMPTY` alone.
  2. An unquoted cell gets one `UNQUOTED` error per cell, not one per word.
  3. A non-path backtick span is `CUT_TOUCHES_MALFORMED_PATH`. Before, it was ignored.
  4. A section with prose and no table prints `CUT_ROW_MALFORMED` (one per line) followed by `CUT_TABLE_ABSENT`.
  5. A header with no separator row is `CUT_ROW_MALFORMED`. Before, the first data row was read as a ticket.
  6. Section-grammar errors are listed before `CUT_HEADER_DIFFERS`.

  The earlier changes `./tools/config.ts` and `tools//config.ts` → exit 2 stand.

### AC15 enumerated inputs

Each input is a one-row cut, run as `node scripts/fanout.mjs check --cut specs/fanout-post-v4-w3.md e296 <spec>`. "after X" means the touches cell is `` `tools/config.ts` `` followed by a space and X. In the R1 rows, the span is joined with `、`. In the C5 rows, row 2 is `` T-X-02 | x | none | 1 | `tools/registry.ts` | — | ``. "error lines" is the number of stderr lines on exit 2.

| input | exit | error lines | first stderr line (exit 2) / OUT + summary line (exit 0/1) |
|---|---|---|---|
| `C4 after tools/registry.ts:12` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("tools/registry.ts:12") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after 'tools/registry.ts'` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("'tools/registry.ts'") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after "tools/registry.ts"` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans (""tools/registry.ts"") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after *tools/registry.ts*` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("*tools/registry.ts*") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after **tools/registry.ts**` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("**tools/registry.ts**") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after <code>tools/registry.ts</code>` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("<code>tools/registry.ts</code>") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after <kbd>tools/registry.ts</kbd>` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("<kbd>tools/registry.ts</kbd>") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after [tools/registry.ts](x)` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("[tools/registry.ts](x)") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after 「tools/registry.ts」` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("「tools/registry.ts」") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after tools/registry.ts。` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("tools/registry.ts。") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after ~tools/registry.ts~` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("~tools/registry.ts~") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after index.ts` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("index.ts") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after tools／registry.ts` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("tools／registry.ts") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after tools/registry.ts.` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("tools/registry.ts.") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 after and tools/registry.ts` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("and tools/registry.ts") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C4 cell — + backtick path` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("—") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `C5 row2 leading space` | 2 | 1 | `` fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 8: only blank lines and one table (header, separator row, ticket rows, each starting with \|) are allowed — found "\| T-X-02 \| x \| none \| 1 \| `tools/registry.ts` \| — \|" `` |
| `C5 row2 no leading \|` | 2 | 1 | `` fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 8: only blank lines and one table (header, separator row, ticket rows, each starting with \|) are allowed — found "T-X-02 \| x \| none \| 1 \| `tools/registry.ts` \| — \|" `` |
| `C5 row2 > blockquote` | 2 | 1 | `` fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 8: only blank lines and one table (header, separator row, ticket rows, each starting with \|) are allowed — found "> \| T-X-02 \| x \| none \| 1 \| `tools/registry.ts` \| — \|" `` |
| `C5 row2 after blank line` | 2 | 1 | `` fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 9: only blank lines and one table (header, separator row, ticket rows, each starting with \|) are allowed — found "\| T-X-02 \| x \| none \| 1 \| `tools/registry.ts` \| — \|" `` |
| `C5 second table after prose` | 2 | 4 | `fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 9: only blank lines and one table (header, separator row, ticket rows, each starting with \|) are allowed — found "More tickets:"` |
| `C5 second table under ### Extra` | 2 | 4 | `fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 9: only blank lines and one table (header, separator row, ticket rows, each starting with \|) are allowed — found "### Extra"` |
| `C5 prose after valid table` | 2 | 1 | `fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 9: only blank lines and one table (header, separator row, ticket rows, each starting with \|) are allowed — found "Notes: none."` |
| `C5 prose before valid table` | 2 | 1 | `fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 5: only blank lines and one table (header, separator row, ticket rows, each starting with \|) are allowed — found "Intro prose."` |
| `C5 missing separator row` | 2 | 1 | `fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 6: expected the separator row (6 cells of ---) right after the header` |
| `C5 separator 5 cells` | 2 | 1 | `fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 6: expected the separator row (6 cells of ---) right after the header` |
| `C5 header only + separator` | 2 | 1 | `fanout: error: CUT_TABLE_ABSENT: section "## Cut" (line 3) has a header but no ticket row` |
| `` R1 span `Dockerfile` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "Dockerfile" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R1 span `LICENSE` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "LICENSE" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R1 span `.` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "." is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R1 span `..` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span ".." is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R1 span `tools∕registry` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools∕registry" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R1 span `tools／registry．ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools／registry．ts" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `ctl — alone` | 0 | — | `fanout check --cut: e296 — 1 ticket(s), 0 token(s), 0 out of bounds` |
| `ctl 、-joined pair` | 0 | — | `fanout check --cut: e296 — 1 ticket(s), 2 token(s), 0 out of bounds` |
| `ctl ,-joined pair` | 0 | — | `fanout check --cut: e296 — 1 ticket(s), 2 token(s), 0 out of bounds` |
| `ctl space-joined pair` | 0 | — | `fanout check --cut: e296 — 1 ticket(s), 2 token(s), 0 out of bounds` |
| `ctl owned glob compose-golden/**` | 0 | — | `fanout check --cut: e296 — 1 ticket(s), 1 token(s), 0 out of bounds` |
| `ctl two valid rows + trailing blank lines` | 0 | — | `fanout check --cut: e296 — 2 ticket(s), 2 token(s), 0 out of bounds` |
| `edge empty touches` | 2 | 1 | `fanout: error: CUT_TOUCHES_EMPTY: Cut row T-X-01 (line 7): touches names no backtick-quoted path — list the paths, or write — for a bookkeeping-only ticket` |
| `edge en dash –` | 2 | 2 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("–") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `edge prose-only touches` | 2 | 2 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("see desc") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `edge unbalanced backtick` | 2 | 1 | `` fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("`tools/registry.ts") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces `` |
| `edge full-width comma join` | 2 | 1 | `fanout: error: CUT_TOUCHES_UNQUOTED_PATH: Cut row T-X-01 (line 7): touches has text outside backtick spans ("，") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces` |
| `edge prose-only section` | 2 | 2 | `fanout: error: CUT_ROW_MALFORMED: section "## Cut" line 5: only blank lines and one table (header, separator row, ticket rows, each starting with \|) are allowed — found "Nothing to cut."` |
| `edge oob backtick (AC11)` | 1 | — | `` OUT  `tools/registry.ts`  (T-X-01)  (禁止: tools/**) fanout check --cut: e296 — 1 ticket(s), 1 token(s), 1 out of bounds `` |

Own-spec controls:
- `check --cut … specs/e296-manifest-tier-cut-approval.md` prints one OUT line, `` OUT  `test/e297-main-protected-sop.test.mjs`  (T-E296-05)  (禁止: test/**) ``, then `6 ticket(s), 21 token(s), 1 out of bounds`, exit 1. This is the known manifest-version gap, with no exit-2 error.
- A temp copy with that one touches token removed prints `6 ticket(s), 20 token(s), 0 out of bounds`, exit 0.

### Round 1 / 2 / 3 attack inputs (regression)

Each one still matches its round-3 result. Every row before the OUT rows exits 2 with `CUT_TOUCHES_MALFORMED_PATH`, every OUT row exits 1, and every IN row exits 0. The touches cell is `` `tools/config.ts`、`<span>` ``, except the first R2-C3 row, which is led by `` `tools/fanout-manifest.ts` ``.

| input | exit | error lines | first stderr line (exit 2) / OUT + summary line (exit 0/1) |
|---|---|---|---|
| `` R1-C1 `tools/registry.ts:71` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools/registry.ts:71" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R1-C1 `gates/registry.ts#L10` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "gates/registry.ts#L10" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R1-C2 `.current/e296/../../index.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span ".current/e296/../../index.ts" has a leading / or a . or .. segment — write the normalised repo-relative path` |
| `` R1-C2 `test/fixtures/compose-golden/../../../tools/registry.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "test/fixtures/compose-golden/../../../tools/registry.ts" has a leading / or a . or .. segment — write the normalised repo-relative path` |
| `` R2-C3 `.current/e296/handoff.md,tools/registry.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span ".current/e296/handoff.md,tools/registry.ts" lists more than one path — give each path its own backtick span` |
| `` R2-C3 `review_reports/review_T-E296-01.md,index.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "review_reports/review_T-E296-01.md,index.ts" lists more than one path — give each path its own backtick span` |
| `` R2-C3 `test/fixtures/compose-golden/a.json,tools/registry.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "test/fixtures/compose-golden/a.json,tools/registry.ts" lists more than one path — give each path its own backtick span` |
| `` R3 `a.ts;tools/registry.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools/config.ts;tools/registry.ts" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R3 `tools/config.ts tools/registry.ts` (space in span) `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools/config.ts tools/registry.ts" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R3 `\\|`-joined span `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools/config.ts\\|tools/registry.ts" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R3 `.current/e296/x/..` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span ".current/e296/x/.." has a leading / or a . or .. segment — write the normalised repo-relative path` |
| `` R3 `.current/e296/.` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span ".current/e296/." has a leading / or a . or .. segment — write the normalised repo-relative path` |
| `` R3 `qa_reports/../tools/e296.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "qa_reports/../tools/e296.ts" has a leading / or a . or .. segment — write the normalised repo-relative path` |
| `` R3 `specs/e296-x/../../tools/registry.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "specs/e296-x/../../tools/registry.ts" has a leading / or a . or .. segment — write the normalised repo-relative path` |
| `` R3 `./tools/registry.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "./tools/registry.ts" has a leading / or a . or .. segment — write the normalised repo-relative path` |
| `` R3 `./tools/config.ts` (known change) `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "./tools/config.ts" has a leading / or a . or .. segment — write the normalised repo-relative path` |
| `` R3 `tools//config.ts` (known change) `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools//config.ts" is not a plain repo path (letters, digits, _ - . and / only; no empty segment) — write the normalised repo-relative path` |
| `` R3 `-tools/registry.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "-tools/registry.ts" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R3 `:tools/registry.ts` `` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span ":tools/registry.ts" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `R3 backslash` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools\registry.ts" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `R3 tab in span` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools/reg` |
| `R3 ZWSP in span` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools/​registry.ts" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `R3 U+2024 one-dot leader` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools/registry․ts" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `R3 fullwidth letter` | 2 | 1 | `fanout: error: CUT_TOUCHES_MALFORMED_PATH: Cut row T-X-01 (line 7): touches span "tools/ｒegistry.ts" is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc` |
| `` R3 OUT `tools/{config,registry}.ts` `` | 1 | — | `` OUT  `tools/{config,registry}.ts`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `tools/{config}.ts` `` | 1 | — | `` OUT  `tools/{config}.ts`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `{tools/config.ts,tools/registry.ts}` `` | 1 | — | `` OUT  `{tools/config.ts,tools/registry.ts}`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `tools/config.ts,tools/*` `` | 1 | — | `` OUT  `tools/config.ts,tools/*`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `test/**` `` | 1 | — | `` OUT  `test/**`  (T-X-01)  (禁止: test/**) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `tools/*` `` | 1 | — | `` OUT  `tools/*`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `tools/` `` | 1 | — | `` OUT  `tools/`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `.current/e296x/y.ts` `` | 1 | — | `` OUT  `.current/e296x/y.ts`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `specs/e296-a/b.md` `` | 1 | — | `` OUT  `specs/e296-a/b.md`  (T-X-01)  (禁止: specs/**) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `Tools/config.ts` `` | 1 | — | `` OUT  `Tools/config.ts`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `.CURRENT/e296/x` `` | 1 | — | `` OUT  `.CURRENT/e296/x`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `.github/workflows/ci.yml` `` | 1 | — | `` OUT  `.github/workflows/ci.yml`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `.registry` `` | 1 | — | `` OUT  `.registry`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `index.ts` `` | 1 | — | `` OUT  `index.ts`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 OUT `README.md` `` | 1 | — | `` OUT  `README.md`  (T-X-01) fanout check --cut: e296 — 1 ticket(s), 2 token(s), 1 out of bounds `` |
| `` R3 IN `.current/e296/.../x` `` | 0 | — | `fanout check --cut: e296 — 1 ticket(s), 2 token(s), 0 out of bounds` |
| `` R3 IN `qa_reports/foo/e296-x.md` `` | 0 | — | `fanout check --cut: e296 — 1 ticket(s), 2 token(s), 0 out of bounds` |
| `` R3 IN `specs/e296-*` `` | 0 | — | `fanout check --cut: e296 — 1 ticket(s), 2 token(s), 0 out of bounds` |
| `` R3 IN `qa_reports/*E296*` `` | 0 | — | `fanout check --cut: e296 — 1 ticket(s), 2 token(s), 0 out of bounds` |

### Proofs and gates

- AC15 section proof: `exit=2`, then `1`. AC15 cell proof: `exit=2`, then `1`. AC15 own-spec proof: `1`.
- AC9: `2` (`specs/fanout-wave5.1.md 2`, `specs/fanout-wave6.md 2`). AC10: `045b56ae749b459a808b16e13ac00e273721cd888e9932e9222f2762a780128a` and `485eabe00700945a3060b04149b59694957061983582519584051f2118b2f863`. AC11: own spec exit 1 (the e297 gap only), the oob case prints `1` then `exit=1`. AC12: `1`.
- Gates:
  - `npm run build`: 0 errors, and the `dist/` diff is limited to `dist/tools/fanout-manifest.{js,js.map,d.ts,d.ts.map}`.
  - `npx tsc --noEmit`: 0.
  - `npm audit --audit-level=high`: 0.
  - `npm run -s check:md-tables`: OK.
  - `node scripts/test-lock.mjs -- npm test`: 3128 tests, 3110 pass, 15 fail, 3 skipped. The 15 reds are exactly the known qa-owned list, unchanged:
    - compose goldens ×7: `compose-equivalence.test.mjs` ×6 and `skill-manifest.test.mjs:97`;
    - four context-budget ceilings (`context-budget.test.mjs` :475, :554, :569, :894);
    - e5-intake-tiering :67 and :214;
    - AC14 re-pins `e178a-integrator-role.test.mjs:75` and `e297-main-protected-sop.test.mjs:101`.

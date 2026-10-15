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

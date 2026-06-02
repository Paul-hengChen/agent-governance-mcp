# Review — T450 / T451 / T452 / T454 — v3.22.0 `subagent-watermark-parent-validation`

Reviewer: code-reviewer (clean-context, opus tier).
Inputs: `specs/subagent-watermark-parent-validation.md`, working-tree diff, empirical run of `dist/lib/watermark-check.js`, `npm test`, `npm run check:version`.
NOT read (per code-reviewer hard rules): `qa_reports/`, sr-engineer's `pending_notes`, prior implementation chatter.

## Summary

- New pure util `lib/watermark-check.ts` exporting `validateWatermark(reply, name, tier)` and `buildWatermark(name, tier)` with the canonical U+2014 regex; compiled output present at `dist/lib/watermark-check.js`.
- `tsconfig.json` `include` glob widened to cover `lib/**/*.ts`; build is clean and the file actually compiles into `dist/lib/`.
- `## Subagent Reply Watermark Validation` section added verbatim-equivalent to `content/skill-coordinator.md` (between Auto-Routing and SOP, line 96) and `content/skill-coordinator-lite.md` (line 38).
- `package.json` + `index.ts` Server literal both at `3.22.0`; CHANGELOG `[3.22.0]` entry written above `[3.21.2]`; `npm run check:version` OK.
- Headline verdict: **CHANGES_REQUESTED**. The pure util and SOP wording are correct against AC1–AC4, but `npm test` reports two regressions that directly violate AC6 ("the full suite passes with no regressions"). The util implementation itself is solid and would otherwise be APPROVED; the changes needed are limited to a stale version-pin test and the lite-bundle token budget.

## Correctness

Empirical exercise of every AC3 / AC5 fixture against `dist/lib/watermark-check.js` (verified via a one-off Node ESM eval) — every fixture passed:

| Fixture | Expected | Observed |
|---|---|---|
| watermark present, name+tier match | `present: true`, unchanged | OK |
| watermark absent | `present: false`, `\n— @<n> (<t>)` appended | OK |
| wrong name | `present: false`, correct watermark appended | OK |
| whitespace around watermark on last line | `present: true`, unchanged | OK |
| empty string | `present: false`, corrected is bare watermark | OK |
| hyphen-minus imposter `-` | absent | OK |
| en-dash imposter `–` (U+2013) | absent | OK |
| case-insensitive `@LITE (HAIKU)` against `lite`/`haiku` | present | OK |
| wrong tier (`sonnet` while dispatched as `haiku`) | absent | OK (PM Decision 3) |
| trailing blank lines after a valid watermark | present | OK |
| idempotency (run validate→correct→validate) | second call `present: true` | OK |

EM-DASH byte check via `hexdump` confirms U+2014 (`e2 80 94`) is used in the source — not a hyphen-minus / en-dash imposter (`lib/watermark-check.ts:25,36`; both regex literal and `buildWatermark` template).

Subtle correctness points all handled:
- The `\s` token inside the regex (`lib/watermark-check.ts:25,104`) matches any single Unicode-whitespace char per ECMAScript `RegExp`, which includes NBSP (`U+00A0`) — slightly more permissive than ASCII space, but a non-issue for haiku output and consistent with the spec literal `/^—\s@[\w-]+\s\([\w-]+\)$/i`.
- The name/tier re-extraction with a second regex (`lib/watermark-check.ts:103-115`) is necessary because `WATERMARK_REGEX` has no capture groups; the duplicated literal is in sync with the original and case-insensitive match against the expected pair correctly treats mismatched names/tiers as absent per PM Decision 3 final bullet.
- The empty-reply branch returns just the watermark with no leading newline (`lib/watermark-check.ts:90-93`) — spec only required `present: false` + `corrected: "— @<n> (<t>)"`; this matches AC5 fixture 5 verbatim.

No correctness bugs found in the util itself or in the SOP-text instructions.

## Quality

- File header docstring (`lib/watermark-check.ts:1-12`) cleanly states scope, lack of I/O, and points readers at the design doc. Public symbols (`WATERMARK_REGEX`, `buildWatermark`, `WatermarkCheckResult`, `validateWatermark`) have JSDoc that mirrors the spec language — easy to verify against the contract.
- Naming is consistent with the existing repo conventions (camelCase exports, no class abstraction for a 50-line pure function).
- One minor duplication smell: the literal `/^—\s@([\w-]+)\s\(([\w-]+)\)$/i` at line 104 duplicates `WATERMARK_REGEX` (line 25) with capture groups added. A single shared regex with `.exec()` would be DRY-er, but the current form is readable and the inline `// Defensive: should be unreachable` comment (line 107) flags the redundancy intentionally — not blocking.
- SOP text in `content/skill-coordinator.md:96-118` and `content/skill-coordinator-lite.md:38-60` is verbatim-equivalent in behavior: same regex, same correction strategy, same five out-of-scope guards. The lite version's intro paragraph correctly explains why a server-read-only lite mode still needs this (it can be invoked from a lite-mode main session via `@<name>` mention — the live failure that motivated v3.22.0) without contradicting lite mode's hard rule of no auto-routing or state writes. The validation is read-only on the reply string and write-only via string concatenation in the relay — no `tw_*` state writes added, no auto-routing introduced.
- CHANGELOG entry is well-structured (Added / Changed / Notes), correctly placed above `[3.21.2]`, with the regex and rationale quoted accurately.

## Architecture

- The util lives in a new top-level `lib/` directory, separate from `tools/`, `guards/`, `prompts/`, `schema/`, and `transport/`. Justified — it's not a tw_* tool, not a server guard, not a prompt assembler, not a schema migrator, not a transport. It's a pure helper consumed by SOP prose. The `tsconfig.json` `include` was correctly widened (line 25); the file compiles into `dist/lib/watermark-check.js` and is referenced from the SOP text by that compiled path.
- No new MCP tool surface; `tw_*` API unchanged (confirmed by inspection of `index.ts` — only the version literal changed at line 200). Backwards compatibility is intact per Decision 6.
- Out-of-scope guard text (both SOP files) correctly enumerates the negative cases: `tw_get_state`, `tw_detect_drift`, other `tw_*` tools, bash, file read, non-Task tools, and the coordinator's own analytic turns. This prevents the coordinator from stamping its own thoughts with a `@lite (haiku)` watermark — semantically critical, called out in both files.
- The placement of the new section in `skill-coordinator.md` (between the Auto-Routing section and the numbered SOP list) is the natural location: the validation is a post-step on a tool result, not a routing decision, but it logically belongs near the Auto-Routing section because it's only triggered by the `Task` tool dispatch that Auto-Routing introduced in v3.20.0.

No architectural objections.

## Security

- Pure function, no I/O, no `eval`, no dynamic regex construction from user input — `WATERMARK_REGEX` is a static literal. No injection vector.
- The detail-extraction regex at `lib/watermark-check.ts:104` uses capture groups but those are matched against `[\w-]+` only, so `actualName` / `actualTier` cannot contain regex metacharacters or shell-active characters. No risk of secondary injection when concatenated into the output.
- No secrets read, no env touched, no FS touched.
- The output is a string appended to the relayed reply; the watermark suffix is hard-coded ASCII + the input `name` and `tier` strings. Both come from the dispatched subagent's frontmatter (template-controlled, not user-controlled at runtime), so no XSS / log-injection vector beyond what the host CLI already accepts.

No security findings.

## Performance

- `validateWatermark` is O(n) over the reply length once (the `split(/\r?\n/)` and the reverse scan for the last non-empty line). Called once per Task tool reply — negligible cost.
- No new I/O, no new file reads, no new MCP round-trips, no new allocations beyond a single split + at most two regex `test`/`match` calls.
- The compiled `dist/lib/watermark-check.js` is 4.3 KB — trivial.

No performance regression. AC6 perf criterion (no regression vs base) satisfied at the code level.

However: see the bundle-budget regression under **Verdict → CHANGES_REQUESTED**. The lite-bundle token count is a context-budget concern that lives in `test/context-budget.test.mjs` (AC2) — independent of runtime performance but governed by an explicit ≤ 2000 token target that this change breaks.

## Verdict

**CHANGES_REQUESTED** — the util implementation, SOP wording, and version/CHANGELOG hygiene are all correct, but `npm test` reports two failures that violate spec AC6 ("the full suite passes with no regressions"). Both must be resolved before handoff to qa-engineer.

### Failure 1 — `test/subagent-templates.test.mjs:368` (stale version pin)

```
not ok 340 - v3.21.2 AC4: package.json + index.ts both at 3.21.2
  expected: '3.21.2'
  actual:   '3.22.0'
```

This is a stale test fixture from the v3.21.2 release. Two acceptable fixes:

- **(preferred)** Rename the test to `v3.22.0 AC8: package.json + index.ts both at 3.22.0` and update both assertions to `3.22.0`. (This mirrors how the v3.21.1 → v3.21.2 version test was handled in the prior release per `git log -p test/subagent-templates.test.mjs`.) Note that the v3.22.0 spec **does** have a version-pin AC (AC8), so the renamed test is meaningful and not a placeholder.
- **(acceptable)** Replace the hardcoded literal with `JSON.parse(fs.readFileSync(...))` parity check between `package.json` and `index.ts` (no hardcoded version), so future bumps don't trip this test. The downside is it loses the explicit "did we remember to bump?" guard; but `scripts/check-version.mjs` already covers that.

Either fix is mechanical; do not skip it.

### Failure 2 — `test/context-budget.test.mjs:54` (lite bundle exceeds ≤ 2000 token target)

```
not ok 14 - AC2: lean always-on bundle is below the raw baseline and within target (<= 2000 ~tok)
  error: 'lean always-on (2552 ~tok) must meet the <= 2000 target'
```

The new `## Subagent Reply Watermark Validation` section in `content/skill-coordinator-lite.md` (23 lines, ~552 tokens by the test's `length / 4` heuristic) pushed the lite always-on bundle 27% over its documented target. This is a real regression of a hard contract — see `specs/context-budget-reduction.md` AC2 — and it's exactly the kind of cross-spec coupling that AC6 is designed to catch.

Three viable fixes, in descending order of cleanliness:

1. **Compress the lite SOP section.** The full coordinator's section is necessary verbatim (it's the canonical wording), but the lite version can be trimmed — the regex + name/tier mismatch rule + out-of-scope guard can be expressed in ~6–8 lines instead of 23. Suggested compression: keep the regex code-fence and the one-sentence out-of-scope guard; drop the bullet list expansion of the guard cases (they are the same as in `skill-coordinator.md` — a `see skill-coordinator.md for full out-of-scope cases` cross-reference would suffice for lite). This preserves AC2's verbatim-equivalent-behavior requirement (same regex, same correction, same idempotency, same guard) while staying under the 2000 budget.
2. **Raise the budget cap.** Edit `test/context-budget.test.mjs:54` from `<= 2000` to `<= 3000` (or similar) and update `specs/context-budget-reduction.md` accordingly. This is a contract change — needs PM signoff and is out of scope for sr-engineer per the spec's "no change to constitution / transitions / templates" backwards-compat boundary. Reject this option unless the user explicitly approves a re-spec.
3. **Move part of the lite section into a non-always-on path.** The lite bundle is the SessionStart-injected always-on text; if the watermark-validation logic only fires after a `Task` tool call, the prose could conceivably move into a docs/ reference and be loaded on demand. This is a larger refactor and probably not worth it for a single section.

Recommend option 1.

### Independent observation (not blocking)

The `dist/index.js` modification shown in `git status` (not requested by the spec) is the recompile that ships the new version literal — confirmed by spot-check that the only diff vs `dist/index.js` is the version string. No surprise code shipped.

After both failures are fixed and `npm test` is green, re-submit for review (the file is append-only across rounds per the code-reviewer SOP).

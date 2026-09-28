# Review — T-E100-01

covers: T-E100-01, T-E101-01, T-E101-02, T-E100-03

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- 2 source files: `bin/agc-init.mjs` (+100/-21, adds `upsertHostKey()` and special-cases `.current/.config.json` out of the skip-if-exists loop) and `templates/agent-adapters/claude.md` (1 bullet rewritten). `docs/backlog.md` (2 priority cells) and `tasks.md` (3 task rows) are governance bookkeeping, not implementation.
- **The string-splice judgement call is sound and I would approve the approach.** I exercised it against 17 constructed inputs plus this repo's real 585-entry `.config.json`: the real-file result adds **exactly one line** with the remainder byte-identical, CRLF and tab indents are preserved byte-exactly, single-line and `{}` configs stay well-formed, and 3 consecutive runs are byte-identical. It fails safe — comments, trailing commas, array/null roots and BOM are all rejected with the file untouched.
- E101 matches its brief exactly, `claude.md` only (`codex.md` / `antigravity.md` verifiably untouched), and improves on the brief in one place.
- Blocking: **C1** the feature reds a test in the full suite with no expected-red manifest declaring it; **C2** falsy `host` values (`""`, `null`, `false`) permanently and silently defeat the self-heal, which is the exact defect E100 exists to close; **C3** the first-ever mutation of a user's existing `.config.json` is a non-atomic truncating write, while the correct atomic helper already exists 200 lines away in the consumer it writes for.
- Verdict: **CHANGES_REQUESTED**. All three are small, local fixes; none impugns the chosen approach.

## Correctness

**C1 (blocking) — full suite is red and no expected-red manifest exists.**
`npm test` → **1780/1781 pass, 1 fail**: `test/p0-onboarding-lite-default.test.mjs:66`

```
AC1: agc init creates .config.json + tasks.md with expected templates, no handoff.md (re-pinned E34)
  assert.deepEqual(cfg, { schema_version: 1 });
  actual:   { schema_version: 1, host: 'claude-code' }
```

This red is correct and foreseeable — it is `configTemplate` gaining the key — and the task brief explicitly pre-authorized it ("leave the suite red for qa if your change reds it"). Authorization to leave it red is not authorization to leave it **undeclared**: `qa_reports/expected-red_e100-e101-dispatch-declaration.txt` does not exist, and per code-reviewer SOP step 4a a missing manifest alongside evident intentional reds is a `CHANGES_REQUESTED` finding. That manifest is sr-engineer-authored machine data, not a QA artifact.

Compounding it: the handoff's verification note reports "existing `test/agc-adapters.test.mjs` (14/14) still green" — a scope that does not include the file the change breaks. The red was therefore not *known and left*, it was *not found*. Fix: add the manifest naming `test/p0-onboarding-lite-default.test.mjs | AC1: agc init creates .config.json + tasks.md with expected templates, no handoff.md (re-pinned E34)`.

**C2 (blocking) — a falsy `host` short-circuits the upsert forever, silently.**
`bin/agc-init.mjs:128`

```js
if (Object.prototype.hasOwnProperty.call(parsed, "host")) {
  return "has-host";
}
```

`hasOwnProperty` is a *presence* test, but the consumer is a *value* test — `tools/config.ts:255-258` surfaces `host` only when it is a non-empty string:

```ts
const host = migration.payload.host;
if (typeof host === "string" && host.length > 0) { result.host = host; }
```

So `"host": ""`, `"host": null`, `"host": false` all map to the lean `{ taskTool: false }` profile in `hostCapabilitiesFor()` — the E100 defect, unchanged — while `agc init` classifies them as `has-host` and never repairs them. Verified end-to-end; all three produce:

```
Skipped (already exists): .current/.config.json    (stderr empty, exit 0)
```

No warning, no non-zero exit, and re-running `agc init` can never fix it. The guard exists to protect a *deliberate* declaration such as `"cursor"` (which it does correctly — verified byte-identical), and none of `""` / `null` / `false` is a deliberate declaration of anything. Fix is one predicate, aligned to the consumer: treat as `has-host` only when the existing value is a non-empty string; otherwise fall through to the splice. Note the splice path itself is fine here — the key already exists, so the replace-vs-insert distinction has to be handled, or simplest, report it as `malformed`-style "present but unusable" with a warning.

**C3 (blocking, robustness) — non-atomic truncating write on the user's config.**
`bin/agc-init.mjs:154`

```js
fs.writeFileSync(abs, updated);
```

Before this diff `agc init` **never** mutated an existing `.current/.config.json` — it was strictly create-if-absent. This is the first write, and it truncates in place. An interruption (^C, ENOSPC, crash) leaves a truncated or empty config; `loadConfig()` then degrades to `{}` and every `driftBaselineIds` entry (585 in this repo), the `cutApprovalAutoTier` arming key and any `taskPaths` silently stop applying — surfaced only as a `config_error` string on `tw_get_state`.

The repo already has the correct pattern, in the very module this file is writing for — `tools/config.ts:326-333`:

```ts
const tmpPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
fs.writeFileSync(tmpPath, `${JSON.stringify(stamped, null, 2)}\n`, "utf-8");
fs.renameSync(tmpPath, configPath);
```

and CLAUDE.md states tmp-file + `fs.renameSync` as the requirement for mutating a governed artifact. `writeClaudeBlock` is also non-atomic, but that is pre-existing and `CLAUDE.md` is regenerable from a template — the user's `.config.json` is not. Three lines; `fs` and `path` are already imported.

**Verified correct — recorded so it is not re-litigated.** `raw.indexOf("{")` at `:132` looks like a hazard (a brace before the first key) and is not: it runs only after `JSON.parse` succeeded *and* the root was type-checked as a non-array object, and valid JSON permits nothing but whitespace before the root value — so the first `{` is provably the root brace. The re-parse before write at `:148-152` is a genuinely good belt-and-braces. BOM is rejected as malformed, and that is **consistent** with the server, which also cannot parse a BOM'd config (`tools/config.ts:175` is a plain `JSON.parse`) and reports `config_error` — not a new defect, and not a finding.

**Evidence matrix** (all run against the built CLI):

| input | disposition | file | result |
|---|---|---|---|
| real repo config, 585-entry array | Updated | +1 line, remainder byte-identical | valid |
| pretty 2-space | Updated | +1 line | valid |
| CRLF | Updated | `\r\n` preserved (od-verified) | valid |
| tab-indented | Updated | tab preserved | valid |
| single-line | Updated | stays single-line | valid |
| `{}` / `{\n}` | Updated | well-formed | valid |
| blank line before first key | Updated | +3 lines (cosmetic, see Quality) | valid |
| `"host": "cursor"` | Skipped | **byte-identical** | valid |
| `"host": ""` / `null` / `false` | Skipped | untouched | **C2 — silently lean forever** |
| trailing comma / `//` comment / BOM | Skipped + warning | untouched | correct |
| `[1,2,3]` / `null` root | Skipped + warning | untouched | correct |
| 3 consecutive runs | Skipped | byte-identical | idempotent |

## Quality

**Q1 — the diff makes its own file's documentation false.** `.current/.config.json` is now the second upsert surface, but three places still say it is skip-if-exists:
- `bin/agc-init.mjs:4-7` — *"Idempotent: existing files are skipped; the CLAUDE.md adapter block is upserted in place."*
- `bin/agc-init.mjs:39-43` (`STR_USAGE`, user-facing) — *"Existing files are skipped."*
- `bin/agc-init.mjs:190` — *".current/ itself is created by the mkdirSync below"* — after the restructure `.current/` is created by the `mkdirSync` **in this block** at `:195`; the loop "below" now only ever mkdirs the cwd for `tasks.md`.

**Q2 — "malformed" is filed under a label that denies it happened.** `:204-211` pushes the malformed case into `skipped`, so stdout prints `Skipped (already exists): .current/.config.json` for a file that was *rejected*, not skipped. The comment at `:205` claims it is "surfaced separately below so it isn't mistaken for the ordinary create-if-absent skip" — but it is in the same bucket; only the stderr warning separates them, and stderr is routinely discarded in scripted use. Exit stays 0, so no caller can detect that the migration did not occur. Suggest a distinct stdout bucket (`Not updated: <file> (unparseable)`). I would keep exit 0 — a scaffold command should not hard-fail over a pre-existing broken config — but the label has to be honest.

**Q3 (cosmetic) — `leadingWs` is reused verbatim, so a blank line before the first key is duplicated.** `:141-143` splices `leadingWs` twice; for a config whose first key is preceded by an empty line, `leadingWs` is `"\n\n  "` and the result gains 3 lines, not 1. Output is valid and no existing byte changes, so this is cosmetic — but it does narrow the "exactly one new line" claim in the handoff note.

**Q4 (positive) — E101 improved on its brief.** The brief specified "invisible to all 33 gates in `GATE_REGISTRY`"; `templates/agent-adapters/claude.md:12` says "invisible to every gate in `GATE_REGISTRY`". Dropping the count is the right call for a template that ships to adopters and outlives the count. The bullet runs longer than the brief's "existing register and length class" and longer than its two siblings, but the row required three distinct claims (standing request / nudge does not override / judge roles MUST `Task`) and I see no shorter honest phrasing. Accepted as-is.

## Architecture

The implementation follows the intake finding, not the E100 row, and that is correct — the row's option (i) ("`agc init` writes the key, one line") genuinely does not reach the two workspaces that demonstrated the defect, and modelling the fix on the `writeClaudeBlock` upsert precedent is the right structural read of the asymmetry. Layering is unchanged: `agc-init.mjs` stays dependency-free of `dist/`, and `host` is an already-typed optional field (`tools/config.ts:64-68`) with `CURRENT_VERSIONS.config === 1` unchanged, so "no schema change" holds.

**I verified the feature actually pays off**, since the whole cut is worthless if the key does not change composition. Composing `skill-coordinator.md` against three workspaces:

| `host` | composed length | host-tagged fragments |
|---|---|---|
| absent | 52,808 | excluded |
| `"cursor"` | 52,808 | excluded |
| `"claude-code"` | **63,975** | included (`coord-02` / `04` / `06`) |

+11,167 chars (+21%). That is the E100 remedy working, and it is also a release-note obligation: every Claude Code workspace that re-runs `agc init` silently pays 21% more coordinator context per invocation. Intended, but it should be stated rather than discovered.

**A1 — the intake finding is right in its conclusion and overclaims in its justification.** You asked me to say so if I thought the finding itself was wrong. It is not wrong: E100 option (i) alone is insufficient, the measurement behind that call is correct, and adding the upsert is the right cut. But the stated reason for dropping option (ii) — *"the upsert self-heals, leaving it to fire only after a hand-deletion"* — is incomplete. There are at least two further states in which it does **not** self-heal and `agc init` exits 0 with no signal: a falsy `host` (C2) and an unparseable config (Q2). Fixing C2 collapses this to the malformed case alone, which is rare enough that I would **not** re-open option (ii) in this cut. My recommendation is one sentence on the E100 row recording the residual, so a future reader does not inherit "self-heals" as unqualified.

**A2 (process, non-blocking) — the `docs/backlog.md` edit had no owner.** Noted as yours: the two priority cells are content-correct and reconcile with `scope_decision_why` ("both raised to P1 by the same call"); `git diff -U1` confirms the priority cell is the only change in either row. The gap is real and worth naming — the edit is a tracked file inside the approved cut with no task id, so it is invisible to `tasks.md` (three rows, none covering `docs/backlog.md`), to the drift ledger (`tw_detect_drift` returned clean), and to QA's per-id evidence requirement. Nothing in the governance record would have surfaced this file. For a two-cell edit a full task is heavier than the change; I would prefer one line in `scope_decision_why` declaring "backlog priority cells: human-authored, no task" so the diff reconciles against the record. Cheap either way, and only worth doing because the same shape at larger size is how unreviewed content enters a feature diff.

## Security

No findings. `upsertHostKey` splices a hardcoded literal — no untrusted data is interpolated into the JSON, so there is no injection surface. The path is derived from `cwd` + a fixed relative constant, so no traversal. No secrets, no network, no new trust boundary. The re-parse before write (`:148-152`) means a splice that somehow corrupted the document could not be persisted. `fs.writeFileSync` follows symlinks, but that matches every other write in this file and is not introduced here.

## Performance

No findings, and no regression. `upsertHostKey` is one `readFileSync`, two `JSON.parse` calls and one `writeFileSync` on a ~9KB file, executed once per `agc init` — the second parse is a deliberate validation, not redundant work. The string-splice is O(n) in file size against `JSON.parse`+`stringify` which is also O(n), so the approach carries no complexity cost, only a formatting benefit.

One measured consequence, recorded under Architecture rather than as a defect: coordinator prompt composition grows 52,808 → 63,975 chars per invocation once `host` is declared.

Worth noting for the record, because it bounds the value of the splice: the byte-preservation it buys lasts only until the next config schema bump. `tools/config.ts:210-219` heal-on-read calls `atomicWriteConfig()`, which does `JSON.stringify(stamped, null, 2)` and reformats the entire file — the 585-entry array included. So the splice protects formatting against *this* write, not durably. That does not change the verdict on the approach (it is still the right call for this write, and it is what keeps this feature's own diff to one line), but it is the honest framing, and it is narrower than the comment at `:103-111` asserts.

**Direct answer to the question put to me — is sr's stated limit the real one?** No; it names the least of them. The handoff calls out formatting-of-the-inserted-line and non-object roots. Both are true and both are minor. The three limits it does not name are C2 (falsy host, permanent silent non-heal), C3 (non-atomic write on a file that until this diff was never mutated), and the heal-on-read reformat above that bounds the whole justification. The approach survives all three; the surrounding robustness does not.

## QA gaps for T-E100-02

The brief's cases (1) fresh, (2) existing-without-host, (3) `"cursor"` untouched, (4) malformed are right and sufficient for the happy paths. Additions, in priority order:

5. **Falsy `host`** — `""`, `null`, `false` must be treated as absent and upserted (or loudly warned), never short-circuited. This is C2 and the highest-value new pin.
6. **Formatting-preservation as a class**, since the entire approach rests on it: CRLF, tab-indent, single-line, `{}`, and a large-array config. Assert *the remainder is byte-identical and exactly one line was added* — not merely that `host` is present and the file parses. A naive `JSON.parse`/`stringify` fix passes case (2) and fails every one of these, which is precisely the regression this pin exists to catch.
7. **`AC2` is now conditionally true.** `test/p0-onboarding-lite-default.test.mjs:72` ("leaves `.config.json` byte-for-byte unchanged on re-run") passes only because run 1 seeds `host`. Either rename it or add a companion asserting a host-less pre-existing config **is** changed on re-run — otherwise a future regression reverting the upsert to a blanket skip passes AC2 untouched.
8. **Malformed-path contract** — pin the exit code and the stdout bucket, whichever way Q2 is resolved, so the labelling stops being incidental.
9. **The dogfood step should assert the payoff, not just the mechanism.** Presence of the `host` key is the mechanism; the host-tagged fragments rendering is the acceptance. Cheap pin: the composed coordinator contains "Subagent Token Observability" with `host` set and does not without.

## Verdict

**CHANGES_REQUESTED** — the string-splice approach is verified sound and approved on the merits, but the round ships an undeclared suite red (C1), a silent permanent failure of the self-heal on falsy `host` values that reinstates the exact defect E100 closes (C2), and a non-atomic first-ever mutation of the user's config where the atomic helper already exists in the consuming module (C3).

## Round 1 reply — sr-engineer

All three blocking findings and both non-blocking ones addressed in `bin/agc-init.mjs`.

- **C1** — `qa_reports/expected-red_e100-e101-dispatch-declaration.txt` now declares `test/p0-onboarding-lite-default.test.mjs | AC1: agc init creates .config.json + tasks.md with expected templates, no handoff.md (re-pinned E34)`, with a rationale block. Ran the full suite (not the scoped subset that missed this last round): `npm test` → **1780/1781**, and I confirmed by name that the one failure is exactly this declared AC1 — nothing else regressed. `test/` untouched, per §2.
- **C2** — `upsertHostKey()`'s has-host check is now a value test mirroring `tools/config.ts:255-258`: `hostIsDeclared = hasHostKey && typeof parsed.host === "string" && parsed.host.length > 0`. A falsy `host` (`""`/`null`/`false`/any non-string) no longer short-circuits to `has-host`; it now falls into a repair path that rewrites the *existing* key's value in place via a targeted `"host"\s*:\s*<primitive>` regex (rather than inserting a second `"host"` key, which would leave the file with two keys and a parse-order-dependent value). A value shape that regex can't span (array/object) declines the rewrite and reports `malformed` rather than guessing. Manually verified all three named falsy values now repair to `"claude-code"` and report `Updated`; `"cursor"` still reports `Skipped` and stays byte-identical.
- **C3** — added `atomicWriteFile()` (tmp path `${target}.${pid}.${Date.now()}.tmp` + `fs.renameSync`), mirroring `tools/config.ts:326-333`'s `atomicWriteConfig()` exactly. `upsertHostKey()`'s only write now goes through it. Verified no leftover `.tmp` file after a normal run.
- **Q1** — updated the header doc comment (`:4-8`), `STR_USAGE` (`:39-44`), and the stale `.current/` creation comment (now correctly attributes it to the special-cased block, not the "loop below").
- **Q2** — malformed/unusable-host dispositions now land in a distinct `notUpdated` bucket, printed as `Not updated (rejected, see warnings): <file>` — separate from `Skipped (already exists)`. Exit code stays 0 per the review's own recommendation (scaffold command shouldn't hard-fail on a pre-existing broken config); the warning on stderr still carries the specific reason.

Not touched: the approved string-splice approach itself, `raw.indexOf("{")` (already verified safe), the re-parse-before-write belt-and-brace, E101's `claude.md` changes, `docs/backlog.md`, `tasks.md`. Q3 (blank-line-before-first-key duplication) and A1/A2 (backlog-row wording, process gap) are noted but out of scope for this round — no code path changed by them.

Verification run this round: `npm run build` clean (tsc 0 errors, check:version OK, check:transitions-sync OK), `npx tsc --noEmit` 0 errors, `npm audit --audit-level=high` clean (only pre-existing moderate `hono`/`protobufjs`, no high/critical), `agc check` exit 0, full `npm test` 1780/1781 (the one declared red).

---

## Round 2 — APPROVED — by code-reviewer

Round 1's three blocking findings were re-derived from the diff and the runtime, not accepted from the reply. All three are genuinely closed. The new, unrequested repair path (`bin/agc-init.mjs:160-195`) was treated as the highest-risk code in the diff and probed with 28 adversarial config shapes; it is provably fail-safe, and the reason it is safe is stronger than the reason given in its own comments. Round 1's approval of the string-splice approach is re-affirmed on independent grounds. Remaining findings are diagnostics-accuracy and one pre-existing hazard — none blocks.

## Summary

- Re-derived C1/C2/C3 independently. **C1 closed**: full `npm test` run this round gives `# tests 1781 / # pass 1780 / # fail 1`, and the single `not ok` is byte-identical to the one entry in `qa_reports/expected-red_e100-e101-dispatch-declaration.txt`. Both manifest claims verified. **C2 closed**: `bin/agc-init.mjs:154-155` is now a value test that matches `tools/config.ts:255-258` exactly (`typeof === "string" && length > 0`). **C3 closed**: `atomicWriteFile()` (`:112-116`) mirrors `atomicWriteConfig()` (`tools/config.ts:326-333`) including the tmp-name scheme; it is the only write path out of `upsertHostKey`.
- **The repair path is not scope creep — it is the completion of C2.** Round 1's C2 prescription was under-specified: applying only the value test, a falsy `host` would have fallen through to the *insert* path, spliced a second `"host"` next to the opening brace, and `JSON.parse` takes the textually-last key — so the falsy value would have survived and E100 would have been silently re-armed, permanently, for exactly the inputs C2 exists to catch. sr detected a defect in the prescribed fix and closed it. Correct call.
- **The unanchored regex is fail-safe, by proof and not by case enumeration** — see Correctness. 28 probed shapes, zero corrupted files, zero lost data.
- **The one real defect: `"malformed"` is not an honest report for one class of input** (valid JSON, repairable top-level value, rejected because an unrelated `host` key sorts earlier in the text). Non-blocking — unreachable under the current config schema — but the docblock and the stderr warning both assert something false, and the code comments misattribute which guard is doing the work.
- E101's template bullet meets every content clause of T-E101-01 and correctly drops the spec's hardcoded "all 33 gates" count. Q1/Q2 doc and bucket changes match the shipped behaviour, with the one exception noted above. Verdict: **APPROVED**.

## Correctness

**Re-derivation of C1 — expected-red manifest is honest and complete.** Full-suite run this round (not sampled, not scoped): `# tests 1781 / # suites 1 / # pass 1780 / # fail 1 / # cancelled 0 / # skipped 0 / # todo 0`. Exactly one `not ok` line in the whole TAP stream:
```
not ok 830 - AC1: agc init creates .config.json + tasks.md with expected templates, no handoff.md (re-pinned E34)
```
SOP 4a sampling (1 entry, so all entries): the entry resolves to a real, locatable test at `test/p0-onboarding-lite-default.test.mjs:52`, and the failure is the E100 shape change and nothing else (`deepStrictEqual` actual `{host:'claude-code', schema_version:1}` vs expected `{schema_version:1}`, at `:66`). Both manifest assertions — the single red, and the 1780/1781 count — verified independently. No finding.

The manifest's collateral claim about AC2 also checks out and is worth carrying forward: `AC2` (`:72`) passes only because its run 1 now seeds the host key, so the re-run hits `has-host` and its `Skipped (already exists)` stdout regex still matches. AC2's *title claim* — "leaves .config.json byte-for-byte unchanged on re-run" — is now false as a general statement and true only for the fresh-init case. It is a green test that no longer means what it says. Recorded under QA gaps.

**Re-derivation of C2 — value test matches the consumer.** `tools/config.ts:255-258` surfaces `host` only when `typeof host === "string" && host.length > 0`; `bin/agc-init.mjs:154-155` is the same predicate. Verified at runtime: `""`, `null`, `false`, `0` all repair to `"claude-code"` and report `Updated`; `"cursor"` and even `"""` (a non-empty string) report `Skipped` and stay byte-identical. No finding.

**Re-derivation of C3 — atomic write.** `atomicWriteFile` (`:112-116`) writes `${target}.${pid}.${Date.now()}.tmp` then `renameSync`, identical in shape and naming to `atomicWriteConfig` (`tools/config.ts:326-333`). It is `upsertHostKey`'s only write. No `.tmp` leftovers observed across 28 runs. No finding. (One consequence, informational: `renameSync` replaces the inode, so the target's mode reverts to umask default. `atomicWriteConfig` has the identical behaviour, so this is consistent with the precedent it cites, not a new class.)

**The new repair path (`:160-195`) — safety analysis.** The concern is real and correctly identified: `KEY_VALUE_RE` (`:168-169`) is unanchored, `exec` returns the FIRST match in the whole file, and that need not be the top-level key. But the write cannot be wrong, and the argument is structural:

1. *The regex can only ever match a real JSON `host` key, at any depth.* `JSON.parse` has already succeeded before `:170` runs, so the text is valid JSON. In valid JSON the 6-character literal `"host"` can only be a string token equal to `host` — a `"` inside a string must be escaped as `\"` or `"`, neither of which produces the literal. And a string token followed by `:` can only be a key, never an array element or a value. So "the literal text inside a string value" is not a reachable case here. Confirmed empirically: `{"a": "host", "host": ""}` correctly repairs the key and not the value; `{"note": "set \"host\": \"foo\" here", "host": null}` correctly repairs the key and leaves the prose value byte-identical.
2. *The reparse guard (`:200-208`) is exactly sufficient, not incidentally lucky.* The splice mutates exactly one `host` key occurrence, h_i. `reparsed.host` is the value of the **last top-level** `host` occurrence. Pre-splice that value was not a non-empty string (or `:156` would have returned `has-host`). So `reparsed.host` can only become a non-empty string if h_i **is** that last top-level occurrence — i.e. the intended target. If h_i is nested, or is a non-final duplicate top-level key, the effective value is untouched and still falsy, and `:206-208` rejects. There is no input for which a wrong occurrence is spliced *and* the write proceeds.

Probed and confirmed fail-safe (file left byte-identical in every case): nested `host` textually before a falsy top-level `host`; top-level `host: []` with a nested string `host` (the regex skips the array and matches the nested one — and the guard, not the `!m` branch, is what saves it); duplicate top-level `host` keys in both orders; both-null duplicates; a top-level key spelled `"host"` with and without a nested real `host`; malformed JSON; top-level array; top-level string; BOM-prefixed. Correct behaviour confirmed on: no-host with a 2-element array (formatting and key order preserved), all four falsy values, `{}`, compact single-line, no-trailing-newline, and a nested `host` *after* a falsy top-level one (top-level repaired, nested `"keepme"` preserved). **No correctness finding against the repair path.**

**FINDING (non-blocking) — `"malformed"` is a dishonest report for the shadowed-key class.** `bin/agc-init.mjs:206-208` returns `"malformed"` when the reparse guard rejects, and `:269-272` renders that as:
> `could not add "host" — left untouched (not valid JSON, or an existing "host" value this tool declines to rewrite in place)`

For input `{"servers": {"host": "prod.example.com"}, "host": "", "schema_version": 1}` **neither disjunct is true**: the file is valid JSON, and the top-level value `""` is precisely the shape the function advertises that it repairs. It is rejected only because an unrelated nested key sorts earlier in the text — a fact about the scanner, not about the file. The user is told their config is bad; the correct statement is that the tool declined to guess. Same for duplicate top-level keys and for `"host"`-spelled keys. Related, in the same class:
- The docblock's `returns "malformed"` clause (`:130-133`) says "array/object" — it does not describe the shadowed-key rejection at all, and that rejection is the larger of the two classes.
- The comment at `:172-173` ("A structurally odd value (array/object) — decline to rewrite it rather than risk a bad splice") explains the `!m` branch as the safety net for shapes the pattern can't span. That is wrong for `{"host": [], "nested": {"host": "x"}}`: the regex *does* match there, `!m` is false, and the **reparse guard** catches it. A maintainer reading these comments will believe the wrong guard is load-bearing — which matters, because the reparse guard is the one thing standing between this function and a bad splice.

Reachability under today's schema is near zero — `tools/config.ts` defines no nested object carrying a `host` key — so this is diagnostics accuracy, not data safety, and it does not block. It becomes live the moment a nested `host` is added to the config schema (an HTTP/transport block is the obvious candidate). Suggested minimal fix, no behaviour change: widen the return doc to name the reparse-rejection class, move the "declines to guess" explanation onto the reparse guard, and change the warning to something like `could not add "host" — left untouched (not valid JSON, or the "host" key could not be rewritten unambiguously)`.

**Not a finding, verified negative:** `raw.indexOf("{")` on the insert path (`:182`) cannot pick a brace inside a preceding string, because a valid top-level JSON object's first `{` is its opening brace. BOM-prefixed files are rejected as `"malformed"` — checked against the consumer, and `loadConfig` rejects them identically (`config_error: Failed to parse ... — config IGNORED`), so `agc init` and the runtime agree that such a file is dead. Consistent, not a divergence.

## Quality

**FINDING (non-blocking, highest-value follow-up) — the C3 hazard still stands one screen above the new helper.** `writeClaudeBlock` at `bin/agc-init.mjs:95` does `fs.writeFileSync(target, before + block + after)` — a truncating, non-atomic, in-place mutation of an existing `CLAUDE.md`, the exact class C3 was raised about. It was not routed through the `atomicWriteFile` helper added 17 lines below it, whose own docblock (`:106-111`) states the rule it violates ("Atomic write for a file this script mutates IN PLACE ... per CLAUDE.md's requirement for any write to a governed artifact"). Stakes are arguably higher than the config case this round fixed: `CLAUDE.md` carries the adopter's own prose *outside* the markers, which a truncated write destroys unrecoverably, whereas `.config.json` is regenerable. Pre-existing, not a regression from this diff, and not named in round 1 either — so it does not block this round. It is a two-line change (`fs.writeFileSync(target, ...)` → `atomicWriteFile(target, ...)` at `:95`, and arguably `:82`/`:101`) inside T-E100-01's own file boundary; worth taking as an in-cut freebie or filing as its own row.

**FINDING (non-blocking) — the actionable detail sits in the channel the code itself says is discarded.** `:264-267` justifies the separate stdout bucket on the grounds that "stderr is routinely discarded", then `:269-272` puts the only specific reason on stderr, and the stdout line points at it (`Not updated (rejected, see warnings)`). A caller reading stdout alone learns that something was rejected and cannot learn why — which is the situation the comment was written to prevent. Either inline the short reason on stdout or drop the "see warnings" pointer. Exit code staying 0 is the right call and I am not reopening it.

**Minor.** (a) The `has-host` disposition is reported as `Skipped (already exists)` (`:262`), reusing the create-if-absent wording for a file that *was* examined and deliberately left because it already declares a host — a stdout-scripting caller cannot tell it apart from `tasks.md` being skipped. (b) `All files already exist — nothing to do.` (`:329-336`) is unreachable: the `CLAUDE.md` adapter is always upserted, so `created` or `updated` is always non-empty. Pre-existing (the upsert predates this diff); adding `notUpdated.length === 0` to an already-dead condition is harmless. (c) On compact single-line configs the inserted key renders as `"host": "claude-code",` (space after colon) against neighbours written `"schema_version":1` — cosmetic only.

**Positive.** The value-test comment (`:147-153`) states the failure mode it prevents *and* why it would have been permanent — that is the right register for a guard whose absence is silent. The `atomicWriteFile` docblock names the concrete consequence (558 `driftBaselineIds` silently ceasing to apply) rather than gesturing at "safety". Comment quality is high; the accuracy defect above is confined to the three strings named in Correctness.

## Architecture

No architecture spec for this feature; the backlog rows are the spec. Layering is respected: `bin/agc-init.mjs` remains a standalone ESM CLI with no import of `tools/`, and duplicating the value test rather than importing `loadConfig` is correct for a `bin/` script that must run before `dist/` exists — the duplication is explicitly annotated with the file:line it mirrors, which is the maintainable form of it.

Spec fidelity against T-E100-01: (a) `configTemplate` carries `"host": "claude-code"` (`:222-225`) ✓; (b) the existing-file upsert path exists, preserves every other key and the file's formatting, and reports under `updated` not `skipped` (`:246-276`) ✓; (c) an existing host is never overwritten ✓, malformed JSON is never clobbered ✓. `test/` untouched ✓ (`git status` shows no `test/` path). Against T-E101-01: `templates/agent-adapters/claude.md` carries every mandated clause — standing request, host-nudge non-override, `code-reviewer`/`qa-engineer` MUST use `Task`, §3.2 rationale, gate-invisibility, build roles may run in-context — and `codex.md` / `antigravity.md` are untouched ✓. This repo's own `CLAUDE.md` was correctly **not** hand-edited (spec defers it to the qa-owned dogfood step); its adapter block still carries the old bullet and `.current/.config.json` still has no `host` key, which is expected state at this hop, not drift.

One deliberate deviation, and it is the right one: the spec dictated "invisible to all 33 gates in `GATE_REGISTRY`"; the template says "invisible to every gate in `GATE_REGISTRY`". A hardcoded count in a file that ships to adopters goes stale on the next gate added. Good judgement.

**FINDING (non-blocking) — the E101 bullet is out of the length class its own spec set.** T-E101-01 says "keep it to the bullet's existing register and length class; this is an adapter stub, not a SOP." The bullet went 110 → 576 characters, against siblings of 100 and 301. The spec is in tension with itself — the six content clauses it also mandates cannot fit the old length — so this is not sr's error, and content beats length here. Recording it so the choice is visible rather than assumed, and so a future trim has a stated baseline.

T-E101-02 (coordinator-authored, already applied) verified as scoped: `docs/backlog.md`'s diff touches only the two priority cells, both now reading the human call of 2026-08-31 in wording consistent with `scope_decision_why`; no other cell in either row moved; both rows still carry 7 pipes (6 columns), matching the untouched E99 row — the E74/E88 trap is clear.

## Security

No findings. No new input crosses a trust boundary: `.current/.config.json` is workspace-local content the operator already controls, and nothing read from it is executed, interpolated into a shell, or used to build a path — the only value derived from it is the boolean `hostIsDeclared`. The only string spliced into the file is the constant `'"claude-code"'`, so no attacker-controlled text reaches the output; a hostile config can at worst cause a rejection, never an injection. `JSON.parse` on untrusted-but-local input has no prototype-pollution reach here (`parsed` is only ever property-read; `hasOwnProperty` is correctly invoked via `Object.prototype.call` at `:153` rather than off the parsed object). The tmp file is created in the same directory as the target with a pid+timestamp name and `renameSync`'d immediately; no `/tmp` symlink surface. No secrets introduced.

## Performance

No findings. One extra `readFileSync` + `JSON.parse` + one `RegExp.exec` per `agc init` on a file measured in single-digit KB, on a command run interactively at workspace setup. No loops added, no complexity-class change, no unbatched I/O, no retained references. The chosen splice approach is in fact the *cheaper* option than the parse-and-restringify it rejects, though correctness — not cost — is the reason to prefer it.

## QA gaps for T-E100-02

Carried forward from round 1 plus new this round. These are pins for qa, not blockers on sr:

1. **AC2 is a green test that no longer means its title** (`test/p0-onboarding-lite-default.test.mjs:72`). It asserts "byte-for-byte unchanged on re-run" but only exercises fresh-init-then-rerun, where run 1 seeds `host`. A pre-E100 workspace is now deliberately *changed* on re-run. Re-pin it as the fresh-init case explicitly, and add the pre-E100 case as its own test rather than letting the old title cover both.
2. **Pin the shadowed-key class as behaviour, whatever the message says** — a `.config.json` with a nested `host` before a falsy top-level `host` must be left byte-identical and must not be reported as updated. This is the guarantee; the wording of the warning is the part that may still change.
3. **Pin the four falsy repairs as a class** (`""`, `null`, `false`, a number) — not just `""`. Each must end at `"host": "claude-code"` with every other key and the file's formatting preserved.
4. **Pin `"cursor"` byte-identical** (over-correction guard) and pin that it reports on the `Skipped` line, not `Updated`.
5. **Pin no `.tmp` residue** in `.current/` after any of the above.
6. **Dogfood migration**: this repo's `.current/.config.json` still has no `host` and `CLAUDE.md`'s adapter block still carries the old bullet — record before/after for both in the evidence doc, per T-E100-02.
7. Note for whoever runs `agc check` after the dogfood step: it compares version *stamps*, not block *content*, so a stale-content adapter under a current stamp reports OK. It exits 0 today (`3.105.0`) with the old bullet still deployed. Not a defect — just don't read `agc check — OK` as "the adapter text is current".

## Verdict

**APPROVED** — all three round-1 blocking findings independently re-derived and closed; the unrequested repair path is the necessary completion of C2 rather than scope creep, and its unanchored regex is provably fail-safe under the reparse guard across 28 probed shapes with zero data loss. The one real defect is a dishonest `"malformed"` report for a class unreachable under the current config schema, which is a three-string fix with no behaviour change and does not justify a third sr round.

---

## Round 3 — APPROVED — by code-reviewer

Scope of this round: T-E100-03 (carried on the file's single top-of-file `covers:` line — the coverage index reads only the FIRST such line per file).

Scope: `bin/agc-init.mjs` only — the in-cut delta for round 2's two non-blocking findings, (1) atomicity and (2) comment/string honesty. Round 2's reparse-guard proof was **re-derived from first principles and re-probed empirically**, not ratified, because finding (2)'s comment rewrite is built on it: 28 adversarial config shapes, zero failures, zero `.tmp` residue. The proof holds and the new comments restate it accurately — with one word's worth of imprecision recorded below. The atomicity extension is judged correct and its `"created"` exclusion defensible. sr's `mode === "skip"` claim was verified structurally and behaviourally, not read. No behaviour change outside the two converted call sites and one warning string.

**Blocking status, stated explicitly for the hop budget: nothing here is must-fix-before-QA. All six findings are file-a-row.** No finding was softened to reach that answer; the one I weighed hardest for blocking (R3-A) is argued through below rather than waved off.

## Summary

- **Finding (1) — atomicity — closed, and the extension is the right call.** Converting the `"appended"` branch was not scope creep: round 2's own text named `:101` as in-class ("arguably `:82`/`:101`"). Both `"updated"` and `"appended"` truncate an existing file carrying adopter prose; the exposure is identical, and fixing one without the other would have left the finding half-closed. Verified live on both branches: prose above and below the markers survives, no residue.
- **The `"created"` exclusion is right.** Nothing pre-exists to lose, and the residual hazard (a crash-truncated file with a dangling `BEGIN` marker) is self-healing: the next run falls to `"appended"`, and the run after that collapses `beginIdx`→`endIdx` into one clean block. Optional to unify; not a defect.
- **`atomicWriteFile` (`:119-123`) is correct in shape** — sibling tmp (same filesystem, so `renameSync` is genuinely atomic), pid+timestamp name with no in-process collision path, byte-identical to the cited precedent `tools/config.ts:326-333`. Death between write and rename leaves the target **intact** and a stray `.tmp`; that is the correct failure direction and a real improvement over the truncating write it replaces.
- **Round 2's reparse-guard proof is correct.** Re-derived independently and confirmed on the exact shapes the new comments cite. The one case that proves the guard is load-bearing rather than decorative — a wrong-occurrence splice that `!m` does *not* catch — reproduces exactly as the comment claims.
- **Finding (2) — honesty — closed for the message and the misattribution.** The warning string is now true for the shadowed-key class, and the `!m` comment correctly hands credit to the reparse guard. One residual imprecision (R3-B) is in the same class as the finding it was meant to close.
- **One genuine behaviour regression introduced by this delta (R3-A): a symlinked `CLAUDE.md` is now replaced rather than written through.** Demonstrated, not theorised. Non-blocking on balance — reasoning below. Verdict: **APPROVED**.

## Correctness

**Re-derivation of the reparse-guard proof (`:220-236`) — independently confirmed sufficient.** The proof needs exactly two facts, both verified rather than assumed:

1. *The splice changes exactly one value token and nothing structural.* `KEY_VALUE_RE` (`:181-182`) matches a complete JSON scalar: the string alternation `"(?:[^"\\]|\\.)*"` cannot over-run its closing quote (a `"` can only enter via `\"`, which `\\.` consumes as a unit), and the number alternation spans the full numeric grammar including exponents. Substituting one value token for another leaves key order and nesting identical, so no `host` occurrence can become or stop being the last top-level one as a result of the splice. Probed: `{"host": 1.5e-3, ...}` and `{"host": "a\"b", ...}` both handled at the right token boundary.
2. *`JSON.parse` duplicate-key semantics are last-wins,* so `reparsed.host` is the last top-level occurrence's value. Confirmed empirically in both orders: `{"host":"a","host":""}` → rejected (regex hits the first, effective value stays `""`); `{"host":"","host":"b"}` → `has-host` (never reaches the splice).

Given (1) and (2): pre-splice the last top-level value was not a non-empty string (or `:169` would have returned `has-host`); the splice leaves it untouched unless it *is* the spliced occurrence; therefore it can only satisfy `:234` if the splice hit the intended target. **There is no input for which a wrong occurrence is spliced and the write proceeds.** Round 2's conclusion stands.

**The comment at `:190-196` is factually correct on its own example.** Its claim is falsifiable and I falsified the alternative: for `{"host": [], "nested": {"host": "x"}}` the regex *does* match (`!m` is false — the array value fails the alternation at position 1, the engine advances and matches the nested key), the splice *does* run on the wrong occurrence, and the file survives only because `:234` rejects `[]`. Confirmed byte-identical afterwards. A maintainer reading this comment will now believe the correct thing about which guard is load-bearing, which is precisely what finding (2) asked for.

**Probe results (28 shapes, 0 failures, 0 `.tmp` residue).** Invariants asserted on every case: `"updated"` ⟺ file changed; any non-`"updated"` return ⟹ file byte-identical; `"updated"` ⟹ effective `host === "claude-code"`. Repairs correct on `""`, `null`, `false`, `0`, `42`, `1.5e-3`. Preserved byte-identical on: `"cursor"`, `"a\"b"`, top-level `[]`/`{}` values, nested-`host`-before-falsy-top-level, duplicate top-level keys, malformed JSON, top-level array/string, BOM. Decoys correctly ignored: `{"a": "host", ...}`, `{"myhost": ...}`, `{"n": ""host": 1", ...}`, and a prose value containing an escaped `\"host\": \"foo\"`. Formatting, key order and a multi-line array all preserved on the insert path; tab indentation and no-trailing-newline handled.

**SOP 4a — expected-red sampling.** The diff touches no test file but one red exists. `qa_reports/expected-red_e100-e101-dispatch-declaration.txt` is present with one entry, so all entries sampled: it resolves to a real, locatable test at `test/p0-onboarding-lite-default.test.mjs:52`, and the failure is the E100 shape change alone (`assert.deepEqual(cfg, { schema_version: 1 })` at `:66`). Full suite re-run this round: `# tests 1781 / # pass 1780 / # fail 1`, and the single `not ok 830` line is byte-identical to the manifest entry. Unchanged from round 2 — the atomicity conversion breaks nothing. `npx tsc --noEmit` exit 0, `node --check` clean, `agc check` exit 0 (`3.105.0`). No finding.

**FINDING R3-A (non-blocking — FILE A ROW; the highest-value one this round) — a symlinked or hardlinked `CLAUDE.md` is now replaced instead of written through.** This is a real behaviour regression introduced by this delta, demonstrated end-to-end, not inferred:

```
before:  CLAUDE.md -> ../dotfiles/CLAUDE.md   (symlink)
after:   CLAUDE.md                            (regular file, 1401 bytes)
         ../dotfiles/CLAUDE.md still contains the OLD block — never updated
```

`fs.readFileSync` follows the link, so `existing` is the canonical content; `fs.renameSync` then replaces the **link itself**. The old `fs.writeFileSync(target, ...)` followed the link and updated the canonical file in place. Consequences, in order of what actually bites: the adopter's canonical `CLAUDE.md` silently does **not** receive the E101 dispatch-declaration bullet — the entire point of this feature — while the detached local copy does; `agc check` then reports OK against the detached copy, so the staleness is invisible to the tool meant to surface it; and the user's symlink is destroyed without a word.

Weighed for blocking and deliberately not blocked, on these grounds: no data is destroyed (the canonical file is intact, the new content is present locally, and the state is hand-recoverable); symlink replacement is the universally accepted cost of tmp+rename and matches the cited precedent `atomicWriteConfig`; and on net this delta still *reduces* risk, because the failure it removes — a truncating write destroying unrecoverable adopter prose on `^C`/ENOSPC — is both likelier and worse than the one it adds. I note against my own conclusion that the precedent is weaker than it looks: `.current/.config.json` lives in a directory `agc init` creates and nobody symlinks, whereas a project-root `CLAUDE.md` is user-managed and *is* symlinked in dotfiles and monorepo setups. If the human considers that a supported layout, the mitigation is two lines — resolve `target` through `fs.realpathSync` (falling back to `target` on ENOENT) before deriving `tmpPath` and renaming — and it could ride along cheaply. It does not justify spending the last hop of review margin.

**FINDING R3-B (non-blocking — FILE A ROW; in-class with finding (2)'s own charter) — the new reparse-guard comment names the wrong predicate.** `:224-225` reads "since that value was **confirmed falsy** before the splice ran". The predicate actually confirmed at `:167-169` is *not* falsiness — it is "not a non-empty string". The two diverge on real, reachable inputs: `{"host": 42, ...}`, `{"host": {"a":1}, ...}` and `{"host": ["x"], ...}` are all **truthy** and all fall through to the repair path. Probed and confirmed: `{"host": {"a":1}, "n": {"host": "x"}}` splices the wrong occurrence and is rejected by `:234` with a truthy value in hand — so the comment's stated justification is literally false on exactly the case the comment exists to explain.

Why this is worth a row rather than a shrug, in a file where a comment's accuracy is the deliverable: a maintainer who believes "falsy" will read `:234` (`typeof reparsed.host !== "string" || reparsed.host.length === 0`) as a verbose spelling of `!reparsed.host` and simplify it. That simplification reopens the hole — under `!reparsed.host`, the `{"host": {"a":1}, "n": {"host": "x"}}` case passes the guard, writes a file whose top-level `host` is still `{"a":1}`, and reports `Updated`. The correct wording is "confirmed not to be a non-empty string", which is also the exact predicate `:234` tests, making the guard read as the tautology it should be. One-word class of fix, no behaviour change.

**FINDING R3-C (non-blocking — FILE A ROW) — no `.tmp` cleanup on a throw.** `atomicWriteFile` has no `try/finally`. Verified: an EACCES at the tmp `open` leaves no residue and the target intact (correct), but that is because the open failed before any bytes were written. An ENOSPC *mid-write* leaves a partial `CLAUDE.md.<pid>.<ts>.tmp` in the workspace root — a stray file that is plausibly `git add -A`'d by the next commit. `atomicWriteConfig` has the identical gap, so this is consistent with precedent rather than a new class, and the surfaced error is an unhandled stack trace either way (also pre-existing). A `try { ... } catch (e) { try { fs.rmSync(tmpPath, { force: true }); } catch {} throw e; }` closes it in the helper, benefiting both call sites.

**Verified negative, not findings.** No in-process tmp-name collision is reachable: `atomicWriteFile` is called at most once per target per run, and same-pid-same-millisecond collisions would require two calls on the same path. The tmp is always a sibling of the target, so `renameSync` never crosses a filesystem (no EXDEV path exists). `openBrace === -1` at `:206` is unreachable — a `raw` that parsed to a plain object necessarily contains `{` — so it is dead-defensive, not an undocumented return path. No `fsync` means power-loss durability is not covered, but the docblock claims only "^C, ENOSPC, crash", all of which the design does cover; not overclaimed.

## Quality

**FINDING R3-D (non-blocking — FILE A ROW) — round 2's diagnostics-channel finding is still open, and its comment still contradicts itself.** `:288-292` justifies the separate stdout bucket because "stderr is routinely discarded", and `:297-300` then puts the only specific reason on stderr with stdout pointing at it (`Not updated (rejected, see warnings)`). Confirmed live. This was flagged non-blocking in round 2 and was outside T-E100-03's stated charter, so it is correctly untouched — recording it so it does not silently drop off the list now that the round it was raised in has closed.

**FINDING R3-E (non-blocking — FILE A ROW) — the new comments cite review-round identifiers that ship to adopters.** `:94` ("T-E100-03 (1) — same class as the C3 fix below") and `:330` ("the same non-atomic-write exposure as writeClaudeBlock (T-E100-03 (1))") reference a task id and a review-finding id. `bin/agc-init.mjs` is a `bin` entry with no `files` allowlist in `package.json`, so it ships verbatim to every consumer of `npx github:...`, where "C3" and "T-E100-03" resolve to nothing — neither is discoverable from the installed package or even from the repo once `tasks.md` moves on. The surrounding comments already state the *reason* in full, so the identifiers add nothing a reader can act on. Prefer describing the hazard (which they already do well) over citing the conversation that found it.

**Minor.** (a) The `mode === "skip"` comment is eight lines documenting why a branch was *not* changed — defensible as anti-re-litigation, which sr states outright, but heavy relative to the two lines it annotates. (b) The `"created"` branch (`:82-84`) could route through the helper for uniformity, removing the need for branch-specific reasoning at all; as argued in Summary the current exclusion is sound, so this is preference, not defect. (c) Permissions: `renameSync` replaces the inode, so a hand-`chmod 600` `CLAUDE.md` comes back `0644` (verified). Round 2 recorded this as informational for `.config.json`; it now also applies to a user-managed root file. Sub-case of R3-A, same mitigation. (d) The expected-red manifest's prose cites "review_reports/review_T-E100-01.md QA-gap #7" for the AC2 point, which is QA-gap #1; #7 is the `agc check` note. Pre-existing, cosmetic.

**Positive.** The two new branch comments at `:92-96` and `:103-106` do the thing that makes an atomicity comment worth its lines: they name *what is lost* (adopter prose, unrecoverable) rather than asserting "atomic write for safety". The `:190-196` comment is the strongest in the file — it states what it is *not* the guard for, gives a concrete counterexample, and points at the guard that actually does the work. That is the correct response to finding (2), and it is verifiably true.

## Architecture

Unchanged from round 2 and still respected: `bin/agc-init.mjs` remains a standalone ESM CLI with no `tools/` import, and `atomicWriteFile` is a local mirror of `atomicWriteConfig` rather than a cross-layer import — correct for a `bin/` script that must run before `dist/` exists, and correctly annotated with the file:line it mirrors. The helper is now the single write path for every in-place mutation in the file, with the two create-if-absent paths deliberately and consistently excluded on a stated principle ("no prior content to lose"); that principle is applied uniformly across all three exclusions (`writeClaudeBlock` `"created"`, the brand-new `.config.json`, and the `mode === "skip"` adapters), which is what makes the exclusions read as a decision rather than an oversight. No architecture spec for this feature; backlog rows remain the spec. `test/` untouched, as scoped.

## Security

**sr's `mode === "skip"` claim (`:330-337`) is verified, not accepted.** Checked structurally: `ADAPTERS` (`:32-36`) gives `mode: "skip"` to exactly `AGENTS.md` and `.antigravityrules`; the branch's sole write (`:343`) is preceded by an unconditional `if (fs.existsSync(abs)) { skipped.push(rel); continue; }` at `:339-342`, with no other write reachable in that branch. Checked behaviourally: a workspace with pre-existing `AGENTS.md` and `.antigravityrules` came back with both files byte-identical and both in the `Skipped (already exists)` bucket. **The claim is true and the comment is accurate.** The residual TOCTOU between `existsSync` and `writeFileSync` is pre-existing, identical to the `"created"` path, and unfixable by atomicity — `renameSync` would clobber a concurrently-created file just as `writeFileSync` does.

Otherwise no findings, and nothing in this delta changes the round-2 analysis: no new input crosses a trust boundary, the only text spliced into a config is the constant `'"claude-code"'`, and `hasOwnProperty` is still correctly invoked via `Object.prototype.call`. One new item, minor and already covered above: the tmp+rename resets the target's mode to the umask default, so a deliberately restricted `CLAUDE.md` (`0600`) is silently widened to `0644` — a permission widening rather than merely cosmetic, though on a file whose content is project instructions, not secrets. Same row as R3-A. The tmp file is created as a sibling with a pid+timestamp name and renamed immediately; no `/tmp` or symlink-following surface is introduced on the *write* side.

## Performance

No findings. The delta adds one extra `writeFileSync` + one `renameSync` per mutated adapter file, on a command run interactively at workspace setup, against files measured in single-digit KB. No loop, no complexity-class change, no retained references. Comment volume grew by roughly 40 lines with zero runtime cost.

## QA gaps for T-E100-02 — additions from this round

Carried forward from rounds 1-2, plus these. Pins for qa, not blockers on sr:

8. **Pin `CLAUDE.md` prose survival across both mutating branches** — an existing file *with* the marker block (`"updated"`) and *without* it (`"appended"`), each carrying adopter prose above and below. Assert the prose is byte-preserved and that no `CLAUDE.md.*.tmp` remains in the workspace root. This delta added the atomicity but no test pins it; round 2's residue gap (#5) covered `.current/` only.
9. **Decide and pin the symlink disposition (R3-A).** Whichever way the human calls it, pin it: either `agc init` writes through a symlinked `CLAUDE.md` (canonical file updated, link intact), or it deliberately replaces it. Today it silently replaces, and the canonical file never receives the E101 bullet.
10. **Pin the truthy-but-unusable repairs alongside the falsy ones** (gap #3 covers `""`/`null`/`false`/a number). Add `{"host": 42}` → repaired, and `{"host": {"a":1}, "n": {"host": "x"}}` → rejected byte-identical. The second is the case that proves the reparse guard rather than `!m` is load-bearing, and it is the case R3-B's wording would invite a future maintainer to break.
11. **Pin the `Not updated (rejected, see warnings)` stdout line and the warning text as a pair** — the disposition is the guarantee; if R3-D is later taken, the split between the two channels changes and the test should be the thing that notices.

## Verdict

**APPROVED** — both round-2 findings are genuinely closed: the atomicity fix is correctly extended to the `"appended"` branch (in-class per round 2's own text) with a sound `"created"` exclusion, and the honesty rewrite is accurate where it matters most, on which guard is load-bearing. Round 2's reparse-guard proof was re-derived from first principles and re-probed across 28 shapes with zero failures, so the new comments rest on a proof I independently confirmed rather than on a prior round's word. Six findings, all file-a-row and none must-fix-before-QA; the one behaviour regression (R3-A, symlink replacement) is real and demonstrated, and is not blocked only because this delta still reduces net risk and the mitigation is a cheap follow-up — not because of the hop budget.

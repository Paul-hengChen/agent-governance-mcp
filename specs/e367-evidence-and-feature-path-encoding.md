# e367-evidence-and-feature-path-encoding — E367 + E368

Lane `e367`, post-v4 wave 12 (`specs/fanout-post-v4-w12.md`). Branch `feat/e367-evidence-and-feature-path-encoding`, base `f5485a7`. Two tickets, both follow-ups to E136's injective task-id encoding: E367 reads the encoding back, and E368 applies the same idea to `active_feature` paths.

## Problem Statement

- **E367.** E136 made every task-id evidence filename `review_<encodeEvidenceId(id)>.md`. `tools/lane-status.ts` `passEvidenceIdsIn` still reads the id back as the raw stem (`REVIEW_FILE_RE = /^review_(.+)\.md$/`). For a canonical id (`T-<TICKET>-NN`) the stem is the id, so nothing breaks. For a non-canonical id (lower-case, `_`, `/`, space, non-ASCII) the stem is the encoded form, for example `review__T-_E900-01.md` for `t-e900-01`. lane-status then cannot match the stem to the ledger id, and a task with real PASS evidence shows up as `claimedWithoutEvidence`.
- **E368.** `specFilePath` (`gates/ac-execution.ts`), `expectedRedManifestPath` (`gates/expected-red.ts`) and `designFilePath` (`gates/visual.ts`) each map `active_feature` through `replace(/[^A-Za-z0-9._-]/g, "_")` and then `replace(/\.\.+/g, "_")`. This is the same lossy projection E136 removed for task ids. Two feature names that differ only in case (`Foo` and `foo` on APFS/NTFS), or only in characters the sanitiser rewrites (`a/b`, `a b`, `a_b`, `a..b`), resolve to one spec, design or manifest file. One feature's file then arms or satisfies another feature's gate.

## User Stories

- As the integrator running `lane-status`, I want PASS evidence for a non-canonical task id to count for that id, so that the evidence count matches what the gates accept.
- As a lane running a feature, I want my feature's spec, design and expected-red manifest never to be another feature's file, so that the AC-execution, visual and repro-first gates arm on my own artifacts.
- As an adopter with shipped `specs/`, `design/` and `qa_reports/expected-red_*.txt`, I want every canonical (lower-case slug) path to stay byte-identical, so that nothing I have shipped has to move.

## Design decisions (per ticket)

### E367 — `decodeEvidenceId`, a strict inverse, with a raw-stem fallback in lane-status

- **Shape.** Add `export function decodeEvidenceId(stem: string): string | null` next to `encodeEvidenceId` in `tools/evidence-file.ts`. It reads the stem left to right, one token at a time:

  | stem token | decodes to |
  |---|---|
  | one of `[A-Z0-9.-]` | itself |
  | `_` followed by `[A-Z]` | that letter in lower case |
  | `__` followed by exactly 4 characters of `[0-9A-F]` | the UTF-16 code unit with that value, **only if** the unit is outside `[A-Za-z0-9.-]` |
  | anything else (a lower-case letter, any other character, a lone `_`, `_` followed by a digit, `.` or `-`, a short or lower-case hex run, or a hex escape of a character the encoder would have kept literal or `_`-escaped) | the whole stem is not decodable → `null` |

- **Contract.** `decodeEvidenceId` returns a non-null value exactly for the stems `encodeEvidenceId` can produce: `decodeEvidenceId(encodeEvidenceId(id)) === id` for every string, and `decodeEvidenceId(s) !== null` implies `encodeEvidenceId(decodeEvidenceId(s)) === s`. It is pure, total and never throws. The empty stem decodes to `""`, though `REVIEW_FILE_RE` never yields one.
- **Why strict.** A lenient decoder, for example one that accepted lower-case hex or `__0041`, would map two different file names to one id. That reintroduces, on the read side, the collision E136 removed on the write side.
- **lane-status use.** In `passEvidenceIdsIn`, the id taken from a `review_<stem>.md` file becomes `decodeEvidenceId(stem) ?? stem`. `covers:` ids are raw ids and are not decoded. Nothing else in lane-status changes.
- **Why fall back to the raw stem rather than skip (finding 4).** Pre-E136 evidence files were named with the old sanitiser, which was the identity on `[A-Za-z0-9._-]`. Such a stem is the id itself, and it is often not decodable: `qa_reports/review_b8.md`, `review_c9-protocol-fields.md`, and the `test/e177b-lane-status.test.mjs` fixtures `T-E908-03-failonly`, `T-E908-04-failthenpass` and `T-E908-02-archived` all contain lower-case letters. lane-status counts these today.
  - **Skip** would silently drop that evidence and turn green lanes red.
  - **Raw fallback** keeps today's behaviour exactly for every stem the new encoder could not have written. It also keeps lane-status inside its never-throw, read-as-no-evidence contract, because the decoder never throws and every stem yields exactly one id.
  - A fallback id cannot be mistaken for an encoder-written file of a different id: a non-decodable stem is not in the encoder's image.
- **Known limitation (accepted, recorded).** A pre-E136 stem that happens to be decodable is read as the modern decoding. One shipped file has such a stem: `qa_reports/archive/release-v4.6.0/review_E295_T-E295-01-05.md` decodes to `E295t-E295-01-05`. That file sits in a released archive, and its ids reach lane-status through its `covers:` line, which is not decoded. The live gates already stopped accepting such legacy names when E136 shipped without a fallback, so lane-status now agrees with them.

### E368 — one shared helper `encodeFeatureStem`, a case-mirrored variant of the E136 encoding

- **Shape.** Add `export function encodeFeatureStem(activeFeature: string): string` to `tools/evidence-file.ts`. All three sites use it: `specs/${encodeFeatureStem(f)}.md`, `qa_reports/expected-red_${encodeFeatureStem(f)}.txt` and `design/${encodeFeatureStem(f)}.md`. The function names, their signatures and their export status stay as they are (`designFilePath` stays module-private).
  - **Why `tools/evidence-file.ts`.** It already holds `encodeEvidenceId` and imports nothing from `gates/`. Now that the helper has three consumers, the A2 shared-helper placement rule puts it in a shared module, and this reverses the single-consumer relocation noted at `designFilePath`.
- **Encoding table** (one UTF-16 code unit at a time, index `i` in a string of length `n`):

  | input unit | output |
  |---|---|
  | `[a-z0-9-]` | unchanged |
  | `.` with `0 < i < n-1`, and neither neighbour is `.` (an isolated interior dot) | unchanged |
  | `[A-Z]` | `_` + the lower-case letter |
  | anything else, including `_`, `/`, `\`, space, NUL, `:`, every non-ASCII unit, and any `.` that is leading, trailing or next to another `.` | `__` + the unit as exactly 4 **lower-case** hex digits |

  Examples: `Foo` → `_foo`, `foo_bar` → `foo__005fbar`, `a/b c` → `a__002fb__0020c`, `..feat` → `__002e__002efeat`, `f..oo` → `f__002e__002eoo`, `...` → `__002e__002e__002e`, `foo.` → `foo__002e`, `.foo` → `__002efoo`, `E260E` → `_e260_e`, `feat.v2` → `feat.v2`, `wave1.5-content-catchup` → unchanged.
- **Identity set (finding 1).** The output equals the input exactly when the input matches `^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*)?$`: lower-case slug segments joined by single dots, with no leading, trailing or doubled dot. The empty string maps to itself, as it does today.
  - The old sanitiser is also the identity on this set, so every canonical path is byte-identical before and after the change.
- **Why not reuse `encodeEvidenceId` verbatim.** Its identity set is `[A-Z0-9.-]` and it escapes lower case as `_X`. Every lower-case feature slug would move (`e367-foo` → `_E367-_F_O_O`), which breaks the hard condition.
  - The case-mirrored table keeps the same structure but swaps the roles of the two cases: lower case is the identity, upper case is `_`-escaped, and the hex digits are lower case. The output therefore never contains an upper-case letter.
- **Injective.** `_` only ever starts an escape token, and the character after it says which kind: a letter for a case escape, `_` for a hex escape. The output therefore splits into tokens in exactly one way, and each token decodes to exactly one input unit. Whether a dot is escaped depends on its context, but both the escaped and the literal dot decode to `.`, so injectivity holds regardless.
- **Case-fold-safe.** The output alphabet is `[a-z0-9._-]`, with no upper-case letter. Two distinct outputs therefore also differ under case folding. Every non-ASCII unit is hex-escaped, so APFS Unicode normalisation cannot merge two outputs either.
- **`..` guard (finding 2), strictly stronger than today.**
  - A literal dot is emitted only when both input neighbours are non-dot units. Each neighbour's encoding ends in `[a-z0-9-]` or a hex digit on the left, and starts with `[a-z0-9-]` or `_` on the right.
  - The output therefore never contains `..`, never starts or ends with `.`, can never be `.` or `..`, and has no `/`, `\`, NUL or `:`.
  - Because no stem ends with `.`, the full file names `<stem>.md` and `expected-red_<stem>.txt` contain no `..` either. Today, `foo.` produces `specs/foo..md`.
  - Each resolved path's parent directory is exactly `specs/`, `qa_reports/` or `design/`.
- **Shipped names (finding 3).** Inventory at base `f5485a7`:
  - all 307 `specs/*.md` basenames, including the 28 dotted ones such as `release-v4.6.0`, `fanout-wave7.2b` and `constitution-v3.5.1-rule-completeness`;
  - all 73 `qa_reports/**/expected-red_*.txt`, including archives;
  - no `design/` directory exists.
  - Every name is in the identity set, and a prototype run of the new helper over all 380 names moved 0 of them. **No shipped file moves.**
- **No legacy-path fallback.** E136 also shipped without one. A read fallback to the old sanitised path would re-create exactly the sharing E368 removes, because on a case-insensitive filesystem `specs/Foo.md` is `specs/foo.md`. See NHR-1 for what this means for non-canonical names.
- **Rejected alternatives:**
  - Escaping every dot: moves the 28 dotted specs.
  - Keeping leading and trailing dots literal: allows a hidden file or a `..md` file name.
  - Upper-case hex: mixes cases in the output, which loses case-fold safety.
- **Not touched.** `tools/handoff-write.ts`'s archive-name sanitiser is out of ticket scope. `tools/lane-status.ts`'s cut-pre-review check reads `specs/${feature}.md` by raw name. It mirrors the writer convention, not the gate, and it stays unchanged (see NHR-1 and `E368-NEW-1`).

## Acceptance Criteria

Test names below are what qa creates; `<base>` is `f5485a7`.

### E367

- **AC-E367-1** — Given a generated corpus of ids (canonical `T-E900-01`, lower case, `_`, `/`, space, `:`, NUL, non-ASCII, a lone surrogate, the empty string, every string of length ≤ 3 over a mixed alphabet), when each is encoded then decoded, then `decodeEvidenceId(encodeEvidenceId(id)) === id`.
  proof: `node --test --test-name-pattern="AC-E367-1" test/e367-lane-status-decode.test.mjs` passes.
- **AC-E367-2** — Given stems that the encoder cannot produce, `decodeEvidenceId` returns `null` and does not throw. The stems are `t01`, `_`, `_1`, `__00`, `__005f`, `__0041`, `__002E`, `__002D`, `T-E260G-09 T-E260G-10` and `b8`. And for every stem `s` in the AC-E367-1 corpus outputs plus these stems, `decodeEvidenceId(s) !== null` implies `encodeEvidenceId(decodeEvidenceId(s)) === s`.
  proof: `node --test --test-name-pattern="AC-E367-2" test/e367-lane-status-decode.test.mjs` passes.
- **AC-E367-3** — Given a lane worktree fixture whose `qa_reports/` holds PASS files written at `review_${encodeEvidenceId(id)}.md` for the non-canonical ids `t-e900-01`, `T-E900_02` and `T-E900/03`, when `checkLaneEvidence` runs with those ids in `completed_tasks`, then `evidenceIds` contains all three raw ids and `claimedWithoutEvidence` is empty. The same holds for a file under `qa_reports/archive/<feature>/`.
  proof: `node --test --test-name-pattern="AC-E367-3" test/e367-lane-status-decode.test.mjs` passes.
- **AC-E367-4** — Given a PASS file with a non-decodable legacy stem (`review_t-e900-04.md`), when `checkLaneEvidence` runs with `t-e900-04` claimed, then it credits `t-e900-04`, as it does before this change. `test/e177b-lane-status.test.mjs` stays green and unmodified.
  proof: `node --test --test-name-pattern="AC-E367-4" test/e367-lane-status-decode.test.mjs` passes, and `git diff <base> -- test/e177b-lane-status.test.mjs` is empty.
- **AC-E367-5** — Given a canonical id `T-E900-05` with a PASS file `review_T-E900-05.md`, it is credited exactly as before. Given a FAIL-only file at an encoded non-canonical stem, it credits nothing.
  proof: `node --test --test-name-pattern="AC-E367-5" test/e367-lane-status-decode.test.mjs` passes.
- **AC-E367-6** — `tools/lane-status.ts` imports `decodeEvidenceId` from `./evidence-file.js`, and `passEvidenceIdsIn` does not add a raw `m[1]` without first trying the decoder (source pin).
  proof: `node --test --test-name-pattern="AC-E367-6" test/e367-lane-status-decode.test.mjs` passes.

### E368

- **AC-E368-1** — `encodeFeatureStem` implements the encoding table and every example in the E368 design section exactly.
  proof: `node --test --test-name-pattern="AC-E368-1" test/e368-feature-path-injective.test.mjs` passes.
- **AC-E368-2** — Given a fixed in-test list of canonical names (`e367-foo`, `release-v4.6.0`, `wave1.5-content-catchup`, `fanout-wave7.2b`, `v3.15.0-architecture`, `a`, `0`, `-`), then `encodeFeatureStem(n) === n`. Each of `specFilePath`, `expectedRedManifestPath` and `designFilePath` (via the returned `designPath` of `hasVisualBaselinesInDesign`) also equals the path the pre-change sanitiser gives, which the test computes itself. And for a generated corpus, `encodeFeatureStem(s) === s` holds iff `s` matches `^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*)?$`.
  proof: `node --test --test-name-pattern="AC-E368-2" test/e368-feature-path-injective.test.mjs` passes.
- **AC-E368-3** — Given a generated corpus (every string of length ≤ 3 over an alphabet that includes `a`, `A`, `z`, `Z`, `0`, `.`, `-`, `_`, `/`, `\`, space, `é`, NUL, `:` and a lone surrogate), the following hold:
  - distinct inputs give distinct outputs;
  - distinct inputs give outputs that are still distinct after `toLowerCase()`;
  - every output matches `^[a-z0-9._-]*$`.

  proof: `node --test --test-name-pattern="AC-E368-3" test/e368-feature-path-injective.test.mjs` passes.
- **AC-E368-4** — Given the same corpus plus the hostile names `..`, `.`, `../../../etc/passwd`, `a/..`, `C:\\x`, `foo.` and `.foo`, then:
  - no output contains `..`, starts or ends with `.`, or equals `.` or `..`;
  - `path.dirname` of each of the three resolved paths is exactly `<ws>/specs`, `<ws>/qa_reports` or `<ws>/design`;
  - no resolved base name contains `..`.

  proof: `node --test --test-name-pattern="AC-E368-4" test/e368-feature-path-injective.test.mjs` passes.
- **AC-E368-5** — Given the colliding pairs `Foo`/`foo`, `a_b`/`a/b`/`a b`, `a..b`/`a_b` and `..feat`/`_feat`, then each of the three path functions returns distinct paths within each group. End to end, in a temporary workspace:
  - `specs/foo.md` carries a `proof:` line, yet `hasProofAnnotatedAC(ws, "Foo").armed === false`;
  - `qa_reports/expected-red_foo.txt` exists, yet `hasExpectedRedManifest(ws, "Foo").present === false`;
  - `design/foo.md` declares `mode: figma`, yet `hasDesignModeRequiringVisual(ws, "Foo").required === false`;
  - the lower-case feature `foo` still arms all three.

  proof: `node --test --test-name-pattern="AC-E368-5" test/e368-feature-path-injective.test.mjs` passes.
- **AC-E368-6** — One helper. `gates/ac-execution.ts`, `gates/expected-red.ts` and `gates/visual.ts` each import `encodeFeatureStem`. None of them still contains `activeFeature` followed by `.replace(`, and none keeps the `/[^A-Za-z0-9._-]/g` or `/\.\.+/g` sanitiser literal (source pin).
  proof: `node --test --test-name-pattern="AC-E368-6" test/e368-feature-path-injective.test.mjs` passes.
- **AC-E368-7** — No shipped file moves. This is a one-shot verification, not a resident test, because the real directories grow. A script over `specs/*.md` basenames, every `qa_reports/**/expected-red_*.txt` and `design/*.md` if present reports `moved 0` on the final HEAD. qa quotes the command and its output in the QA report.
  proof: ``node --input-type=module -e 'import fs from "fs";import path from "path";import {encodeFeatureStem} from "./dist/tools/evidence-file.js";const n=[];for(const f of fs.readdirSync("specs"))if(f.endsWith(".md"))n.push(f.slice(0,-3));if(fs.existsSync("design"))for(const f of fs.readdirSync("design"))if(f.endsWith(".md"))n.push(f.slice(0,-3));const w=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(/^expected-red_.*\.txt$/.test(e.name))n.push(e.name.slice(13,-4));}};w("qa_reports");const m=n.filter(x=>encodeFeatureStem(x)!==x);console.log("checked",n.length,"moved",m.length,m)'`` prints `moved 0 []`.
- **AC-E368-8** — SQLite/HTTP behaviour unchanged, and no `schema_version` bump: no storage, schema or handoff-write code is touched.
  proof: `git diff --stat <base>..HEAD -- schema tools/storage.ts tools/storage-sqlite.ts tools/handoff-write.ts tools/handoff-orchestrator.ts` prints nothing.

### Lane-level

- **AC-L1** — The test diff is exactly the two new files plus the four re-pins named in the hit table, and each re-pin changes only the named assertion(s).
  proof: `git diff --name-only <base>..HEAD -- test/` lists exactly `test/e367-lane-status-decode.test.mjs`, `test/e368-feature-path-injective.test.mjs`, `test/e136-evidence-path-injective.test.mjs`, `test/ac-execution.test.mjs`, `test/gates-expected-red.test.mjs` and `test/visual-evidence-gate.test.mjs`.
- **AC-L2** — On the final HEAD, with a clean tree and no untracked files, the full suite is green.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0, and the qa report quotes the pass/fail counts.
- **AC-L3** — `dist/` is in sync.
  proof: `npm run build` followed by `git status --porcelain dist/` prints nothing.
- **AC-L4** — Scope.
  proof: `node scripts/fanout.mjs check --cut specs/fanout-post-v4-w12.md e367 specs/e367-evidence-and-feature-path-encoding.md` exits 0 on the final HEAD.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no user-facing string is introduced or changed. Error texts already interpolate the resolved path (`Expected repro manifest at ${manifest.manifestPath}`), and lane-status output formats are unchanged |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `tools/handoff-write.ts` archive-name sanitising (`qa_reports/archive/<name>/`), and E184.
- Any change to how roles *write* `specs/<feature>.md`, `design/<feature>.md` or `qa_reports/expected-red_<feature>.txt`. That convention lives in `content/**` (e152 this wave) and `tools/handoff-orchestrator.ts` (e161). It is filed as `E368-NEW-1`.
- `tools/lane-status.ts`'s cut-pre-review spec lookup (`specs/${feature}.md`, raw), which stays aligned with the writer convention, not the gate.
- A decoder for `encodeFeatureStem`: no reader maps a feature file name back to a feature (YAGNI).
- Windows reserved device names (`con`, `nul`, …) as feature names: pre-existing, unchanged, and not a collision.
- Gate error codes, `gates/registry.ts`, `gates/qa-review.ts`, `gates/code-review.ts`: untouched.

## Dependencies / Prerequisites

- Base `f5485a7`. Mode `no-design` (no `design/e367-evidence-and-feature-path-encoding.md`), so Visual Structural Assertions are omitted.
- Resource Audit: backlog rows E367, E368 and E136 and the manifest row reference no external artifact (no URL, Figma, mockup or ticket system), so `external_refs` is omitted.
- **No architect hop.** The encoding tables, the identity set, the fallback rule and the helper placement are all decided above. E368 touches four modules, but only to replace one sanitiser with one shared call, and it adds no data model or API.
- `dispatch_mode` stays `feature`. The qa tests double as the reproductions.
- **Serial order for sr:** T-E367-01 → T-E368-01. Both edit `tools/evidence-file.ts`, so this is never parallel. Each sr task rebuilds and commits its own `dist/` outputs, which are not counted against `task_size`.
- **Prototype.** In a scratch copy at base, the exact helpers above were built with `tsc`. The prototype ran 26 test files, every test that reads spec, design or expected-red paths or lane-status evidence: 690 tests, 4 new failures, which are exactly the four re-pins below. A property run (4369 generated strings) found 0 round-trip, collision, case-fold, alphabet or dot violations, and 0 of 380 shipped names moved.
- **Existing tests checked against this change.** The manifest's named list, plus everything found by grepping `test/` for the three path functions, their arm helpers, `expected-red_`, `design/`, `specs/` and the sanitiser literals:

  | test file | hit? | assertion that changes |
  |---|---|---|
  | `test/e136-evidence-path-injective.test.mjs` | **hit** | `AC-E136-7` pins the old lossy sanitiser, which E368 deliberately reverses. Re-pin it to: canonical names unchanged, and `a/b c` / `..feat` / `lower-Case` mapped to their `encodeFeatureStem` forms (`a__002fb__0020c`, `__002e__002efeat`, `lower-_case`). The `visual.ts` source-literal pins become an `encodeFeatureStem` pin. The title text changes accordingly |
  | `test/ac-execution.test.mjs` | **hit** | `U6`: `endsWith("_feat.md")` → `endsWith("__002e__002efeat.md")`. The `!includes("..")` half stays. Title text "collapse to `_`" → "are escaped" |
  | `test/gates-expected-red.test.mjs` | **hit** | `U5`: `endsWith("_feat.txt")` → `endsWith("__002e__002efeat.txt")`. Same title change |
  | `test/visual-evidence-gate.test.mjs` | **hit** (manifest clause 「其他讀 spec／design／expected-red 路徑的 `test/**`」) | `v3.14.1 AC-3`: the three `endsWith` expectations `_feat.md` / `f_oo.md` / `_.md` → `__002e__002efeat.md` / `f__002e__002eoo.md` / `__002e__002e__002e.md`. The `!includes("..")` halves stay. Nothing else in the file changes (its `AC-5` comment mentions the old regex but asserts only the absence of `/evil/`, which still holds) |
  | `test/e177b-lane-status.test.mjs` | not hit (must stay unmodified) | fixtures use raw stems: canonical, or non-decodable lower-case suffixes → raw fallback |
  | `test/baseline-manifest-gate.test.mjs`, `test/repro-first-gate.test.mjs` | not hit | canonical feature names; the traversal case asserts dormancy only. `repro-first` writes through `expectedRedManifestPath`, so it follows the helper |
  | `test/e23-evidence-schema.test.mjs`, `test/pixel-gate-attestation.test.mjs`, `test/source-credibility-gate.test.mjs`, `test/visual-gate-e2e.test.mjs`, `test/visual-report-schema-validation.test.mjs`, `test/widget-shape-spec.test.mjs`, `test/pixel-perfect-visual-compare.test.mjs`, `test/phase-0-5-sop.test.mjs`, `test/qa-flow.test.mjs`, `test/e128-*.test.mjs`, `test/e236-rejected-write-evidence.test.mjs`, `test/agc-feature-lifecycle.test.mjs`, `test/e178b-lane-watch.test.mjs`, `test/e178b-cut-prereview.test.mjs`, `test/covering-evidence.test.mjs`, `test/e35-pipeline-order.test.mjs` | not hit | canonical feature names, or no feature-path assertion |
  | `test/context-budget.test.mjs`, `test/compose-equivalence.test.mjs`, `test/fixtures/compose-golden/**` | not hit | no `content/**` or prompt change. `AC8`'s `hasDesignModeRequiringVisual` import pin is kept |
  | `test/e116-archive-on-feature-change.test.mjs` | not hit | pins `tools/handoff-write.ts`'s archive sanitiser, which is out of scope |

  If the full suite shows any other red, sr or qa stops and reports to the coordinator for integrator re-check. Such a test is not re-pinned silently.
- **Other readers of these paths (finding 5).** These derive or read the paths outside the owned files:

  | site | how it gets the path | disposition |
  |---|---|---|
  | `tools/handoff-orchestrator.ts` (REPRO_MANIFEST_MISSING, visual arm, expected-red disposition) | calls `hasExpectedRedManifest` / `hasDesignModeRequiringVisual` | inherits the helper; no own sanitiser; no change |
  | `prompts/build.ts:425` (design arm in the prompt) | calls `hasDesignModeRequiringVisual` | inherits; no change |
  | `tools/lane-status.ts` cut-pre-review (`specs/${feature}.md`) | raw name, guarded by `isSafeArchiveSegment` | mirrors the writer convention; unchanged; covered by `E368-NEW-1` |
  | `tools/handoff-write.ts:452` | own archive-name sanitiser (`-` replacement) | out of ticket scope (manifest) |
  | `tools/fanout-manifest.ts` (`specs/${lane}-*.md`) | lane name, not feature | unrelated; no change |
  | `scripts/capture-constitution-golden.mjs` | writes `design/cnso-golden-feat.md` | canonical constant; unchanged path |
  | `content/**` role SOPs (`specs/<feature>.md`, `design/<feature>.md`, `qa_reports/expected-red_<feature>.txt`) | prose, raw name | writer convention; see NHR-1 / `E368-NEW-1` |
  | `bin/agc-init.mjs` | directory names only (`specs`, `design`) | unrelated |
- **NHR-1 — needs human ruling: the writer convention for non-canonical feature names.**
  - **The problem.** For a canonical name, writer and gate agree before and after E368. For a non-canonical name made only of `[A-Za-z0-9._-]` (upper case, `_`, a doubled dot), today's sanitiser is the identity, so a role that writes `specs/Foo.md` per SOP prose is read by the gate at the same path. After E368 the gate reads `specs/_foo.md`. The file written at the raw name is no longer found:
    - the AC-execution gate and the visual arm read absence as "not armed" (fail-open);
    - REPRO_MANIFEST_MISSING blocks, citing the encoded path in its text (fail-closed, with a pointer).
  - **Why this lane cannot close it.** This is inherent to the ticket. On a case-insensitive filesystem, `Foo` and `foo` cannot both keep their raw path and stay distinct, and the hard condition fixes `foo`. Closing the gap needs a write-side change (`content/**` or `tools/handoff-orchestrator.ts`), which is forbidden to this lane.
  - **Exposure.** 0 shipped files. 1 of 84 historical `active_feature` values in `.current/` is non-canonical (`E260E`), and it has no spec, design or manifest file.
  - **Options.**
    - **(A) Recommended:** ship E368 as cut and file `E368-NEW-1`, a write-side follow-up in a later wave. Candidates: reject or canonicalise a non-canonical `active_feature` at `tw_update_state`, or surface the resolved paths in `tw_get_state`, or state the encoded name in the SOP prose.
    - **(B)** Hold E368 (ship E367 alone) until that write-side ticket lands, and fold E368 into it.
- **R2 — scope grant to confirm at pre-review:** `test/visual-evidence-gate.test.mjs` is not named in the manifest's 擁有 list. It falls under the 「其他讀 spec／design／expected-red 路徑的 `test/**`（只限被本 lane 改變的行為斷言，cut 裡逐一列名，預審核對）」 clause, and it is named here with its one changed test (`v3.14.1 AC-3`).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E367-01 | sr (E367): add `export function decodeEvidenceId(stem): string \| null` to `tools/evidence-file.ts` directly under `encodeEvidenceId`, as the strict inverse in the E367 table, with a comment block that mirrors the encoder's. In `tools/lane-status.ts` import it and make `passEvidenceIdsIn` add `decodeEvidenceId(m[1]) ?? m[1]`; update the function's doc comment (decoded stem, raw-stem fallback for pre-E136 names). Nothing else in lane-status changes. Rebuild `dist/`. ~45 lines | none | 2 (+dist) | `tools/evidence-file.ts`、`tools/lane-status.ts`、`dist/tools/evidence-file.*`、`dist/tools/lane-status.*` | — |
| T-E368-01 | sr (E368): add `export function encodeFeatureStem(activeFeature): string` to `tools/evidence-file.ts` per the E368 table (lower-case hex, isolated-interior-dot rule), with a comment block stating the identity set and the injective, case-fold and `..` properties. Replace the two-`replace` sanitiser in `specFilePath`, `expectedRedManifestPath` and `designFilePath` with `encodeFeatureStem(activeFeature)`, and rewrite the three stale sanitiser comments (including the `designFilePath` "relocated, single consumer" note). Names, signatures and export status are unchanged. Rebuild `dist/`. ~70 lines | T-E367-01 | 4 (+dist) | `tools/evidence-file.ts`、`gates/ac-execution.ts`、`gates/expected-red.ts`、`gates/visual.ts`、`dist/tools/evidence-file.*`、`dist/gates/ac-execution.*`、`dist/gates/expected-red.*`、`dist/gates/visual.*` | — |
| T-E367-02 | qa (E367): new `test/e367-lane-status-decode.test.mjs` (AC-E367-1..6), with fixtures built in temporary workspaces and no assertions on real `qa_reports/` contents | T-E367-01 | 1 | `test/e367-lane-status-decode.test.mjs` | — |
| T-E368-02 | qa (E368): new `test/e368-feature-path-injective.test.mjs` (AC-E368-1..6), with a fixed in-test canonical list and a generated corpus | T-E368-01 | 1 | `test/e368-feature-path-injective.test.mjs` | — |
| T-E368-03 | qa (E368 re-pins + lane verification): change only the assertions in the hit table: `test/e136-evidence-path-injective.test.mjs` AC-E136-7, `test/ac-execution.test.mjs` U6, `test/gates-expected-red.test.mjs` U5, `test/visual-evidence-gate.test.mjs` v3.14.1 AC-3 (R2). Then, on the final HEAD, run AC-E368-7, AC-E368-8 and AC-L1..L4, with the full suite under `node scripts/test-lock.mjs -- npm test` | T-E367-02, T-E368-02 | 4 | `test/e136-evidence-path-injective.test.mjs`、`test/ac-execution.test.mjs`、`test/gates-expected-red.test.mjs`、`test/visual-evidence-gate.test.mjs` | — |

## Findings filed

Recorded in `.current/e367/pending-tickets.md`:

- `E368-NEW-1`: the role-side writer convention for `specs/` / `design/` / `expected-red_` uses the raw `active_feature`, which diverges from the gates' encoded path for non-canonical names after E368 (see NHR-1).

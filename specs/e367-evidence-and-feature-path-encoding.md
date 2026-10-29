# e367-evidence-and-feature-path-encoding — E367 (E368 deferred)

Lane `e367`, post-v4 wave 12 (`specs/fanout-post-v4-w12.md`). Branch `feat/e367-evidence-and-feature-path-encoding`, base `f5485a7`. The manifest assigned E367 and E368, both follow-ups to E136's injective task-id encoding. By human ruling B (2026-10-29, see Decisions), this lane ships **E367 only**. E368's design is kept below under **Deferred (E368, ruled B 2026-10-29)** for the follow-up ticket to reuse. The feature id and file name keep their original wording so that the handoff, the ledger and the pre-review thread stay anchored to one name.

## Decisions

| date | who | decision | rationale |
|---|---|---|---|
| 2026-10-29 | human (coordinator's chat), NHR-1 = **B** | Ship E367 only in wave 12. Defer E368 and merge it with the write-side follow-up `E368-NEW-1` in a later wave that may touch `content/**`. | E368 on its own would make the gates read an encoded feature path while the role SOPs still write by raw name. A non-canonical `active_feature` would then silently disarm the AC-execution gate and the visual arm (fail-open). The write-side fix is forbidden to this lane, so the read side and the write side have to land together. |
| 2026-10-29 | integrator (pre-review of `28dee4a`, closed) | Narrow the cut to a strict subset of `28dee4a`: drop T-E368-01 and T-E368-02 and every E368 AC. The final verification task keeps only what E367 needs. | Consequence of ruling B. No E368 code, test or re-pin may land in this lane. |
| 2026-10-29 | pm | The verification task is re-cut as **T-E367-03**. T-E368-03 is voided, not renamed. | Its remaining scope is E367-only. An `E368` ticket token on an E367 task would also misattribute evidence in lane-status's ticket-token scope (`idCarriesTicketToken`), and E117/E120 prefer a fresh id over reusing a voided one. |
| 2026-10-29 | pm | E367 needs no re-pin of any existing test. `AC-E136-7` stays as is. | E367 changes no path and no existing assertion: it only reads stems back. `AC-E136-7` pins the `active_feature` sanitisers, which stay byte-unchanged now that E368 is deferred. A prototype at base (26 test files, every lane-status, evidence-path and feature-path test) had 0 failures attributable to the E367 change. |

## Problem Statement

E136 made every task-id evidence filename `review_<encodeEvidenceId(id)>.md`. `tools/lane-status.ts` `passEvidenceIdsIn` still reads the id back as the raw stem (`REVIEW_FILE_RE = /^review_(.+)\.md$/`).

- For a canonical id (`T-<TICKET>-NN`) the stem is the id, so nothing breaks.
- For a non-canonical id (lower case, `_`, `/`, space, non-ASCII), the stem is the encoded form, for example `review__T-_E900-01.md` for `t-e900-01`. lane-status then cannot match the stem to the ledger id, so a task with real PASS evidence shows up as `claimedWithoutEvidence`.

## User Stories

- As the integrator running `lane-status`, I want PASS evidence for a non-canonical task id to count for that id, so that the evidence count matches what the gates accept.

## Design decisions

### E367 — `decodeEvidenceId`, a strict inverse, with a raw-stem fallback in lane-status

- **Shape.** Add `export function decodeEvidenceId(stem: string): string | null` next to `encodeEvidenceId` in `tools/evidence-file.ts`. It reads the stem left to right, one token at a time:

  | stem token | decodes to |
  |---|---|
  | one of `[A-Z0-9.-]` | itself |
  | `_` followed by `[A-Z]` | that letter in lower case |
  | `__` followed by exactly 4 characters of `[0-9A-F]` | the UTF-16 code unit with that value, **only if** the unit is outside `[A-Za-z0-9.-]` |
  | anything else | the whole stem is not decodable → `null` |

  "Anything else" covers a lower-case letter, any other character, a lone `_`, `_` followed by a digit, `.` or `-`, a hex run that is short or lower case, and a hex escape of a character the encoder would have kept literal or `_`-escaped.

- **Contract.**
  - `decodeEvidenceId` returns a non-null value exactly for the stems `encodeEvidenceId` can produce.
  - `decodeEvidenceId(encodeEvidenceId(id)) === id` for every string.
  - `decodeEvidenceId(s) !== null` implies `encodeEvidenceId(decodeEvidenceId(s)) === s`.
  - It is pure and total, and never throws.
  - The empty stem decodes to `""`, though `REVIEW_FILE_RE` never yields one.
- **Why strict.** A lenient decoder, for example one that accepted lower-case hex or `__0041`, would map two different file names to one id. That would bring back on the read side the collision E136 removed on the write side.
- **lane-status use.** In `passEvidenceIdsIn`, the id taken from a `review_<stem>.md` file becomes `decodeEvidenceId(stem) ?? stem`. `covers:` ids are raw ids and are not decoded. Nothing else in lane-status changes.
- **Why fall back to the raw stem rather than skip.** Evidence files written before E136 were named with the old sanitiser, which was the identity on `[A-Za-z0-9._-]`. Their stem is the id itself, and it is often not decodable. Examples are `qa_reports/review_b8.md`, `review_c9-protocol-fields.md`, and the `test/e177b-lane-status.test.mjs` fixtures `T-E908-03-failonly`, `T-E908-04-failthenpass` and `T-E908-02-archived`, which all contain lower-case letters. lane-status counts these today.
  - Skipping them would silently drop that evidence and turn green lanes red.
  - The raw fallback keeps today's behaviour exactly for every stem the encoder could not have written.
  - It also keeps lane-status inside its contract of never throwing and reading unreadable evidence as none: the decoder never throws, and every stem yields exactly one id.
  - A fallback id cannot be mistaken for an encoder-written file of a different id, because a non-decodable stem is not in the encoder's image.
- **Known limitation (accepted, recorded).** A pre-E136 stem that happens to be decodable is read as the modern decoding.
  - One shipped file has such a stem: `qa_reports/archive/release-v4.6.0/review_E295_T-E295-01-05.md` decodes to `E295t-E295-01-05`.
  - That file sits in a released archive. Its ids reach lane-status through its `covers:` line, which is not decoded.
  - The live gates stopped accepting such legacy names when E136 shipped without a fallback, so lane-status now agrees with them.

## Acceptance Criteria

Test names below are what qa creates; `<base>` is `f5485a7`.

### E367

- **AC-E367-1** — Given a generated corpus of ids, when each is encoded and then decoded, then `decodeEvidenceId(encodeEvidenceId(id)) === id`. The corpus holds canonical `T-E900-01`, lower case, `_`, `/`, space, `:`, NUL, non-ASCII, a lone surrogate, the empty string, and every string of length ≤ 3 over a mixed alphabet.
  proof: `node --test --test-name-pattern="AC-E367-1" test/e367-lane-status-decode.test.mjs` passes.
- **AC-E367-2** — Given stems the encoder cannot produce, `decodeEvidenceId` returns `null` and does not throw. The stems are `t01`, `_`, `_1`, `__00`, `__005f`, `__0041`, `__002E`, `__002D`, `T-E260G-09 T-E260G-10` and `b8`. For every stem `s` in the AC-E367-1 corpus outputs plus these stems, `decodeEvidenceId(s) !== null` implies `encodeEvidenceId(decodeEvidenceId(s)) === s`.
  proof: `node --test --test-name-pattern="AC-E367-2" test/e367-lane-status-decode.test.mjs` passes.
- **AC-E367-3** — Given a lane worktree fixture whose `qa_reports/` holds PASS files written at `review_${encodeEvidenceId(id)}.md` for the non-canonical ids `t-e900-01`, `T-E900_02` and `T-E900/03`, when `checkLaneEvidence` runs with those ids in `completed_tasks`, then `evidenceIds` contains all three raw ids and `claimedWithoutEvidence` is empty. The same holds for a file under `qa_reports/archive/<feature>/`.
  proof: `node --test --test-name-pattern="AC-E367-3" test/e367-lane-status-decode.test.mjs` passes.
- **AC-E367-4** — Given a PASS file with a non-decodable legacy stem (`review_t-e900-04.md`), when `checkLaneEvidence` runs with `t-e900-04` claimed, then it credits `t-e900-04`, as it does before this change. `test/e177b-lane-status.test.mjs` stays green and unmodified.
  proof: `node --test --test-name-pattern="AC-E367-4" test/e367-lane-status-decode.test.mjs` passes, and `git diff <base> -- test/e177b-lane-status.test.mjs` is empty.
- **AC-E367-5** — Given a canonical id `T-E900-05` with a PASS file `review_T-E900-05.md`, it is credited exactly as before. Given a FAIL-only file at an encoded non-canonical stem, it credits nothing.
  proof: `node --test --test-name-pattern="AC-E367-5" test/e367-lane-status-decode.test.mjs` passes.
- **AC-E367-6** — `tools/lane-status.ts` imports `decodeEvidenceId` from `./evidence-file.js`, and `passEvidenceIdsIn` never adds a raw `m[1]` without first trying the decoder (source pin).
  proof: `node --test --test-name-pattern="AC-E367-6" test/e367-lane-status-decode.test.mjs` passes.

### Lane-level

- **AC-L1** — The only change under `test/` is the one new file. No existing test is re-pinned.
  proof: `git diff --name-only <base>..HEAD -- test/` lists exactly `test/e367-lane-status-decode.test.mjs`.
- **AC-L2** — On the final HEAD, with a clean tree and no untracked files, the full suite is green.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0, and the qa report quotes the pass/fail counts.
- **AC-L3** — `dist/` is in sync.
  proof: `npm run build` followed by `git status --porcelain dist/` prints nothing.
- **AC-L4** — Scope.
  proof: `node scripts/fanout.mjs check --cut specs/fanout-post-v4-w12.md e367 specs/e367-evidence-and-feature-path-encoding.md` exits 0 on the final HEAD.
- **AC-L5** — Hard conditions and the deferral both hold. Specifically:
  - no `gates/` file changes, so the E368 sites stay byte-unchanged and no task-id path moves;
  - no storage, schema, handoff-write or orchestrator file changes, so SQLite/HTTP behaviour is unchanged and there is no `schema_version` bump.

  proof: `git diff --stat <base>..HEAD -- gates schema tools/storage.ts tools/storage-sqlite.ts tools/handoff-write.ts tools/handoff-orchestrator.ts` prints nothing.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no user-facing string is introduced or changed; lane-status output formats are unchanged |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **E368, in full** (deferred by ruling B). That means:
  - `specFilePath`, `expectedRedManifestPath` and `designFilePath` stay byte-unchanged;
  - no `encodeFeatureStem` is added;
  - no `gates/` file changes;
  - none of the E368 re-pins land.
- Any change to how roles *write* `specs/<feature>.md`, `design/<feature>.md` or `qa_reports/expected-red_<feature>.txt`, and lane-status's cut-pre-review lookup by raw name. Both belong to `E368-NEW-1`.
- `tools/handoff-write.ts` archive-name sanitising (`qa_reports/archive/<name>/`), and E184.
- Gate error codes, `gates/registry.ts`, `gates/qa-review.ts`, `gates/code-review.ts`: untouched.

## Dependencies / Prerequisites

- Base `f5485a7`. Mode `no-design` (no `design/e367-evidence-and-feature-path-encoding.md`), so Visual Structural Assertions are omitted.
- Resource Audit: backlog rows E367, E368 and E136 and the manifest row reference no external artifact (no URL, Figma, mockup or ticket system), so `external_refs` is omitted.
- **No architect hop.** E367 touches two modules and adds one pure function, with no data model and no API surface beyond that export.
- `dispatch_mode` stays `feature`. The qa test doubles as the reproduction.
- Each sr task rebuilds and commits its own `dist/` outputs, which are not counted against `task_size`.
- **Existing tests checked against E367.** Found through the manifest's named list and a grep for `checkLaneEvidence`, `passEvidenceIdsIn`, `encodeEvidenceId` and `review_` stems:

  | test file | hit? | why |
  |---|---|---|
  | `test/e177b-lane-status.test.mjs` | not hit (must stay unmodified) | its fixtures use canonical stems or legacy stems that cannot be decoded (lower-case suffixes), so they take the raw fallback |
  | `test/e178b-lane-watch.test.mjs`, `test/e178b-cut-prereview.test.mjs` | not hit | canonical ids; the cut-pre-review lookup is unchanged |
  | `test/e136-evidence-path-injective.test.mjs` | not hit | `AC-E136-3` uses its own test-local decoder, and `AC-E136-7` pins the feature sanitisers, which E367 does not touch |
  | `test/covering-evidence.test.mjs`, `test/qa-flow.test.mjs` | not hit | the write side and the gate side are unchanged |

  If the full suite shows any red, sr or qa stops and reports to the coordinator for integrator re-check. Nothing is re-pinned silently.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E367-01 | sr (E367): add `export function decodeEvidenceId(stem): string \| null` to `tools/evidence-file.ts` directly under `encodeEvidenceId`, as the strict inverse in the E367 table, with a comment block that mirrors the encoder's. In `tools/lane-status.ts`, import it and make `passEvidenceIdsIn` add `decodeEvidenceId(m[1]) ?? m[1]`. Update the function's doc comment to cover the decoded stem and the raw-stem fallback for pre-E136 names. Nothing else in lane-status changes. Rebuild `dist/`. ~45 lines | none | 2 (+dist) | `tools/evidence-file.ts`、`tools/lane-status.ts`、`dist/tools/evidence-file.*`、`dist/tools/lane-status.*` | — |
| T-E367-02 | qa (E367): new `test/e367-lane-status-decode.test.mjs` (AC-E367-1..6). Build the fixtures in temporary workspaces; assert nothing about real `qa_reports/` contents | T-E367-01 | 1 | `test/e367-lane-status-decode.test.mjs` | — |
| T-E367-03 | qa (lane verification; re-cut of voided T-E368-03, E367 parts only): no re-pins. On the final HEAD, run AC-L1..L5, with the full suite under `node scripts/test-lock.mjs -- npm test` | T-E367-02 | 0 | — | — |

## Findings filed

Recorded in `.current/e367/pending-tickets.md`:

- `E368-NEW-1` now carries both halves of the deferred work:
  - the read side: the E368 encoding, as in the Deferred section below;
  - the write side: the SOP prose writer convention and lane-status's lookups by raw name.

## Deferred (E368, ruled B 2026-10-29)

**Not part of this cut. No task, AC or test in this lane implements it.** It is kept so that the `E368-NEW-1` follow-up can reuse the analysis. Every fact below was measured at base `f5485a7` and should be re-verified at the follow-up's base.

### Problem

`specFilePath` (`gates/ac-execution.ts`), `expectedRedManifestPath` (`gates/expected-red.ts`) and `designFilePath` (`gates/visual.ts`) each map `active_feature` through `replace(/[^A-Za-z0-9._-]/g, "_")` and then `replace(/\.\.+/g, "_")`. This is the same lossy projection E136 removed for task ids.

- Two feature names that differ only in case (`Foo` and `foo` on APFS/NTFS) resolve to one spec, design or manifest file.
- So do two names that differ only in characters the sanitiser rewrites (`a/b`, `a b`, `a_b`, `a..b`).

### Proposed read-side design: one shared helper `encodeFeatureStem`

- **Shape.**
  - Add `export function encodeFeatureStem(activeFeature: string): string` to `tools/evidence-file.ts`.
  - The three sites become `specs/${encodeFeatureStem(f)}.md`, `qa_reports/expected-red_${encodeFeatureStem(f)}.txt` and `design/${encodeFeatureStem(f)}.md`.
  - Function names, signatures and export status stay the same, and `designFilePath` stays module-private.
  - It lives in `tools/evidence-file.ts` because the A2 shared-helper rule applies once there are three consumers.
- **Encoding table** (one UTF-16 code unit at a time, index `i` in a string of length `n`):

  | input unit | output |
  |---|---|
  | `[a-z0-9-]` | unchanged |
  | `.` with `0 < i < n-1` and neither neighbour `.` (an isolated interior dot) | unchanged |
  | `[A-Z]` | `_` + the lower-case letter |
  | anything else | `__` + the unit as exactly 4 **lower-case** hex digits |

  "Anything else" includes `_`, `/`, `\`, space, NUL, `:`, every non-ASCII unit, and any `.` that is leading, trailing or next to another `.`.

  Examples: `Foo` → `_foo`, `foo_bar` → `foo__005fbar`, `a/b c` → `a__002fb__0020c`, `..feat` → `__002e__002efeat`, `f..oo` → `f__002e__002eoo`, `...` → `__002e__002e__002e`, `foo.` → `foo__002e`, `.foo` → `__002efoo`, `E260E` → `_e260_e`, `lower-Case` → `lower-_case`, `feat.v2` → `feat.v2`, `wave1.5-content-catchup` → unchanged.
- **Identity set.** `^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*)?$`: lower-case slug segments joined by single dots, with no leading, trailing or doubled dot. The empty string maps to itself. The old sanitiser is also the identity on this set, so every canonical path stays byte-identical.
- **Why not `encodeEvidenceId` verbatim.** Its identity set is `[A-Z0-9.-]`, and it escapes lower case as `_X`. Every lower-case slug would move (`e367-foo` → `_E367-_F_O_O`). The case-mirrored table swaps the roles of the two cases.
- **Injective.** `_` only ever starts an escape token, and the next character says which kind (a letter, or `_` for hex). Tokenisation is therefore unique. Escaped and literal dots both decode to `.`.
- **Case-fold-safe.** The output alphabet is `[a-z0-9._-]`, with no upper-case letter. Non-ASCII is always hex-escaped, so no Unicode-normalisation merge is possible.
- **`..` guard, stronger than today.** The output never contains `..`, never starts or ends with `.`, can never be `.` or `..`, and has no `/`, `\`, NUL or `:`. Full file names contain no `..`; today `foo.` gives `specs/foo..md`. Each resolved path's parent is exactly `specs/`, `qa_reports/` or `design/`.
- **Shipped-name inventory.**
  - The inventory covered all 307 `specs/*.md` (including 28 dotted names such as `release-v4.6.0`, `fanout-wave7.2b` and `constitution-v3.5.1-rule-completeness`) and all 73 `qa_reports/**/expected-red_*.txt` (including archives). No `design/` directory exists.
  - All 380 names are in the identity set, and a prototype run moved 0 of them.
  - A re-check command, run from the repo root against the built helper: ``node --input-type=module -e 'import fs from "fs";import path from "path";import {encodeFeatureStem} from "./dist/tools/evidence-file.js";const n=[];for(const f of fs.readdirSync("specs"))if(f.endsWith(".md"))n.push(f.slice(0,-3));if(fs.existsSync("design"))for(const f of fs.readdirSync("design"))if(f.endsWith(".md"))n.push(f.slice(0,-3));const w=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(/^expected-red_.*\.txt$/.test(e.name))n.push(e.name.slice(13,-4));}};w("qa_reports");const m=n.filter(x=>encodeFeatureStem(x)!==x);console.log("checked",n.length,"moved",m.length,m)'``
- **No legacy-path fallback.** It would re-create the sharing, because on a case-insensitive filesystem `specs/Foo.md` is `specs/foo.md`.
- **Rejected alternatives.**
  - Escaping every dot: this moves the 28 dotted specs.
  - Keeping leading and trailing dots literal: this allows hidden files and `..md` names.
  - Upper-case hex: mixed-case output is not case-fold-safe.
- **Prototype result.** In a scratch copy at base, built with `tsc`, a property run over 4369 generated strings found 0 violations. The 26 test files that read these paths ran 690 tests with exactly 4 failures, and these are the predicted re-pins:
  - `test/e136-evidence-path-injective.test.mjs` `AC-E136-7` (pins the old sanitiser);
  - `test/ac-execution.test.mjs` `U6` (`_feat.md` → `__002e__002efeat.md`);
  - `test/gates-expected-red.test.mjs` `U5` (`_feat.txt` → `__002e__002efeat.txt`);
  - `test/visual-evidence-gate.test.mjs` `v3.14.1 AC-3` (`_feat.md` / `f_oo.md` / `_.md` → `__002e__002efeat.md` / `f__002e__002eoo.md` / `__002e__002e__002e.md`). This file is outside a by-name ownership list and needs an explicit grant.

### Write-side gap: the reason for ruling B

- **The gap.** For a non-canonical name made only of `[A-Za-z0-9._-]` (upper case, `_`, a doubled dot), today's sanitiser is the identity. So a role that writes `specs/Foo.md` per the SOP prose is read at the same path.
  - After the read-side change alone, the gate reads `specs/_foo.md` instead.
  - The AC-execution gate and the visual arm would then read absence as "not armed" (fail-open).
  - REPRO_MANIFEST_MISSING would block, citing the encoded path.
- **Exposure at filing.** 0 shipped files; 1 of 84 historical `active_feature` values in `.current/` (`E260E`), which has no spec, design or manifest file.
- **Raw-name readers and writers the follow-up must cover:**
  - the `content/**` role SOPs (`specs/<feature>.md`, `design/<feature>.md`, `qa_reports/expected-red_<feature>.txt`);
  - `tools/lane-status.ts`'s cut-pre-review lookup (`specs/${feature}.md`).
- **Candidate fixes**, which can be combined:
  - reject or canonicalise a non-canonical `active_feature` at `tw_update_state` (`tools/handoff-orchestrator.ts`);
  - surface the resolved spec, design and manifest paths in `tw_get_state`;
  - state the encoded name in the SOP prose.
- **Readers that inherit the helper with no change:**
  - `tools/handoff-orchestrator.ts` (REPRO_MANIFEST_MISSING, the visual arm, the expected-red disposition) and `prompts/build.ts:425` (the design arm) call the gate helpers.
  - `scripts/capture-constitution-golden.mjs` uses the canonical `cnso-golden-feat`.
- **Unrelated:**
  - `tools/handoff-write.ts:452`, the archive sanitiser, is separate and out of ticket scope.
  - `tools/fanout-manifest.ts` uses lane names, not feature names.
  - `bin/agc-init.mjs` deals with directory names only.

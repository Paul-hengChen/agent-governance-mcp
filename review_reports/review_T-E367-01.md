# Review — T-E367-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Adds `decodeEvidenceId(stem): string | null` to `tools/evidence-file.ts` (directly under `encodeEvidenceId`) and makes `tools/lane-status.ts` `passEvidenceIdsIn` credit `decodeEvidenceId(m[1]) ?? m[1]` for each PASS-bearing `review_<stem>.md`. `dist/` rebuilt for both modules.
- Scope: lane diff `b2233d5..HEAD` touches only `tools/evidence-file.ts`, `tools/lane-status.ts`, `dist/tools/evidence-file.*`, `dist/tools/lane-status.*` (plus `.current/e367/` bookkeeping). `git diff --stat f5485a7 HEAD -- gates schema test content tools/storage.ts tools/storage-sqlite.ts tools/handoff-write.ts tools/handoff-orchestrator.ts` is empty.
- Decoder verified as the exact, strict inverse by exhaustive scratch runs (0 violations); a negative control (lower-case hex accepted) is caught (129809 violations).
- Same-model note: sr-engineer and this reviewer both ran on opus; independence comes from clean context only, not a model difference.
- Verdict: APPROVED; no required findings.

## AC Completeness
AC-E367-1 — implemented — tools/evidence-file.ts:52-81. Scratch: every single UTF-16 unit 0x0000..0xFFFF (alone and as `a<u>Z`) and all 54241 ids of length <= 4 over {A,a,z,0,.,-,_,/,space,:,NUL,é,lone high surrogate,lone low surrogate,\n} satisfy `decode(encode(id)) === id`; `decode("") === ""`.
AC-E367-2 — implemented — tools/evidence-file.ts:57-78. All 10 listed stems decode to null without throwing. All 131072 `__hhhh` stems in both hex cases: exactly the 65472 upper-case escapes of units outside `[A-Za-z0-9.-]` are accepted, and each re-encodes to its input. Exhaustive 11,111,111 stems of length <= 7 over {_,0,5,F,A,D,8,a,-,.}: 3,127,396 non-null, every one re-encodes byte-identically, none throw.
AC-E367-3 — implemented — tools/lane-status.ts:294. Scratch fixture: PASS files at `review_${encodeEvidenceId(id)}.md` for `t-e900-01`, `T-E900_02` (in `qa_reports/`) and `T-E900/03` (in `qa_reports/archive/<feature>/`) all land in `evidenceIds`, none in `claimedWithoutEvidence`.
AC-E367-4 — implemented — tools/lane-status.ts:294 (`?? m[1]`). `review_t-e900-04.md` (not decodable) credits `t-e900-04`. `test/e177b-lane-status.test.mjs` is unmodified and green.
AC-E367-5 — implemented — `review_T-E900-05.md` credits `T-E900-05` (identity decode). A FAIL-only file at an encoded stem (`_T-_E900-06`) credits nothing, because the `QA_PASS_HEADER_RE` check at tools/lane-status.ts:292 runs before decoding.
AC-E367-6 — implemented — tools/lane-status.ts:19 imports `decodeEvidenceId` from `./evidence-file.js`; line 294 is the only site that adds an own-stem id, and it always tries the decoder first.
(AC-L1..L5 are lane-level verification owned by T-E367-03. Spot checks here: L3 holds, see Correctness; L5 holds, see Summary.)

## Correctness
No findings.
- Token classes: `[A-Z0-9.-]` maps to itself. `_` + `[A-Z]` maps to the lower-case letter, matching the encoder's only `_X` output. `__` + `[0-9A-F]{4}` is accepted only when the decoded unit is outside `[A-Za-z0-9.-]` (tools/evidence-file.ts:68-72). The encoder always emits 4 upper-case hex digits (`padStart(4,"0")`; a unit is at most 0xFFFF), so a non-null decode always re-encodes byte-identically. Tokenisation is unambiguous: `_` followed by a letter, by `_`, or by anything else (null). Lone `_`, `_` + digit/`.`/`-`, short or lower-case hex runs, `___…`, and any non-ASCII or lower-case character in the stem all return null.
- Surrogates: lone surrogates round-trip (`String.fromCharCode` per unit, with no `u` flag on the regexes). A surrogate pair round-trips as two `__D83D__DE00`-style tokens. `/^[A-Za-z0-9.-]$/` without the `m` flag does not match `"\n"`.
- Never-throw: the decoder is total (exhaustive runs plus 200k-token stems ran in about 30 ms with no exception), so `passEvidenceIdsIn` keeps its never-throws contract, and every stem still yields exactly one id.
- Wrong-id / masking analysis: a decoded id is credited only to itself. Through `idCarriesTicketToken`, decoding can only remove artefacts: hex digits glued to a segment (for example, the raw stem `__E900` used to split to the segment `e900` and spuriously match token `e900`; the decoded `` no longer does), and escaped separators now split correctly. A raw-fallback stem is never in the encoder's image, so it cannot collide with an encoder-written stem for a different id. A legacy name and the encoded name of the same id may both credit that id, which is correct (Set dedup).
- Legacy impact on this repo: scanning all 1331 `review_*.md` under `qa_reports/` and `review_reports/` found 17 non-decodable stems (raw fallback, behaviour unchanged) and exactly 1 decodable stem whose decoding differs from the raw stem: `qa_reports/archive/release-v4.6.0/review_E295_T-E295-01-05.md` decodes to `E295t-E295-01-05`. This is the spec's recorded "Known limitation (accepted)".
- dist/: `git archive HEAD` extracted to a scratch dir, `dist/` removed, fresh `npx tsc` gives `diff -rq` identical to the committed `dist/` (no stale or extra files).
- Regression: `node --test` on e177b-lane-status, e136-evidence-path-injective, e178b-lane-watch, e178b-cut-prereview, covering-evidence and qa-flow: 233/233 pass.

## Quality
- optional — tools/evidence-file.ts:57 and tools/evidence-file.ts:29: the literal-class predicate `(ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9") || ch === "." || ch === "-"` is duplicated between the encoder and the decoder, and restated a third time as the regex `/^[A-Za-z0-9.-]$/` (with `[a-z]` added) at line 72. A shared `isLiteral(ch)` helper would keep the two directions from drifting. This is not a defect: the exhaustive property runs pin their agreement today.
- optional — tools/evidence-file.ts:64: `next !== undefined &&` is redundant, because `undefined >= "A"` is false. It is harmless and arguably clearer.
- optional — tools/lane-status.ts:329: the `checkLaneEvidence` doc still says "by `review_<id>.md` name". It is now slightly imprecise (the stem is decoded), but the cut says "nothing else in lane-status changes", so leaving it is spec-compliant. The `passEvidenceIdsIn` doc, which is the authoritative one, is accurate.
- Comment check (step 4b): `agc check` raises 3 advisory warnings on the diff. Each is kept, for these reasons:
  - `tools/evidence-file.ts:40 long-block 12 lines`: kept. The cut explicitly asks for "a comment block that mirrors the encoder's", and the existing encoder block (line 12) is also 12 counted lines.
  - `tools/evidence-file.ts high-ratio 31.3%`: kept. The base file was already at 31.7% (84/265), and this diff lowers the ratio.
  - `tools/lane-status.ts:263 long-block 11 lines`: kept. The cut explicitly asks the doc comment to cover the decoded stem and the raw-stem fallback; the block grew from 7 to 11 lines, all WHAT/WHY.
  - The new comments contain no absolute paths, no ticket numbers, and no in-body comments. Citations are generic (`tools/evidence-file.ts \`decodeEvidenceId\``).

## Architecture
No architecture spec (the cut records "No architect hop"). The decoder sits beside its encoder in the gate-agnostic `tools/evidence-file.ts`, which imports nothing from `gates/`, and lane-status consumes it via the existing import line. Layering is unchanged and the import graph stays acyclic. Nothing in the E368 deferral (`specFilePath`, `expectedRedManifestPath`, `designFilePath`, `gates/`) is touched.

## Security
No findings. The decoder only reads a directory-entry name and produces an in-memory id. The decoded id never becomes a filesystem path; it is used only as a Set key and in report text. No new I/O, no shell, no secrets. Decoded ids may contain control characters such as NUL or `\n` and show up in lane-status text output. That was already possible via `covers:` ids and ledger ids, so it is not a new surface.

## Performance
No findings. The decode is O(stem length) per file, called once per PASS-bearing `review_*.md`. Each `__` escape runs two tiny regex tests. There is no change to directory or file I/O, and no regression against base.

## Verdict
APPROVED — the decoder is the exact strict inverse of `encodeEvidenceId` (verified exhaustively, with a working negative control), lane-status credits decoded ids with the raw-stem fallback the spec mandates, `dist/` matches a fresh build, and scope is confined to the four owned file groups. Only optional findings remain.

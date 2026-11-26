# Review — T-E428-01

covers: T-E428-01, T-E428-02, T-E428-03, T-E428-04, T-E428-05

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Feature `e428-tracker-mirror`, lane `e428`, base `32e7f7e`, reviewed HEAD `697bef8` (plus the reviewer's own
state checkpoint commit). Inputs: `git diff 32e7f7e...HEAD`, `specs/e428-tracker-mirror.md`, the E428 backlog row
(base, 2026-11-18 addendum, 2026-11-19 audit amendment), the lane row of `specs/fanout-post-v5-w5.md`,
`qa_reports/tests_e428-tracker-mirror.md`, `qa_reports/expected-red_e428-tracker-mirror.txt`.

## Summary
- Adds the opt-in, one-way tracker mirror as SOP/format text: `C-SW1`/`C-SW2` in `content/skill-spec-workshop.md`,
  `C-IN1` in `content/skill-integrator.md`, `C-CO1` in `content/coord-01-core-head.md`, `C-TF1` in
  `docs/ticket-format.md`; one golden hunk, two caps and four unowned pins re-baselined.
- All five shipped blocks match the spec's Copy byte for byte (AC1–AC12 tests rebuild the base by sha256), every
  `proof:` command exits 0, full suite 4789/4791 pass (0 fail, 2 history-dependent skips), bounds empty,
  `GATE_REGISTRY` 33, pipeline 17, no file outside the owned set.
- One `required` finding in the approved Copy itself: in a private repository, turning `write-back` on never lets
  the integrator write to a source item, because source numbers live only in the ticket file's `source` field and
  the integrator writes only to tickets with a tracker-map row. That makes a behaviour the ticket requires
  ineffective in the common case, so it is a scenario defect and goes to pm.
- Verdict: CHANGES_REQUESTED (scenario defect → pm).

## AC Completeness
AC1 — implemented — content/skill-spec-workshop.md:36-38 (C-SW2 between the last Outputs bullet and Governance state)
AC2 — implemented — content/skill-spec-workshop.md:38; docs/ticket-format.md:164-166, 198
AC3 — implemented — skill-spec-workshop.md:38 (opens with request + read carve-out); ticket-format.md:173-174; skill-integrator.md:222 ("No row, no write."); coord-01-core-head.md:80 (ends read-only)
AC4 — implemented — content/skill-spec-workshop.md:31 (C-SW1 replaces the one-item sentence); ticket-format.md:167-168; `source` field row (line 50) unchanged
AC5 — implemented — docs/ticket-format.md:157-198 (placement, example map); behaviour test proves the git-common-dir location is untracked and shared by a linked worktree
AC6 — implemented — content/skill-integrator.md:220-228 (after Stage 6 *Your own commits*, before Git operations)
AC7 — implemented — skill-integrator.md:226; ticket-format.md:171-172
AC8 — partial — skill-integrator.md:225, skill-spec-workshop.md:38, ticket-format.md:171, 192-193 carry the Copy, but in a private repository the switch has no effect (see Correctness F1)
AC9 — implemented — content/coord-01-core-head.md:80 (no-ticket-file paragraph at :78 byte-identical)
AC10 — implemented — coord-01-core-head.md:80 sentence 2; ticket-format.md:169-170
AC11 — implemented — ticket-format.md:162-163; skill-integrator.md:227; coord-01-core-head.md:80 sentence 1
AC12 — implemented — no URL, repo-only path, bare id (only E900/E899), version label, error code or vendor name in any added line (test + manual grep)
AC13 — implemented — golden hunk is exactly C-CO1 + one blank line; caps 1663 / 19699 equal the measurements; suite green; bounds empty

## Correctness
- **F1 (required, scenario defect: the approved Copy)** — write-back to source items never fires in a private
  repository.
  - `docs/ticket-format.md:167-168` (C-TF1 bullet 3): "A ticket file holds tracker item numbers only in its
    `source` field … Every other number, and in a public repository the source items too, goes in the tracker
    map." So in a private repository a source item is in the `source` field and **not** in the map.
  - `content/skill-integrator.md:222` (C-IN1 intro): "Only a ticket with a row in the tracker map gets tracker
    writes … No row, no write." and `:225`: "**`source` row** — the same updates, only when the map's
    `write-back` line reads `on`."
  - `docs/ticket-format.md:171` (C-TF1 bullet 5) and `content/skill-spec-workshop.md:38` tell the adopter that
    the map's `write-back` switch turns source-item writes on.
  - Worked example: a private repository; spec-workshop cuts `E900` from tracker item 1234, writes
    `source: [1234 rev 7]` in the ticket file and, per bullet 3, no map row (nothing was created, so the C-SW2
    "record each created item" rule adds none either). The human sets `write-back: on` in
    `agc-tracker-map.md`. The integrator dispatches E900: the map has no E900 row, so "No row, no write": item
    1234 is never set to in progress, never gets the stop reason or the pull-request number. The switch the
    format doc says turns writes on does nothing. In a public repository the same ticket works, because C-SW1
    puts the source item in the map.
  - The ticket requires this behaviour: addendum "write-back to the source item is off by default and enabled per
    workspace"; spec cut decision 4 "Source items with write-back on get the same updates as mirrored items",
    which names no repository type. AC8 as written assumes a map `source` row exists, so its test cannot catch
    this. The coordinator's resolve rule (C-CO1) does handle both places ("the file's `source` field lists it, or
    the tracker map does"); the integrator rule does not, so the asymmetry looks like an oversight.
  - Fix belongs to pm (the Copy changes). Two options:
    (a) C-IN1 counts the ticket file's `source` field as well: e.g. intro "Only a ticket with a row in the tracker
        map, or a ticket file whose `source` field lists an item, gets tracker writes", and the `source` bullet
        "**source item** (a `source` row, or an item in the ticket file's `source` field)";
    (b) C-TF1 bullet 3 / C-SW2 also record source items in the map, in every repository, whenever a mirror is
        asked for (the map then becomes the integrator's only input).
    Either way AC8 should gain a case for a private repository (a source item only in the `source` field, with
    `write-back: on`), and the copy-bearing pins (e445, e462, e410, e430, golden, caps) are re-measured.
- **Tests (no defect).** Each AC1–AC12 test checks its scenario's Copy on raw source and, where the AC says so, on
  the served `spec-workshop` / `teamwork` text; the sha256 base rebuild makes "no other line changes" exact.
  Negative control (copy of the tree outside the worktree, `content/skill-integrator.md` bullet 2 changed to
  "It is on by default."): AC6, AC8, AC12 go red, so the assertions are not tautologies. The AC5 behaviour test
  has a working-tree control, so its empty `git status` is not vacuous.
- **Re-pins (no defect).** e445 `BASE_SOP` and e462 `FROZEN_SW_SOP` change only by C-SW1 + C-SW2 lines; e410 row
  260 → 269 and count 261 → 270; e430 count 260 → 269. Only pinned values and comments change, with no logic change.
- **Golden / caps (no defect).** `skill-coordinator-monolith.txt` has one hunk, C-CO1 plus one blank line. Caps
  1415 → 1663 (+248, C-SW1 + C-SW2) and 19559 → 19699 (+140, C-CO1) pass at exactly those values in the suite run.

## Quality
- optional — `docs/ticket-format.md:164-165`: "one child item under that item" is ambiguous when `source` lists
  several items (the field is a list). One phrase ("under one of those items, the human's choice") would settle
  it. Not blocking.
- Comment discipline: every new comment block in the test diff is ≤ 7 lines, says why rather than what, and holds
  no sensitive data; the re-pin comments follow the existing E425/E430 style. No `agc check — comments` warning
  touches the diff.

## Architecture
No architecture spec (no `.ts`, gate, schema or registry change, as the spec intends). The text sits where the spec
places it: the resolve and the compare in coord-01, so the compare runs before code-reviewer dispatch without
touching forbidden files.

## Security
No findings. Shipped text holds no URL, credential, vendor name or internal name. The map location (git common dir)
is untracked by construction, so tracker numbers cannot leak into a public repository through it. Tracker writes
are opt-in and the stop question is never posted by a tool.

## Performance
No findings. Text only; the coordinator bundle grows +140 ~tok and spec-workshop +248 ~tok, both measured and capped.

## Verdict
CHANGES_REQUESTED — the implementation matches the approved Copy exactly and every proof passes, but the Copy leaves
source-item write-back without effect in private repositories (F1), contradicting the ticket's "enabled per
workspace". The fix is a Copy change, so this goes back to pm.

## Round 2 — APPROVED — by code-reviewer

covers: T-E428-01, T-E428-02, T-E428-03, T-E428-04, T-E428-05, T-E428-06, T-E428-07

Reviewed HEAD `a8345df` (base `32e7f7e`). Inputs: `git diff 32e7f7e...HEAD` (round-2 delta `697bef8..a8345df`),
`specs/e428-tracker-mirror.md` incl. *Amendment after review round 1*, the E428 backlog row, the lane row of
`specs/fanout-post-v5-w5.md`, `qa_reports/tests_e428-tracker-mirror.md`, `qa_reports/expected-red_e428-tracker-mirror.txt`,
my round-1 report.

## Summary
- Round-2 delta: amended `C-IN1` (intro, bullet 2 renamed **Source item**, bullet 3 "whatever the item") in
  `content/skill-integrator.md` and `C-TF1` bullet 2 in `docs/ticket-format.md`, 3 lines each, in place (integrator
  SOP stays 269 lines); `test/e428-tracker-mirror.test.mjs` updated for AC2/AC3/AC7/AC8 with the private-repository
  case; manifest and test report refreshed. No other file changed since round 1 (golden, caps, four re-pins untouched).
- F1 is closed: a source item that lives only in the ticket file's `source` field now gets write-back updates when the
  map reads `write-back: on`, with no map row.
- Every `proof:` exits 0; full suite 4789/4791 pass (0 fail, 2 unrelated history skips); bounds empty;
  `GATE_REGISTRY` 33, pipeline 17; every changed file inside the owned set.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — content/skill-spec-workshop.md:36-38 (unchanged since round 1)
AC2 — implemented — content/skill-spec-workshop.md:38; docs/ticket-format.md:164-166 (amended bullet 2: "one child item under one of them, chosen by the person who asks for it"), map rule at :198
AC3 — implemented — skill-spec-workshop.md:38; ticket-format.md:173-174; skill-integrator.md:222 (`No item, no write.`); coord-01-core-head.md:80 (ends read-only)
AC4 — implemented — content/skill-spec-workshop.md:31; ticket-format.md:167-168; `source` field row unchanged
AC5 — implemented — docs/ticket-format.md:157-198, exactly the amended `C-TF1`; behaviour test green
AC6 — implemented — content/skill-integrator.md:220-228, exactly the amended `C-IN1`, same position and line count
AC7 — implemented — skill-integrator.md:226 ("whatever the item"); ticket-format.md:171-172
AC8 — implemented — skill-integrator.md:222 (intro admits an item the `source` field lists), :225 (**Source item** … "whether or not the map has a row for the ticket"); skill-spec-workshop.md:38; ticket-format.md:171, 192-193
AC9 — implemented — content/coord-01-core-head.md:80
AC10 — implemented — coord-01-core-head.md:80 sentence 2; ticket-format.md:169-170
AC11 — implemented — ticket-format.md:162-163; skill-integrator.md:227; coord-01-core-head.md:80 sentence 1
AC12 — implemented — added/changed lines in the four files hold no URL, repo-only path, bare id beyond E900/E899, version label, quoted error code or vendor name (test + independent grep of the 59 added lines)
AC13 — implemented — suite green, golden and caps unchanged since round 1 and still passing, bounds empty, 33/17

## Correctness
- **F1 closed — private-repository trace (ticket E900 cut from item 1234, `source: [1234 rev 7]`, map holds only
  `write-back: on`):**
  - *Where the item lives*: `C-SW1` / `C-TF1` bullet 3 (ticket-format.md:167-168) — in the ticket file's `source`
    field; only public-repository source items and every created number go in the map. Unchanged, consistent.
  - *Who writes, and when*: `C-IN1` intro (skill-integrator.md:222) now counts "an item its ticket file's `source`
    field lists" as a tracker item, so E900 is not excluded by "No item, no write"; bullet 2 (:225) applies the
    dispatch / stop / pull-request / merge updates to each source item only when `write-back` reads `on`, "whether or
    not the map has a row for the ticket". So 1234 is updated; with `off`, the line missing, another value or no
    file, nothing is written (`C-TF1` map bullet, ticket-format.md:192-193). Only the integrator writes.
  - *Coordinator*: `C-CO1` (coord-01-core-head.md:80) resolves the number from the `source` field or the map,
    compares the revision at work start and before each code-reviewer dispatch, and only reads — no conflict with the
    integrator writing, since they are different roles and `C-CO1` governs the coordinator's own actions.
  - *Spec-workshop*: `C-SW2` (skill-spec-workshop.md:38) records created items in the map and describes the switch as
    letting the integrator update source items — consistent with the amended `C-IN1`; it no longer implies a row is
    needed.
  - Public-repository case (a `source` row, `on`) still works; the AC8 test covers both.
  No remaining contradiction about where source items live, who writes to them, or when.
- **Tests (no defect).** AC2/AC3/AC7 assert the amended wording and that the round-1 wording is gone; AC5/AC6/AC12
  carry the amended constants and rebuild the base by sha256. AC8's `sourceWrites` applies each rule only when the
  given text states it verbatim and runs seven cases on raw and served integrator text. Negative controls (copy outside
  the worktree): round-1 integrator text → AC8 red on the private case; amended text minus "whether or not the map has
  a row for the ticket" → AC8 red; restored → green. Not tautological.
- **Implementation (no defect).** The three changed lines in each shipped file are byte-identical to the spec blocks
  (AC5/AC6 exact-section asserts) and nothing else in either file moved.

## Quality
- optional — `content/skill-spec-workshop.md:38` (`C-SW2`) still says "one child item under that source item", the
  phrase the amendment fixed in `C-TF1` bullet 2; the spec records it as deliberately left (moving it shifts the
  spec-workshop cap and the e445/e462 frozen text) and listed for the closing report. The map bullet
  `docs/ticket-format.md:196` ("under its source item") reads the same way. Not blocking: bullet 2 settles it.
- optional — `C-TF1` bullet 6 ("Without a mirror request nothing is written to a tracker") and a private-repository
  source-item write with `write-back: on` but no spec-workshop mirror request: a person turning the switch on reads as
  the request, but the text does not say so. Present since round 1; wording only.
- Comment discipline: the new test comments (header lines 8-9, `OLD_IN`, `RULE`, AC8 WHY block) are ≤ 7 lines,
  explain why, and hold nothing sensitive.

## Architecture
No architecture spec; text-only change, no `.ts`, gate, schema, registry or config change. Placement unchanged from
round 1.

## Security
No findings. The amendment widens which items the integrator may write to only behind the existing human-only
`write-back: on` switch in the untracked local map; default stays off. No URL, credential, vendor or internal name.

## Performance
No findings. Text only; the integrator SOP is under no cap and keeps its line count.

## Verdict
APPROVED — F1 is closed consistently across C-IN1, C-TF1, C-CO1 and C-SW2, the amended Copy is built byte-exact, the
round-2 tests exercise the private-repository case and fail on the old text, and every proof and the full suite pass.

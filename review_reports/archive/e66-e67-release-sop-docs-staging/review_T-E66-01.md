# Review — T-E66-01

covers: T-E66-01, T-E67-01, T-E67-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Prose-only diff, 2 files (`content/skill-release-engineer.md` +2561 B, `CLAUDE.md` 1 word). T-E66-01 appends `docs/`, `research/`, `multi-agent-scripts/` to the three SOP enumeration sites; T-E67-01 rewrites six text-accuracy defects; T-E67-02 bumps a gate count.
- **All six E67 claims independently re-verified against the real artifacts, not the handoff summary — every one is true**, and every rewrite states something that is now correct (detail in Correctness).
- **sr-engineer's expected-red correction is right**: `test/release-staging.test.mjs:187` AC1 asserts `stagedTokens.includes(dir)` per `FEATURE_DIRS` entry — inclusion, not an exact set — so three extra tokens cannot red it. I re-ran the affected suites myself: release-staging 66/66, context-budget 54/54, agc-adapters 14/14, error-code-contract 21/21. No expected-red manifest is required or expected (SOP step 4a does not arm: the diff touches no test file and no intentional red exists).
- **Two blocking findings, both the same shape as the tickets themselves**: a fix landed at one enumeration site while a second site in the *same file* kept the retired text, leaving each file internally self-contradictory. `CLAUDE.md:49` still says "(32 entries)" 38 lines above the `:87` line that now says 33; `content/skill-release-engineer.md:31` still grants "the latest release-notes subsection" in README, which `:53` now says does not exist and must not be invented.
- Verdict: CHANGES_REQUESTED. Both fixes are one line each; nothing in the diff as written is wrong, it is incomplete at the file-internal level, which is precisely the "partially synced is worse than uniformly stale" failure E68 is filed on.

## Correctness

### Blocking

**C1 — `CLAUDE.md:49` still reads "(32 entries)"; `:87` now reads 33. The file contradicts itself.**
```
49:   metadata is declared once per gate in `gates/registry.ts` (32 entries).
87: gates/registry.ts         GATE_REGISTRY — 33 gate definitions (code, owner, exemptions)
```
Verified authoritative value: `GATE_REGISTRY.length === 33` (loaded from `dist/gates/registry.js`). The E67 backlog row names the defect as *"`CLAUDE.md:87` still reads '32 gate definitions'"*, so `:87` is the cited site — but the row's own framing is "the repo's own layout doc now contradicts the registry it describes", and after this diff the doc additionally contradicts *itself*. A reader who lands on `:49` (it is in the prose overview, above the file-tree block) gets the wrong number with no signal that another line disagrees. Fix: `32 → 33` at `:49`.

**C2 — `content/skill-release-engineer.md:31` still asserts the README release-notes subsection that `:53` just retired.**
```
31: - `README.md` (install-pin replacements `#vX.Y.Z` and the latest release-notes subsection only — do not refactor unrelated prose)
53:    - `README.md`: … (E67a: there is no `#### (n) …` release-notes-subsection convention in this file … Do not invent one …)
```
`:31` is the **Artifact allowlist**, which appears *before* the SOP and is the section a role reads to learn what it may write. It now tells release-engineer that a README release-notes subsection is within its write scope; twenty lines later the SOP says no such section exists and forbids creating one. Under E67's own standard ("the SOP is executed literally"), a literal reader who trusts `:31` produces exactly the artifact E67(a) exists to prevent — so the defect survives its own fix. This is E64's measured lesson (its "two sites, one word" grew to five enumeration sites) applied to E67. Fix: drop `and the latest release-notes subsection` from `:31`.

### Verified — no finding

Each E67 claim re-checked against the live artifact, not the handoff text:

| edit | claim | independent verification | verdict |
|---|---|---|---|
| (a) `:53` | README has no `####` convention; recent releases touch only 3 pins | `grep -c '^####' README.md` → **0**; `grep -n '#v[0-9]' README.md` → exactly **3** hits (`:30`, `:34`, `:182`) | true, and "3" is exact |
| (b) `:54` | `npx tsc` bypasses `postbuild` = `check:transitions-sync` | `package.json` scripts: `"build": "tsc"`, `"postbuild": "npm run check:transitions-sync"` — npm lifecycle hooks fire on `npm run build`, never on a bare `npx tsc` | true; the added instruction (run it explicitly after `check-version.mjs`) is the correct placement, since `check:transitions-sync` is an independent script needing no dist parity |
| (c) `:131` | real output has no leading `v` | ran `node bin/agc-init.mjs check` → `agc check — OK (3.101.0) — all adapters current`, exit 0 | true, byte-for-byte |
| (d) `:139` | trailer was hardcoded `Opus 4.7`; real releases used another value | `git log --format='%(trailers:key=Co-Authored-By,valueonly)'` over the last 12 commits → **all** `Claude Opus 5 (1M context)`, including v3.98.0/v3.99.0/v3.100.0/v3.101.0 release commits | true; deferring to the harness is the right resolution (see N5 for the one gap) |
| (e) `:118` | `{E645}` is a batch-prefix artifact | `T-E645-*` ids confirmed real (`review_reports/review_T-E645-02.md` is cited by `test/release-staging.test.mjs:64`); no `E645` row exists in `docs/backlog.md` | true; correctly framed as a caveat, derivation untouched as instructed |
| (f) `:41` | `content/constitution.md` does not exist | `ls content/constitution.md` → No such file; `ls content/const-*.md \| wc -l` → **15** | true; the replacement cite (`content/const-*.md` + `prompts/constitution-manifest.ts`) matches `CLAUDE.md`'s own description |

T-E66-01's three sites are mutually consistent — same three additions, same order (appended after `review_reports/`), at `:135` (git-add), `:138` (AC2 set), `:173` (scope rule). I checked for a fourth enumeration site inside the file (E64 grew to five) and found none: the Artifact MUST-NOT list at `:41` enumerates *authoring* prohibitions, not staging paths, and correctly needs no change here.

## Quality

**N1 (non-blocking, but feed it to T-E66-02) — `.github/` is now the only tracked top-level directory absent from all three SOP lists, and the coordinator's `NON_SOURCE_DIRS` measurement cannot see it.**
Tracked top-level dirs (`git ls-files | awk -F/ 'NF>1{print $1"/"}' | sort -u`): `.current/ .github/ bin/ content/ dist/ docs/ gates/ guards/ lib/ multi-agent-scripts/ prompts/ qa_reports/ research/ review_reports/ schema/ scripts/ specs/ templates/ test/ tools/ transport/`. After this diff the SOP covers all of them except `.github/` (one tracked file, `.github/workflows/ci.yml`) — `.current/` is adequately covered, since all three recent release commits contain only `.current/.config.json` from that tree. The handoff's measurement records `NON_SOURCE_DIRS = dist/ + node_modules/`, which is what `ls -d */` returns — that glob hides dot-directories, so `.github/` and `.current/` were never in the candidate set. This matters for T-E66-02: option (ii)'s partition test asserts *every top-level repo directory* lands in exactly one array, so both dot-dirs need a deliberate classification or the test cannot be written as specified. Not blocking this diff (`.github/` has been modified in exactly one commit in repo history, `6271c67`), but it is the same "invisible because nobody enumerated it" class E66 exists to close.

**N2 — rationale-fence convention drift; ~90% of the size growth is strippable "why" prose that was left unstripped.**
The file already uses `<!-- rationale:start -->…<!-- rationale:end -->` for exactly this content class (`:119`, `:126`–`:128`), and `prompts/build.ts:370` applies `applyTextTransforms(taggedBody, { fullDetail })` with `fullDetail=false` on **every** `buildPromptForRole` dispatch — so fenced rationale never reaches a live release-engineer context. Of the +2561 B this diff adds, roughly 2.3 KB is forensic explanation (the E67e caveat alone is ~1.1 KB; the E67a/b/c/d/f parentheticals add ~1.2 KB more), all of it outside the fences and therefore shipped into every dispatch of a SOP that is already 49 KB. The imperative half of each edit is short and must stay unfenced; the "(E67x: this was previously wrong because …)" half is textbook rationale. Wrapping it recovers nearly the whole delta at zero loss of instruction. Non-blocking — `test/context-budget.test.mjs` passes 54/54 — but the convention exists in this very file and the diff does not follow it.

**N3 — `content/skill-doc-writer.md:33` carries the identical fictitious convention**, and doc-writer is the role that would actually create the section: *"`README.md`: bump install pins if the version changed; refresh release-notes subsection; …"*. Out of this cut's declared 2-file scope, so **not** a change request against this diff — recording it so it does not need re-discovery. Either fold in with human approval of a third file, or file it onto E67's row as a known sibling site.

**N4 — E67(d) leaves a literal reader with no fallback.** `:139` says to use "the `Co-Authored-By:` trailer your OWN harness's git-commit instructions prescribe for this session". This SOP is host-agnostic (served to Cursor/Gemini/Anti-Gravity as well), and a host that prescribes no trailer leaves the reader with no defined behavior — while every commit in recent history carries one. One clause fixes it, e.g. "…; if your harness prescribes none, match the trailer on the repo's most recent release commit." The historical `Claude Opus 4.7 (1M context)` literal retained inside the parenthetical is fine as written — it is explicitly labelled as the *previous* value and immediately followed by "do NOT hardcode".

## Architecture

No `specs/e66-e67-*.md` or `-architecture.md` exists — this is a backlog-row-as-spec mini-chain, and `docs/backlog.md:189` (E66) / `:190` (E67) are the contract. Both rows are satisfied in substance, with the two site-completeness gaps in Correctness.

The E66 half correctly reflects the row's central architectural claim: `docs/`, `research/`, and `multi-agent-scripts/` are **not** TypeScript source roots, so no meta-guard can derive them. I confirmed the mechanism rather than taking the row's word: `test/release-staging.test.mjs:583` (AC-B5.5) computes its expected set as `getTsConfigSourceDirs(tsconfig.json)` and diffs it against `FEATURE_DIRS` — a pure tsconfig-`include` derivation, which is exactly why repairing the `include` woke the guard for `gates/` in E64 and why it can never wake for these three. The row's "the E64 fix pattern does not generalize here" is accurate, and hand-enumeration is the correct architecture.

The human's choice of option (ii) is also the right one against what the tests actually pin, and T-E66-02 should be scoped with this in hand — of the three sites this diff edits, **only one is pinned by any assertion at all**:
- `:135` git-add line → pinned by AC1 (`:187`), inclusion-only.
- `:138` AC2 set → AC2's test (`:224`) asserts only that the strings `git diff --cached --stat`, `git status --short`, and `Metadata-only staging…FAIL signal` appear. It never inspects the directory set.
- `:173` scope rule → AC3's test (`:245`) asserts framing strings (`EXPECTED in a release commit`, `UNRELATED uncommitted changes`, the verbatim stop-condition). It never inspects the directory list.

So today two of the three E66 sites can be emptied entirely with a green suite.

**On the drift question the dispatch raises — it belongs in T-E66-02, not as a separate ticket, with one scope caveat.** The undetected direction (a directory named in the SOP but absent from `FEATURE_DIRS`) is real and I confirmed it is undetected: AC1 is `for (const dir of FEATURE_DIRS) assert(stagedTokens.includes(dir))`, a one-way subset check. Option (ii)'s partition test closes it *structurally* for any directory that exists on disk — `disk dirs = FEATURE_DIRS ⊎ NON_SOURCE_DIRS`, composed with AC1's `FEATURE_DIRS ⊆ SOP tokens`, yields `disk dirs ⊆ SOP tokens ∪ NON_SOURCE_DIRS`, which is the closure E66 wants. It does not need its own ticket. But that composition only holds for site 1; sites 2 and 3 remain unpinned in either direction, so T-E66-02 should extend the AC1-style capture-group assertion to the AC2 set and the scope-rule list, or option (ii) will close the class at one of three sites and leave the row's "converts remember-to-add-it into a failing test" claim two-thirds true.

**Coupling risk to state plainly for the coordinator**: nothing currently forces the two halves to ship together. `FEATURE_DIRS` still holds its original 15 entries and the SOP now names 18; the suite is green in that inconsistent state, and would stay green if T-E66-02 were dropped or deferred. Until it lands, `simulatePreCommitVerify` (the test's model of AC2) checks a strictly smaller set than the AC2 text it models.

## Security

No secrets, credentials, or trust boundaries touched — prose-only edits to two markdown files, no executable path changed. Concur with the sr-engineer checklist on substance.

One process-security note, non-blocking: `git add docs/ research/ multi-agent-scripts/` stages **untracked** files under those trees, not just modifications. That is already true of `content/`, `test/`, etc., so the diff introduces no new class — but `research/` (54 tracked files) is the likeliest place in this repo for in-flight exploratory notes, and the same sentence this diff edits at `:173` still lists "scratch dirs" among the STOP-triggering unrelated changes. After the edit, that sentence declares `research/` both EXPECTED-and-never-a-STOP and (by the scratch-dir clause) potentially STOP-worthy. The existing "run `git status --short` first" instruction at `:133` is the mitigation, and it is already there; a half-sentence at `:173` noting that these three additions can hold untracked scratch, unlike the TypeScript source dirs, would remove the ambiguity. Not blocking.

## Performance

No runtime code changed; no algorithmic surface. The only measurable cost is prompt-context size: `content/skill-release-engineer.md` grows 46,532 → 49,093 bytes (+2561, +5.5%), paid on every release-engineer dispatch. `test/context-budget.test.mjs` passes 54/54, so no declared budget is breached. See Quality N2 — wrapping the explanatory halves in the file's existing rationale fences would return ~2.3 KB of that to the strip pass and make the net dispatch cost roughly neutral. No performance regression.

## Verdict
CHANGES_REQUESTED — every claim in the diff is verified true and the approach is right, but each of the two files still contains a second site carrying the retired text the diff just corrected (`CLAUDE.md:49` "(32 entries)" vs the new `:87` 33; `skill-release-engineer.md:31`'s README release-notes subsection vs the new `:53`), leaving both files self-contradictory in exactly the way these tickets exist to prevent. Two one-line fixes; the rest of the round is sound.

## Round 1 reply — by sr-engineer

- **C1 fixed**: `CLAUDE.md:49` "(32 entries)" → "(33 entries)". Swept the rest of the file for other stale enumerations before closing this out: verified live counts for every other numeric claim in the file (`gates/registry.ts` GATE_REGISTRY.length=33, TOOL_REGISTRY.length=12, PROMPT_REGISTRY.length=11, 18-step pipeline via `name:` count in `UPDATE_STATE_GATE_PIPELINE`, 15 `const-*.md`, 7 `coord-*.md`, 11 `skill-*.md` incl. coordinator-lite, 12 `templates/claude-code-agents/`, 87 test files) — all already correct, `:49` was the only stale site in this file. Found the same "(32 entries)" stale count in two files outside this ticket's 2-file scope — `CONTRIBUTING.md:21` and `docs/architecture.md:112` — left untouched (out of declared scope) and flagged in `pending_notes` for the coordinator to file.
- **C2 fixed**: `content/skill-release-engineer.md:31` Artifact allowlist no longer grants the README release-notes subsection; now reads "install-pin replacements `#vX.Y.Z` only" and points at the SOP step 4 `README.md` bullet as the source of truth, matching `:53`'s E67a text.
- **`.github/` addition**: added to all three lists per dispatch — the SOP step 8 git-add line, the AC2 pre-commit-verify cross-reference set, and the Expected-vs-unrelated scope rule — with a one-sentence classification distinguishing it (tracked, feature-touchable, added) from `.current/` (only `.config.json` ships; rest is session bookkeeping per precedent commits `cc3e0df`/`53a6392` — deliberately NOT added).
- **N2 (rationale-fence, non-blocking) — partially folded in**: wrapped 4 of 5 candidate "why" spans in the file's own `<!-- rationale:start/end -->` convention where it was mechanical (move fences, no rewrite): E67a's parenthetical (`:53`), E67c's parenthetical (`:131`→now later line), E67d's parenthetical (`:139`→now later line), and E67f's parenthetical (`:41`). Verified post-strip output (`stripRationale(stripOriginTags(...))`) has no dangling references or leftover double-spaces. Left E67e's caveat (~1.1KB, the largest single span) and the tail of E67b unfenced: both interleave live-actionable guidance ("if a future run surfaces an unfamiliar code, check whether it's a batch-id artifact...") with the historical illustration, and cleanly separating them would require rewriting the prose (e.g. "harmless there" needs its antecedent rewritten to survive independently of the stripped example) rather than just moving fence markers — per the review's own carve-out, skipping rather than rewriting.
- Full suite re-run after all edits: `npm run build` clean (tsc + check-version + check:transitions-sync all OK), `npm test` → 1719/1719 pass, 0 fail. No expected-red manifest needed (no test file touched, no intentional red).

Handing back to code-reviewer.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Both round-1 blocking findings are genuinely fixed and independently verified against the artifacts, not the claim (C1: `CLAUDE.md:49` → 33, matches `GATE_REGISTRY.length === 33` at runtime; C2: `:31` allowlist and `:53` step-4 bullet now agree that no release-notes subsection exists, and README.md carries 0 `####` headings).
- The new `.github/` classification is correct and the three SOP lists are now byte-consistent at 19 directories. The `.current/` exclusion sentence is accurate as a rule and both cited bookkeeping commits check out.
- **New blocking regression, introduced by this round's N2 fencing.** Three of the five new rationale fences are placed at END OF LINE. `stripRationale`'s regex ends in `\n?` and consumes the trailing newline, so in the SOP that `tw_switch_role` actually delivers, **SOP steps 5 and 6 no longer exist as steps** — both are swallowed into step 4's `README.md` sub-bullet — and step 8's AC4 post-commit bullet is swallowed into the commit bullet. This is a strictly-worse render than base.
- Verdict: CHANGES_REQUESTED — one narrowly-scoped fix (move 3 fence terminators off end-of-line), everything else in the round stands.

## Correctness

### Blocking

**R2-1 — Three end-of-line rationale fences destroy the numbered-step structure of the rendered SOP. `content/skill-release-engineer.md:53`, `:54`, `:139`.**

`prompts/text-transforms.ts` strips with:

```
/<!-- rationale:start -->[\s\S]*?<!-- rationale:end -->\n?/g
```

The trailing `\n?` is deliberate and correct for BLOCK-form fences (start marker on its own line, as at `:126–128`), where the whole line goes away. It is wrong for an INLINE fence that *terminates* a line: the newline is eaten and the following line is glued on. The sibling stripper documents exactly this trap and deliberately omits `\n?` for the same reason — `stripOriginTags`: *"Unlike rationale fences, origin fences are INLINE (mid-sentence / end-of-heading), so the regex deliberately does NOT consume a trailing newline — doing so would join a fenced heading with the line below it."*

Rendered through the real pass (`stripRationale(stripOriginTags(...))`, i.e. `applyTextTransforms({fullDetail:false})` — the `tw_switch_role` dispatch path):

| step header | at HEAD | after this round |
|---|---|---|
| `4.` | own line | own line |
| `5.` | own line 54 | **gone** — absorbed into step 4's README sub-bullet |
| `6.` | own line 55 | **gone** — absorbed into the same line |
| `6a.` | own line 56 | own line |
| `- **Post-commit sanity check (AC4)**` | own line | **gone** — absorbed into the `git commit` bullet |

Rendered line 53 is a single 1190-char run-on ending `...is the release-notes record. 5. \`npm run build\`. ZERO compile errors required. ... or it never runs at all. 6. \`npm test\`. All tests MUST pass ...`. Rendered line 133 ends `...do NOT hardcode a specific model name/version here.    - **Post-commit sanity check (AC4)** — conditional on dispatch shape (E44)...`.

Two concrete consequences for a literal executor:

1. Step 6a's own text reads *"after `npm test` (step 6)"* — a dangling reference to a step that no longer appears as a step anywhere in the rendered document. This is precisely the post-strip dangling-reference class N2 was supposed to avoid creating.
2. The build/test steps are demoted from top-level numbered obligations to trailing prose inside a sub-bullet about editing README pins. The AC4 bullet marker is now mid-line, so it does not render as a list item at all.

This is a regression, not a pre-existing condition: at HEAD all three render on their own lines (verified by rendering `git show HEAD:content/skill-release-engineer.md` through the same pass).

**Fix** — no prose rewrite needed, only fence placement. For each of the three, either (a) move the fence to mid-line so text follows the `rationale:end` marker on the same line (the shape E67c at `:125` and E67f at `:41` already use — both verified clean in the render), or (b) promote it to BLOCK form on its own lines like `:126–128`. E67c and E67f need no change.

**Re-check before handing back:** render the file through `stripRationale(stripOriginTags(...))` and assert `5.`, `6.`, and the AC4 bullet each still begin a line. Do not rely on `npm test` for this — no test covers it (see R2-4).

### Verified — no finding

- **C1 fixed.** `CLAUDE.md:49` and `:87` both read 33. Cross-checked against the running artifact, not the source text: `GATE_REGISTRY.length === 33`. Swept `CLAUDE.md` for other bare `32`/`33` — only those two lines match; line 111 is an unrelated `constitution-rationale.md` reference. The claim of "no other stale enumerations in this file" holds.
- **C2 fixed, and the two sites genuinely reconcile.** `:31` now reads "install-pin replacements `#vX.Y.Z` only ... see SOP step 4's `README.md` bullet: there is no release-notes subsection to update"; `:53` says "Do not invent a release-notes subsection; the CHANGELOG entry ... is the release-notes record." No contradiction remains, and the cross-reference target is real. Ground truth re-verified: `grep -c '^####' README.md` → 0.
- **E67f verified against the tree**, not just asserted: `content/constitution.md` does not exist; `content/const-*.md` is exactly 15 files.
- **E67c verified**: the `v`-less form `agc check — OK (X.Y.Z) — all adapters current` matches real output.
- **AC1 does not red.** `test/release-staging.test.mjs:187` asserts `FEATURE_DIRS ⊆ stagedTokens` — a subset check, not equality — so adding four directories to the git-add line cannot fail it. sr's "1719/1719 pass" is consistent with the diff. This also means the four new directories are currently pinned by nothing; see R2-4.

## Quality

**R2-2 (non-blocking) — `.github/` classification is correct; the `.current/` exclusion sentence is accurate as a rule but has one historical counter-example.** `content/skill-release-engineer.md:173`.

Verified rather than accepted:
- `git ls-files .github/` → exactly `.github/workflows/ci.yml`. The sentence's parenthetical naming that one file is precisely right, and it is tracked and feature-touchable as claimed.
- All three lists now carry the same 19 directories — git-add (`:133`), AC2 (`:136`), Expected-scope (`:173`). I diffed them element-wise; no drift.
- Both cited bookkeeping commits are real and contain what the sentence says: `cc3e0df` → `.current/handoff.md`, `.current/metrics.jsonl`; `53a6392` → those plus `.current/telemetry.jsonl`.
- Across the eight most recent `chore(release)` commits, `.current/.config.json` is the only `.current/` path staged in seven of them. The exception is `11cc082` (v3.99.0), which also carried `.current/feature-split.md`.

The sentence is prescriptive ("only `.current/.config.json` ... ships with a release"), and one prior release deviating is arguably the drift the rule exists to standardize — so this is not a change request. Recording it so the next reader who runs the same check does not treat it as a discovered defect. If it is cheap, "only `.current/.config.json` is *staged by this step*" would be exactly true with no counter-example.

Worth noting the sentence earns its place beyond classification: `.current/feature-split.md` is modified in the working tree right now, is connected to the active feature, and is not in the git-add list. Before this sentence, a literal executor reaching the Expected-vs-unrelated STOP rule had no guidance on it. Now it does.

**R2-3 (non-blocking) — `:53` hardcodes a pin count, which is the same stale-literal class E67d exists to remove.** The bullet reads "these **3** pin replacements are the whole of what recent releases have actually touched in this file." Accurate today — `README.md` carries exactly 3 `#v` pins (lines 30, 34, 182). But E67d's own rationale, three steps later, argues that "a hardcoded model-version trailer is exactly the class of literal that goes stale — defer to the harness's live prescription instead of restating a snapshot of it here." A hardcoded count of a thing the same sentence tells you to find with "replace **all**" is the same shape. The normative instruction ("replace all") is correct and load-bearing; the count is decorative corroboration. Dropping "these 3" (or moving it inside the rationale fence, subject to R2-1's placement rule) costs nothing.

**R2-4 (non-blocking, hand to QA) — the four new directories are unpinned, and so is the render invariant R2-1 just broke.** Two distinct gaps, both landing in T-E66-02's lap; carried into the handoff notes.

**N2 disposition — accepted as partially taken, with a correction to the self-report.** Four of five spans fenced is a reasonable stop, and leaving E67e's caveat unfenced is defensible: it terminates in a genuinely normative clause ("Do NOT re-engineer the derivation to special-case batch prefixes"), so it is not pure "why" prose and does not cleanly belong behind a fence. One correction for the record: sr's `pending_notes` state that "E67b tail" was left unfenced, but E67b's tail *is* fenced at `:54` — and it is one of the three fences that cause R2-1. The disposition is fine; the description of it was not.

**N3 / N4 — still open, still out of scope, correctly untouched.** Restated here only so they survive into the coordinator's filing.

**Scope discipline — correct, no finding.** The same stale "32 entries" at `CONTRIBUTING.md:21` and `docs/architecture.md:112` sits outside the declared 2-file scope and was left untouched with a flag to the coordinator. That is the right call and I am explicitly not requiring it in this round.

## Architecture
No architecture spec for this feature (backlog-row-as-spec mini-chain). No layering change — three markdown files. R2-1 is not an architecture violation but a violation of an existing documented convention *inside* the render layer: `prompts/text-transforms.ts` states the block-vs-inline fence contract in a comment, and the new fences break it. The convention deserves a test, not just a comment (R2-4).

## Security
No findings. No new input crosses a trust boundary; no secrets, no executable surface. The `git add` line gained four literal directory tokens, all tracked paths — no globbing or shell expansion introduced.

## Performance
No findings. `content/skill-release-engineer.md` grows ~2.0KB of source, but the rendered (post-strip) delta is smaller because 4 of 5 additions are fenced. No hot-path or dispatch-budget concern at this size. Note the irony that R2-1's newline consumption slightly *reduces* rendered line count (167 vs 174) — that is corruption, not savings.

## Verdict
CHANGES_REQUESTED — the round-1 fixes and the `.github/` work are all sound and verified, but the new fencing silently deletes SOP steps 5 and 6 and the AC4 bullet from the SOP as actually served to release-engineer; the fix is a three-site fence relocation with no prose rewrite.

## Round 2 reply — by sr-engineer

- **R2-1 fixed by dropping all three offending fences**, not relocating them. `stripRationale`'s `\n?` only consumes a newline when one immediately follows `<!-- rationale:end -->`; the three broken spans (`:53` E67a, `:54` E67b tail, `:139` E67d) each sat at the true end of their sentence/bullet with no further same-line text to sandwich the fence against, so a mid-line relocation would have required inserting the markers mid-sentence (splitting "…touched in this file." from "Do not invent…", and similarly for the other two) — mechanical, but riskier to get byte-exact than simply reverting. Chose reversion per the task's own framing ("Reverting a fence is a legitimate outcome here") and because it matches the treatment already given to E67e's caveat and (per round-1's original intent, confirmed by this round's N2 correction) E67b's tail — all three now read as plain unfenced prose, byte-identical to their pre-fence wording. E67c (`:131`) and E67f (`:41`) untouched, as directed.
- **Verified via the real strip pass, not the source** — rebuilt (`npm run build` clean) and ran `stripRationale(stripOriginTags(fs.readFileSync('content/skill-release-engineer.md')))` (the exact `tw_switch_role` dispatch path):
  - Step `4.` own line (49), step `5.` own line (54), step `6.` own line (55), step `6a.` own line (56), the `- **Post-commit sanity check (AC4)**` bullet own line (136) — all five render as separate lines, matching HEAD's shape.
  - Step 6a's "after `npm test` (step 6)" now correctly references a step that renders (step `6.` at line 55) — no dangling ref.
  - Checked for stray artifacts from the marker removal: no doubled spaces, no orphaned punctuation at any of the three edit sites.
- **Noted, not fixed (out of this diff's scope): a pre-existing instance of the same `\n?`-swallow class, predating this feature.** The BLOCK-form rationale fence at `:126–128` (the "on the premise this replaces" span, part of the earlier E49/E50 MUST-NOT rationale, not part of this round's N2 fencing) has its `<!-- rationale:end -->` alone on its own line, immediately followed by a newline into step `7b.` — rendering through the same strip pass glues `"...MUST be touched.7b. **Drift-baseline acknowledgment**..."` onto one line with no separating space. Confirmed this is not a regression from this diff (the span is untouched by T-E66-01/T-E67-01/T-E67-02) and is orthogonal to R2-1's three sites. Flagging in `pending_notes` for the coordinator rather than fixing here — outside the declared 2-file, 3-site scope of this round's fix, and correcting it would touch prose this ticket did not open.
- Full verification re-run after the edits: `npx tsc --noEmit` clean, `npm run build` clean (tsc + check-version + check:transitions-sync all OK), `npm test` → 1719/1719 pass, 0 fail (unchanged from round 1's count — no test file touched). No expected-red manifest needed.
- Security checklist: no secrets, no external input, no injection surface — prose-only edits to `content/skill-release-engineer.md`, three fence-marker removals, no wording changed.

Handing back to code-reviewer.

---

## Round 3 — APPROVED — by code-reviewer

## Summary
- **R2-1 is fixed, verified through the real render pass rather than the source or the claim.** Rendering the working-tree file through `stripRationale(stripOriginTags(...))` — the exact `tw_switch_role` dispatch path — puts step `4.` at rendered line 49, the `README.md` sub-bullet at 53, step `5.` at 54, step `6.` at 55, step `6a.` at 56, and `- **Post-commit sanity check (AC4)**` at 136. Each begins its own line. Step 6a's "after `npm test` (step 6)" now resolves to a step that renders. This matches sr's self-report line-for-line.
- **No new glue anywhere in the file.** A systematic scan of every `rationale:start…end` span (not just the three R2-1 sites) shows the working tree carries 4 fences: the two this cut added (`:41` E67f, `:131` E67c) are both mid-line with same-line trailing text and consume no newline; the two that do consume one are byte-identical to HEAD.
- **The pre-existing swallow is confirmed pre-existing — and it is two sites, not one.** sr reported `:126–128`. There is a second, same-class instance at `:119`. Both reproduce identically against `git show HEAD:content/skill-release-engineer.md` rendered through the same pass. Neither is in this cut; neither is required here. Handing the *pair* to the coordinator so the follow-up ticket is filed at full width (detail in N-R3-1).
- Every E67 factual claim re-verified against live artifacts a third time (README `####` count, npm lifecycle scripts, `agc check` output literal, `GATE_REGISTRY.length`, `const-*.md` count, tracked-ness of the four new dirs). All three SOP directory lists diff element-wise to the same 19 entries, in the same order. `npm test` → 1719/1719, 0 fail.
- Verdict: APPROVED. Nothing remaining makes the shipped SOP wrong for a literal executor, and nothing remaining was introduced by this cut.

## Correctness

### R2-1 — resolved. Render verified directly.

Rendered through `stripRationale(stripOriginTags(...))` (`applyTextTransforms({fullDetail:false})`):

| step header | HEAD | round 2 (broken) | round 3 (now) |
|---|---|---|---|
| `4.` | own line | own line | own line 49 |
| `5.` | own line | absorbed into step 4 | own line 54 |
| `6.` | own line | absorbed into step 4 | own line 55 |
| `6a.` | own line | own line | own line 56 |
| `- **Post-commit sanity check (AC4)**` | own line | absorbed into commit bullet | own line 136 |

The chosen resolution — reverting the three fences to plain unfenced prose rather than relocating them mid-line — is sound. `stripRationale` only eats a newline when one immediately follows `rationale:end`; with the markers gone there is no strip site at all, so the render is structurally identical to HEAD at those three points. Reversion also avoids the byte-exactness risk of splitting three sentences mid-clause, which was the alternative. The cost is the ~2.3 KB of unfenced rationale N2 wanted back — accepted; N2 was non-blocking and a correct render outranks a smaller one.

The two fences this cut retains are the safe shape and were re-verified individually:
- `:41` (E67f) — `…/ \`content/const-*.md\`.<!-- rationale:start --> (…)<!-- rationale:end --> \`gates/\` joins this list…` — trailing same-line text, no newline consumed.
- `:131` (E67c) — `…all adapters current\`)<!-- rationale:start --> (…)<!-- rationale:end --> — a stale stamp caught here…` — same shape, no newline consumed.

### Full-file fence audit (WT vs HEAD)

Enumerating every span rather than spot-checking the three known sites:

```
=== working tree — 4 rationale fences ===
  L 41- 41  safe             (mid-line, added this cut)
  L119-119  GLUES-NEXT-LINE  next: - `mkdir -p` the archive dir for each tree that is NOT `EX…
  L126-128  GLUES-NEXT-LINE  next: 7b. **Drift-baseline acknowledgment** (moved ahead of the …
  L131-131  safe             (mid-line, added this cut)

=== HEAD — 2 rationale fences ===
  L117-117  GLUES-NEXT-LINE  next: - `mkdir -p` the archive dir for each tree that is NOT `EX…
  L124-126  GLUES-NEXT-LINE  next: 7b. **Drift-baseline acknowledgment** (moved ahead of the …
```

Both hazard sites exist at HEAD (at `:117` / `:124–126`, shifted to `:119` / `:126–128` by this cut's insertions above them) and neither span is touched by this diff. This cut added exactly two fences and both are clean. **Confirmed: the swallow class is entirely pre-existing and out of this cut.**

### N-R3-1 (non-blocking, for the coordinator's follow-up ticket) — the pre-existing swallow is TWO sites.

sr's `pending_notes` name only `:126–128`. The second is `:119`.

**Site A — `:126–128`** (the one sr reported). `<!-- rationale:end -->` sits alone on `:128`, immediately followed by `7b.`. Rendered:
```
…not new since `$PREV_TAG` — MUST NOT be touched.7b. **Drift-baseline acknowledgment** (moved ahead…
```
Step `7b.` does not exist as a step in the rendered SOP — it is trailing prose inside step 7a's "Zero matches = silent no-op" sub-bullet, with no separating space. Byte-identical at HEAD. (One correction for the record: the glued text is `MUST NOT be touched.`, not `MUST be touched.` as the note states — the sentence is a prohibition, and a reader chasing the note with the wrong string will not find it.)

**Site B — `:119`** (not previously reported). The `- **Log \`<CODES>\` even when empty (E50)**` bullet terminates in `<!-- rationale:end -->` at end-of-line; the following `- \`mkdir -p\`` bullet is glued on. Rendered:
```
…the same self-documenting move step 8's AC4 SKIP branch already makes.    - `mkdir -p` the archive dir for each tree that is NOT `EX…
```
Byte-identical at HEAD (rendered line 117 there, 119 here). The `mkdir -p` bullet — which creates the archive directories step 7a's subsequent move commands write into — does not render as a list item.

Site B is the more consequential of the two: it demotes a directory-creating command inside the archive step, where A demotes a step header whose body still renders in full. Both are the same root cause and should be one ticket. Neither is required in this round; recording the pair so the filing does not have to rediscover B.

### Re-verified — no finding

Every claim checked against the live artifact, third pass:

| claim | check | result |
|---|---|---|
| README has no `####` convention; 3 install pins | `grep -c '^####' README.md`; `grep -c '#v[0-9]'` | 0 and 3 — E67a and the "3" both exact |
| `npx tsc` bypasses `postbuild` | `package.json` → `build: "tsc"`, `postbuild: "npm run check:transitions-sync"` | true; npm hooks never fire on bare `npx tsc` |
| `agc check` output has no leading `v` | `bin/agc-init.mjs:210` → `` `agc check — OK (${ver}) — all adapters current` `` | true, byte-for-byte |
| `GATE_REGISTRY` is 33 | loaded `dist/gates/registry.js` at runtime | 33 — matches both `CLAUDE.md:49` and `:87` |
| `content/constitution.md` absent, 15 `const-*.md` | filesystem | true |
| four new dirs are tracked | `git ls-files` | `docs/` 25, `research/` 54, `multi-agent-scripts/` 5, `.github/` 1 |
| three SOP lists agree | element-wise diff of git-add capture group, AC2 `{…}` set, Expected-scope list | all three = same 19 dirs, same order; git-add additionally carries `dist/`, correctly a metadata path not a feature dir |
| suite green | `npm test` | 1719/1719, 0 fail; `test/release-staging.test.mjs` 66/66 |

`CLAUDE.md` re-swept for other stale enumerations: the `18-step UPDATE_STATE_GATE_PIPELINE` claim at `:47`/`:61` verifies against a runtime length of 18, and `87 test files` matches `ls test/*.test.mjs`. No new inconsistency introduced.

No expected-red manifest is required — SOP step 4a does not arm (no test file touched, no intentional red).

## Quality

**Still open, still correctly out of scope, restated so they survive into the coordinator's filing:**
- **R2-3** — `:53` still hardcodes "these **3** pin replacements", the same stale-literal class E67d's own rationale argues against. Accurate today (exactly 3 pins). The normative half — "replace **all** `#v<old>` pins" — is correct and load-bearing; the count is decorative. Cheap to drop whenever this file is next opened.
- **R2-2** — the `.current/` exclusion sentence is prescriptive and has one historical counter-example (`11cc082`/v3.99.0 also staged `.current/feature-split.md`). Wording it as "only `.current/.config.json` is *staged by this step*" would be exactly true.
- **N3** — `content/skill-doc-writer.md:33` carries the identical fictitious README release-notes convention, and doc-writer is the role that would act on it. Outside the declared 2-file scope.
- **N4** — E67d gives a literal reader no fallback when the host prescribes no `Co-Authored-By:` trailer.
- **Scope discipline** — the same stale "32 entries" at `CONTRIBUTING.md:21` and `docs/architecture.md:112` remains untouched and flagged. Correct call; explicitly not required here.

**N-R3-2 (non-blocking) — the fence contract is documented in a comment and violated twice in the tree, with no test.** `prompts/text-transforms.ts` states the block-vs-inline contract precisely in `stripOriginTags`'s comment (*"origin fences are INLINE … so the regex deliberately does NOT consume a trailing newline — doing so would join a fenced heading with the line below it"*), and `stripRationale` keeps the `\n?` for block-form fences. The trap is real, it has bitten twice in this file at HEAD, and it bit this feature once in round 2 — three occurrences of a class that `npm test` cannot see. This is R2-4's render-structure test, and it is the highest-value item in T-E66-02's lap.

## Architecture
No architecture spec (backlog-row-as-spec mini-chain); `docs/backlog.md:189` (E66) / `:190` (E67) are the contract, and both rows are now satisfied in substance and at every in-file site. No layering change — two markdown files. Round 2's convention violation inside the render layer is resolved by reversion; the convention itself remains untested (N-R3-2).

Round 1's architectural finding stands and is unchanged by this round: `docs/`, `research/`, `multi-agent-scripts/`, and `.github/` are not TypeScript source roots, so `AC-B5.5`'s `getTsConfigSourceDirs(tsconfig.json)` derivation can never wake for them — hand-enumeration plus an explicit partition test is the correct architecture, and option (ii) is the right call.

## Security
No findings. Prose-only edits to two markdown files; no executable path, trust boundary, or secret touched. The `git add` line gained four literal directory tokens, all tracked paths, no globbing or shell expansion. Round 1's process note about `git add research/` staging untracked exploratory files stands as a non-blocking observation; the pre-existing "run `git status --short` first" instruction at `:129` is the mitigation and is already present.

## Performance
No findings. No runtime code changed. `content/skill-release-engineer.md` grows ~2.5 KB of source paid per release-engineer dispatch; the round-2 reversion returns ~2.3 KB of that to the unstripped path, so the rendered delta is now close to the source delta. `test/context-budget.test.mjs` declares no breach and the suite is green. No hot-path or complexity-class change.

## Verdict
APPROVED — R2-1 is fixed and verified through the real `stripRationale(stripOriginTags(...))` render, not the source: steps 4, 5, 6, 6a and step 8's AC4 bullet each begin their own line, and a full-file fence audit shows this cut added two fences, both of the safe mid-line shape. The two remaining newline-swallow sites (`:119`, `:126–128`) are byte-identical to HEAD, genuinely pre-existing, and correctly out of this cut. Everything still open is non-blocking and carried forward.

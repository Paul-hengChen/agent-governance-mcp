# QA Review — T-E48-03

covers: T-E48-01, T-E48-02, T-E48-03

Feature: `e48-docs-skills-delete`. Mini-chain (backlog row `docs/backlog.md:171`
plus the human decision recorded in handoff `scope_decision_why` ARE the spec;
PM/architect skipped by design). sr-engineer (T-E48-01) deleted `docs/skills/`
entirely and reworded `scripts/check-transitions-sync.mjs:17-19`. code-reviewer
(T-E48-02) APPROVED in round 2 after a round-1 CHANGES_REQUESTED
(`review_reports/review_T-E48-02.md`), and forward-routed one required-scope
finding (C2, non-blocking to T-E48-01) plus one advisory (C7) into this ticket.

## Handoff-integrity note (not a T-E48-01/02 defect, recorded for the record)

The handoff write that landed round 2's APPROVED verdict stamped
`agent_id: "qa-engineer"` instead of `"code-reviewer"` and left `pending_notes`
truncated in the summary view (`pending_notes_truncated.total_chars: 4720`
against a 3000-char display limit — the full text was present, just clipped in
the `tw_get_state` JSON preview). I did not reconstruct scope from
`pending_notes` or `tasks.md` alone; both were cross-checked against the
authoritative evidence file `review_reports/review_T-E48-02.md` (Round 1 +
Round 2), which is internally consistent and was the source of record for
everything below.

## Expected-Red Diff (Phase 0.5)

`qa_reports/expected-red_e48-docs-skills-delete.txt` declared 2 intentional
reds (`test/release-staging.test.mjs` lines 1283 and 1301, both ENOENT
crashes from `docs/skills/` having been deleted). Both entries verified
byte-identical against the live test file before editing, against both the
pre-edit red run (`not ok 1174`/`not ok 1175`, both `testCodeFailure` ENOENT,
matching the manifest's two declared entries exactly, nothing else red) and
the post-edit green run (both tests renamed/rewritten and now passing as part
of the 1720/1720 suite — see Phase 4). Disposition: both declared reds
accounted for, none unexplained, no undeclared red found. Its `#` rationale
block's count prescription ("shrink the 9-site enumeration to the 1 remaining
live site") was itself wrong — code-reviewer's own round-2 C7 flagged this as
its round-1 miss and routed the fix to this ticket. Corrected below (item 4).

## Phase 1 — Review / re-derivation

Re-derived C2 from the tree myself rather than trusting the review report's
prose, per the dispatch instruction and per this repo's own history on this
exact enumeration (5 → 6 → 7 → 9, every prior miss a live site nobody
counted):

- `grep -rniIE '\bwaived\b' content/ docs/ templates/ prompts/ tools/ gates/ bin/ scripts/ CLAUDE.md README.md AGENTS.md .antigravityrules`
  → hits in `docs/backlog.md` ONLY, lines 180/182/206/207 (E57/E59 ticket rows
  describing the abolished escape — legitimate history, untouched). Zero hits
  in `content/`. Confirms the tree-sweep narrowing to `content/` alone is
  lossless.
- `grep -rn "re-review trigger\|dependency-advisor\|NOT a waiver\|Dependency audit at build gate\|Dependency-audit disposition" content/` →
  exactly 4 lines, in exactly 2 files: `content/const-15-core-tail.md:11` and
  `content/skill-release-engineer.md:56,57,58`. No fifth live site exists
  anywhere in `content/`; the count is 4, not 1 and not 5+.
- Confirmed `content/skill-release-engineer.md:57`'s "waiver" and
  `const-15-core-tail.md:11`'s "NOT a waiver" are the noun form, which
  `/\bwaived\b/i` does not match — the addition cannot false-positive the
  tree sweep.
- **Found and fixed a latent false-fail the review's prose claim glossed over**:
  a naive single-line anchor at the `:57` ("Already recorded") bullet lead
  does NOT literally contain either "disposition" or "dependency-advisory
  record" (verified with a standalone `node -e` regex probe against the live
  file) — the review's claim that "the existing per-site assertions ... hold
  on all three new excerpts as written" does not hold for a bullet-only
  anchor. Fix: widened the `:57` and `:58` anchors to span from the `:56`
  heading through each bullet's own end (`[\s\S]*?` instead of a same-line
  `.*$`), since a disposition sub-bullet is not semantically complete
  detached from the heading that introduces it. Re-verified with the same
  probe: both now contain "disposition" and neither contains `waived`.
  Uniqueness of all three anchor phrases confirmed (`grep -c` = 3 total
  matches across the three patterns in the file, one each).

## Phase 2 — Discussion

None needed — the re-derivation confirmed the review's core finding (4 sites,
not 1) without surfacing a fifth site or falsifying the count; the one
correction needed was to my own anchor design, not to the site count.

## Phase 3 — Changes made (`test/release-staging.test.mjs`)

1. **Tree sweep (`:1283-1299` before edit)**: dropped `docs/skills` from the
   `trees` array (now `[content/]` only). Renamed the test
   (`"... does not reappear anywhere in content/ (structural, tree-wide
   sweep)"`) and reworded the failure message to drop the `docs/skills/`
   mention.
2. **Per-site enumeration (`:1301-1354` before edit)**: removed the
   `RELEASE_MIRROR`/`SR_MIRROR` `readFileSync` calls (both threw ENOENT).
   Re-baselined the `sites` array from 9 to 4:
   - `content/const-15-core-tail.md:11` (source bullet) — kept, anchor
     unchanged.
   - Dropped all 8 `docs/skills/*` mirror/table-row/mermaid entries.
   - Added 3 new entries against `SKILL` (`content/skill-release-engineer.md`,
     already loaded at file top): `:56` (the `6a. **Dependency-audit
     disposition**` heading), `:57` (`- **Already recorded**` bullet, widened
     anchor per Phase 1), `:58` (`- **Not recorded, or recorded but its
     re-review trigger has since fired**` bullet, widened anchor per Phase 1).
   - Renamed the test to say "4 live §6 ... sites" and cite
     `review_T-E48-02.md round 1/2 C2` instead of the stale `review_T-E59-01.md
     Round 2` count.
3. **Counter-guard (`:1353` before edit)**: `assert.equal(sites.length, 9, ...)`
   → `assert.equal(sites.length, 4, ...)`, with a dated message recording both
   directions of the delta (−8 `docs/skills/` mirror sites deleted by E48, +3
   previously-unpinned live `content/skill-release-engineer.md:56-58` sites
   added), so the count change reads as deliberate from either direction.
4. **Header WHY comment (`:1242-1274` before edit)**: updated to record the
   2026-08-17 re-baseline inline (why 9 → 4, not 9 → 1; which sites moved,
   which were added) rather than leaving the block describing a 9-site/
   two-tree state that no longer matches the code beneath it. Not explicitly
   named in the dispatch, but leaving it stale would misdescribe the test
   directly below it — same defect class E48 exists to close.
5. **`qa_reports/expected-red_e48-docs-skills-delete.txt`**: corrected the `#`
   rationale block's superseded "shrink to the 1 remaining live site" line to
   record the actual 9 → 4 re-baseline and its reason (3 previously-unpinned
   live sites), per code-reviewer's round-2 C7. Left both `file | test name`
   entries untouched (already verified correct by two review rounds).

## Phase 4 — Run

### Build / audit / suite

```
npm run build                     → clean: check:version OK, tsc clean, postbuild check:transitions-sync OK (21 keys, exact match)
npm audit --audit-level=high      → exit 0; 5 pre-existing moderate/low transitive advisories (@hono/node-server, body-parser, esbuild, hono, protobufjs), all pre-existing, none HIGH/CRITICAL
npm test                          → 1720 total / 1720 pass / 0 fail   (was 1720 / 1718 / 2 fail: not ok 1174 @:1283, not ok 1175 @:1301)
```

### Scope verification (by diff, not by report)

- `git diff HEAD --stat -- content/` → empty. `content/` byte-identical to HEAD.
- `git diff HEAD --stat` (whole tree) → only `.current/feature-split.md`,
  `.current/handoff.md` (session state), `scripts/check-transitions-sync.mjs`
  (T-E48-01's sanctioned reword, already reviewed/APPROVED), `tasks.md` (+3,
  the coordinator-authored task rows), and `test/release-staging.test.mjs`
  (this ticket's own edit) touched. 12 `docs/skills/*` deletions still staged
  and deletions-only.
- No history file rewritten: `specs/`, `CHANGELOG.md`, `review_reports/`
  (aside from the new untracked `review_T-E48-02.md`, an addition not a
  rewrite) and `qa_reports/` (aside from item 5 above, my own scoped fix) do
  not appear in the diff at all.

## Verdict: PASS

All three task ids (T-E48-01, T-E48-02, T-E48-03) verified. The E59 pin
re-baselines to 4 sites (not 1), matching code-reviewer's re-derived C2 exactly,
with one correction of my own: the `:57`/`:58` per-site anchors needed
widening to include their `:56` heading context, or the existing
disposition/dependency-advisory-record presence assertion would false-fail on
those two sites — verified directly with a standalone regex probe before
committing to the anchors. `content/` remains byte-identical to HEAD; no
history file was rewritten; build/audit/suite all green (1720/1720, `npm
audit` exit 0 at 5 pre-existing sub-HIGH advisories). Expected-red manifest's
superseded rationale line corrected per code-reviewer's C7.
## 2026-08-17T06:52:56.701Z — PASS — by qa-engineer

PASS. Re-derived C2 independently (grep across content/ + full tree for &quot;waived&quot;, and for the disposition-channel phrases) and confirmed the correct re-baseline is 9 -&gt; 4 sites, not 9 -&gt; 1: content/const-15-core-tail.md:11 (kept) + content/skill-release-engineer.md:56/:57/:58 (added, never in E59's original enumeration). No 5th live site exists. Rewrote test/release-staging.test.mjs: dropped docs/skills from the :1284 tree-sweep array (renamed test + failure message), removed the RELEASE_MIRROR/SR_MIRROR ENOENT-throwing reads, re-baselined the sites array to the 4 real sites, moved the :1353 counter-guard to 4 with a dated bidirectional-delta message, and updated the header WHY comment so it doesn't misdescribe the code beneath it. Found and fixed a real gap in the review's own claim: a naive single-line anchor at :57's bullet lead does not literally contain &quot;disposition&quot;/&quot;dependency-advisory record&quot; -- widened the :57/:58 anchors to include the :56 heading context so the existing presence assertion actually holds (verified with a standalone regex probe before and after). Corrected the expected-red manifest's superseded &quot;shrink to 1 site&quot; rationale line (code-reviewer's C7). npm run build clean; npm audit --audit-level=high exit 0 (5 pre-existing moderate/low transitive advisories); npm test 1720/1720 (was 1720/1718, 2 fail). content/ byte-identical to HEAD; no history file (specs/, CHANGELOG.md, review_reports/, qa_reports/ other than the one scoped fix, tasks.md) rewritten. Evidence: qa_reports/review_T-E48-03.md (covers T-E48-01, T-E48-02, T-E48-03).

## 2026-08-17T06:53:35.190Z — PASS — by qa-engineer

PASS. Re-derived C2 independently (grep across content/ + full tree for &quot;waived&quot;, and for the disposition-channel phrases) and confirmed the correct re-baseline is 9 -&gt; 4 sites, not 9 -&gt; 1: content/const-15-core-tail.md:11 (kept) + content/skill-release-engineer.md:56/:57/:58 (added, never in E59's original enumeration). No 5th live site exists. Rewrote test/release-staging.test.mjs: dropped docs/skills from the :1284 tree-sweep array (renamed test + failure message), removed the RELEASE_MIRROR/SR_MIRROR ENOENT-throwing reads, re-baselined the sites array to the 4 real sites, moved the :1353 counter-guard to 4 with a dated bidirectional-delta message, and updated the header WHY comment so it doesn't misdescribe the code beneath it. Found and fixed a real gap in the review's own claim: a naive single-line anchor at :57's bullet lead does not literally contain &quot;disposition&quot;/&quot;dependency-advisory record&quot; -- widened the :57/:58 anchors to include the :56 heading context so the existing presence assertion actually holds (verified with a standalone regex probe before and after). Corrected the expected-red manifest's superseded &quot;shrink to 1 site&quot; rationale line (code-reviewer's C7). npm run build clean; npm audit --audit-level=high exit 0 (5 pre-existing moderate/low transitive advisories); npm test 1720/1720 (was 1720/1718, 2 fail). content/ byte-identical to HEAD; no history file (specs/, CHANGELOG.md, review_reports/, qa_reports/ other than the one scoped fix, tasks.md) rewritten. Evidence: qa_reports/review_T-E48-03.md (covers T-E48-01, T-E48-02, T-E48-03).


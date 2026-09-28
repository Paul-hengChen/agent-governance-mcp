# Review — T-E4X-03 (T-E44-01 + T-E49-01)

covers: T-E4X-03, T-E44-01, T-E49-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- One file changed: `content/skill-release-engineer.md` (+2,898 bytes, 25,012 → 27,910). Step 7a's ticket-code derivation (T-E49-01) and step 8's AC4 post-commit check (T-E44-01). Content-only; zero source, gate, schema, prompt, constitution or test files touched — boundary claim verified independently.
- **T-E44-01 (AC4 → REQUIRE / SKIP / UNCLASSIFIABLE) is correct.** The three branches match the pinned cut, the REQUIRE branch's STOP string is byte-identical to the pre-E44 text, and every unhandled shape fails safe toward STOP. Two non-blocking findings.
- **T-E49-01 (step 7a `<CODES>` derivation) is fatally broken and must be re-done.** Applied mechanically to the exact release it was authored to fix (v3.95.0), the rule yields a set **disjoint from the right answer** — `{E37, E38}` instead of `{E45, E46}` — because it scopes itself to *slugs* while the range references the shipped tickets only as *bare codes*.
- The rule's own illustrative example is counterfactual: the two slugs it cites appear **only in the release commit**, which does not exist when step 7a runs (7a precedes step 8 by construction — its moves must land *in* that commit).
- The parenthetical "the same range this SOP already reads for the CHANGELOG, step 4" is false, and `<prev-tag>` is left undefined anywhere in the file.
- Verdict: **CHANGES_REQUESTED** — E44's failure mode (a governance step whose literal text does not work) is reproduced one ticket later, in the ticket written to fix that class.

## Correctness

### F1 — BLOCKING (T-E49-01) — `content/skill-release-engineer.md:54`: the derivation returns the wrong set on the release it was written for
The rule collects codes from "every ticket/feature **slug** referenced in that range's commit subjects/bodies". Mechanically applied to the v3.95.0 range at step-7a time (`v3.94.0..7b49d81~1` — the release commit does not yet exist):

```
$ git log v3.94.0..7b49d81~1 --pretty=format:'%s%n%b' | grep -oiE '\be[0-9]{1,3}-[a-z0-9-]+' | sort -u
E37-style       # from "C13/E37-style provenance" in ad617da's body
E38-advisory    # from "two E38-advisory pins"   in ad617da's body
```
→ `<CODES> = {E37, E38}`. The tickets that actually shipped appear only as bare codes:
```
$ git log v3.94.0..7b49d81~1 --pretty=format:'%s%n%b' | grep -oE '\bE[0-9]{1,3}\b' | sort -u
E37 E38 E39 E40 E41 E42 E43 E44 E45 E46 E47
$ git log v3.94.0..7b49d81~1 --pretty=format:'%s%n%b' \
    | grep -ic "e45-qa-blocked-pm-escape\|e46-qa-spec-defect-status-rule"
0
```
The set is not merely too narrow — it is **disjoint** from `{E45, E46}`, so the orphaned `qa_reports/review_T-E45-01.md` that E49 exists to make reachable would *still* not be swept, while two prose-mention codes would be. The retained MUST NOT cannot save this: it excludes files *outside* `<CODES>`, so a wrong-but-nonempty `<CODES>` is exactly the case it does not bound.

Loosening the read of "ticket/feature slug" to any hyphenated token is worse, not better — the same range then yields `18 2026 76 9 951 97 AC ADD AGC AGENT ANTI AUTO BUTTON BYTE CAPTURE CHAIN CODE COMPOSE CONTRACT COORD CROSS CUT DEAD DESIGN DEV DOC DONE DRIFT FEATURE FIRST HTTP HUMAN IN LABEL MID MINI NO NON OPT PATH PER POST PRE QA RE RETRO ROUND ROW SCHEMA SHIPS SIBLING SKILL SPEC SR THREE VS WATERMARK` (`BUTTON` comes from a *consumer workspace's* feature `button-figma-realign` quoted in `ad617da`'s body). Neither reading is executable. The step is unexecutable-as-written, which is definitionally the E43/E44 defect class.

**Required change:** derive from bare ticket codes, not slugs, with a stated regex and a stated source. A derivation that works on the real case, e.g.: `git log <prev-tag>..HEAD --pretty=format:'%s' | grep -oE '\b[A-Z][0-9]{1,3}\b'` over **subjects only** (subjects carry `E45`/`E46` for both feature commits; bodies are where the prose-mention noise lives) — plus an explicit intersection with the ids that actually have evidence files at `qa_reports/` root. State the regex literally so the next release-engineer does not have to invent one.

### F2 — BLOCKING (T-E49-01) — `:54`: the worked example describes commits that cannot exist at step 7a
The example asserts "a range whose commits reference both `e45-qa-blocked-pm-escape` and `e46-qa-spec-defect-status-rule`". Those two slugs occur **exactly twice in the whole range, both inside release commit `7b49d81`**:
```
$ git show -s --format='%s%n%b' 7b49d81 | grep -c "e45-qa-blocked-pm-escape\|e46-qa-spec-defect-status-rule"
2
```
Step 7a's own preamble requires its moves to "land in the SAME release commit" — so 7a necessarily runs *before* that commit is authored. The example silently reads state from the future. A release-engineer who trusts the example and gets an empty/wrong set has no way to tell which of the two is broken. Re-derive the example from the pre-release range, or drop it.

### F3 — BLOCKING (T-E49-01) — `:54`: false provenance claim, and `<prev-tag>` is never defined
`grep -n "git log" content/skill-release-engineer.md` returns **only line 54**, and `grep -n "prev-tag"` likewise. So:
- "the same range this SOP already reads for the CHANGELOG, step 4" is untrue — step 4 builds the CHANGELOG from the `qa_review` summary and the version literals, and reads no git history at all. The claim was inherited verbatim from the E49 backlog row (`docs/backlog.md:172`) and propagated without checking; the backlog row is wrong on this point too.
- `<prev-tag>` is a placeholder with no resolution rule anywhere in the file. At step 7a the *new* tag does not exist yet, so it means "the latest existing tag" — but the step must say so (`git describe --tags --abbrev=0`), or the role guesses. This is the same defect shape as F1: a step that reads as executable but is not.

### F4 — non-blocking (T-E49-01) — `:54,:58,:61`: mentioned-in-range ≠ shipped-in-release
Release ranges routinely carry state-bookkeeping commits that enumerate *newly filed, unshipped* tickets. `5a9a824`, inside the v3.95.0 range, filed `E39 E40 E41 E42 E43 E44` as OPEN. Under any code-level derivation those become archive candidates for a release that shipped none of them. Today they survive only because they appear as bare codes and the current text hunts slugs (F1) — i.e. the false-positive risk is masked by a different bug, and fixing F1 unmasks it. The MUST NOT is structurally incapable of bounding this: it is expressed *in terms of* `<CODES>`, so it is tautological with respect to over-derivation. Whatever derivation replaces F1 needs a bound that is **independent** of `<CODES>` — the natural one is `covers:`/filename evidence intersected with the ids the release's `completed_tasks` ledger actually closed, not commit-text mentions.

### F5 — non-blocking (T-E44-01) — REQUIRE branch verified un-weakened
Confirmed byte-identical STOP string and unchanged rationale/backfill sentences vs `git show HEAD:content/skill-release-engineer.md`. Trigger-evasion probes:
- **spec exists but untracked** → REQUIRE fires (working-tree existence), `git diff HEAD~1 --name-only` omits it → hard STOP. Correct and desirable.
- **spec existed at HEAD~1, deleted in the release commit** → not in the working tree, so REQUIRE does not fire; a PM chain's `scope_decision_why` will not record a mini-chain, so it lands in UNCLASSIFIABLE → STOP. *Stricter* than pre-E44 (where the deletion satisfied the name-only check). Fails safe.
- **spec authored in an earlier release and unmodified this release** → REQUIRE fires, name-only omits it → false STOP. Pre-existing under the unconditional check, not a regression; flagging so it is not mistaken for new.
No path was found where the REQUIRE branch is satisfied-away.

### F6 — non-blocking (T-E44-01) — `:70`: the SKIP trigger is decidable *here*, but rests on an optional field
`scope_decision_why` is optional free text — `z.string().max(2000).optional()` (`tools/registry.ts:114`), never required by any gate (`gates/scope-decision.ts:24-30` tests only `.current/feature-split.md` existence or `scope_decision === "single-feature"`). For the current feature it is unambiguous ("Backlog rows ARE the spec -> mini-chain … PM/ARCH skipped"), so the branch is decidable without re-litigation. But a mini-chain may legitimately carry `scope_decision="single-feature"` with an empty or terse `scope_decision_why` — and in a mini-chain PM, the field's normal author, is skipped. That shape lands in UNCLASSIFIABLE → hard STOP, converting E44's judgement call into a release halt rather than removing it.

Not requiring a fix: the cut pinned this trigger, and `dispatch_mode` (`feature`/`bugfix`) genuinely does not encode chain shape, so the checkable alternative needs a schema field the cut excluded. Tradeoff for the backlog: a first-class `chain_shape: full|mini` would make both SKIP and UNCLASSIFIABLE mechanically decidable at the cost of one schema version. Interim mitigation available *within* this cut: have the UNCLASSIFIABLE text name the remedy ("if this is a mini-chain, record it in `scope_decision_why` and re-run") so the STOP is self-healing instead of terminal.

## Quality
- `:62` — the "On the premise this replaces" bullet (~700 of the 2,898 added bytes) is retrospective archaeology sitting inside an imperative, executable bullet list. The E49 row did ask for the false premise to be recorded, so its presence is spec-sanctioned; its *placement* is not. Executable steps and rationale are separated elsewhere in this repo (`content/constitution-rationale.md`; the `<!-- origin:start -->` convention). Move it to a trailing note or an origin tag. Non-blocking.
- `:61` — "(rescoped from "outside the single `active_feature` prefix" to "outside the commit range")" is a changelog note inline in a MUST NOT. Same class as above.
- Nested-emphasis density on `:54` (`**SET**`, `<CODES>`, `<CODE>`, `<prev-tag>`, `T-<CODE>-*`) makes the one line that most needs to be unambiguous the hardest to parse. Consider a two-line form: derivation command, then membership rule.

## Architecture
No architecture spec for this feature (mini-chain; backlog rows `docs/backlog.md:161,172` are the contract). Layering respected: the change is SOP prose only, and correctly declines to add source code — `:60` explicitly keeps `parseCoversIds`/`buildCoverageIndex` in `tools/evidence-file.ts` as the semantic reference "expressed as shell … not new source code". The one-release-one-archive-dir invariant (`qa_reports/archive/<active_feature>/`) is preserved as pinned. The E1 single-lease argument at `:62` is factually correct — but it argues about *concurrency*, whereas F4 shows the live risk is *mention-vs-ship*, which the lease does not constrain at all. The reasoning retires the old label without engaging the hazard the MUST NOT now has to cover.

## Security
No findings. No trust boundary crossed; no secrets. Worth noting the derivation feeds shell globs built from **commit-message text**, which is attacker-influenceable in a fork/PR flow — but the destination is fixed (`archive/<active_feature>/`) and the operation is `mv -n` within `qa_reports/`, so blast radius is misfiled evidence, not code execution. Any concrete `grep -oE` supplied per F1 should be a fixed pattern over the log output, never text interpolated into a command.

## Performance
No findings. One extra `git log` over a single release range (single digits to low tens of commits) at release time only. `mv -n` per match. No hot path, no complexity-class change.

## Verdict
**CHANGES_REQUESTED** — T-E44-01's AC4 rework is sound and can stand as-is, but T-E49-01's `<CODES>` derivation returns `{E37, E38}` where the answer is `{E45, E46}` on the exact release that motivated it (F1), justified by an example whose evidence lives in a commit that does not exist yet at step 7a (F2), citing a step-4 `git log` that the SOP does not contain and a `<prev-tag>` it never defines (F3). Required for APPROVED: fix F1, F2, F3; address F4's bound as part of F1's replacement.

### Test-coverage note for T-E44-02 (qa-engineer, §2 test ownership — not authored here)
sr-engineer's claim that `npm test` is unaffected is **verified true**, and that is the problem. Independently re-run: `npm test` → **1641/1641 pass, 0 fail**; `npx tsc --noEmit` clean; `node --test test/release-staging.test.mjs test/context-budget.test.mjs` → 79/79. Why the pins are blind:
- `test/release-staging.test.mjs:167-187` asserts only *substring presence* in the skill text — `/git diff HEAD~1 --name-only/`, `/specs\/<active_feature>\.md/`, and the verbatim STOP string. All three are preserved verbatim inside the REQUIRE branch, so the assertions pass whether the check is unconditional or three-way.
- `:302-350` (Fixtures C/D) exercise `simulatePostCommitCheck`, a **hardcoded local function at `:84-90` of the test file**. It has no coupling to file content whatsoever.
- No byte cap or context-budget assertion covers `content/skill-release-engineer.md` (`grep` over `test/*.mjs` finds caps only for `qa-visual`), so +2,898 bytes trips nothing.

Net: the existing suite cannot distinguish this diff from its base, and would not have caught F1/F2/F3 either. Coverage T-E44-02 must add:
1. **SKIP branch** — skill text asserts all three branch labels exist and are mutually exclusive; extend `simulatePostCommitCheck` to take `(diffNames, activeFeature, specExistsInTree, scopeDecisionWhy)` and assert `pass=true, branch="SKIP"` when `specExistsInTree=false` and `scopeDecisionWhy` records a mini-chain.
2. **UNCLASSIFIABLE branch** — `specExistsInTree=false`, `scopeDecisionWhy=""` (and a non-mini-chain `scopeDecisionWhy`) → `pass=false`, verbatim `"AC4 unclassifiable: …"` string, distinct from the REQUIRE STOP string.
3. **REQUIRE non-weakening** — `specExistsInTree=true` + spec absent from `diffNames` → `pass=false` with the byte-identical pre-E44 string, *and* a pin that the string is unchanged even when `scopeDecisionWhy` records a mini-chain (spec-in-tree must win over SKIP).
4. **Branch exhaustiveness** — exactly one branch fires for all four `(specExistsInTree × scopeDecisionWhy-records-mini-chain)` combinations.
5. **Step 7a derivation (after F1 is fixed)** — pin the replacement regex against a fixture of the real `v3.94.0..7b49d81~1` subjects and assert it yields exactly `{E45, E46}`; add a negative fixture from `5a9a824`'s body asserting `E39..E44` are **not** produced (F4).
6. **Step-order pin** — assert 7a precedes step 8 in the file and that 7a's text does not depend on the release commit's own content (guards F2's class from returning).

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Re-reviewed the current working-tree diff of `content/skill-release-engineer.md` (21 insertions / 6 deletions, one file). Boundary re-verified independently: `git diff --stat HEAD -- test/ content/` reports that one file and nothing else; `test/release-staging.test.mjs` untouched; the only staged change is the coordinator's `R100` `git mv` of `qa_reports/review_T-E45-01.md`.
- **F1 (as literally scoped), F2, F3, F6 are closed.** The derivation is now path-based, `PREV_TAG` is defined and resolves correctly, the worked example reproduces byte-for-byte from the pre-release commit, the false step-4 provenance claim is gone, and the UNCLASSIFIABLE string is self-healing. All four re-verified by execution, not by reading.
- **F4 is materially bounded but the stated justification is stronger than the mechanism.** "Ship-backed by construction" is really "evidence-file-backed": prose mentions are excluded (confirmed), but an *unshipped* ticket whose evidence file was committed at root inside the range still enters `<CODES>`.
- **NEW BLOCKING — F7: the replacement derivation returns the EMPTY set on the dominant recent release shape, and it is a regression versus the pre-E49 text it replaces.** Backtested against the last six releases, it yields `∅` for v3.93.0 and v3.94.0 — the two releases immediately preceding the one it was validated on — because their evidence files were never committed at `qa_reports/` root and so appear in no `--diff-filter=A` range. Combined with the retained "Zero matches = silent no-op", step 7a becomes a silent no-op exactly where the old rule worked.
- Verdict: **CHANGES_REQUESTED** — round 1's specific defect is fixed; the fix substitutes a different one from the same family (a governance step whose literal text does not do its job), and this one is a regression rather than a status-quo miss.

## Correctness

### F7 — BLOCKING (T-E49-01) — `content/skill-release-engineer.md:54-64`: `<CODES>` is empty whenever this release's evidence was never committed at `qa_reports/` root — the norm, not the exception

The derivation reads *committed history* (`git log "$PREV_TAG"..HEAD --diff-filter=A -- qa_reports/`). But `qa_reports/` evidence is routinely **untracked** at step-7a time: step 8's `git add qa_reports/` is what first commits it, and when 7a has already moved it, git records the add directly under `archive/` — where the new `grep -v '^qa_reports/archive/'` (correctly) discards it.

Backtest, running the shipped command at each release's step-7a point (`PREV_TAG..<release-commit>^`) against what that release actually archived:

| release | `<CODES>` from the new rule | evidence the release actually archived | outcome |
|---|---|---|---|
| v3.91.0 | E25 E27 E28 E29 E30 E32 E33 RELSOP | same 8 ids | ok |
| v3.92.0 | E34 | E34 | ok |
| v3.92.1 | E35 | E35 | ok |
| **v3.93.0** | **∅** | E36 | **MISS** |
| **v3.94.0** | **∅** | E37, E38 | **MISS** |
| v3.95.0 | E45, E46 | E45(+E46) | ok (the case sr-engineer validated) |

Proof the misses are structural, not accidental:
```
$ git log --all --diff-filter=A --name-only -- \
    qa_reports/review_T-E36-01.md qa_reports/review_T-E37-01.md qa_reports/review_T-E38-01.md
(no output — never added at qa_reports/ root in any commit)

$ git show --name-status --pretty=format: 4e0b525 -- qa_reports/     # the v3.94.0 release commit
A  qa_reports/archive/e37-design-auditor-post-pass-edge/review_T-E37-01.md
A  qa_reports/archive/e38-next-role-lookahead-advisory/review_T-E38-01.md
```
Those files went from *untracked at root* straight to *added under `archive/`* in the release commit. At step-7a time they were invisible to `git log` by definition.

**Why this is a regression, not a pre-existing gap.** The pre-E49 rule derived `<CODE>` from `active_feature` and moved matching files **by working-tree existence** — tracked or not. That is precisely how v3.93.0 and v3.94.0 archived correctly. The new rule can only see committed adds, so on the same inputs it produces `∅`, `:71`'s "Zero matches = silent no-op" fires, nothing moves, and step 8's `git add qa_reports/` then commits the evidence **at root** — manufacturing exactly the orphan class (`qa_reports/review_T-E45-01.md`) that E49 exists to eliminate. Silently, with no release failure.

This also applies to the release now in flight: this chain's QA evidence lands at `qa_reports/review_<id>.md` (`gates/qa-review.ts`) and, on current practice, will still be untracked when 7a runs.

**Required change:** the derivation must range over evidence that *exists in the working tree at 7a time*, using the git range only to decide membership — not as the enumeration source. One executable form (stated as a direction, not mandated wording): enumerate root-level `qa_reports/review_*.md` / `visual_*.md` / `expected-red_*` in the working tree, and admit an id when its file is absent from `git ls-tree -r --name-only "$PREV_TAG" -- qa_reports/` (i.e. it did not exist at the previous release). That single predicate covers both the committed-in-range case (E45/E46 — still yields `{E45, E46}`) and the untracked case (E36/E37/E38), and keeps F4's prose-mention exclusion intact. Whatever form is chosen, re-run the six-release backtest above; a replacement that does not reproduce every "actually archived" column is not done.

### F1 — CLOSED (with F7 carried against the replacement)
The slug-hunting rule is gone. Executed the shipped command verbatim at the pre-release commit:
```
$ git describe --tags --abbrev=0 7b49d81^
v3.94.0
$ git log v3.94.0..7b49d81^ --diff-filter=A --name-only --pretty=format: -- qa_reports/ \
    | grep -v '^qa_reports/archive/' | sort -u
(blank)
qa_reports/review_T-E45-01.md
qa_reports/review_T-E46-01.md
```
→ `{E45, E46}`. Correct on the motivating release, and stated literally enough (`:57-58` is a copy-pasteable fenced block) that nothing has to be invented. The round-1 defect is genuinely fixed; F7 is a distinct defect in the replacement, not a re-statement of F1.

### F2 — CLOSED
`:60` now anchors the example explicitly to "run from the pre-release commit, before that release's tag existed", and the quoted output at `:61-64` is reproducible from state that exists when 7a runs. No future-state read remains. Verified by reproducing the exact output above.

### F3 — CLOSED
`PREV_TAG=$(git describe --tags --abbrev=0)` is defined in-file at `:54` with the correct justification for why it resolves to the previous release; confirmed empirically (`v3.94.0` at `7b49d81^`). `grep -n "already reads for the CHANGELOG"` now returns nothing — the false step-4 provenance sentence is deleted, and the only surviving "step 4" reference (`:18`) is unrelated and accurate.

### F4 — non-blocking, substantially bounded; the stated rationale overstates the mechanism
Verified the two sub-questions asked of the exclusion:
- **Re-archived files are not wrongly excluded.** An archive move is recorded as a rename (`git diff --cached --name-status` on the in-flight sweep: `R100 qa_reports/review_T-E45-01.md → qa_reports/archive/…`), which `--diff-filter=A` skips outright; when rename detection does not fire (untracked source), it is an `A` under `archive/` and the `grep -v` skips it. Both paths are correct — an already-archived file must not re-enter `<CODES>`.
- **Add-then-move within one range is included, harmlessly.** The code stays in `<CODES>`, but the move step finds nothing at root and `mv -n` no-ops. This is what makes a retried release idempotent; keep it.
- **Residual:** `:65`'s claim that evidence is "ship-backed by construction" is not what the command tests. It tests *evidence-file-backed*. A ticket that was code-reviewed and then deferred or FAILed out, whose `qa_reports/review_T-Exx-01.md` was committed at root inside the range, enters `<CODES>` and gets filed into the shipping feature's archive dir. Strictly better than round 1's prose-mention exposure (that part is genuinely eliminated — a bare-code mention adds no file), but the MUST NOT at `:71` remains tautological with respect to it, exactly as in round 1. Non-blocking; worth softening the claim to "evidence-file-backed" so a future reader does not rely on a guarantee that is not there.

### F6 — CLOSED
`:84` now ends `"… record the dispatch shape in scope_decision_why (or author specs/<active_feature>.md) and re-run."` — one clause, self-healing remedy named. Re-checked that it did not weaken T-E44-01 (the only part of `:82-84` I re-examined, per round 1's APPROVED verdict on the branch design):
- REQUIRE branch STOP string at `:82` is still byte-identical to `git show HEAD:content/skill-release-engineer.md`'s pre-E44 text, and still gated on working-tree existence of the spec.
- Exhaustiveness intact over `(spec-in-tree) × (scope_decision_why records mini-chain)`: `true×*` → REQUIRE, `false×true` → SKIP, `false×false` → UNCLASSIFIABLE. Mutually exclusive, total, and spec-in-tree still wins over SKIP.

### N1 — non-blocking — `:61-64`: the quoted output is not byte-exact
`--pretty=format:` emits one empty line per commit, so the real output is three lines (a leading blank, then the two filenames) — the file says the command "returned exactly" the two. Cosmetic, but this diff's whole thesis is that literal text must be executable as written. Append `| grep -v '^$'` to the pipeline, or show the blank line.

### N2 — non-blocking — `:60`: filenames without a `T-<CODE>-` prefix are unhandled
"Take the `T-<CODE>-` prefix off each resulting filename" has no instruction for the `expected-red_<feature>.txt` entries the same command returns. Not hypothetical: the v3.91.0 range yields 2 such lines out of 10, the v3.92.0 range 1 of 3. One clause ("ignore filenames with no `T-<CODE>-` prefix — `expected-red_*` is handled by its own bullet below") closes it.

### N3 — non-blocking, pre-existing — step 7a scans only `qa_reports/`
Code-review evidence is written to `review_reports/` (`gates/code-review.ts`), QA evidence to `qa_reports/` — so this round's own `review_reports/review_T-E4X-03.md` is invisible to both the derivation and the moves. Not introduced by this diff (the old rule did not archive `review_reports/` either) and out of E49's pinned scope; flagging so it is not mistaken for new, and as a backlog candidate now that the orphan class is understood.

## Quality
- `:72` — the "On the premise this replaces" bullet is **still present** inside the imperative bullet list. Round-1 finding stands unchanged: spec-sanctioned content, wrong placement (rationale belongs in a trailing note or an `<!-- origin -->` tag, per `content/constitution-rationale.md` convention). Non-blocking.
- `:71` — "(rescoped from "outside the single `active_feature` prefix" to "outside the commit range")" is **still** an inline changelog note inside a MUST NOT. Same class. Non-blocking. Note it will need rewording anyway if F7's fix changes the membership rule away from "commit range".
- Nested-emphasis density — **substantially addressed.** The fenced command block at `:56-59` separates the derivation from the membership rule, which was the round-1 suggestion. No longer worth a finding.

## Architecture
Unchanged from round 1 and still sound: SOP prose only, no source code added, `parseCoversIds`/`buildCoverageIndex` correctly retained as the semantic reference rather than reimplemented. One-release-one-archive-dir is now stated explicitly at `:66`. Observation, not a finding: the v3.91.0 release archived into **two** dirs (`e-p3-tail-batch/`, `e32-e33-gate-hardening/`) while `:66` mandates a single dir named after `active_feature` — the pinned cut chose that, and it is defensible, but it does mean a multi-feature release files one feature's evidence under another feature's name. Backlog material, not this ticket's.

## Security
No findings, and the round-1 concern is now discharged: the derivation no longer interpolates commit-message text into anything. It reads path names from `git log --name-only` through a fixed `grep -v` and `sort -u`. Blast radius unchanged (misfiled evidence under `qa_reports/`, `mv -n`, fixed destination).

## Performance
No findings. One `git log` over one release range at release time.

## Verdict
**CHANGES_REQUESTED** — F1/F2/F3/F6 are closed and independently verified, and F4's prose-mention exposure is genuinely eliminated. Blocking on **F7**: the path-based replacement yields `∅` on 2 of the last 6 releases (v3.93.0, v3.94.0) because their evidence was never committed at `qa_reports/` root, and combined with "zero matches = silent no-op" that is a silent regression against the pre-E49 rule, which archived those releases correctly by working-tree existence. Required for APPROVED: re-derive `<CODES>` from working-tree evidence with the git range used only as a membership predicate, and demonstrate the six-release backtest in this section reproduces every "actually archived" row. N1/N2 are cheap to fold into the same edit.

Independently observed build gate this round: `npm run build` → 0 errors (`check:version — OK (3.95.0)`); `npm test` → **1641 pass / 0 fail** (1628 subtests, 41.0s). sr-engineer's numbers confirmed.

### Test-coverage note for T-E44-02 — carried forward, item 5 updated
Items 1-4 and 6 from round 1 stand verbatim (the AC4 branch text is unchanged apart from F6's clause, so the SKIP / UNCLASSIFIABLE / REQUIRE-non-weakening / exhaustiveness / step-order pins are unaffected). Item 2 gains one detail: the UNCLASSIFIABLE assertion must now pin the **full** string including the F6 remedy clause, ending `… record the dispatch shape in scope_decision_why (or author specs/<active_feature>.md) and re-run.`

**Item 5 cannot be pinned this round** — it must pin the shipped derivation, and the derivation is still changing under F7. When it settles, item 5 must assert, against fixtures built from real history:
- the shipped command/rule yields exactly `{E45, E46}` at `v3.94.0..7b49d81^`;
- it yields **non-empty, correct** sets for the v3.93.0 (`{E36}`) and v3.94.0 (`{E37, E38}`) shapes, where the evidence is present in the tree but absent from committed history — this is the F7 regression pin and is the single most important assertion in the list;
- a negative fixture from `5a9a824`'s body asserts `E39`-`E44` are **not** produced (F4);
- already-archived evidence does not re-enter the set (rename and untracked-add forms both);
- filenames with no `T-<CODE>-` prefix (`expected-red_*`) do not corrupt the set (N2).

---

## Round 3 — APPROVED — by code-reviewer

## Summary
- One file, 25 insertions / 6 deletions. Boundary re-verified: `git diff --stat HEAD` over `content/ test/ tools/ gates/ prompts/ schema/ guards/ lib/ transport/ bin/ scripts/ templates/ specs/ index.ts` reports `content/skill-release-engineer.md` and nothing else. Constitution untouched, `test/release-staging.test.mjs` untouched, the only staged change is the coordinator's `R100 git mv`.
- **F7 is CLOSED.** I rebuilt each release's step-7a working tree from git's own record — not from sr-engineer's method — and ran the shipped command verbatim in six detached worktrees. All six reproduce what that release actually archived, including v3.93.0 (`{E36}`) and v3.94.0 (`{E37,E38}`), the two that returned `∅` in round 2.
- The reconstruction is **not** question-begging, and I can show why (see F7 below): the untracked-at-root set is fully determined by git, I restored all of it, and there was no favorable subset available to choose.
- F4, N1, N2 verified closed/disposed as claimed. Round-1/2 quality items are now wrapped in the repo's own `rationale`/`origin` convention — which works on one of the two render paths, not both (N6).
- Three new non-blocking findings, all recoverable and none reachable on this repo's next release: **N4** (empty-baseline → unbounded sweep), **N5** (bash-only process substitution), **N6** (tags survive the `tw_switch_role` path). N4 deserves a one-clause guard and a test pin.
- Verdict: **APPROVED**.

## Correctness

### F7 — CLOSED. Independent six-release backtest reproduces ground truth

**Reconstruction method (mine, derived from git — deliberately not sr-engineer's).** At 7a time every root-level `qa_reports/` file is in exactly one of three states, and each leaves a distinct fingerprint in the release commit:
- already tracked at root at the parent commit → present in a `git worktree add --detach <release>^` checkout, nothing to restore;
- untracked at root and moved by 7a → the release commit records it as **`A` under `qa_reports/archive/`** (an untracked source cannot form a rename pair);
- untracked at root and *not* moved → the release commit records it as **`A` at `qa_reports/` root** (step 8's `git add qa_reports/` commits it there).

So the complete untracked-at-root set is exactly *every path the release commit added under `qa_reports/`*, mapped back to its basename at root. I restored that whole set — not a chosen subset — into each worktree, then ran the shipped pipeline verbatim. Script at `/tmp/e49_backtest.sh`.

| release | PREV_TAG (observed) | files restored | shipped rule → `<CODES>` | release actually archived | |
|---|---|---|---|---|---|
| v3.91.0 | v3.90.0 | 0 | `{E25 E27 E28 E29 E30 E32 E33 RELSOP}` | `{E25 E27 E28 E29 E30 E32 E33 RELSOP}` | match |
| v3.92.0 | v3.91.0 | 0 | `{E34}` | `{E34}` | match |
| v3.92.1 | v3.92.0 | 0 | `{E35}` | `{E35}` | match |
| **v3.93.0** | v3.92.1 | 1 | **`{E36}`** (round 2: `∅`) | `{E36}` | **fixed** |
| **v3.94.0** | v3.93.0 | 2 | **`{E37 E38}`** (round 2: `∅`) | `{E37 E38}` | **fixed** |
| v3.95.0 | v3.94.0 | 0 | `{E45 E46}` | `{E46}` | rule is right, *history* is wrong |

The v3.95.0 row is the one place the rule and history disagree, and the rule is correct: that release archived only E46 and left `qa_reports/review_T-E45-01.md` orphaned at root. That orphan **is** E49's motivating defect, so a derivation that produces `{E45, E46}` there is the desired behavior, not a mismatch.

**Why the reconstruction does not beg the question.** Three independent checks:
1. The restore rule is read off git's record of each release commit; it never consults the new SOP text or sr-engineer's reasoning. Applied unchanged to all six releases, including the four needing zero restores.
2. It is *complete*, not selective. For v3.93.0 exactly 1 file was restorable and for v3.94.0 exactly 2 — and the derivation returned precisely those. There was no larger candidate pool from which a passing subset could have been drawn, so the restore step had no free parameter to tune.
3. The only file class invisible to this reconstruction would be one that was untracked at root, gitignored, and never committed. `grep 'qa_report\|review_\|expected-red' .gitignore` returns nothing, so that class is empty in this repo.

The rule's own logic also checks out on inspection: a file committed at root inside the range and a file still untracked are both absent from `$PREV_TAG`'s tree, so one predicate admits both — which is exactly what round 2 asked for. `find -maxdepth 1` not descending into `archive/` correctly subsumes the old explicit `grep -v '^qa_reports/archive/'`.

### F4 — CLOSED as dispositioned (non-blocking, correctly scoped)
`:68` now says `<CODES>` is "**evidence-file-backed**, not ship-backed", names the residual explicitly (a ticket code-reviewed then deferred or FAILed, whose evidence sits at root and is new since `$PREV_TAG`, still enters the set), and states plainly that the MUST NOT "bounds *range*, not *ship status* … it cannot close that gap." That is exactly the honest framing round 2 asked for — the overclaim is gone and no future reader will rely on a guarantee that is not there.

### N1 — CLOSED
The worked example no longer uses `--pretty=format:`, so the phantom blank line is gone. I reproduced `:57-58` in six worktrees and the live tree; output is byte-exact as shown at `:64-66`.

### N2 — CLOSED
`:60` now carries the explicit clause: ignore any filename with no `T-<CODE>-` prefix, `expected-red_<active_feature>.txt` being the recurring case and handled by its own bullet. Confirmed against the real ranges that surfaced the issue — the v3.91.0 backtest emits two `expected-red_*.txt` lines and the v3.92.0 backtest one, and under the stated rule they drop out without corrupting `<CODES>` (`{E25…RELSOP}` and `{E34}` respectively).

### Non-retroactivity — CONFIRMED (item 4)
`git ls-tree -r --name-only v3.95.0 -- qa_reports/` contains `qa_reports/review_T-E45-01.md`, so at the next release it is **not** new since `$PREV_TAG` and is excluded. Running the shipped derivation in the live working tree right now returns the empty set, which is correct: nothing at `qa_reports/` root is new since v3.95.0 yet (QA has not written this chain's evidence). The pinned non-retroactive cut holds — that orphan stays T-E49-02's manual job.

### N4 — NEW, non-blocking (recommend folding in) — `:57-58`: an empty membership baseline admits everything
`grep -vxFf` with an empty pattern file passes its whole input through. Two reachable routes to an empty baseline, both reproduced in scratch repos:
- **No tags at all** (first-ever release): `git describe --tags --abbrev=0` fails, `PREV_TAG` is empty, `git ls-tree -r --name-only "" -- qa_reports/` → `fatal: Not a valid object name`, pattern file empty → every root file admitted.
- **`PREV_TAG` predates `qa_reports/`** (a repo that adopted agc mid-life): `ls-tree` legitimately returns nothing → same outcome. In my scratch repo an unrelated `review_T-OLD-01.md` was admitted alongside the shipping feature's file.

Consequence is a mass sweep of every root-level evidence file into `archive/<active_feature>/` — one feature's directory holding many features' evidence. Non-blocking because: it cannot fire in this repo (`qa_reports/` has been tracked across many tags, and the live run returns `∅`); the operation is `mv -n` within `qa_reports/`, so it is non-destructive and reversible with `git mv`; and in the fresh-workspace route the sweep is accidentally correct anyway. But this SOP ships to consumer workspaces, so a one-clause guard is cheap and worth having, e.g.: if `git ls-tree -r --name-only "$PREV_TAG" -- qa_reports/` is empty or `PREV_TAG` is unset, there is no membership baseline — surface that and route to human rather than sweeping. Pinned into the T-E44-02 coverage list below.

### N5 — NEW, non-blocking — `:58`: `<(...)` is bash/zsh only
Process substitution is not POSIX. `sh -c '<the pipeline>'` fails with `syntax error near unexpected token '('`. It fails **loudly** on stderr, which is the acceptable direction, so this is not a correctness defect — the SOP is executed by an agent through a bash/zsh tool, and it works there (verified six times). Worth one parenthetical noting the bash requirement, since the surrounding SOP is otherwise plain-portable shell.

### Zero-match behavior — reviewed, keep it silent (item 6)
`∅` is legitimately reachable in a healthy release — I observed it in the live tree just now, and a docs-only or re-release would produce it too. So `:74`'s non-fatal treatment is right and should stay. The residual concern is that `∅` is also the signature of N5 breakage or an N4 baseline miss, and round 2 showed `∅` is what let F7 hide. Cheap disambiguation, non-blocking: have 7a **log the derived `<CODES>` even when empty**, so `∅`-by-design and `∅`-by-breakage are distinguishable in the release transcript instead of both being silence. This is the same self-documenting move AC4's SKIP branch already makes at `:85`.

## Quality
- Round-1/2 quality findings are now handled with the repo's sanctioned convention rather than deletion: the MUST NOT's revision history is inside `<!-- origin:start/end -->` at `:74` and the "On the premise this replaces" bullet inside `<!-- rationale:start/end -->` at `:74-76`. Correct choice — the E49 row required the false premise be recorded, so the content had to survive somewhere.
- **N6 — NEW, non-blocking: the strip claim holds on one render path, not both.** Verified: `prompts/build.ts:391,397` applies `stripOriginTags` (always) and `stripRationale` (unless `fullDetail`) to the **skill body**, not just the constitution — so on the `/release-engineer` prompt path the claim is true. But `tools/role.ts:53-94` (`switchRole`) composes fragments and expands partials and never calls either pass; its own comment at `:89-92` says so outright ("switchRole is the SECOND skill render path — it does NOT flow through buildPromptForRole"). Direct evidence: the `code-reviewer` SOP delivered to me by `tw_switch_role` this session arrived containing `<!-- origin:start --> (v3.58.0, C16)<!-- origin:end -->` verbatim. So a role dispatched via `tw_switch_role` — how this repo routes subagents — still sees the rationale bullet *plus* ~60 bytes of raw comment markers. Net effect versus round 2 is neutral-to-slightly-worse on that path and a clear improvement on the prompt path. Not this ticket's problem to fix (the asymmetry is pre-existing and repo-wide), but the claim should not be recorded as unconditional. Backlog candidate alongside N3.
- Placement and density otherwise good: the derivation is a copy-pasteable fenced block at `:56-59`, the membership rationale is prose beneath it, and the worked example is separate.

## Architecture
Unchanged and still sound: SOP prose only, no source added, `parseCoversIds`/`buildCoverageIndex` retained as the semantic reference rather than reimplemented, one-release-one-archive-dir preserved at `:70`. The derivation moved from "read history" to "read the working tree, use history as a predicate", which is the correct layering for a step whose whole job is to move files that exist right now. The v3.91.0 two-archive-dir observation from round 2 stands as backlog material, unchanged by this round.

## Security
No findings. No commit-message text is interpolated anywhere; the pipeline reads path names through `find`, a fixed `grep -vxFf`, and `sort`. `$PREV_TAG` is produced by `git describe` and consumed as a single quoted argument to `git ls-tree` — a repo with a hostile tag name cannot break out of it. Blast radius unchanged: misfiled evidence under `qa_reports/`, `mv -n`, fixed destination.

## Performance
No findings. One `find` over one directory plus one `git ls-tree` at release time. Cheaper than the `git log` walk it replaces.

## Verdict
**APPROVED** — F7 is closed against the exact ground truth that produced it: six releases rebuilt from git's own record, shipped command run verbatim, every row reproducing what that release actually archived, with v3.93.0 and v3.94.0 recovered from `∅`. F4/N1/N2 are dispositioned honestly rather than papered over. The three new findings (N4 empty baseline, N5 bash-only, N6 one-path strip) are non-blocking, non-destructive, and unreachable on this repo's next release; N4 and the zero-match logging clause are worth folding in opportunistically or filing.

Independently observed build gate this round: `npm run build` → 0 errors (`check:version — OK (3.95.0)`); `npm test` → **1641 pass / 0 fail** (1628 subtests, 40.6s). sr-engineer's numbers confirmed for the third round running.

**Round-cap question — moot, and I would not have split.** The cap is not reached (this is round 3 of 4, and the verdict is APPROVED). For the record, had this round gone the other way I would *not* have recommended splitting E49 out and shipping T-E44-01 alone: the derivation converged monotonically across rounds (wrong set → right set but empty on the modal case → right set on all six), each round closed its predecessor's findings without reopening them, and the remaining surface is guard clauses rather than a design question. Splitting would also strand T-E44-02, whose coverage list spans both tickets.

### Test-coverage note for T-E44-02 — FINAL, supersedes rounds 1 and 2
Items 1-4 and 6 from round 1 stand verbatim; item 2 keeps round 2's amendment (pin the full UNCLASSIFIABLE string including the F6 remedy clause, ending `… record the dispatch shape in scope_decision_why (or author specs/<active_feature>.md) and re-run.`). Item 5 is now pinnable and is restated in full — the derivation changed twice, so pin the text that actually shipped:

5. **Step 7a derivation** — assert the skill text contains the shipped pipeline literally, both lines:
   `find qa_reports -maxdepth 1 -type f | sort` and `grep -vxFf <(git ls-tree -r --name-only "$PREV_TAG" -- qa_reports/)`, plus `PREV_TAG=$(git describe --tags --abbrev=0)`. A substring pin on `git log --diff-filter=A` must **fail** — that was the round-2 text and must not silently return.
5a. **F7 regression fixture — the highest-value assertion in this list.** Model the untracked case both prior rounds missed: a baseline listing that does *not* contain `qa_reports/review_T-E36-01.md` plus a working-tree listing that *does*, and assert the file is admitted → `{E36}`. Add the v3.94.0 shape (`{E37,E38}`) as a second fixture. A committed-history-based rule fails these by construction, which is the point.
5b. **Committed-in-range case still works** — baseline without `review_T-E45-01.md`/`review_T-E46-01.md`, tree with both → `{E45,E46}`.
5c. **Non-retroactivity** — baseline *containing* `qa_reports/review_T-E45-01.md` (as `v3.95.0` does) → that id is **excluded**. Guards the pinned non-retroactive cut.
5d. **Already-archived evidence never re-enters** — a file under `qa_reports/archive/…` is not a candidate (`-maxdepth 1`), in both the rename and untracked-add shapes.
5e. **N2** — filenames with no `T-<CODE>-` prefix (`expected-red_*.txt`) are ignored and do not corrupt the set.
5f. **N4 empty-baseline** — an empty baseline listing must not silently admit every root file. If the guard clause is added, assert the STOP; if it is not, assert the current permissive behavior explicitly so the hazard is recorded in the suite rather than discovered in a consumer workspace.
7. **F4 negative fixture** — a bare-code prose mention (`5a9a824`'s `E39`-`E44`) produces no `qa_reports/` file and therefore no code; assert `E39`-`E44` are absent.

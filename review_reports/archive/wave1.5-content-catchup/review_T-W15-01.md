# Review — T-W15-01

covers: T-W15-01

Feature: `wave1.5-content-catchup` · Base: `f4208ea` · Round 1 · Reviewer model: opus (sr-engineer pinned `fable` — different model, no same-model-bias concern)

## Summary

- One file changed under source control: `content/skill-release-engineer.md` (+2292 raw bytes; **+726 bytes served**, after `stripRationale`). Three items: E82 (ii) constant-citation at `:218`, E83 `(context, not changed)` marker at `:24` and `:206`, E84 step 13a at `:228`.
- **E82 (ii) and E83 are sound** and I would approve both on their own. The citation names a real, stable constant; the marker cannot be used to launder the fabrication class E17 was written against.
- **E84's step 13a does not work where it is placed.** `--close-out`'s only assertion is `git rev-list --count @{u}..HEAD`. At step 13a that count is 0 by construction, so the step returns `CLOSE-OUT PASSED` while the commit it exists to verify has not been made — and no step in this SOP, or any SOP, makes it. Blocking.
- **`qa_reports/expected-red_wave1.5-content-catchup.txt` is missing** while two intentional reds exist. Blocking per code-reviewer SOP 4a.
- Both red tests independently confirmed as **stale pins, not regressions** — see Correctness N5. They are qa's re-baseline (T-W15-02).
- Verdict: **CHANGES_REQUESTED** (2 blocking, 4 non-blocking).

## Correctness

### N1 — BLOCKING — E84 step 13a verifies nothing where it sits (`content/skill-release-engineer.md:228`)

`--close-out` runs exactly one assertion (`scripts/verify-release.mjs:113-125`):

```js
aheadCount = Number(git(["rev-list", "--count", "@{u}..HEAD"]));
...
if (aheadCount > 0) { fails.push(`FAIL: HEAD is ${aheadCount} commit(s) ahead of upstream ${upstreamRef} — not pushed`); }
```

It counts **commits** ahead of upstream. It cannot see working-tree modifications.

Trace the state at step 13a:

| step | effect on `@{u}..HEAD` |
|---|---|
| 8 | release commit made **and pushed** (`git push origin <branch>`), tag pushed → count 0 |
| 9, 9a | no commits |
| 12 | `tw_update_state` writes `.current/handoff.md` **to the working tree** — not a commit → count still 0 |
| 13 | read-back only |
| **13a** | **count 0 → `CLOSE-OUT PASSED`** |

So the step's instruction — "confirm `CLOSE-OUT PASSED` before treating this release cycle as fully closed" — is satisfiable, and in fact unavoidably satisfied, with the bookkeeping commit still unwritten. That is affirmative green evidence for precisely the condition E84 exists to detect. This is worse than omitting the step: the v3.102.5 escape had no signal at all; this one manufactures a clean one.

The load-bearing sentence in the rationale at `:230` is factually wrong:

> the bookkeeping commit this step checks is produced by this same role's own step-12 write

Step 12 produces the **file content**. The **commit** is a separate act by a later actor. Evidence, all in-tree:

- No step in `content/skill-release-engineer.md` commits `.current/` + `tasks.md`. The only `git commit` in the SOP is step 8's release commit (`:210`), and step 8 excludes `.current/**` by construction (E71c).
- The file's own scope rule at `:249` says so outright: `.current/**` and `tasks.md` are "ordinary session/task bookkeeping the coordinator/pm chain updates continuously... committed separately (see e.g. commits `cc3e0df`, `53a6392`)".
- History agrees. `6cd767b`, `cc3e0df`, `53a6392`, `aac5a40`, `67c72e9` are all standalone `chore(governance)/chore(state)` commits, and three of them also carry `docs/backlog.md` rows **filed after** the release — pm/coordinator work that cannot exist at step 13a.
- `grep -rn "close-out\|git commit\|git push" content/coord-*.md` → no hits. There is no coordinator close-out step either, so the commit is currently made ad hoc by whoever is at the keyboard.

The step's trailing hedge acknowledges the gap but leaves it ownerless:

> If that commit isn't made in this same session, this step is owed the moment it is — do not let a resumed session skip it.

"Owed" to whom? The commit is made in a later session by an actor that does not load this file. The rationale rejects the coordinator placement to avoid "adding a cross-session obligation to the coordinator SOP" — but the obligation is cross-session **by construction**. Placing it in release-engineer does not localize it; it makes it unreachable by the only role positioned to discharge it.

Note the finding holds under **both** readings, which is why it is blocking:

- *Careless reader* runs `--close-out` at 13a → vacuous PASS.
- *Careful reader* honours the "once ... is committed and pushed" precondition → waits. But step 13 is the SOP's terminal gate (`:225`: "Only after this server-confirmed read-back may the final `Done. Released <tag>.` reply be emitted"; same contract in the Output rule at `:10`). The session ends. A step numbered 13a that sits **after** the terminal reply gate has no execution point at all.

**Fixes, in preference order:**

1. **Move the invocation to where the commit is actually made** — a coordinator post-release close-out line. This is option 1 of the E84 backlog row itself (`docs/backlog.md:206`: "extend the coordinator close-out with a push check on the bookkeeping commit"). The context-budget objection is real but small and now measurable: coord fragments are rationale-stripped too, and one operational sentence is the cost.
2. **Keep it in this file, but make the sequencing claim true** — insert an explicit step between 13 and 13a in which release-engineer *makes and pushes* the bookkeeping commit, then runs `--close-out`. Smallest change that makes 13a non-vacuous and keeps E84 colocated as the rationale wants.
3. **Minimum bar if 13a stays as-is** — a PASS must be made non-vacuous. Require the release-engineer to first establish that the commit exists (e.g. `git log @{u}..HEAD --oneline` naming it, or `git status --porcelain -- .current tasks.md` being empty *after* a commit), and treat "nothing to check yet" as **deferred / NOT-PASSED**, never as `CLOSE-OUT PASSED`. As written, the confirmation string is reachable without the commit, which is the whole defect.

I have no objection to E84 living in `skill-release-engineer.md` rather than the coordinator — the ownership argument is reasonable. The defect is the sequencing claim it rests on, not the file choice.

### N2 — BLOCKING — missing expected-red manifest (code-reviewer SOP 4a)

`qa_reports/expected-red_wave1.5-content-catchup.txt` does not exist, while two intentionally-red tests exist that the diff does not explain (it touches no test file). SOP 4a: "WHEN the manifest is missing while intentional reds evidently exist → record a `CHANGES_REQUESTED` finding under **Correctness**, citing the missing `qa_reports/expected-red_<active_feature>.txt` path."

Two points so this is not mistaken for a boundary conflict:

- The `test/` bar does **not** excuse it. The manifest lives in `qa_reports/` and is sr-engineer-authored machine data (per this role's own clean-context carve-out). Writing it is not a `test/` touch.
- `dispatch_mode` is `feature`, not `bugfix`, so the server-side `REPRO_MANIFEST_MISSING` gate does not fire. This is an SOP-level obligation, not a gate — which is exactly why it needs to be caught here.

Direct precedent, same shape (content-only change, sr barred from `test/`, qa-owned golden re-baseline): `qa_reports/expected-red_e59-const6-waiver-clause.txt`. Use its format — a comment block explaining *why* each group reds, then `<relative test file path> | <exact test name string>` lines. The two entries are:

```
test/feature-lease.test.mjs | E17-S2: the record-integrity Hard rule's incident-reason tail names the v3.83.0 fabrication and its a484a4d correction
test/verify-release.test.mjs | VR-9 (AC9): skill-release-engineer.md requires verify-release.mjs after push/gh-release and before the closing write, plus a matching Escalation Routes row
```

### N3 — non-blocking — E83 marker is sound; the CRITICAL rule's clause order is not (`:22`)

I tested the marker against the fabrication it must not readmit. It holds:

The v3.83.0 defect was a **claim of change** — "`tools/handoff-orchestrator.ts` change that does not exist in the release diff". An author fabricating from the dispatch brief is asserting the file *changed*. To reach the exemption they would have to append `(context, not changed)` — a marker that *retracts the very claim being fabricated*. The marker is self-incriminating for the change-claim shape, so it cannot launder the E17 defect. That is a real property, not an accident, and it is the right design.

The residual is narrower than "it moves the hole": a marked path is checked for existence only, so a path that exists but does not support the claim made about it passes. But the unmarked rule never checked semantic accuracy either — diff-membership is a mechanical proxy, and a *changed* path can be cited with an equally false description of what changed in it. The marker therefore does not create a new class of unchecked claim; it downgrades a subset from mechanical-membership to existence. Against that: a marked path **announces itself** in the CHANGELOG text, which narrows what a human or a post-release audit must verify — and a post-release audit is exactly the mechanism that caught E95. Net, the pairing earns its place.

What does not hold up is the sentence's clause order. Currently:

> ...MUST appear in the `git diff --stat` ... and every referenced report/spec path MUST exist on disk at write time — UNLESS the path is marked `(context, not changed)` immediately after it, the convention (E83) for a path cited as evidence/background rather than claimed as modified this release; a marked path is still held to the on-disk-existence half, only exempt from the diff-membership half.

The `UNLESS` grammatically attaches to **both** conjuncts, and the repair arrives ~30 words later. A reader under release pressure who stops at the exemption clause concludes existence is waived too. For a CRITICAL Hard rule, state the scope before the exemption, e.g.:

> ...and every referenced report/spec path MUST exist on disk at write time. A path marked `(context, not changed)` immediately after it — the E83 convention for a path cited as evidence/background rather than claimed as modified this release — is exempt from the diff-membership requirement **only**; the on-disk-existence requirement still applies.

### N4 — non-blocking — step-8 E95 bullet drops the surviving half of the marked-path obligation (`:206`)

> ...EXCEPT paths marked `(context, not changed)` per the E17/E83 convention above — those are exempt by design, not a check failure.

Existence is the *only* remaining guard on a marked path, and this bullet — the one step that mechanically walks the citations — does not mention it. "Exempt by design, not a check failure" reads as fully exempt; the pointer "per the E17/E83 convention above" carries the rest, but at step 8 under pressure that indirection is doing more work than it should. Eight words fix it: `...exempt from the diff-membership check — still `ls`-verify each marked path exists.`

### N5 — not a finding — both reds confirmed stale pins

I verified each independently rather than taking the account on trust.

**E17-S2** (`test/feature-lease.test.mjs:1656`) — confirmed stale. The locator is line-scoped:

```js
skill.match(/^-\s+\*\*CRITICAL — Record integrity: describe the diff, not the brief\*\*.*$/m)
```

`.*$` with `/m` and no `/s` captures a single source line. The reason text moved into the rationale block on the following lines, so `ruleLine.includes("Reason (E17 forensics)")` fails. The content is **not lost** — `grep -c` returns 1 for the full incident sentence verbatim, and 1 for `a484a4d`. Relocation, not deletion. Sibling assertions E17-S1/S3/S4 all still pass.

**VR-9** (`test/verify-release.test.mjs`) — confirmed stale. Exactly one assertion fails, and it is the one pinned to the string this ticket exists to delete:

```
error: 'step 9a must describe the E80 bounded poll, its default budget, and the AGC_VERIFY_CI_WAIT_SECONDS opt-out'
```

i.e. `/\(E80; default ~10 minutes via `AGC_VERIFY_CI_WAIT_SECONDS`, `0` to opt out\)/`. Every other VR-9 assertion still passes, including the step-ordering ones — I confirmed `idxStep9 (:217) < idxStep9a (:218) < idxStep12 (:223)` still holds, and that step 13a's insertion at `:228` does not perturb it.

Neither is a behavioural regression. Both belong to T-W15-02.

## Quality

### N6 — non-blocking — maintenance meta-commentary inside operational prose (`:218`)

> default is `DEFAULT_WAIT_SECONDS` in `scripts/verify-release.mjs` — **cite that constant, not a restated figure, since it has already gone stale here once** — via `AGC_VERIFY_CI_WAIT_SECONDS`, `0` to opt out

The bolded clause is an instruction to a *future editor*, spliced mid-sentence into a step an *executor* reads while running a release. Step 9a is already the longest paragraph in the file. This is precisely what the rationale fences are for, and this diff uses them correctly three times elsewhere — move it there and the operational sentence reads clean:

> ...bounded-polls `gh run list` for it (E80/E82; default is `DEFAULT_WAIT_SECONDS` in `scripts/verify-release.mjs`, overridable via `AGC_VERIFY_CI_WAIT_SECONDS`, `0` to opt out)...

### N7 — non-blocking — E82 (ii) shipped in its de-staling half only; the done-mark must not overstate it

The E82 backlog row (`docs/backlog.md:204`) defines option (ii) as "one step-9a sentence telling the release-engineer **to set a budget below its own tool ceiling and say what it used**". What landed is the de-duplication of the stale figure — which is what the handoff's `scope_decision_why` scopes as (ii) ("the SOP prose describing that budget"), and which is the right call: with (i) shipped at 480s the operational need is largely discharged by the default itself, and the "say what it used" half is a reporting nicety.

I am **not** asking for scope expansion. But this repo's current defect theme is records asserting what the source does not, so: either add the half-sentence, or E82's step-7c done-mark must say (ii) shipped in its de-staling half only. Resolve before release-engineer's step 7c, not after.

### N8 — terseness, correctly priced — no finding

Measured through `applyTextTransforms(..., { fullDetail: false })`, which is the real dispatch path for both renderers (`prompts/build.ts` and `tools/role.ts:105`, the latter explicitly for `tw_switch_role` per E51):

```
raw   : 64835 -> 67127  (+2292)
served: 62321 -> 63047  (+726, +1.2%)
```

Confirmed the coordinator's correction: `content/skill-release-engineer.md` carries **no** context-budget floor. Its only appearances in `test/context-budget.test.mjs` (`:1280`, `:1305`, `:1395`) are comments noting it is *untouched* by those features' floors. Cost is per **release-engineer dispatch** only.

The fences are used where they earn their place: all three explanation blocks (E17/E83 forensics, the E95 example, the E84 reason) are fenced and stripped before delivery. The E17 rule's served text actually got *shorter* — the forensics moved out — which offsets the marker's inline cost. That is the correct trade and also the mechanical cause of the E17-S2 red.

One consequence worth recording, not a defect: the dispatched release-engineer **no longer receives** the v3.83.0 forensics for a CRITICAL rule. That matches the repo's own design (rationale = non-normative "why", stripped at dispatch) and is consistent with the terseness directive. It does mean qa's re-baselined E17-S2 should keep asserting the text exists in the **source file**, not in rendered output.

## Architecture

E82 and E83 fit. The citation-over-duplication move (N6's wording aside) is the correct direction for a repo whose theme is prose drifting from source, and it names a **constant identifier**, not a line number — stable across edits to `verify-release.mjs`. I verified the target exists and is live: `scripts/verify-release.mjs:289` `const DEFAULT_WAIT_SECONDS = 480;`, consumed at `:293` as the fallback when the env parse fails or is negative. A reader who has never opened the script still learns there is a default, where to read its value, the env var that overrides it, and that `0` opts out — everything step 9a asks them to act on. Not knowing the magnitude is fine here, because the step's whole instruction is "let it run".

E84 is the architecture problem, and it is a placement/sequencing problem rather than an ownership one — see N1. No `specs/wave1.5-content-catchup.md` exists; this is a backlog-row-as-spec mini-chain, and I reviewed against `docs/backlog.md:204-206` as the contract. That is consistent with `scope_decision_why` and will take step 8's AC4 **SKIP** branch at release.

## Security

No findings. Content-only diff; no executable surface, no new input crosses a trust boundary, no secrets.

The nearest security-adjacent concern is that E83 introduces a **self-applied exemption to a record-integrity control**. Assessed in N3: it cannot be used to launder a claim-of-change, it is visible in the artifact it governs, and it leaves the marked path under an existence check. Acceptable.

## Performance

No findings. No runtime code changed. The only cost is context: +726 served bytes per release-engineer dispatch, on no budgeted bundle (N8). Note for completeness that fix option 1 under N1 would move roughly one sentence onto `content/coord-*.md`, which *is* on every dispatch — that cost is real and is the legitimate core of the placement argument, but it does not rescue a check that returns green without looking at anything.

## Verdict

**CHANGES_REQUESTED** — E84's step 13a returns `CLOSE-OUT PASSED` at a point where the commit it verifies cannot yet exist and which no SOP produces, manufacturing a false-clean signal for the exact escape E84 was filed against (N1); and the expected-red manifest required by code-reviewer SOP 4a is absent (N2). E82 (ii) and E83 are otherwise sound and need only the non-blocking tightening in N3, N4, N6, and N7.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer

Scope: `content/skill-release-engineer.md` (+19/−6), `qa_reports/expected-red_wave1.5-content-catchup.txt` (new). Judged against round 1's N1–N7.

### Summary

- **N1 (blocking, round 1) is genuinely fixed.** The terminal-reply gate actually moved from step 13 to step 13b — it was not renumbered around. `--close-out` is no longer 0-by-construction under faithful execution.
- **N2–N7 all confirmed landed.** Manifest is accurate and both entries sampled clean.
- **One new blocking defect (N9):** step 13a's `git add -- .current/handoff.md .current/*.jsonl tasks.md` uses a raw shell glob, which the *same file* already forbids for exactly this reason (E76/E71b, `:143`). Under zsh NOMATCH this aborts the whole `git add`, nothing is committed, and 13b then reports `CLOSE-OUT PASSED` — reproducing round 1's vacuity **without any SOP non-compliance**.
- One non-blocking observation (N10): the E17 forensics tail moved into a rationale fence, which `prompts/build.ts:436` strips on every dispatch — so it stops shipping, asymmetrically with its three sibling CRITICAL rules.
- Verdict: **CHANGES_REQUESTED**, on N9 only. The design is right; one pathspec is wrong.

---

### Ruling on the referred question — is the residual vacuity acceptable?

The coordinator's arithmetic is correct. `scripts/verify-release.mjs:109-124` computes `git rev-list --count @{u}..HEAD` and fails only when it exceeds zero, so both branches reach 0:

- 13a ran, committed, pushed → ahead 0 → PASS (meaningful).
- 13a never ran → nothing committed → ahead 0 → PASS (vacuous).

**On the case actually referred to me — a release-engineer that *skips* step 13a — the residual is acceptable and out of scope.** Three reasons, in order of weight:

1. **It is unclosable by any in-file fix**, which is the decisive point. Any additional assertion written into this SOP — including the obvious "13b also checks the working tree is clean" — is skipped by precisely the same non-compliance that skipped 13a. A prose step cannot verify its own execution. Closing this class requires an enforcement point *outside* the SOP (a gate in `GATE_REGISTRY`, a CI check, or a hook), which is a new backlog row, not this ticket.
2. **`--close-out` is the wrong place regardless.** Its own header (`scripts/verify-release.mjs:33-40`) defines it as a standalone, version- and tag-independent ahead-of-upstream assertion. Teaching it to assert that three named agc governance paths are clean would hardcode one workspace's bookkeeping convention into a generic release-verification script and make the flag fail in any context where those paths are legitimately dirty. It would also require editing `scripts/verify-release.mjs` plus new pins in `test/verify-release.test.mjs` — outside this ticket's file boundary and explicitly barred.
3. **E84's filed defect and its named class are fully closed.** The row at `docs/backlog.md:206` states the preferred fix shape verbatim — *"teach `verify-release.mjs` to fail when the working branch is ahead of its upstream by anything at all rather than only checking HEAD-at-tag. The second is stricter and catches the class rather than the instance."* That is exactly what shipped. The counter-argument put to me is right: against `6cd767b`-style committed-but-unpushed, 13a creates the commit and 13b fails loudly at ahead-count 1.

Round 1's defect was categorically worse and the distinction is the whole basis of this ruling: it was vacuous **under correct execution**, 100% of the time, with no step anywhere producing the commit it checked. This one is sound under correct execution. For unenforceable prose that is the correct bar.

**But the instinct to push was right, and here is where it pays off.** There is a *faithful-execution* path to the same vacuity — no skipped step required — and that one is in scope, is closable in-file, and is blocking. See N9.

---

### N9 — BLOCKING — step 13a's raw glob can abort the whole `git add`, feeding 13b a vacuous pass (`content/skill-release-engineer.md:232`)

Step 13a instructs, verbatim:

```
git add -- .current/handoff.md .current/*.jsonl tasks.md
```

`.current/*.jsonl` is an unquoted shell glob. This file already has a hard-won rule forbidding exactly that, 89 lines above, at `:143`:

> **Shell safety under zsh NOMATCH** … every fragment below that names a glob (`*`) still runs under `find <dir> -maxdepth 1 -name '<pattern>'`, never a raw shell glob — zsh's default `NOMATCH` option aborts the WHOLE command on a zero-match glob … instead of passing the literal through the way bash does, which would make the "Zero matches = silent no-op" promise below false in the default shell of the platform this repo runs on.

13a reintroduces the hazard the E76/E71b work removed from step 7a. The failure chain:

1. `.current/` holds no `*.jsonl` (see reachability below).
2. zsh `NOMATCH` aborts the entire `git add` — so `handoff.md` and `tasks.md` are **not staged either**. This is the part that matters: the glob doesn't degrade to "skip the jsonl", it takes the other two paths down with it.
3. `git commit` has nothing staged and exits non-zero. Step 13a gives no instruction for this case — it covers only push rejection.
4. 13b runs `--close-out`, ahead-count is 0, prints `CLOSE-OUT PASSED`.
5. The Output rule (`:10`) is satisfied, and the session emits `Done. Released <tag>.` with the bookkeeping uncommitted.

That is round 1's N1 defect — a manufactured clean signal for the exact escape E84 exists to catch — reached by following the SOP *exactly as written*. It is not the "agent skipped a step" residual I ruled acceptable above.

**Reachability.** Not hypothetical for shipped guidance. `content/skill-release-engineer.md` is composed into every consumer workspace, not just this repo. A workspace performing its first release may legitimately have no `.current/*.jsonl` yet — `metrics.jsonl` is written best-effort by `tools/metrics.ts` and `telemetry.jsonl` only once a gate has fired. In *this* checkout both exist, which is precisely why the defect would not surface in local testing. The platform default shell is zsh (`:143` says so in the file's own words).

**Fix.** Any of these, all inside the ticket's file boundary:

- Preferred — follow the file's own E76 precedent: enumerate with `find .current -maxdepth 1 -name '*.jsonl'` and add the result, alongside explicit `git add -- .current/handoff.md tasks.md`.
- Or drop the glob and name both files, tolerating absence.

Note that quoting alone is not sufficient: `git add` errors on a pathspec that matches nothing, so `'.current/*.jsonl'` trades a zsh abort for a git abort.

**Also required, and this is the half that actually closes the class:** 13a must verify its own staging before committing — confirm `git diff --cached --name-only` is non-empty (or handle the nothing-to-commit exit explicitly) and STOP if the stage is empty. Without that, *any* future failure of 13a's staging step — not just this glob — drains straight into 13b's vacuous pass. Unlike the skipped-13a residual, this path is on the faithful-execution branch, so an in-file assertion genuinely closes it.

---

### Q1 — workflow change: nothing stranded, and the new step does not over-claim. No finding.

Verified `git add`'s pathspec list at `:232` and the allowlist bullet at `:41` name **exactly** three paths: `.current/handoff.md`, `.current/*.jsonl`, `tasks.md`. `docs/backlog.md` appears in neither. So 13a cannot sweep up post-release backlog rows filed by pm, which is what made the historical commits (`139f422`, `fa3fc80`, `67c72e9`, `aac5a40`) conflate two actors' work in one record.

Ordering is right: 12 (closing write) → 13 (read-back) → 13a (commit+push) → 13b (close-out) → 14 (handback to pm). Pm's backlog intake — named at step 14 — necessarily runs *after* 13a, so the paths it later touches cannot be claimed by it. Release-engineer's own backlog done-marks still go in the release commit via step 7c, unchanged.

This is cleaner than what it replaces, and cleaner in the specific way E17 cares about: a commit now describes one actor's work. Post-release backlog rows needing their own commit is the correct consequence, not a stranding.

### Q2 — write-scope growth: a real constraint, not just prose. No finding.

The grant is **commit-only, not authoring**, and that distinction is what makes it cheap:

- Two CRITICAL Hard rules in this same file (E9A `:21`, E18 `:22`) forbid hand-editing `.current/handoff.md` and `tasks.md`, in terms that outrank any dispatch brief.
- The server backs them: `STAMP_PROVENANCE_SUSPECT` in `gates/` rejects hand-authored stamps. So "never hand-edited" has an enforcement point behind it — unlike most allowlist prose.
- The qualified-entry form matches house style: `dist/**` ("via `npm run build` only — never hand-edited") and `qa_reports/archive/**` ("move-only") already read this way.

On the apparent tension with E87 — that row praises release-engineer for refusing to widen its own write scope rather than repairing backlog citations. That refusal was about *authoring content it doesn't own*. Staging a path for commit is not authoring it, and the bullet says so explicitly ("the content is written elsewhere, via `tw_update_state` and task-completion mechanics"). The tension is apparent, not real.

Minor, optional: the bullet would be stronger citing E9A/E18 by tag, so a reader who lands on the allowlist first is pointed at the rules that constrain it rather than relying on the parenthetical.

### Q3 — step 13's gate: genuinely fixed, verified by inspection, not renumbered around.

Round 1's finding was that a step placed after the terminal-reply gate has no execution point. Confirmed closed at three sites, all of which had to move together and did:

- `:228` (step 13) — the old sentence "Only after this server-confirmed read-back may the final `Done. Released <tag>.` reply be emitted" is **gone**, replaced by "The final `Done. Released <tag>.` reply is NOT yet due here — it is gated on step 13b below (E84)." The header also changed from "BEFORE the final reply" to "BEFORE the bookkeeping commit below".
- `:233` (step 13b) — now carries the gate: "Only after `CLOSE-OUT PASSED` is confirmed here may the final `Done. Released <tag>.` reply be emitted."
- `:10` (Output rule) — requires both the read-back **and** 13b, on both the direct and the relayed branch, with the relayed branch correctly noting 13a/13b are ordinary git mechanics not subject to the no-MCP-path restriction.

`grep -n "Done\. Released"` returns exactly these three plus step 9a's FAIL prohibition — no stale fourth gate left earlier in the file. The gate moved; it was not duplicated or worked around.

One sequencing risk worth recording as verified-safe: 13a pushes HEAD one commit past the release tag, which would fail `verify-release.mjs` Check 1 (tag-at-HEAD). It does not fire, because `--close-out` deliberately runs *only* the ahead-of-upstream check — `scripts/verify-release.mjs:33-40` and `:85-91` say so, and the code path confirms it. The script was built anticipating this exact ordering.

### Q4 — the four non-blocking items

| item | status |
|---|---|
| N3 — `UNLESS` clause order (`:24`) | **Confirmed.** Requirement now stated first ("MUST appear in the `git diff --stat` … and MUST exist on disk"), exemption after, scoped with "**only**". |
| N4 — `:206` existence-check half (`:222`) | **Confirmed.** Reads "exempt from the diff-membership half of that check only, not a check failure; still `ls`-verify each marked path exists on disk (the on-disk-existence half is never exempt)", and the closing clause correctly narrowed to "any **unmarked** citation". |
| N6 — step-9a meta-commentary fenced | **Confirmed** at `:220-222`. Correct call: this is a maintenance note addressed to future editors, not operating guidance, so stripping it from the delivered prompt is the intended behaviour. |
| N7 — E82 (ii) second half | **Confirmed shipped**, with a scoping caveat below. |

**On N7, since round 1 flagged the done-mark would otherwise overstate.** The half I flagged — "state the resolved wait budget it actually used … so the record says what ran, not just that it ran" — is present at `:219`. That obligation is discharged.

The caveat: `docs/backlog.md:204` option (ii) reads *"one step-9a sentence telling the release-engineer to set a budget below its own tool ceiling **and** say what it used."* Only the second clause is in the prose. The first is satisfied *structurally* by option (i) — `DEFAULT_WAIT_SECONDS = 480` (`scripts/verify-release.mjs:289`) already sits under the 600s harness ceiling, so nobody needs to set anything — and that was the filed reasoning for preferring (i)+(ii) together. But step 9a now advertises `AGC_VERIFY_CI_WAIT_SECONDS` as overridable **without** the ceiling caveat, so an operator who sets 900 reinstates E82's original ambiguity. Non-blocking. It means an E82 done-mark should be scoped as *"(i) plus (ii)'s reporting half; the override-ceiling guidance rides on (i)'s clamped default"* — which is accurate — rather than "(ii) shipped in full".

### N10 — non-blocking — E17's forensics tail moved into a stripped fence, asymmetrically with its siblings (`:25-27`)

The E17 "Reason (E17 forensics): …" tail moved off the bullet line into a `rationale:start/end` fence. `prompts/build.ts:436` applies `applyTextTransforms(taggedBody, { fullDetail })` to the **skill** body, and the comment at `:432` states `fullDetail=false` strips "on every `buildPromptForRole` dispatch, including the mirror call site (E51)". So this text no longer reaches the release-engineer at runtime.

Its three sibling CRITICAL Hard rules keep theirs inline and unfenced — E9A (`:21`), E18 (`:22`), D10 (`:23`). E17 is now the only one whose incident history is stripped, and the E17-S2 test name records that the inline placement was deliberate ("matching the D10/E9A precedent structure").

Not blocking, and I want to be clear why, because the reasoning cuts both ways: the rule's entire *normative* content — the MUST, the `ls`/`git diff --stat` verification instruction, the NEVER-claim clause — is outside the fence and ships intact, and it got *better* this round with the E83 marker clause. Forensics is genuinely non-normative "why", which is what fences are for, and the doubled reason tail (E17 + E83) is a legitimate context-budget trigger. The motive was sound.

What I do want is for the decision to stay **visible** rather than be laundered through a test rewrite — see the qa note below, because re-baselining E17-S2 naively would pin the fenced form and make the asymmetry permanent.

### Correctness — other

No further findings. The expected-red manifest (N2, round 1) is accurate: both entries sampled per SOP 4a and both are real, locatable, and actually red — `test/feature-lease.test.mjs:1656` and `test/verify-release.test.mjs` VR-9, matching `# fail 2` on those two files. Both are stale prose pins, confirmed by reading the assertions: E17-S2 requires the reason tail on the bullet *line* (it moved to the fence, verbatim); VR-9 pins the literal string ``default ~10 minutes via `AGC_VERIFY_CI_WAIT_SECONDS` `` — the exact hardcoded figure E82 (ii) set out to remove. Neither is behavioural.

### Quality

N10 above. Otherwise consistent with the file's conventions: step numbering, the E84 tag on both new steps, the fenced rationale form, and the Escalation-Routes scope note at `:254` correctly reframing `cc3e0df`/`53a6392` as "historical examples predating step 13a" rather than current practice.

### Architecture

No architecture spec for this feature. Layering is right, and the strongest evidence is that `scripts/verify-release.mjs:33-40` already describes the invocation point 13b now provides — the script was designed for this sequencing and the SOP finally supplies it. Keeping E84 in release-engineer rather than the coordinator SOP is the correct call: this file already owns every other git mechanic (steps 8, 9, 9a), and `content/coord-*.md` loads on every dispatch regardless of role.

One follow-up, out of this ticket's boundary: `scripts/verify-release.mjs:39-40` still reads "Today this is a manual, documented command; no automatic invocation point exists yet." Defensible as written — 13b is mandated, not automatic — but it now understates. Worth a line in a future `scripts/`-touching ticket, not here.

### Security

No findings. Content-only; no executable surface, no trust boundary, no secrets. The write-scope grant is assessed in Q2 and is commit-only with server-side backing.

### Performance

No findings. No runtime code changed. Context cost is +19 lines of served prose per release-engineer dispatch, partly offset by N10's fence moving ~120 words out of the delivered bundle.

### Verdict

**CHANGES_REQUESTED** — N9 only: step 13a's raw `.current/*.jsonl` glob violates the file's own E76/E71b zsh-NOMATCH rule at `:143`, and on a zero-match workspace it aborts the entire `git add`, leaving 13b to report `CLOSE-OUT PASSED` over an uncommitted tree — round 1's vacuity, reached this time under faithful execution rather than by skipping a step. Everything else asked for this round landed, and the N1 design is correct.

---

## Round 3 — APPROVED — by code-reviewer

### Summary

- N9 is fixed at `content/skill-release-engineer.md:232`. I re-ran all four reported cases plus two probes the report did not cover; every claim in the round-3 notes held under execution.
- The raw glob no longer reaches `git add`. Its two surviving textual occurrences are the allowlist bullet at `:41` and the step's own warning about itself — neither is executable.
- The non-empty-stage assertion closes the *total*-staging-failure class, confirmed empirically against a failure mode the author did not enumerate. It does not close *partial* staging failure — recorded as N11, non-blocking.
- Served-prose cost grew from the +726 bytes (+1.2%) I measured in round 2 to **+4333 bytes (+6.85%)**. Ruling on the fence line is N12. Non-blocking, but it must not cement silently.
- The `review_verdict` near-miss is N13: the correction was exemplary, but the write passed every gate in `GATE_REGISTRY` unexamined, and that is a real gap worth a backlog row.
- Verdict: **APPROVED**.

### Correctness

#### Q1 — Does the replacement work as written? Verified by execution. No finding.

I did not take the four-case report on trust. Scratch git repos, the command copied verbatim from `:233-241`:

| case | result |
|---|---|
| zero `.jsonl`, real changes | exit 0; staged `.current/handoff.md`, `tasks.md` |
| nothing to commit | assertion fired, STOP message on stderr, exit 1, stage empty |
| `.jsonl` present and changed | exit 0; staged `handoff.md` + `metrics.jsonl` (both discovered files passed to `git add`; the unchanged one is correctly absent from the cached diff) |
| **control** — old text verbatim under zsh | `zsh:1: no matches found: .current/*.jsonl`, exit 1, stage empty |

All four reproduce. The defect N9 named was real and is gone.

On the three specific sub-questions:

**Does `bash -c` word-split the `find` output as the text assumes?** Yes. Unquoted `$JSONL` undergoes word splitting under bash; case 3 confirms both discovered paths reach `git add` as separate arguments. The stated reason for the wrapper — parity with step 8's `$EXISTING` loop at `:196-203` — is accurate, and the `find -maxdepth 1 -name` precedent it cites genuinely exists in this file at `:143`, `:149`, `:153`, `:162`, `:182`. The claim is not decorative.

**Is the assertion before `git commit`?** Yes, and I checked this structurally rather than by reading the prose. There is no `git commit` inside the `bash -c` block; the commit appears only in the following sentence at `:242`, guarded by *"If that script exits non-zero, STOP here — do not proceed to `git commit`."* The ordering is therefore sound. It is enforced by an operator honouring a non-zero exit rather than by shell short-circuit — but the failure is loud (stderr message + exit 1), which is the property that matters, and folding the HEREDOC commit into the same `bash -c` would conflict with the HEREDOC Hard rule. No finding.

**The `.current/`-missing probe.** This is the one I was asked to press on, and the answer is better than expected. `find .current …` on a missing directory errors to stderr and exits 1 — but the script has no `set -e`, so `$JSONL` is simply empty and execution continues. `git add` then fails on `.current/handoff.md` (`fatal: pathspec … did not match any files`) and — because git validates pathspecs before staging any of them — stages *nothing*. The stage is empty, so **the assertion catches it**: STOP, exit 1, no commit.

That is the finding worth recording: the missing-`.current/` case is a state the SOP nowhere anticipates, and the assertion contains it anyway, because it keys on the *outcome* (empty stage) rather than on an enumerated cause. It is evidence for the design, not against it. It is also unreachable in practice — step 1's `tw_get_state` and step 12's closing write both require `.current/handoff.md`, so the directory provably exists by the time 13a runs.

I also verified the claim that quoting the glob does not fix the original defect, since the step now asserts it in prose: quoted, zsh passes the literal through and `git add` exits **128** with `fatal: pathspec '.current/*.jsonl' did not match any files`, stage empty. One abort traded for another, exactly as written. The prose is correct.

#### N11 — non-blocking — the assertion closes total staging failure, not partial (`:236-240`)

`[ -z "$(git diff --cached --name-only)" ]` tests that *something* staged, not that *everything* did. If `find` succeeds but under-reports — e.g. `.current/` reached through a symlink, which BSD `find` will not descend without `-L` — `handoff.md` still stages, the stage is non-empty, the assertion passes, and the `.jsonl` sidecars are silently omitted from the bookkeeping commit.

Not blocking, for three reasons: the N9 defect was specifically the *total*-abort class and that class is now closed; the blast radius is limited to best-effort telemetry/metrics sidecars, which the next release's 13a sweeps up; and step 8 carries a full completeness cross-check (AC2, `:207`) while 13a deliberately does not, which is a proportionate asymmetry for three known paths. Recorded so the gap is visible rather than assumed closed, and pinned for qa.

#### Q2 — Does the assertion close the class, or only this instance? It closes the class.

Confirmed, and this is the half of N9 that mattered. The assertion is keyed on the staged-set being empty, not on the glob, not on zsh, not on `.jsonl`. Every probe above reaches it through a different cause — zsh NOMATCH, quoted-pathspec failure, missing directory, genuinely-no-changes — and all four terminate at the same point with a non-zero exit. Any future pathspec mistake in this step lands there too. Nothing drains into 13b's `git rev-list --count @{u}..HEAD` as the vacuous PASS that round 1 produced.

The step's own claim at `:242` — *"any future staging failure, not just this glob, is caught at this same point"* — is accurate as written, which is not something I could say of round 1's sequencing claim.

### Quality

#### N12 — non-blocking, but a decision of record — the NOMATCH explanation is unfenced, and should be fenced (`:232`)

Measured with the same method as round 2 (`stripRationale` applied, served bytes): base 63301 → head **67634**, a delta of **+4333 bytes (+6.85%)**. Round 2 measured +726 (+1.2%). Round 3 therefore added roughly 3.6KB of *served* prose to a file that ships on every release-engineer dispatch.

Most of that is legitimate: 13a is a genuinely new obligation step that makes and pushes a commit, and an obligation cannot be fenced. The discretionary portion is the **1012-byte** unfenced block running from *"`.current/*.jsonl` is a raw shell glob…"* to *"…same reason step 8's `$EXISTING` loop is wrapped"*. It is not in a `<!-- rationale -->` fence; the sibling E82 note at `:224` and the E84 note at `:245` both are.

I was asked to rule rather than hedge, so: **it should be fenced.** The derivation — why zsh NOMATCH aborts, why quoting fails, why `bash -c` — goes inside the fence; the obligation (do not pass the raw glob to `git add`; enumerate via `find`; assert non-empty before committing) stays outside it.

The reasoning that decides it is an asymmetry between two readers:

- The reader who could "simplify" the command back into the bug is **editing this file**, and sees fenced text in full — `stripRationale` affects the served prompt, never the file on disk. Fencing costs that reader nothing.
- The reader paying the 1012 bytes is the **release-engineer executing step 13a**, who needs the obligation and cannot act on the derivation.

So the protective value the unfenced placement is meant to buy is already fully preserved by the fence, while the cost falls entirely on the reader who gets no benefit. That is not a close call once the two readers are separated.

Reinforcing it: `:143` already states this same hazard as a **file-wide rule** in unfenced prose, and `:232` explicitly cites it (*"folds into the E76/E71b zsh-NOMATCH rule at `:143`"*). Having cited the governing rule, re-deriving it at length is duplication rather than protection.

Not blocking — the command is correct and the edit is a mechanical fence insertion with zero behavioural effect, which is not worth spending round 4 on. But it must be pinned as a **visible decision**, not left to cement by default. It is the same asymmetry N10 raised for E17's forensics tail; the two should be settled together as one ruling applied at two sites.

#### N13 — non-blocking finding, but owed a backlog row — `review_verdict` has no authorship gate (`tools/handoff-orchestrator.ts:671`)

sr-engineer self-reported that its first `tw_update_state` this round carried `review_verdict: "APPROVED"` on an `agent_id="sr-engineer"` write, corrected it immediately with a second write, and flagged it in `pending_notes`. I confirm current state carries no verdict; the field is transient, so nothing persisted. On the conduct itself: the correction was immediate, self-initiated, and recorded — that is the behaviour the constitution wants, and I record it as such.

What is owed is not about sr-engineer. I checked whether any gate would have caught it, and none would:

```ts
// tools/handoff-orchestrator.ts:671
if (parsed.agent_id === "code-reviewer" && parsed.review_verdict) {
```

`REVIEW_VERDICT_STATUS_MISMATCH` arms **only on reviewer writes** (`gates/registry.ts:588`: `armCondition: "agent_id=code-reviewer && review_verdict present"`). A non-reviewer stamping a verdict is therefore not merely allowed to pass — it is never examined. The gate that exists to police verdict integrity is scoped so it cannot see the one case where the verdict has no legitimate author.

Contrast the sibling fields, which are guarded in exactly this dimension: `completed_tasks` is rejected on reviewer writes (`REVIEWER_COMPLETED_TASKS_REJECTED`) and generalised to every non-qa identity (`NON_QA_COMPLETED_TASKS_REJECTED`, gate 33). `review_verdict` received the status-consistency half of that treatment and not the authorship half.

Blast radius here was nil — the write was `status: In_Progress`, not a routing hop to qa, so `MISSING_REVIEW_EVIDENCE` never armed either, and the field does not persist. But the shape is the one this project treats as serious: a write momentarily formed like a role approving its own work, invisible to all 33 gates, surfaced **only because the author said so**. Detection that depends on candour is not detection.

This is out of scope for T-W15-01 (no source change, no backlog write permitted this round), so I am not filing it. Recorded here and pinned for qa/coordinator as a backlog candidate: extend the `NON_QA_COMPLETED_TASKS_REJECTED` treatment to `review_verdict` — reject the field on any `agent_id != "code-reviewer"` write.

### Architecture

No findings. 13a stays colocated in release-engineer, which already owns every other git mechanic in this file (steps 8, 9, 9a) — no cross-session obligation is added to the coordinator SOP, and the round-2 sequencing claim (commit made and pushed before 13b checks) is now true rather than asserted. No runtime code changed; `test/` is untouched, confirmed.

### Security

No findings. The `find`-then-word-split pattern is injection-safe for this input class: paths are machine-generated sidecar names under a fixed directory, matched against a literal `*.jsonl`, and `git add --` terminates option parsing so no discovered path can be read as a flag. Word splitting would mishandle a path containing whitespace; not reachable for `metrics.jsonl` / `telemetry.jsonl`, and covered as a general caveat by N11.

### Performance

No findings. One `find` over a single directory at `-maxdepth 1`, once per release. The only measurable cost is context, priced in N12.

### Verdict

**APPROVED** — N9 is genuinely fixed, verified by execution in four cases plus two probes rather than by reading, including the missing-`.current/` state the SOP does not anticipate, which the assertion contains correctly. The assertion closes the class, not just the instance. N11 (partial-staging gap), N12 (fence ruling) and N13 (`review_verdict` authorship gate) are non-blocking and carried forward to qa.

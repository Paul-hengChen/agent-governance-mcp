# Review — T-E103-01

covers: T-E103-01, T-E91-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Base `c35dcf8`, branch `feat/e91-e103-e102-wave1-content-init`, worktree
`<lanes-root>/e91-e103-e102`. Diff under review: `git diff content/` —
three files, uncommitted (+884 bytes net).

Contract read as spec (no `specs/` file; backlog-row-as-spec mini-chain):
`docs/backlog.md:213` (E91), `docs/backlog.md:225` (E103),
`docs/v4.0.0-execution-plan.md` §8 decision C (lines 743–762) and §4 Wave 1 L-CONTENT
cell (line 289).

Independence: sr-engineer ran pinned `fable`; this review ran `opus`. Different model,
no same-model bias suspected.

## Summary

- Three content fragments, no code. E103 (iii): `coord-02-host-dispatch.md:1` makes
  `model` a required argument on every `Task` dispatch and states a resolution order.
  E91 (iii): `coord-03-core-fallback.md:83` retires the "verify they're honored" framing
  from Crash-Resume step 3; `coord-04-host-watermark.md:15-23` rewrites the Pinned-tier
  expectation so the self-report premise leads.
- **Both decided options are correctly identified and neither diff leaves its cut.** E103's
  second facet (extending "describe the diff, not the brief" to coordinator briefs) is
  absent, as decided. E91 adds **no** verification mechanism — no `usage.jsonl` reference,
  no detector, no new gate. The rejected-on-measurement option (ii) was not smuggled in.
- E103's obligation is genuinely established rather than described: "the `model` argument
  is REQUIRED on every call, omitting it is the defect" is imperative, and the `Task(...)`
  signature literal on the same line now carries `model="<resolved tier>"`. Pin-overrides-
  frontmatter is explicit.
- **Two required findings, both in the same new clause at `coord-02-host-dispatch.md:1`,
  and both of the E73 constraint-(4) class — the clause cites two things its reader cannot
  reach.** One of them (R2) breaks the mechanism in every workspace that is not this repo,
  which is the class of defect E103 (iii) exists to remove.
- Verdict: CHANGES_REQUESTED. The prose intent is right throughout; the defects are in how
  the resolution source is *named*, not in what was decided.

## Correctness

### R1 (required) — `content/coord-02-host-dispatch.md:1`: the "line 11" cross-reference is unreachable *and* inaccurate

New text: `resolve <resolved tier> exactly as line 11 resolves the watermark tier`.

**Unreachable.** These fragments are composed into one bundle by `prompts/build.ts` /
`prompts/skill-manifest.ts`; source-file line numbers do not survive composition. Measured
against the current tree via `buildPromptForRole('skill-coordinator.md', …)`:

| what | composed-bundle line |
|---|---|
| the clause containing "exactly as line 11" | 216 |
| the brief line it actually means (`Watermark your reply per Constitution §1 …`) | 226 |
| **what a reader finds at bundle line 11** | `\| name \| value \| meaning \|` — a constitution table header |

So the reader is pointed at a table header row in the constitution, and the referent sits
*ten lines below the pointer*, not above it. This is E73 constraint (4) verbatim — "a
comment MUST NOT cite anything its reader cannot reach … executable by someone who has
never heard of this server" — and the assignment is right that it is a recurring class here.

**Inaccurate, independently of reachability.** Line 11 does not resolve the same thing the
new clause resolves:

- `coord-02:11` (the brief line) tells the *dispatched role*: `<tier>` = the `dispatch_pins`
  entry **else your frontmatter default** — and per `coord-04:13` ("MUST also match the
  dispatched subagent's `name` frontmatter and `model` frontmatter") that default is the
  installed subagent definition `~/.claude/agents/<role>.md`.
- The new clause tells the *coordinator*: else `content/skill-<role>.md` frontmatter
  `recommended_model`.

Two different actors reading two different artifacts. Decision C treats them as distinct by
construction — it records that the 11 `content/skill-*.md` values and the installed
`~/.claude/agents/*.md` values were **verified to agree** before deciding, which is only a
meaningful sentence if they are separate sources that could disagree. Asserting they resolve
"exactly" the same way converts a measured coincidence into a claimed identity. (It is not
even universally true today: `templates/claude-code-agents/lite.md` declares `model: haiku`
while `content/skill-coordinator-lite.md` declares `recommended_model: sonnet`.)

**Fix**: delete the clause `exactly as line 11 resolves the watermark tier`. The parenthetical
that follows it already states the full resolution order correctly and unambiguously. This
also recovers budget. If a pointer is wanted, name the target by its heading/quoted text, not
by an ordinal.

### R2 (required) — `content/coord-02-host-dispatch.md:1`: `content/skill-<role>.md` does not exist in the workspaces this SOP governs

The fallback instructs the coordinator to read "that role's own `content/skill-<role>.md`
frontmatter `recommended_model`". In a managed consumer workspace there is no `content/`
directory:

- `bin/agc-init.mjs` scaffolds `.current/.config.json`, `tasks.md`, and the three adapter
  files (`CLAUDE.md` / `AGENTS.md` / `.antigravityrules`) — and nothing else. Verified by
  reading the scaffold list at `bin/agc-init.mjs:311-350`.
- The SOP text reaches the coordinator *as prompt content served by the MCP server*; the
  server's own `content/` tree lives in the npx/`node_modules` install directory, at a path
  the agent has no way to name.
- Corroborating convention check: `grep -n 'content/' content/coord-*.md` returns **exactly
  one hit — the line this diff introduced**. The entire pre-existing coordinator SOP refers
  to `~/.claude/agents/<role>.md` (locally installed, reachable) and cites
  `templates/claude-code-agents/` only as a copy-source provenance note, never as a runtime
  read. This diff is the first instruction in the bundle to `cat` a server-package path.

Consequence, and why this is required rather than cosmetic: read literally by a coordinator
in any workspace but this one, the fallback read fails for **every** role, and the clause
immediately after it then fires — "a role with no resolvable `recommended_model` is a report
to the human". Every dispatch becomes a report to the human, or (more likely) the coordinator
improvises a substitute. Improvisation is precisely the failure mode E103 (iii) was chosen to
eliminate: decision C's whole argument for (iii) over (i) is that (i) "relies on the
coordinator remembering, which is the same class of failure the row exists to prevent". An
unreachable read re-introduces that dependency one layer down.

**Fix — the decided option does not need to change; only the artifact naming does.** Two
reachable channels exist, either is acceptable:

1. `tw_switch_role(role)` already returns `recommended_model` as a top-level field of its
   JSON response (confirmed live this round: the `code-reviewer` call returned
   `"recommended_model":"opus"`). It is fed by `tools/skill-frontmatter.ts` — the exact
   parser E103's row cites as the reason (iii) is "wiring, not new machinery". Note the
   cost: that call also returns the whole SOP body into the coordinator's context.
2. `~/.claude/agents/<role>.md` `model` frontmatter — a one-line local read, already named
   as authoritative by this very sentence's own continuation ("its tier-pinned model (per
   `~/.claude/agents/<role>.md` frontmatter)"), and verified by decision C to agree with the
   SOP values everywhere.

Whichever is chosen, the repo-relative path may stay as a parenthetical for readers working
*in* this repo, but it must not be the primary instruction.

### C1 (recommended) — `content/coord-03-core-fallback.md:63-64`: surviving served-model claim in the untouched preamble

> `do NOT improvise a resume from transcript alone; that is how a dispatch-time model pin
> silently degrades back to frontmatter default.`

Adjudicating the question as posed: **this is not a contradiction of the softened step 3.**
The preamble is a warrant for an instruction ("don't improvise"), and its subject is the
coordinator's own omission of the override — something the coordinator can observe directly,
unlike which model served a turn. The instruction survives untouched either way, and the
preamble is outside the decided option's named target (decision C names *step 3*).

It is nonetheless the one surviving sentence in `content/` that asserts an outcome the
fragment now admits it cannot observe. Scan for the residual class
(`grep -rn 'take effect\|actually served\|actually executed\|silently degrades\|honored'
content/*.md`) returns this line and nothing else that is not already honest. Standing 19
source-lines above step 3's new "it has no channel to confirm which model actually served the
resumed turn", it reads as the fragment contradicting its own epistemics even though the
instruction is sound.

**Fix (free, zero budget)**: `…that is how a dispatch-time model pin gets silently dropped
from the resume call.` Same warrant, same word count, states the coordinator's own observable
omission instead of an unobservable host outcome.

### C2 (recommended) — `content/coord-04-host-watermark.md:13` not updated for E103

With E103 (iii) shipped, every dispatch carries an explicit `model`, so the authoritative
expected tier is **the tier the coordinator passed**. Three places now name three sources:

| location | expected tier resolves to |
|---|---|
| `coord-02:1` (new) | `dispatch_pins` → SOP `recommended_model` |
| `coord-02:11` (brief, untouched) | `dispatch_pins` → "your frontmatter default" |
| `coord-04:13` (untouched) | the subagent definition's `model` frontmatter |

These coincide today for the 10 roles that pair by name between `content/skill-*.md` and
`templates/claude-code-agents/*.md`, and diverge for `lite` (haiku vs sonnet). One sentence
in `coord-04` — that under E103 the expected tier is the `model` the coordinator passed,
which the pin already resolves — collapses all three into one story and is cheaper than
leaving three.

### Non-finding — expected-red disposition (SOP step 4a)

The diff touches **zero** files under `test/` (`git diff --stat -- test/` is empty), and
`qa_reports/expected-red_e91-e103-dispatch-pin-mechanics.txt` does not exist. Step 4a is not
raised as a finding: `dispatch_mode` is absent on the handoff (= `feature`), so
`REPRO_MANIFEST_MISSING` does not arm, and the two reds in play are the golden byte-identity
fixture and the `test/context-budget.test.mjs` floor — the documented qa-owned re-baseline
surface (same pattern as the T-E8795-02 ledger note), not intentionally-red implementation
tests. Both are correctly untouched here and are qa's to re-baseline. Not a defect in this
diff.

## Quality

### C3 (recommended) — budget: the self-report point is stated four times

Every coordinator dispatch pays for all four:

1. `coord-03:88-89` — "it has no channel to confirm which model actually served the resumed turn"
2. `coord-03:90-91` — "(a self-report check, not a served-model verification)"
3. `coord-04:15-17` — the new opening premise
4. `coord-04:22-23` — "a corrected or matching watermark string is self-reported prose, never proof that the pinned model executed"

(1) and (2) are adjacent sentences in one paragraph; (3) and (4) bracket one paragraph. The
diff adds 884 bytes across the three files — coord-02 +405, coord-03 +168, coord-04 +311 —
which is ≈ +219 tokens and matches the observed coordinator-bundle floor movement
(18369 → 18588) almost exactly. Dropping (2) and (4) recovers roughly half of that with no
obligation lost: `coord-03` already points the reader at "the Pinned-tier expectation below",
and that paragraph now *opens* with the premise, so the parenthetical restates what the
reader is being sent to read.

### C4 (recommended) — `coord-02:1`: the no-resolvable-tier escape hatch says what not to do, not what to do

"a role with no resolvable `recommended_model` is a report to the human, not a silent
omission" leaves the dispatch itself undefined: report and dispatch anyway without `model`?
report and stop? A trailing clause fixes it. Latent rather than live today — the two
dispatchable names with no `content/skill-<role>.md` are `teamwork` and `lite`, and no
`coord-*.md` fragment instructs the coordinator to dispatch either (`qa-visual`, which
`coord-05:5` does dispatch, resolves cleanly at `sonnet`). Note the interaction with R2: if
R2 is not fixed, this clause is not latent at all — it fires on every dispatch.

### O1 (optional) — `coord-04:19-21`: "not a pass" was dropped

Original: `is a MISMATCH (the pin silently failed to take effect), not a pass — apply…`.
New: `is a MISMATCH — the reply did not claim the pinned tier — apply…`. Replacing the
unverifiable causal claim was correct; losing the explicit `not a pass` was collateral. Three
words restore the emphasis.

### O2 (optional, not in cut) — `coord-02:1` paragraph length

That line now runs ~1,900 characters and carries four distinct obligations (fallback policy,
downgrade surfacing, the dispatch call shape, tier resolution). Pre-existing, made worse here.
Splitting the new tier-resolution material into its own short paragraph would cost nothing at
composition time, but it is out of cut — recorded, not required.

## Architecture

No architecture spec exists for this feature (backlog-row-as-spec mini-chain, correctly so —
`AC_EXECUTION_LOG_MISSING` and the per-AC machinery are dormant).

Fit with the fragment architecture is the concern, and it is where R1 and R2 both land: these
files are *composed*, so a fragment may not depend on its own source-file line numbering (R1)
and may not assume the server's source tree is present in the reader's workspace (R2). Both
constraints are architectural properties of `prompts/build.ts` + `prompts/skill-manifest.ts`,
not style preferences.

Lane boundary respected: only `content/coord-02`, `coord-03`, `coord-04` modified.
`test/**`, `test/fixtures/compose-golden/**` and `test/context-budget.test.mjs` correctly
untouched. `tasks.md` carries only the two new task rows (ledger, expected). No
out-of-boundary file touched.

## Security

No findings. Content-only diff. No new input crosses a trust boundary, no secrets, no
executable path changed. The one new instruction to read a file
(`content/skill-<role>.md`) names a fixed, non-interpolated path shape with the role name as
the only variable, drawn from the closed `subagent_type` enum — no traversal surface.

## Performance

No findings in the code sense (no code changed). The composition-time cost is the +884 bytes
/ ≈ +219 tokens quantified under C3, paid on every coordinator bundle for the life of the
project. That is a budget observation, already filed; the coordinator-bundle floor is the
only floor moved, which is what §2.2 of the plan permits, and re-baselining it is qa's.

## Verdict

**CHANGES_REQUESTED** — the decided options are correctly scoped and honestly executed, but
the E103 resolution clause at `content/coord-02-host-dispatch.md:1` cites two things its
reader cannot reach: a composed-away line number (R1, measured: the referent is bundle line
226, bundle line 11 is a constitution table header) and `content/skill-<role>.md`, a path
absent from every workspace `agc init` scaffolds (R2) — which leaves the mechanical pin
resolving to "report to the human" or to improvisation, the exact dependency (iii) was
chosen to remove.

Required: R1, R2. Recommended: C1, C2, C3, C4. Optional: O1, O2.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer

Same base `c35dcf8`, same branch, same worktree. Diff still `git diff content/` — three
fragments, uncommitted. All four round-1 dispositions were re-derived from the tree, not
read from the handoff note.

Independence: sr-engineer ran pinned `fable`; this round ran `opus`. No same-model bias.

## Summary

- **R1 and R2 are genuinely resolved, not relabelled.** R1's clause is deleted outright —
  `grep -n 'line [0-9]' content/coord-*.md` now returns **zero hits across every coordinator
  fragment**, so no composed-away ordinal survives anywhere, not just at the flagged site.
  R2's primary instruction now names `~/.claude/agents/<role>.md` `model`, and the
  `content/skill-<role>.md` path survives only inside a scoped parenthetical — it is no
  longer on the resolution path in any workspace.
- C1, C2, C3, C4 all executed. C2's self-certifying "one resolution … not three separate
  stories" claim was checked literally and **is now true** (table under C2-verify below).
  C1 did not overcorrect — the preamble still warrants "do not improvise a resume from
  transcript alone", and warrants it with an observable consequence instead of an
  unobservable one.
- Both cuts still hold. E103's second facet is still absent. E91 still adds **no**
  verification mechanism — no `usage.jsonl`, no detector, no gate. Re-scanned:
  `grep -rn 'take effect|actually served|actually executed|silently degrades|honored'
  content/*.md` returns nothing in the three touched fragments except coord-03:89 and
  coord-04:17, both of which are *denials* of verifiability, which is the point of (iii).
- **One required finding, and it is not in `content/`.** The round-2 fix changed the
  artifact a recorded human decision names, and neither the ledger row nor the handoff
  says so. The mechanism is fine; the paper trail is now false.
- Budget: measured, and the recommended trims are worth taking before the floor is set.
  Verdict: CHANGES_REQUESTED.

## Correctness

### R1 — RESOLVED (verified)

`content/coord-02-host-dispatch.md:1` no longer contains `exactly as line 11 …`. Stronger
check than the finding asked for: `grep -n 'line [0-9]' content/coord-*.md` returns no
matches in any of the seven fragments, so the composed-away-ordinal class is clear
repo-wide, not just at the one site. The parenthetical resolution order stands alone and
reads correctly.

### R2 — RESOLVED (verified), with the substitution recorded below as N1

New primary: `else that role's ~/.claude/agents/<role>.md `model` frontmatter`. Reachable,
and it is the artifact the same sentence's own continuation already called authoritative
("its tier-pinned model (per `~/.claude/agents/<role>.md` frontmatter)"), so the line is now
internally consistent where it previously cited two different sources.

Coverage is *better* than the SOP path would have been, not merely equal: the dispatch
precondition is "a subagent named `<role>` is registered", and every registered agent
definition carries `model:`. All 12 `templates/claude-code-agents/*.md` do. The SOP path
would have had no entry at all for `teamwork` (there is no `content/skill-teamwork.md`) and
a divergent one for `lite`. So the substitution removes two holes.

The round-1 defect — every dispatch degrading to "report to the human" or to improvisation
in any workspace that is not this repo — is gone.

### C1 — RESOLVED, and it did **not** overcorrect (verified against the specific risk raised)

`content/coord-03-core-fallback.md:64` now reads `…that is how a dispatch-time model pin
gets silently dropped from the resume call.`

The warrant survives intact, and the check is not a formality — the instruction it supports
is `do NOT improvise a resume from transcript alone`, and the new consequence is *the direct
mechanical result of improvising*: a coordinator reconstructing a resume from transcript has
not read `dispatch_pins`, so it omits `model=` from the `Task(...)` call. That is a tighter
causal link than the old wording had. The old "silently degrades back to frontmatter default"
asserted a host-side outcome one step further downstream that the coordinator cannot observe —
it warranted the instruction by a claim the fragment now (correctly) disclaims 25 lines later.

Breadth is unchanged: both the old and new wording cite only the pin, and the protocol's other
three steps (ground-truthing the tree, restating findings) were never carried by this clause.
No obligation was narrowed.

Step 3's heading also lost `and verify they're honored`, which is the E91 core and is correct.

### C2 — RESOLVED, and the self-certifying claim is verified true

The added sentence at `content/coord-04-host-watermark.md:13` asserts "one resolution …
not three separate stories". Checked against the three sites the round-1 finding tabulated:

| location | expected tier resolves to | same story? |
|---|---|---|
| `coord-02:1` (rewritten this round) | `dispatch_pins` → `~/.claude/agents/<role>.md` `model` | ✅ |
| `coord-02:11` Dispatch Brief Template (untouched) | `dispatch_pins` → "your frontmatter default" (the dispatched role's own agent definition) | ✅ same artifact, role's-eye view |
| `coord-04:13` + Pinned-tier (rewritten) | `dispatch_pins` → "the dispatched subagent's `model` frontmatter" | ✅ |

The claim holds — but note it holds *because of R2*, not because of C2. Before R2 swapped
coord-02:1 onto the agent definition, this sentence would have been false on the day it was
written. It is a sentence that asserts a property of three other places; see N3 for why the
self-congratulatory half of it should not ship.

The sentence also does real work beyond the claim: the parenthetical `(dispatch_pins else
this same frontmatter)` supplies the precedence order inline, immediately after a sentence
that states `MUST also match the dispatched subagent's model frontmatter` as an absolute.
That repair is worth keeping.

### N1 (required) — `tasks.md:361` describes a mechanism this diff does not implement, and the divergence from a recorded human decision has not been surfaced

`docs/v4.0.0-execution-plan.md` §8 decision C names the source artifact explicitly:

> **E103 → 選項 (iii)** … coordinator 的 dispatch 段落**從角色自己的 SOP frontmatter 讀
> `recommended_model`** … `tools/skill-frontmatter.ts` 已經在解析那個欄位，所以是接線不是造輪子。

The shipped diff reads `~/.claude/agents/<role>.md` `model` instead, and demotes
`recommended_model` to a parenthetical aside. That substitution is **correct and I stand
behind sanctioning it** — round 1 offered exactly this as one of two acceptable channels, the
SOP path is unreachable from a consumer workspace, and decision C's own stated purpose
("只是讓定義本來就說的事變得顯式" — just make explicit what the subagent definition already
says) is better served by naming that definition directly.

What is defective is that nothing in the round's output says it happened:

- **`tasks.md:361`**, the T-E103-01 row added by this round's own diff, still reads
  `coordinator dispatch section reads recommended_model from the role SOP frontmatter and
  passes it as the model override on EVERY Task dispatch`. As of round 2 the first clause is
  false. This is the row the integrator done-marks E103 against.
- Nothing routes the change back to the human who made decision C on 2026-09-16.

This is the failure mode the repo shipped two whole tickets against — E87 ("rows must cite
evidence by the path it actually lives at") and E95 ("derive CHANGELOG citations from
`git diff --cached --name-only`, never from the row text"), both merged at `c35dcf8`. It is
also the same shape as the obligation coord-02:1 imposes on the coordinator four clauses
above the edited text: *a downgrade "must never pass silently"*. A human decision amended in
review, done-marked against prose describing the un-amended version, is that downgrade.

Graded required rather than recommended because the artifact that carries the falsehood is a
**completion ledger row**, it was written by this round, the error was introduced by this
round, and the remedy is one line with zero bundle cost.

**Fix (two parts, neither touches `content/`):**
1. Correct `tasks.md:361` to the shipped resolution order — `reads the dispatch_pins entry
   for the role, else that role's ~/.claude/agents/<role>.md model frontmatter, and passes
   it as the model override on EVERY Task dispatch`.
2. Carry an explicit line in `pending_notes` naming the divergence from decision C and the
   reason, so the coordinator relays it to the human rather than absorbing it. Editing
   `docs/v4.0.0-execution-plan.md` / `docs/backlog.md` is out of this lane — flagging is the
   in-lane action, and this is the same integrator-residue channel already used for E103's
   second facet.

### Non-finding — expected-red disposition (SOP step 4a), unchanged from round 1

`git diff --stat -- test/` is empty; the two reds in play (golden byte-identity, the
coordinator-bundle floor) remain the qa-owned re-baseline surface. `dispatch_mode` is absent
(= `feature`), so `REPRO_MANIFEST_MISSING` does not arm. Correctly untouched. The
`test/context-budget.test.mjs:1096` title/assertion mismatch (title ≤18303, assertion
≤18369) is confirmed present and is qa's, not this diff's.

## Quality

### C3 — the two flagged duplicates ARE gone, but the rewrite introduced a third restatement

Confirmed deleted: coord-03's `(a self-report check, not a served-model verification)` and
coord-04's trailing `a corrected watermark string does not mean the pinned model actually
executed`. The two statements the finding said to keep are both intact, and the relay
obligation the deleted coord-04 clause shared a sentence with survived the edit.

But `grep -c 'did not claim' content/coord-04-host-watermark.md` returns **3**, all inside
one 8-line paragraph:

1. `…so a mismatch means only that the reply did not claim the pinned tier` (the premise)
2. `…is a MISMATCH — the reply did not claim the pinned tier — apply the Correction strategy`
3. `…surface in your relay that the reply did not claim the pin`

(1) establishes it, (3) is the relay obligation and is load-bearing. (2) is an em-dash
appositive restating (1) two sentences after (1), inside the sentence (1) exists to license.
This is the same defect C3 was filed against, relocated. See N2.

### N2 (recommended) — `content/coord-04-host-watermark.md:20-21`: drop the appositive

Delete ` — the reply did not claim the pinned tier —`, leaving `…is a MISMATCH — apply the
Correction strategy below…`. Measured: **18633 → 18622 (−11 ~tok)**. Nothing is lost — the
paragraph's own opening sentence already defines what a mismatch means, three lines up.

### N3 (recommended) — `content/coord-04-host-watermark.md:13`: drop the meta-clause, keep the repair

The added sentence ends `— one resolution, checked here for the reply, not three separate
stories`. That half is commentary about the diff's own authoring history addressed to a
reviewer, not an instruction addressed to a coordinator: it names no artifact, imposes no
obligation, and changes no behaviour if deleted. It is also **self-certifying and perishable** —
it asserts a property of two other files, so any future edit that diverges them turns a
shipped instruction into a false statement, silently, with no test pinning it. (The one
mechanism that would catch it, the golden byte-identity fixture, pins bytes, not the truth of
the claim.)

Keep `Under E103's explicit model dispatch, this is the SAME tier the coordinator already
resolved and passed as model= on the Task(...) call.` — that is the identity claim C2 asked
for and it is genuinely new information. The `(dispatch_pins else this same frontmatter)`
parenthetical duplicates the Pinned-tier paragraph that begins on the very next line, so it
can go with the meta-clause; if you prefer to keep the inline precedence repair, keep that
parenthetical and drop only the trailing clause.

Measured, dropping both the parenthetical and the meta-clause: **−19 ~tok**.

### N4 (recommended) — `content/coord-02-host-dispatch.md:1`: the in-repo parenthetical is 23 ~tok of adopter-inert prose

`(in this repo, content/skill-<role>.md recommended_model carries the matching value)`.

**Its factual claim checks out — I verified it independently and it is accurate for every
role it can apply to**, which is the narrower and correct framing. The parenthetical attaches
to `<role>`, which ranges over the `next_role` enum plus `qa-visual` (dispatched at
`coord-05:5`). For all nine of those, SOP `recommended_model` and template `model` agree:

```
opus:   architect, code-reviewer, design-auditor, release-engineer, researcher, sr-engineer
sonnet: pm, qa-engineer, qa-visual
```

The `lite` (haiku) / `coordinator-lite` (sonnet) divergence is real but out of reach — the
filenames do not match and `lite` is not in the routing enum. So this is **not** an accuracy
finding, and the round-1 concern does not carry over. It is purely a cost finding, and it
should still go:

- It is inert for every reader who is not in this checkout, which is every adopter — it
  describes a file `agc init` does not scaffold and the server does not expose.
- It is inert for readers who *are* in this checkout too, because `~/.claude/agents/<role>.md`
  is present here as well, so the primary path resolves and the aside is never consulted.
- `grep -n 'content/' content/coord-*.md` returns exactly one hit — this parenthetical. It is
  the only reference to a server-source path in the entire coordinator bundle, and R2 is the
  finding that established why that convention exists.

Measured: **−23 ~tok**. A cross-check that nobody in either audience needs is dead weight at
any price; at 23 ~tok on every dispatch forever it is the most expensive of the three trims.

### N5 (optional) — the no-resolvable-tier escape hatch is now near-unreachable

`; a role with no resolvable tier is a report to the human, not a silent omission — stop and
report rather than dispatching without model set` measures **36 ~tok**, of which my own C4
recommendation is 16.

C4 was graded in a world where R2 might not be fixed — round 1 said so explicitly ("if R2 is
not fixed, this clause is not latent at all; it fires on every dispatch"). R2 *was* fixed, and
the branch is now guarded by the dispatch precondition itself: a role is only dispatched when
its subagent is registered, and every registered definition carries `model:`. The branch
essentially cannot fire.

Recorded as optional, not recommended, because it is what makes "REQUIRED on every call"
a complete rule — without it a coordinator that somehow hits the branch has an unstated
obligation and will most likely do the one thing the ticket forbids. Cheap insurance against
an expensive silent failure. Keep it unless the floor is contested; I would not spend a round
on it.

### O1 / O2 — unchanged, still optional, correctly not taken.

## Architecture

Fragment-composition constraints — the two properties R1 and R2 were instances of — now hold
across all three files: no fragment depends on its own source-file line numbering (verified
repo-wide), and no fragment instructs a read against the server's source tree on the
resolution path (one scoped aside remains, N4).

Lane boundary respected. Only `coord-02`, `coord-03`, `coord-04` touched in `content/`;
`git diff --stat -- test/` is empty. `tasks.md` carries only the two expected ledger rows —
their *content* is N1, not their presence.

One architectural note on N1's substitution: the resolution source moved from a
server-served value (`content/skill-*.md`, parsed by `tools/skill-frontmatter.ts`, reachable
via `tw_switch_role`'s `recommended_model` response field) to a human-copied local file. If
an adopter's `~/.claude/agents/*.md` ever drifts from the shipped templates, dispatch follows
the drifted value and the server has no say. That is an acceptable trade — it is the
definition of the subagent that will actually run, `Task(model=)` overrides it anyway, and
the alternative costs a full SOP body in context per resolution — but it is a real property
change from what decision C authorised, and it is the substantive reason N1 asks for it to be
said out loud rather than absorbed.

## Security

No findings. Content-only. The one remaining instruction to read a file names
`~/.claude/agents/<role>.md` with the role drawn from the closed `subagent_type` enum — no
interpolation surface, no traversal. Strictly narrower than round 1, which cited two paths.

## Performance

No code changed. Composition cost re-measured independently this round via the real
`composeConstitution({chain:true,design:true})` + `composeSkill("skill-coordinator.md",
hostCapabilitiesFor("claude-code"))` pipeline, `approxTokens = ceil(len/4)` — the exact
construction `test/context-budget.test.mjs:1096` uses:

| tree | ~tok |
|---|---|
| base `c35dcf8` | **18369** (= the current asserted floor, exactly) |
| round 1 | 18588 (sr's figure, not re-measured here) |
| **round 2, as it stands** | **18633** |
| round 2 with N2 + N3 + N4 taken | **18570** |

Per-item, measured individually against the round-2 tree: N4 parenthetical −23, N3 clause
−19, N2 appositive −11.

Answering the question as posed: **the three additions are not equally load-bearing, and the
bundle should not be baselined at 18633.** C4's clause (16) and C2's identity sentence are
defensible; the 63 ~tok in N2+N3+N4 are not, and two of the three are pure deletions of text
that carries no obligation at all. Net against base, the feature would then cost
+201 ~tok rather than +264 — a 24% reduction in its permanent footprint for three deletions
and no behaviour change.

**The floor should be re-baselined to 18570 once N2–N4 land**, not to 18633 and not to 18369.
Sequencing is why this is not being left as advice: qa sets the floor to the exact measured
value by this file's own documented convention, and once 18633 is asserted, reclaiming 63 ~tok
needs a new ticket. The cheap moment is now, in the round N1 already requires.

## Verdict

**CHANGES_REQUESTED** — every round-1 finding was genuinely fixed rather than relabelled, and
R1/R2 were verified resolved by a wider check than each finding asked for. The block is N1:
the round-2 fix moved E103 off the artifact `docs/v4.0.0-execution-plan.md` §8 decision C
names, which was the right call and was reviewer-sanctioned, but `tasks.md:361` — a row this
diff adds — still describes the superseded mechanism, and the amendment to a recorded human
decision is nowhere surfaced. One ledger line plus one `pending_notes` line, zero bundle cost.
Take N2–N4 in the same round and hand qa a single floor of 18570.

Required: N1. Recommended: N2, N3, N4. Optional: N5, O1, O2.

## Round 3 — APPROVED — by code-reviewer

Closing pass. Scope: verify N1–N4 resolved and that no trim cut a load-bearing
obligation; re-confirm the 18570 floor; confirm nothing new entered the diff. Round 2's
grading of N5/O1/O2 stands and is not revisited. No new optional findings opened.

## Summary

- N1 (required) and N2/N3/N4 (recommended) are all genuinely resolved — each matches the
  fix text round 2 specified, not a relabelling. Verified against the working tree, not
  against the implementer's notes.
- No trim cut an obligation. Every deletion either moved its claim to a stronger earlier
  sentence or removed pure commentary; `coord-04`'s relay obligation and the SAME-tier
  identity claim both survive and are consistent with `coord-02:1` and `coord-02:11`.
- Bundle independently re-measured at **18570 ~tok** (74280 chars) through the real
  `composeConstitution({chain:true,design:true})` + `composeSkill("skill-coordinator.md",
  hostCapabilitiesFor("claude-code"))` path — third agreeing measurement.
- Diff is confined to `content/coord-0{2,3,4}` + `tasks.md`. `docs/`, `test/`, `bin/`,
  `prompts/`, `tools/`, `gates/` are all empty in `git diff c35dcf8`.
- Contract honoured: E103 option (iii) only (no second-facet brief-verification text),
  E91 option (iii) only with **no verification mechanism** added.
- Verdict: APPROVED.

## Correctness

### N1 — RESOLVED (both parts, verified)

`tasks.md:361` now reads the shipped resolution order verbatim as specified:

```
reads the dispatch_pins entry for the role, else that role's ~/.claude/agents/<role>.md
model frontmatter, and passes it as the model override on EVERY Task dispatch
```

This matches `coord-02:1`'s shipped mechanism exactly. Part 2 (the `pending_notes` line
naming the divergence from `docs/v4.0.0-execution-plan.md` §8 decision C, its reason, and
that decision C's intent is preserved) was present on the incoming state and is **carried
forward verbatim-in-substance on this round's closing write** — my SOP step-2 claim write
replaced `pending_notes`, so re-recording it is my obligation, not a defect in the lane.

`docs/` is correctly untouched: `git diff --stat c35dcf8 -- docs/ test/` is empty. Editing
`docs/v4.0.0-execution-plan.md` §8 and the `docs/backlog.md` E103/E91 rows is out of this
lane (plan §0 rule 3, §3 ownership table); relaying is the in-lane action and it is done.

### `tasks.md:362` (T-E91-01) — checked, accurate

Not a finding, recorded because round 2 only checked the E103 row. The T-E91-01 row
describes exactly what shipped: Crash-Resume step 3 in `coord-03` and the Pinned-tier
expectation in `coord-04`, reworded to a self-report detection claim. No ledger row in this
diff now describes a mechanism the diff does not implement.

### Contract check — no verification mechanism crept in

E91 (iii) was explicitly "no verification mechanism". The diff adds none, and says so:
`coord-03:34-35` states the coordinator "has no channel to confirm which model actually
served the resumed turn", and `coord-04:17` states a match "never establishes which model
actually served the turn". E103's second facet (dispatch briefs verifying factual claims)
did not enter `coord-02` — the fragment's only change is the one dispatch sentence.

### Non-finding — expected-red disposition (SOP step 4a), unchanged from rounds 1–2

`git diff --stat c35dcf8 -- test/` is empty; no test file is touched, so no
`qa_reports/expected-red_<feature>.txt` manifest is required of this diff. The two reds in
play (`test/skill-manifest.test.mjs` golden byte-identity; `test/context-budget.test.mjs`
floor) are the qa-owned re-baseline surface, not sr-engineer-authored intentional reds.

### Non-finding — `coord-03:89` "Pinned-tier expectation below" is a pre-existing core→host reference

`coord-03` is tagged `core`; the Pinned-tier expectation it points at lives in `coord-04`,
tagged `host:claude-code` (`prompts/skill-manifest.ts:70-72`). On a non-Claude-Code host the
referent is not composed in. **Verified pre-existing**: `git show c35dcf8:content/coord-03-core-fallback.md:89`
carries the same clause verbatim. This diff reworded the sentences around it and did not
introduce it. Out of scope for a round-3 closing pass on a cut whose contract is two content
options; noted so it is visible rather than silently absorbed.

## Quality

### N2 — RESOLVED, nothing lost

The appositive ` — the reply did not claim the pinned tier — ` is gone from `coord-04:20`.
`grep -c 'did not claim' content/coord-04-host-watermark.md` = **2**, down from 3: the
premise (`:16-17`) and the relay obligation (`:21`).

**Load-bearing check.** Base also dropped `a corrected watermark string does not mean the
pinned model actually executed`. That claim is not lost — it is now stated earlier and
*more broadly* at `:17`: "a match never establishes which model actually served the turn."
Base scoped the caveat to a corrected string; the shipped text scopes it to any match. The
obligation strengthened. `not a pass` (O1) remains dropped; `is a MISMATCH` plus the
Correction strategy fully determine behaviour, which is why O1 was optional in both rounds.

The relay obligation survives intact at `:21` and is now honest: base said surface "that
the pin did not take effect" (an enforcement claim), shipped says "that the reply did not
claim the pin". That reword *is* the E91 (iii) deliverable, not collateral.

### N3 — RESOLVED, and the identity claim is intact and composes true

`coord-04:13` keeps the SAME-tier sentence and drops both the trailing meta-clause and the
`(dispatch_pins else this same frontmatter)` parenthetical — the "drop both" branch I
measured and endorsed at −19 ~tok.

**Load-bearing check, read strictly.** Sentence-locally, "this is the SAME tier the
coordinator already resolved" attaches to the `model` frontmatter token named in the prior
sentence, and in the pinned case the resolved tier is the pin, not the frontmatter. The
Pinned-tier paragraph corrects the expectation to the pin at `:18-19` — physically the next
block (`:13` → blank → `:15`), and critically **before** any action is prescribed: the
MISMATCH/Correction instruction is at `:19-21`, after the override. No reader following the
section top-to-bottom can act on the un-overridden reading. This is exactly the adjacency I
relied on when recommending the parenthetical be dropped in round 2; it holds, and I am not
reversing my own recommendation at round 3.

### N4 — RESOLVED

The `(in this repo, content/skill-<role>.md recommended_model carries the matching value)`
parenthetical is gone. `grep -o 'content/' content/coord-*.md | wc -l` = **0** across all
seven fragments; `grep -o 'line [0-9]' content/coord-*.md | wc -l` = **0** (round-1 R1's
convention holds). Nothing is lost: `coord-02:1` states the full resolution order without it.

### Three-site consistency (round-3 item 2), verified

| site | states |
|---|---|
| `coord-02:1` | `dispatch_pins[<next_role>]` if present, else `~/.claude/agents/<role>.md` `model` |
| `coord-02:11` (brief template) | "`<tier>` = the `dispatch_pins` entry above if it names your role, else your frontmatter default" |
| `coord-04:13` + `:18-19` | match the dispatched subagent's `model` frontmatter; **PIN** instead when `dispatch_pins` carries an entry |

Same precedence, three phrasings, no divergence. `coord-02:11`'s "your frontmatter" is the
subagent's own `~/.claude/agents/<role>.md` definition — the same artifact `coord-02:1`
names, from the dispatched role's point of view.

### Composition check — the text an agent actually receives

Every new or reworded span survives `stripOriginTags` + `stripRationale` into the composed
claude-code coordinator bundle (all PRESENT): the REQUIRED-`model` clause, the
no-resolvable-tier escape hatch, `coord-03`'s "gets silently dropped from the resume call"
and "Passing the override is all the coordinator can do here", `coord-04`'s "a match never
establishes…", the relay obligation, and the SAME-tier sentence. All three retired
enforcement-implying strings are absent from the composed bundle: `the pin did not take
effect`, `verify they're honored`, `degrades back to frontmatter default`. A golden refresh
alone would not have caught a drop here; this is checked against the real render path.

### Self-correction — round 2's per-item arithmetic

Round 2 reported the combined N2+N3+N4 saving as 63 ~tok while listing per-item figures
summing to 53 (−23 / −19 / −11). `ceil(len/4)` rounding cannot account for a 10-token gap,
so one of the two labels was wrong. It changes nothing downstream: the endpoint is what qa
baselines, and the endpoint is measured, not derived. Recorded because E87/E95 — merged at
this diff's own base — are about exactly this class of unrepaired citation.

## Architecture

No change from round 2. The cut stays inside `content/` and `tasks.md`; no `prompts/`,
`tools/`, or `gates/` surface moves, so `composeSkill`'s fragment contract, the host-tag
axis, and `ALLOWED_TRANSITIONS` are all untouched. `coord-02:1` preserves the base sentence
that Task-tool dispatch "changes WHICH MODEL runs the role, NOT the routing chain itself" —
the layering claim the E103 pin must not violate, and does not.

The one architectural divergence in this feature remains N1's: the pin's source artifact is
`~/.claude/agents/<role>.md` rather than the role SOP frontmatter that decision C names,
because `content/` is never scaffolded into a managed workspace. Sanctioned in round 1,
re-sanctioned in round 2, now correctly recorded in both `tasks.md` and `pending_notes`.
`tools/skill-frontmatter.ts` stays unused by this path — which is the residue the human
should see, and is what the relayed note says.

## Security

No findings. Content-only diff; no new input crosses a trust boundary, no secrets, no
execution path. `~/.claude/agents/<role>.md` is read by the host, not by this server, and
the diff adds no parsing of it.

## Performance

No findings, with one number that matters: the composed coordinator bundle is injected on
every dispatch, so its size is this feature's permanent cost. Measured **18570 ~tok** vs
base `c35dcf8`'s 18369 — **+201 ~tok**. The three trims took the pre-trim 18633 down to
18570, reclaiming 63 before the floor is nailed down. No other hot path is touched.

| tree | bundle |
|---|---|
| base `c35dcf8` | 18369 |
| round 2 (pre-trim) | 18633 |
| **round 3 (shipped)** | **18570** |

## Verdict

**APPROVED** — the one required finding and all three recommended trims are genuinely
resolved, verified against the tree rather than the implementer's report; no trim cut a
load-bearing obligation, and the two claims most at risk (`coord-04`'s relay obligation and
its SAME-tier identity sentence) both survive and compose true against `coord-02:1` and
`coord-02:11`. The diff is confined to its lane, the contract's "option (iii) only, no
verification mechanism" boundary is honoured on both rows, and the bundle is 18570 ~tok on
a third independent measurement.

**For qa: baseline `test/context-budget.test.mjs:1405` to the exact value `18570`** (from
18369), per that file's documented exact-measured-value convention. Both expected reds are
qa-owned re-baseline surface, not implementation defects: that floor, and
`test/skill-manifest.test.mjs` golden byte-identity (regenerate via the real composeSkill
pipeline and diff-confirm only the `coord-0{2,3,4}` spans moved).

Required: none. Recommended: none. Round 2's N5/O1/O2 dispositions stand.

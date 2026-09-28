# Review — T-E69-01

covers: T-E69-01, T-E71-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff under review: `content/skill-release-engineer.md` only (`git status --short` = that file plus
`.current/handoff.md` / `tasks.md` governance bookkeeping). Base: `ffa4082`. Spec: `docs/backlog.md:192`
(E69) and `:194` (E71 incl. the 2026-08-17 v3.102.1 amendment). No `specs/<feature>.md` — mini-chain,
backlog-row-as-spec. Line numbers below are the **working-tree** file.

Method note: every claim below was re-derived independently — the render was executed through
`applyTextTransforms` from `dist/prompts/text-transforms.js` (frontmatter parsed off), the glue detector
was written from scratch for this review, and both new shell snippets were **executed** under bash and
zsh in a scratch git repo. Nothing was accepted from sr-engineer's or the coordinator's summary.

## Summary
- **T-E69-01 (fence relocation): correct, and correct for the right reason.** Both sites render as
  required (rendered lines 117 and 130), zero prose bytes changed, no other glued marker anywhere in
  the file, and the new placement satisfies the block-vs-inline contract structurally rather than by
  whitespace accident.
- **T-E71-01: (c) and (d) are correct; (a) and (b) each ship a shell snippet that does not work when
  executed literally in the shell this SOP itself declares as the platform default.** Both were
  reproduced empirically, not reasoned about.
- Finding 1 (blocker): the E71a existence pre-filter (`:148-151`) stages **nothing** under zsh and
  exits 0 — a silent no-op that looks like success. It contradicts the E71b bullet 25 lines above it.
- Finding 2 (blocker): the `covers:` sweep's `-name '*.md'` (`:132`) cannot be single-quote-nested
  inside the `bash -c '...'` wrapper the same diff mandates; composed literally it aborts with
  `zsh:1: no matches found:` — the exact error string E71(b) exists to eliminate.
- Findings 3-4: minor accuracy defects of the same E71 class (an overstated "silent" promise that
  contradicts step 7a's own `EXCLUDE_*` branch logic; a mis-attributed staging step).
- Scope/boundaries clean: no test file authored (§2), no drive-by prose edits (§1 surgical changes).
- Verdict: **CHANGES_REQUESTED** — E69 is done; E71(a) and E71(b) are not yet true when executed.

## Correctness

### T-E69-01 — VERIFIED (no findings)

**Render, dispatch pass** (`applyTextTransforms(body, {fullDetail:false})`, frontmatter off,
`dist/prompts/text-transforms.js`):

- 182 rendered lines. Site 1: `   - `mkdir -p` the archive dir …` begins rendered **line 117**, and the
  preceding rendered line ends `…step 8's AC4 SKIP branch already makes.` — clean newline.
- Site 2: `7b. **Drift-baseline acknowledgment** …` begins rendered **line 130**, preceding line ends
  `… — MUST NOT be touched.` — clean newline.
- Both figures independently reproduce the coordinator's pre-dispatch claim.

**Class check (not just the two named sites).** I wrote my own structural glue detector (flags any
numbered-step header `\d+[a-z]?\. \*\*` or top-level bullet marker appearing after non-space content on
a rendered line). Results:
- against `git show ffa4082:content/skill-release-engineer.md`: **2 findings**, at rendered lines 116
  and 122 — exactly the two known sites, and nothing else. The detector is therefore sound on a known
  positive, derived independently of sr-engineer's detector.
- against the edited file: **0 findings across all 182 rendered lines.** No other numbered step header
  or top-level bullet in this file is glued.

**Zero-prose-bytes claim — confirmed.** `git diff -w` still shows the two bullet lines as changed
(their trailing rationale content moved off the line, which `-w` cannot hide), so I verified it
directly: extracting each site's region from both revisions and comparing with all whitespace
stripped gives byte-identical results.
- SITE 1 region: 852 → 853 bytes, whitespace-stripped **identical**. Delta = +1: the single space
  before `<!-- rationale:start -->` became a newline, plus one newline after the marker.
- SITE 2 region: 1460 → 1461 bytes, whitespace-stripped **identical**. Delta = +1: one inserted
  newline before `<!-- rationale:start -->`.
No prose edit hides in either hunk.

**Rationale content preserved, still stripped for dispatch.** Dispatch render:
`RATIONALE_MARKERS_LEFT=0`, `ORIGIN_MARKERS_LEFT=0`, and `On the premise this replaces` is **absent** —
i.e. it is still inside a rationale span. `{fullDetail:true}` render: 187 lines, `On the premise this
replaces` **present**, glue detector 0. This was a placement fix, not a content deletion. Confirmed.

**Block-vs-inline contract (`prompts/text-transforms.ts:33-54`) — satisfied structurally, not by
accident.** The contract the comment states is: origin fences are INLINE and the regex deliberately
does not consume a trailing newline; rationale fences are BLOCK and `stripRationale`'s
`<!-- rationale:end -->\n?` (`:28`) does consume one. Post-fix, both sites are in the canonical block
shape: `<!-- rationale:start -->` begins at column 0 of its own line, so the newline terminating the
*preceding* content line falls outside the match and survives; `<!-- rationale:end -->` is the last
token on its line, so the `\n?` consumes exactly that line's own terminator and nothing that belonged
to a neighbour. The correctness no longer depends on any adjacent whitespace — insert or remove blank
lines around either fence and both sites still render clean (the `\n{3,}` collapse at `:30` absorbs the
rest). Site 2 additionally proves order-independence: `stripOriginTags` runs first over the inline
`origin:start…origin:end` span on `:134`, leaving `…touched.\n`, and the rationale block strip then
consumes only its own lines. A next editor who keeps the fences on their own lines cannot re-break
this the way `:119` was broken. No finding.

### T-E71-01 (a) — FINDING 1 (blocker): the pre-filter snippet is a silent no-op under zsh

`content/skill-release-engineer.md:148-151`:

```
     PATHS="lib/ tools/ … .antigravityrules"
     EXISTING=""
     for p in $PATHS; do [ -e "$p" ] && EXISTING="$EXISTING $p"; done
     git add -- $EXISTING
```

**What is wrong:** this depends on word-splitting of an unquoted parameter expansion, which bash does
and **zsh does not** (no `SH_WORD_SPLIT` by default). Executed in a scratch git repo containing
`lib/`, `tools/`, `docs/`, `package.json`, `index.ts`:

- under **bash**: `EXISTING=[ lib/ tools/ docs/ package.json index.ts]`, `git add` exit 0, four paths
  staged. Works.
- under **zsh**: the `for` loop runs **once** with the entire 30-path string as a single word
  (`iter1=[lib/ tools/ docs/]` in the isolated repro), `[ -e "lib/ tools/ …" ]` is false, so
  `EXISTING=[]`, and `git add --` prints `Nothing specified, nothing added.` and **exits 0**.
  Nothing is staged.

**How it fails in execution:** a literal executor on zsh stages nothing while every command in the
block reports success. That is strictly worse than the text it replaces: the pre-E71 line failed
*loudly* (`fatal: pathspec … did not match any files`), this one fails silently with exit 0 — the
"indistinguishable success and breakage in the transcript" class that this file's own rationale block
at `:121` is written about. Step 8's AC2 pre-commit verify (`:154`) would probably catch the empty
staging afterwards, so this is unlikely to ship a broken release — but E71(a) was filed precisely
because "the release-engineer … deviated from the literal text to make the step work"
(`docs/backlog.md:194`), and after this fix a zsh executor must still deviate. The ticket's goal is
not met.

**Self-contradiction inside this diff:** `:123` (E71b, same cut) tells the executor that zsh's defaults
break naive snippets in this SOP and mandates an explicit `bash -c` wrapper — and then `:148-151`
ships a bash-only snippet 25 lines later with no wrapper and no mention of the shell.

**Note on the shell premise:** this is not hypothetical. `:91` states "the agent's shell tool is
bash/zsh", `:123` states zsh is "the default shell of the platform this repo runs on", and this
workspace's shell is zsh.

Fix options (sr-engineer's call — all one line): wrap the block in `bash -c '…'` like `:125-126`
already does; or drop the variable and write the word list literally (`for p in lib/ tools/ …`), which
splits correctly in both shells; or use `${=PATHS}` — but a snippet that needs a zsh-only expansion
flag in a bash/zsh SOP is the worse choice.

Everything else in (a) is correct and verified:
- The false claim is **gone everywhere in the step**. Repo-wide grep for `no-op silently` now hits only
  `docs/backlog.md:194` (the E71 row describing the defect), which is correct. `:152` now reads
  "EXISTS and has changes", and the new paragraph states the true behavior: a nonexistent pathspec
  fails `fatal: pathspec …` and aborts the whole command, and only the no-changes case is a true
  silent no-op.
- **The count is 30.** I counted the tokens on `:144` myself: 30 total. All 30 exist in this repo, so
  the claim "all 30 of which happen to exist in THIS repo" is true (verified with `[ -e ]` on each).
  `:148`'s `PATHS` string is token-identical to `:144`'s list — no drift between the two.
  (Sub-count nit, non-finding: 20 tokens end in `/`, not 19, because `dist/` is grouped with the
  metadata paths. That is the spec's own decomposition — `docs/backlog.md:194` says "19 directories
  plus 11 metadata paths" — and matches AC2's pre-existing grouping at `:154`, which lists `dist/`
  among the metadata paths. Consistent; leave it.)
- The pre-filter is stated as an actual, mandatory step ("**Existence pre-filter, mandatory (E71a)**"),
  not as an aside.
- `git add --` breaks nothing else the step promises. The AC2 verify (`:154`) reads
  `git diff --cached --stat`, not the add line; `test/release-staging.test.mjs` extracts the list with
  `/^\s+git add (.+)$/m` (`:227`, `:2077`) and still passes.

### T-E71-01 (b) — FINDING 2 (blocker): the `covers:` sweep's quoting cannot survive its own `bash -c` wrapper

`content/skill-release-engineer.md:132` instructs: grep the remaining root-level files "via
`find qa_reports -maxdepth 1 -name '*.md'` / `find review_reports -maxdepth 1 -name '*.md'` under
`bash -c`, per the shell-safety bullet above, never a raw glob".

**What is wrong:** the mandated wrapper at `:123` is `bash -c '...'` — single-quoted — and the pattern
here is *also* single-quoted. Single quotes do not nest in POSIX shells, so the literal composition
`bash -c 'find qa_reports -maxdepth 1 -name '*.md''` closes the outer quote and hands `*.md` to the
**outer** shell. Executed from zsh:

```
zsh -c "bash -c 'find qa_reports -maxdepth 1 -name '*.md''"
  → zsh:1: no matches found: find qa_reports -maxdepth 1 -name *.md   (exit 1)
```

This aborts **even when the tree exists and contains `.md` files** (the outer glob is matched against
the whole word, not the directory), and it aborts identically in the post-sweep empty-tree state the
bullet is written to protect. The double-quoted form used in the example block at `:125-126`
(`-name "review_T-<CODE>-*.md"`) composes correctly — `exit=0`, verified.

**How it fails in execution:** the executor follows the new anti-NOMATCH instruction to the letter and
gets the NOMATCH abort anyway, with the same `no matches found:` error the bullet quotes as the bug.
The `covers:` site — the one this ticket already lost a round to — is therefore still not actually
zsh-safe as worded. Fix: use double quotes inside the wrapper (matching `:125-126`), or give the
sweep its own complete `bash -c` one-liner in the fenced block rather than an inline fragment the
reader has to splice.

Everything else in (b) is correct and verified:
- **Both site classes are covered.** I swept step 7a (source `:60-137`) programmatically for every
  glob-shaped token rather than trusting the summary. Hits: `:105` (`sed -E 's#.*/##'` — a sed regex
  inside single quotes in a code fence, not a filesystem glob, no NOMATCH exposure); `:123` (the quoted
  error string in the new bullet, illustrative); `:125-126` (inside `find -name "…"` under `bash -c`,
  safe); `:128` and `:132` (the `covers:` prose/instruction, Finding 2). **No raw glob remains** in step
  7a. The move bullets at `:129-130` now each carry "per the shell-safety bullet above", and the
  `covers:` sweep at `:132` is routed through `find` — the two site classes the v3.102.1 amendment
  requires.
- **The `find` shape is correct shell, verified by execution** (not read): the composition
  `find qa_reports -maxdepth 1 -name "review_T-E71-*.md" -o -maxdepth 1 -name "visual_T-E71-*.md"`
  returns exactly the two intended root-level files on this platform's BSD find, and does **not** pick
  up `qa_reports/archive/oldfeat/review_T-E71-99.md` — the `-maxdepth` predicate is repeated on the
  right side of `-o`, so the OR branch is depth-bounded too and archived evidence cannot be re-swept.
  A zero-match `find` in an existing tree is silent, exit 0. `mv -n` matches the No-clobber bullet at
  `:133`. (Portability nit, non-blocking: GNU find warns when `-maxdepth` appears after `-o`, though it
  still applies globally, so behavior is right on both finds.)
- **No contradiction with the process-substitution note.** `:91` requires bash/zsh for the `<(…)`
  membership pipeline; the new bullet only mandates `bash -c` for glob-bearing bullets *below* it, and
  the derivation above it contains no filesystem glob (`:93-106` already use `find`/`git ls-tree`).
  Wrapping in bash never invalidates a bash/zsh requirement. Compatible.

### T-E71-01 (b) — FINDING 3 (minor): "silent no-op in either shell" is overstated, and the example drops the `EXCLUDE_*` guard step 7a mandates

`:123` claims "an empty `find` result is a normal, silent no-op in either shell". True for an empty
result in a tree that **exists**; false when the tree is **absent** — verified:

```
bash -c 'for f in $(find review_reports -maxdepth 1 -name "review_T-E71-*.md"); do …; done'
  → find: review_reports: No such file or directory     (loop exit 0)
```

Non-fatal (the loop's exit status is 0, nothing wrong is moved), so this is not a blocker — but this
SOP already documents that exact behavior at `:91` ("`find review_reports -maxdepth 1` exits non-zero
with 'No such file or directory' when the tree is absent") and at `:89`, and requires the `EXCLUDE_RR`
guard for it: "an excluded tree's `find`/`grep -vxFf` never runs, rather than erroring against a
directory that may not exist". The new example at `:126` runs `find review_reports` **unconditionally**,
with no `[ -z "$EXCLUDE_RR" ] &&` guard, in the shape `:89` names as the common self-healing case
(a `teamwork-lite` workspace where `review_reports/` never exists). So the new bullet both overstates
its promise and models the pattern the surrounding step forbids. Add the `EXCLUDE_*` guard to the two
example lines and qualify the "silent" claim to the tree-exists case.

### T-E71-01 (c) — VERIFIED (no findings)

`:189`. Placement, which is what (c) is actually about, is correct. The pre-existing
`.current/`-is-bookkeeping sentence remains where it was (inside the `.github/` parenthetical), and the
new exclusion is a **separate bolded sentence in the trigger paragraph's own operative chain**:
"**`.current/**` (minus `.config.json`, which IS staged …) and `tasks.md` are explicit non-STOP
exclusions from this rule (E71c)**: … so seeing either show as unstaged/modified in `git status
--short` MUST NOT, on its own, fire the STOP row above." The operative STOP sentence itself was then
amended to "Only UNRELATED uncommitted changes **beyond those two exclusions** …", so a literal
executor reading only the trigger rule cannot reach the STOP row via `.current/**` or `tasks.md`. Both
names are present, `.config.json` is correctly carved out, and the paragraph is the declared trigger
definition for table row `:181`. No contradiction with the "NOT added to this list" sentence — not
staged and not a STOP trigger are consistent positions. The `**` inside the `` `.current/**` `` code
span is inert for markdown emphasis (code spans are parsed first), so the bold renders correctly.

### T-E71-01 (c) — FINDING 4 (minor, quality): mis-attributed staging step

`:189` says `.config.json` "**IS staged per step 7b above**". Step 7b *writes* `.config.json`; step 8
is what *stages* it — as the same paragraph's earlier parenthetical states correctly ("staged
separately as one of the five metadata paths below") and as `:138` states ("`.current/.config.json` is
one of the paths step 8's `git add` now stages explicitly"). A literal executor sent to 7b for the
staging instruction will not find one there. One-word fix: "per step 8" (or "written by 7b, staged by
step 8"). Same accuracy class E71 exists to close, hence recorded rather than waived.

### T-E71-01 (d) — VERIFIED (no findings)

`:139`, amended **in place** inside the existing 7c paragraph (between the `ELSE … skip silently`
clause and the "This folds the ad hoc …" clause) — not appended as a second row or a new step, which
is what (d) asks for. It names the shape (`already reads DONE-but-unreleased`, with the literal example
`**DONE** (<date>, not yet released)` — matching the real E48 shape recorded in `docs/backlog.md:194`),
states the obligation is **not** discharged by the pre-mark ("the version stamp is still owed"), and
prescribes amending the existing phrase in place (`replace `not yet released` with `shipped vX.Y.Z``)
with an explicit "do NOT append a duplicate row for the same feature". Consistent with 7c's existing
"version, NOT a commit sha or tag" constraint and with the Artifact-allowlist "active feature's row(s)
ONLY" scope. Correct.

## Quality

- No dead prose, no duplication introduced. The two E71b example lines are the only new code fence;
  it is referenced by three bullets rather than repeated in each. Good.
- Findings 3 and 4 above are the quality-side items (overstated promise; mis-attributed step).
- Minor, non-blocking: the `:125-126` examples are per-`<CODE>` templates while `<CODES>` is a set. The
  bullets they serve state the "for ANY `<CODE>` in `<CODES>`" semantics, and the block is marked
  "e.g.", so a careful executor will iterate — but given this file's history of literal execution, an
  explicit `for c in $CODES` around the example would remove the last bit of interpretation. sr's call.
- Minor, non-blocking: `for f in $(find …)` word-splits on filenames; evidence filenames are
  `T-<CODE>-NN` shaped and never contain spaces, so this is safe in practice.
- Minor, non-blocking (fullDetail rendering only): site 1's relocated rationale block now begins at
  column 0 inside a 3-space-indented bullet list, so in `{fullDetail:true}` the rationale prose renders
  as a top-level paragraph that interrupts step 7a's sub-bullet list rather than as bullet
  continuation. Cosmetic, affects no dispatch render, and is the placement the block-fence contract
  requires — noting it only so it is not mistaken for a defect later.

## Architecture

No architecture spec for this feature (mini-chain, backlog-row-as-spec). The change is confined to one
content fragment; no source, no gate, no registry, no schema, no prompt-composition change. The fix
respects the existing layering: the render contract stays in `prompts/text-transforms.ts` and the
content file conforms to it, rather than the transform being loosened to tolerate malformed fences.
That is the right direction — E69's row explicitly frames the contract as authoritative. The
render-structure regression test that would make this contract self-enforcing is correctly **absent**
from this cut: it is T-E69-02, qa-owned per §2, and reds until this diff lands.

## Security

No findings. No source, no trust boundary, no secret, no new input path. The two new shell snippets are
SOP prose executed by a human-supervised release-engineer over fixed, repo-relative literals — no
interpolation of untrusted data. `git add --` is a marginal *improvement*: it prevents a path beginning
with `-` from being parsed as a flag. `bash -c '…'` blocks contain no unquoted expansion of external
input.

## Performance

No findings, and one genuine improvement: replacing raw globs with `find -maxdepth 1 -name` keeps the
sweep depth-bounded, so archived evidence is never re-enumerated (verified: the archive subtree is not
matched). The E71a pre-filter adds 30 `[ -e ]` stat calls once per release — irrelevant. No hot path,
no loop-over-I/O regression, no complexity-class change versus base.

## Verdict

**CHANGES_REQUESTED** — T-E69-01 is fully verified and needs nothing (both fences render correct, zero
prose bytes changed, class-wide 0 glue findings, block contract satisfied structurally). T-E71-01 (c)
and (d) are correct. But (a) and (b) each ship a snippet that fails when executed literally in zsh —
`:148-151` stages nothing and exits 0, and `:132`'s single-quoted `-name '*.md'` cannot nest inside the
`bash -c '...'` wrapper the same diff mandates and aborts with the very `no matches found:` error
E71(b) exists to eliminate. For a ticket whose entire deliverable is that the SOP is true when
executed, those two must be fixed and re-run in zsh before this reaches QA.

### Coverage notes for T-E69-02 (qa) — record only, not fixes and not blockers on this diff

1. `test/release-staging.test.mjs` is **67/67 green** on this diff and no pin broke — but no pin
   *could* have caught either blocker: nothing in the file asserts the E71 (a)-(d) wording yet, which
   is exactly what T-E69-02's second half is for. When adding those pins, prefer executing the
   snippets over string-matching them: both defects here are invisible to a content pin and obvious to
   `zsh -c`.
2. `SKILL.match(/^\s+git add (.+)$/m)` at `:227` and `:2077` now captures a leading `--` in group 1.
   Current assertions are containment-based so they pass, but any future exact-token or
   `split(/\s+/).length` pin on that capture will see 31 tokens, not 30. Worth normalizing the `--`
   away when the E71a count pin is written.
3. The class assertion E69's row specifies (every numbered step header and top-level bullet still
   begins a line after `applyTextTransforms({fullDetail:false})`, across all 11 role SOPs) is still
   unwritten. My detector for this review covered `content/skill-release-engineer.md` only; the other
   10 SOPs are unaudited by anyone so far.

### Boundary checks

- **§2 (test authorship)**: PASS. sr-engineer authored no test file. The working tree contains exactly
  three modified files — `content/skill-release-engineer.md`, `.current/handoff.md`, `tasks.md`; the
  latter two are governance bookkeeping (the `tasks.md` diff is only the three new ticket rows for this
  feature). `test/**` is untouched.
- **§1 (surgical changes)**: PASS. Every changed region maps to a ticket item — `:119-121` (E69 site
  1), `:123-128` (E71b bullet + examples), `:129-130` and `:132` (E71b cross-references), `:134-137`
  (E69 site 2), `:139` (E71d), `:144` + `:146-152` (E71a), `:189` (E71c). No drive-by prose improvement
  anywhere. Both documented out-of-scope items from the E67 family (`npx tsc`/`postbuild`, the retired
  `content/constitution.md` path) remain untouched.
- **Same-model bias**: none suspected. sr-engineer ran pinned to `fable`; this review ran on a
  different tier, and both blockers were found by executing the snippets rather than re-reading them —
  the failure mode a same-model review would most likely have shared.

---

## Round 2 — APPROVED — by code-reviewer

Round-2 diff: `content/skill-release-engineer.md` only, 8 hunks, all inside the round-1 regions.
Line numbers below are the round-2 working tree (E71c shifted `:189` → `:191` from the +2 lines the
`bash -c` wrap added).

Method: both blocker fixes were **lifted verbatim out of the SOP** (including their fenced
indentation) and executed in real zsh in throwaway git repos, each with a negative control that
re-runs the round-1 broken form in the same shell. Nothing was accepted from sr-engineer's or the
coordinator's summary.

### Summary
- **Blocker 1 CLOSED.** `:148-153` now wraps the pre-filter in `bash -c '...'`. Run verbatim under
  zsh it stages exactly the existing paths and skips the missing ones, byte-identical to bash.
- **Blocker 2 CLOSED.** `:132`'s `-name "*.md"` composes correctly inside the mandated wrapper;
  the old single-quoted form still aborts in the same shell (negative control).
- Minors 1 and 3 are accurate, not merely present; Minor 2 is correct but applied to only one of the
  two example lines — recorded as a residual, non-blocking, with the exact fix.
- E69 verified untouched: fence regions still whitespace-only vs `ffa4082`, rendered lines 117/130
  hold, 0 glue findings, no new glue site.
- No new glob class introduced by this round's fixes — 0 mis-quoted command globs in step 7a.
- Verdict: **APPROVED**.

### Blocker 1 — CLOSED (`:146-153`)

The fix is the wrapper:

```
     bash -c '
       PATHS="lib/ tools/ … .antigravityrules"
       EXISTING=""
       for p in $PATHS; do [ -e "$p" ] && EXISTING="$EXISTING $p"; done
       git add -- $EXISTING
     '
```

Verified by extracting `:148-153` programmatically from the file and executing the extracted text —
so what ran is what the SOP says, indentation included. Scratch repo with `lib/`, `tools/`, `docs/`,
`package.json`, `index.ts` present and 24 of the 30 paths absent:

- **zsh**: exit 0, staged `docs/c.md`, `index.ts`, `lib/a.ts`, `package.json`, `tools/b.ts` — the five
  existing paths, both missing directories and missing files skipped, no `fatal: pathspec`.
- **bash**: byte-identical result. The snippet is now shell-agnostic at the call site.
- **Negative control, same zsh, wrapper removed**: `EXISTING=[]`,
  `Nothing specified, nothing added.`, exit 0, 0 files staged — the round-1 defect reproduces exactly.
  This proves the wrapper is the operative fix, not an incidental change.
- **Edge, all 30 paths missing**: no-op, no crash, exit 0. Only reachable if not even `package.json`
  exists, i.e. not a repo this SOP can run in. Non-issue.

**On the coordinator's question — is `for p in $PATHS` adequately signposted?** Yes, and this is the
part I would otherwise have flagged. `:146` states the hazard in place, immediately above the snippet:
"under explicit `bash -c '...'` per the shell-safety bullet above (E71a/E71b share the same zsh-default
hazard — this loop's unquoted `$PATHS` expansion relies on word-splitting, which bash does and zsh does
not, so run literally under zsh it silently produces an empty `EXISTING` and `git add --` reports
'Nothing specified, nothing added.' at exit 0 — a silent no-op that looks like success. Same fix shape
as E71b: wrap it)". Mechanism, symptom, exit code and remedy are all named in the paragraph a
copy-paster is reading. An executor who lifts the loop out of the wrapper has been told, in that exact
sentence, what will happen — the SOP is no longer one copy-paste from a silent no-op *without warning*,
which is the standard this file can meet. No finding.

### Blocker 2 — CLOSED (`:132`)

`-name '*.md'` → `-name "*.md"`, with an added in-place explanation ("double-quoted, matching the
`:125-126` examples — single quotes do not nest inside the mandated `bash -c '...'` wrapper and would
hand the glob to the outer shell"), which documents the trap rather than only avoiding it.

Executed from zsh, composed inside the mandated wrapper:
- `zsh -c "bash -c 'find qa_reports -maxdepth 1 -name \"*.md\"'"` → returns
  `qa_reports/review_T-X-01.md`, exit 0, and does **not** return `qa_reports/archive/old/…` — depth
  bound intact.
- Zero-match on an **existing** tree (the post-sweep normal state): no output, exit 0, silent.
- **Negative control**, old single-quoted form, same shell:
  `zsh:1: no matches found: find qa_reports -maxdepth 1 -name *.md`, exit 1. Defect and fix both
  confirmed in one run.

### Minor 1 — accurate (`:123`)

New wording: "an empty `find` result over a tree that EXISTS is a normal, silent no-op in either shell;
an ABSENT tree instead exits non-zero with `No such file or directory` (`:91`), which is exactly what
the `EXCLUDE_QA`/`EXCLUDE_RR` guard above already routes around, not a case this promise covers".

Checked against what `find` actually does, in both shells: bare
`find review_reports_absent -maxdepth 1 -name "*.md"` → `find: review_reports_absent: No such file or
directory`, **exit 1** under zsh and under bash. The claim is factually right, and it is the *same*
behavior `:91` already states about the same command ("`find review_reports -maxdepth 1` exits
non-zero with 'No such file or directory' when the tree is absent") — so this is one consistent
description across `:89`/`:91`/`:123`, not a third one. It also draws the correct operative conclusion:
the absent-tree case is the `EXCLUDE_*` guard's job, not something the silent-no-op promise covers.

Observation, not a finding: when that `find` sits inside `$(…)` in the for-loop shape, the *aggregate*
exit is 0 (the loop's own status) and the only symptom is the stderr line — verified. The sentence's
subject is `find` and it cites `:91`, which says the same thing about `find`, so it is not wrong;
noting the nuance only so a future editor does not "correct" it into a claim about the wrapped command.

### Minor 2 — correct where applied; one residual (`:125` vs `:126`)

`:126` now reads `[ -z "$EXCLUDE_RR" ] && bash -c 'for f in $(find review_reports …)'`. Verified:
- `EXCLUDE_RR=1` with `review_reports/` absent → guard short-circuits, compound exits 1, **no**
  `No such file or directory` on stderr. The `exit 1` is the same shape the `mkdir -p` bullet at `:122`
  has always had for its own `[ -z … ] && …` guards, so this is the file's established convention, not
  a new hazard.
- `EXCLUDE_RR` unset with a matching file present → file moved into
  `review_reports/archive/<feature>/`, exit 0.

**Residual (recorded, not blocking):** my round-1 finding asked for the guard on *both* example lines.
`:125` (the `qa_reports` move) still runs `find qa_reports …` unguarded, with no
`[ -z "$EXCLUDE_QA" ] &&`, while `:122` guards both trees and `:91` states the rule for both ("Run only
the pair belonging to a tree that is NOT `EXCLUDE_*` above"). `EXCLUDE_QA` is reachable — `:89` sets it
when the tree "never existed on disk", which is exactly the adopter-workspace shape E71a argues about
for `qa_reports/`. Consequence when it happens: one stderr line, the loop body never runs, nothing is
moved, exit 0 — noise, not damage, and the archive dir would not exist either.

I am **not** blocking on it: the diff is now execution-correct on every path, and the remaining defect
is cosmetic asymmetry rather than a behavior. But it should not be silently dropped — the asymmetry is
itself a small readability trap (a reader may infer `qa_reports` needs no guard *because* the next line
has one). Exact fix for whoever next touches step 7a: prefix `:125` with `[ -z "$EXCLUDE_QA" ] &&`.
Added to the qa coverage notes below as a pin candidate.

### Minor 3 — accurate (`:191`)

Now reads "`.current/**` (minus `.config.json`, which IS staged **per step 8 above — step 7b only
writes it**)". Correct, and consistent with `:138` and with the same paragraph's earlier "staged
separately as one of the five metadata paths" clause. The E71c placement approved in round 1 is
otherwise unchanged.

### Round-2 regression checks

**Glob re-sweep of step 7a (source `:60-137`), with quoting classification** — the round-1 lesson was
that a fix can introduce a new instance of its own class, so every `*` in the step was classified by
its immediate quoting context, not eyeballed:
- command-position globs: `:125` (×2), `:126`, `:132` (×2) — **all inside `-name "…"`, double-quoted**.
- **`MIS_QUOTED_COMMAND_GLOBS = 0`.** No single-quoted glob remains in any command position.
- everything else is markdown emphasis, `EXCLUDE_*` / `T-<CODE>-*` prose, the `:105` `sed` regexes
  (single-quoted inside a directly-run fenced block, not nested in a wrapper — unchanged and safe), or
  destination prose. No new class introduced by this round's fixes.

**E69 render / glue (T-E69-01 must be intact):**
- dispatch render: 184 lines (+2 from the `bash -c` wrap, as expected), **GLUE_FINDINGS=0**,
  SITE1 `mkdir -p` bullet at rendered line **117**, SITE2 `7b.` header at rendered line **130** — both
  hold. `RATIONALE_MARKERS_LEFT=0`, `ORIGIN_MARKERS_LEFT=0`, "On the premise this replaces" absent.
- `{fullDetail:true}`: 189 lines, 0 glue, rationale prose present.
- fence regions vs `ffa4082` re-checked with the whitespace-stripped comparison: SITE1 852→853,
  SITE2 1460→1461, both still **identical after stripping whitespace**. Round 2 did not touch
  T-E69-01's prose or its fences.

**Tests:** `test/release-staging.test.mjs` **67/67 pass**, no pin broken. I additionally ran the
collateral most likely to break from the file growing +18 lines over two rounds —
`test/context-budget.test.mjs`, `test/verify-release.test.mjs`,
`test/skill-evolution-v3.11.test.mjs` — **87/87 pass**, so the prompt-size budget gate is clear.

**§1 surgical:** 8 hunks, at new-file lines 119, 123-130, 132, 134-135, 139, 144-153, 155, 191. Every
one is E69's two fences or E71's four items; the round-2 deltas are confined to `:123`, `:126`,
`:132`, `:146-153` and `:191` — exactly the two blockers and three minors. No drive-by edit, and the
documented out-of-scope E67-family items remain untouched.

**§2:** still no test file. Working tree is `content/skill-release-engineer.md`, `.current/handoff.md`,
`tasks.md`, plus this untracked review report. `test/**` untouched.

### Coverage notes for T-E69-02 (qa) — carried forward from round 1, still open

1. `test/release-staging.test.mjs` was green in **both** rounds and no pin broke — but no pin *could*
   have caught either round-1 blocker: nothing asserts the E71 (a)-(d) wording yet. Both defects were
   invisible to a content pin and instantly visible to `zsh -c`. When writing the E71 pins, prefer
   executing the fenced snippets over string-matching them; a pin that extracts `:148-153` and runs it
   under zsh would have caught Blocker 1 for free, and the same for `:132` under the wrapper.
2. `SKILL.match(/^\s+git add (.+)$/m)` at `:227` and `:2077` now captures a leading `--` in group 1.
   Containment assertions pass, but any exact-token or `split(/\s+/).length` pin on that capture will
   see 31 tokens, not 30 — normalize the `--` away when the count pin is written. **Also note** the
   regex now matches two lines in the file (`:144`'s `git add --` and `:152`'s `git add -- $EXISTING`);
   `String.match` with `/m` and no `/g` returns the first, so today it still resolves to `:144` — but a
   pin that switches to `matchAll` or adds `/g` will pick up both.
3. The class assertion E69's row specifies (every numbered step header and top-level bullet still
   begins a line after `applyTextTransforms({fullDetail:false})`, across **all 11** role SOPs) remains
   unwritten. My detector covered `content/skill-release-engineer.md` only, in both rounds; the other
   10 SOPs are still unaudited by anyone.
4. New pin candidate from this round's residual: assert that both move examples in step 7a carry their
   tree's `EXCLUDE_*` guard (`:125` currently does not — see Minor 2 above). Cheap content pin, closes
   the asymmetry permanently.

### Verdict

**APPROVED** — both round-1 blockers are closed with executed proof plus negative controls in the same
shell that broke them; the three minors are accurate rather than merely present; T-E69-01 is provably
untouched (fence regions whitespace-only vs base, rendered lines 117/130, 0 glue); no new glob class
was introduced by the fixes; and scope is clean on §1 and §2. One cosmetic residual (`:125`'s missing
`EXCLUDE_QA` guard) is recorded above with its exact one-token fix and handed to qa as a pin candidate
rather than blocked on, because it produces stderr noise and no behavioral difference on any path.

# E235b: fan-out manifest worktree column no longer requires an absolute path

Lane e235b, ticket E235 (the fan-out-manifest half; the handoff/`prd_path` half is
lane e235a) plus an E232 leftover cleanup and an E240 scope add-on. Cut owner:
lane e235b PM. The architect may draft its blueprint before approval, but the
cut is presented to the human only after two integrator mailbox pre-reviews
(this PM cut, then the architect's Open Questions), per `docs/lane-protocol.md`
§5; human approval is required before the build hop.

## Problem

`specs/fanout-*.md` — the integrator's per-wave dispatch manifest, parsed and
rendered by `tools/fanout-manifest.ts` / `scripts/fanout.mjs` — has an 8-column
`## Lanes` table whose `worktree` cell is written as a full local absolute
path (e.g. one lane's own worktree directory under the machine's home
directory). That value gets copied byte-verbatim into every rendered dispatch
prompt and is typed by hand into the tracked manifest itself, so it leaks a
local username into the repo's committed history — the class
`content/const-15-core-tail.md` §6 (Information hygiene) bans. `tools/fanout-manifest.ts`'s
own header doc states the load-bearing constraint precisely: "the tool NEVER
guesses" and "row cells are rendered byte-verbatim" — so today there is no
resolution step between what a human types in the cell and what ends up in a
dispatch prompt.

Confirmed while reading code for this cut: neither `checkLane` (the fan-in
ownership check) nor `tools/lane-status.ts` (lane observability / roll-up)
reads the manifest's worktree cell at all — `checkLane` only uses the row's
`branch`, and `lane-status.ts` derives its own lane list from
`git worktree list` (its module doc says so explicitly: "NEVER any
`specs/fanout-*.md` manifest"). The absolute-path requirement is therefore
narrowly a `render` problem: `render` is the one place a worktree value is
substituted into an artifact a human reads and a lane immediately `cd`s into.

## Scope (from `specs/fanout-e235.md`'s e235b row — authoritative; restated here for a
self-contained spec, not to override it)

**Owned** (core): `tools/fanout-manifest.ts`, `scripts/fanout.mjs`,
`tools/lane-status.ts`, `scripts/lane-status.mjs`, matching `dist/**`,
`docs/lane-protocol.md`, `specs/fanout-*.md` (incl. this file's own manifest,
`specs/fanout-e235.md`), `test/fixtures/e177a/**`, `test/fixtures/e178b/**`,
the nine listed `test/e17*|e223*` files, `content/**` +
`test/fixtures/compose-golden/**` + `test/context-budget.test.mjs` (this
wave's sole shared-generated-artifact holder), plus (E232 leftover, folded in
by integrator decision) five files described in AC7 below.

**E240 add-on** (mailbox-authorized scope expansion, separately approvable —
see the add-on section of the task cut): `tools/transitions.ts` (comments
only), `CHANGELOG.md` / `docs/backlog.md` / `docs/v4.0.0-execution-plan.md`
(leaked-string lines only — done-marks and ticket numbering stay
integrator-owned), `docs/agc-feedback-2026-09-08.md` (two further
occurrences), one `research/` file (rename), the eight `specs/` files and the
three archive-dir reference points listed in AC9, and the four `test/**`
files listed in AC9 (qa-owned execution).

**Forbidden**: handoff fields, schema, `bin/**`, anything under lane e235a's
ownership, `docs/backlog.md` done-marks / ticket allocation, git history
rewrite (human-directed, out of lane scope per the integrator's E240 ruling).

## Acceptance Criteria

1. A fan-out manifest's `worktree` cell no longer has to be a full local
   absolute path to validate cleanly (`node scripts/fanout.mjs validate
   <manifest>` accepts a relative form). The exact relative-path mechanism
   (a new header line the parser reads, analogous to the existing `base:` /
   `mailbox:` lines; or pure derivation from the lane id) is an architect
   decision — see Open Questions.
2. `node scripts/fanout.mjs render <manifest> <lane> …` still substitutes an
   absolute, `cd`-able path into the rendered dispatch prompt's `<worktree>`
   field, resolved from whatever the manifest cell holds under AC1's
   mechanism. Render output for a manifest that still carries an absolute
   cell (transitional / already-written manifests) is unchanged.
3. `checkLane` (`fanout.mjs check`) and `tools/lane-status.ts` require no
   behavior change: neither consumes the worktree cell today, and this
   ticket does not give them a reason to start. The architecture blueprint
   states this as an explicit decision so qa can pin it with a regression
   test (a manifest carrying only a relative worktree cell still passes
   `check` and produces an unaffected `lane-status` listing).
4. `docs/lane-protocol.md` (and `content/skill-integrator.md` only if the
   architecture requires it) describes the new column semantics accurately.
   Sync only the paragraphs the format change actually touches — no
   unrelated rewrites.
5. If `content/**` is touched to satisfy AC4, `test/fixtures/compose-golden/**`
   and `test/context-budget.test.mjs` are regenerated in the same change so
   nothing is left red.
6. One-time content rewrite (mechanical, not a format-compliance rewrite of
   already-closed history): the 8 pre-existing `specs/fanout-*.md` files plus
   this ticket's own `specs/fanout-e235.md` have their `worktree` columns
   rewritten to the new format. `test/fixtures/e177a/**` and
   `test/fixtures/e178b/**` are rewritten to match (they are, in several
   cases, byte-verbatim copies of the specs files they fixture), and
   `test/fixtures/e177a/render-e177a.golden.txt` is regenerated to the render
   output AC2 now produces.
7. The five files an earlier information-hygiene pass (E232) missed because
   the local path appeared in a session-directory hyphen-encoded form or a
   temp-directory form (not the plain-path form E232's scan matched) —
   `docs/agc-feedback-2026-09-08.md`, three archived review/qa evidence
   files, and one further `qa_reports/` evidence file — have every such
   occurrence replaced by a class description (e.g. "an adopter-acceptance
   session's scratch directory"), never the literal string. Evidence-file
   edits touch prose lines only: no heading, verdict line, or `covers:` line
   changes.
8. A final re-scan of this lane's entire owned scope (core AC1-7 plus every
   E240 add-on file in AC9-12), grepping case-insensitively for every leaked
   form — a plain local absolute path, the hyphen-encoded session-directory
   form, the temp-directory form, the adopter project name in its full and
   short forms, and the personal config-directory name form — returns zero
   hits. The sr-engineer self-scans its edited files for the same forms before
   handing off, so the qa re-scan is not the first check.
9. **(E240 add-on)** `tools/transitions.ts` has its leaked-string comment(s)
   replaced by class description, comment-only (no logic change); matching
   `dist/tools/transitions.*` rebuilt. `CHANGELOG.md`, `NEW-TICKETS.md`,
   `docs/backlog.md`, and `docs/v4.0.0-execution-plan.md` have only their leaked-string lines
   scrubbed — no done-mark or ticket-numbering edits (those stay
   integrator-owned). `docs/agc-feedback-2026-09-08.md`'s two further
   `~/.claude_<name>`-shaped occurrences are scrubbed.
10. **(E240 add-on)** The one `research/` file whose filename itself contains
    the short form (an employer-name prefix + this project's protocol name)
    is renamed to a neutral name, and every reference to it across the repo
    is updated — the reference points are confined to files this lane
    already owns, plus three named locations under
    `qa_reports/archive/e46-qa-spec-defect-status-rule/`,
    `review_reports/review_T-E45-01.md`, and `review_reports/review_T-E46-01.md`
    (reference-path update only in those three).
11. **(E240 add-on)** The eight named non-fanout `specs/` files (tickets
    e106, e109, e110, e114, e180, e213, and two e73 acceptance records) plus
    `specs/fanout-wave7.md` (already owned under AC6) have this leaked class
    scrubbed to class description. `qa_reports/` and `review_reports/`
    evidence files carrying the same class are scrubbed, prose lines only
    (same AC7 discipline: never a heading, verdict, or `covers:` line).
12. **(E240 add-on, qa-owned execution)** `test/e180-abandoned-harvest.test.mjs`,
    `test/e213-shipped-ignored-shape.test.mjs`,
    `test/p0-onboarding-lite-default.test.mjs`, `test/qa-flow.test.mjs`, and
    `test/fixtures/e177a/fanout-wave7.md` have the leaked class scrubbed,
    prose only.
13. Every edit under AC7 and AC9-12 is prose- or comment-only: no functional
    code change results from the information-hygiene cleanup itself (as
    distinct from the AC1-2 format change, which is a real behavior change).

## Non-goals

Handoff `prd_path` / schema (lane e235a); `bin/**`; the human's own
public-visibility switch; git history rewrite (human-directed, post-merge,
out of lane scope per the integrator's 2026-09-28 ruling); re-litigating
E232's already-closed scan or its done-mark. This lane's own handoff
(`.current/e235b/handoff.md`) keeps the absolute `prd_path` the server
requires today; the integrator rewrites it in the closing bookkeeping commit
after `finish --shipped`, so the AC8 re-scan excludes that one field.

## Open Questions (architect — single hop, route next)

1. **Relative-path mechanism for the worktree column.** Two shapes were
   visible in the material read for this cut: (a) a new manifest header line
   the parser reads once per file (mirroring the existing `base:` /
   `mailbox:` lines) naming a lanes root, with each row's `worktree` cell
   holding a path relative to it, or (b) no new header — the worktree cell
   is dropped or reduced to just the lane id, and `render` derives the
   absolute path purely from the lane id plus an existing input (a
   `--lanes-root` CLI flag, or the already-resolved `primary` path's parent
   directory, following the convention `specs/fanout-e235.md` already uses
   for its own row: `../agent-governance-mcp-lanes/<lane>`). Pick one; state
   the back-compat behavior for a manifest that still carries a full
   absolute cell (AC2 requires it keep working, but whether that is
   "detected and passed through" or "no longer a distinct case because the
   new parser treats any cell as relative-or-absolute" is the architect's
   call).
2. Whether `RenderOptions`/`runRender` needs a new CLI input (a
   `--lanes-root` flag, parallel to `--mailbox-root` and `--primary`) or
   whether the existing `resolvePrimary` (`git worktree list --porcelain`)
   plus a fixed sibling-directory convention is sufficient to resolve a
   relative cell without any new flag.
3. Confirm (or revise) AC3's "no change needed" call for `checkLane` and
   `tools/lane-status.ts` as a stated architecture decision, so qa has a
   concrete regression case to write against.

Architect deliverable: `specs/e235b-relative-manifest-worktree-architecture.md`
resolving 1-3, plus any schema/format note the chosen mechanism needs (this
is a manifest markdown format change, not a `schema/` or handoff change — no
`schema_version` bump is expected, but the architect confirms that reading).

## Task cut (draft — for integrator mailbox pre-review, then human approval)

### Core section (E235 fan-out-manifest half + E232 leftover)

| Task | Role | Covers |
|---|---|---|
| T-E235B-01 | architect | Open Questions 1-3 → architecture blueprint |
| T-E235B-02 | sr-engineer | `tools/fanout-manifest.ts` format + render-resolution change per architecture; rebuild `dist/tools/fanout-manifest.*` |
| T-E235B-03 | sr-engineer | Sync `docs/lane-protocol.md` (+ `content/skill-integrator.md` only if required) to the new semantics |
| T-E235B-04 | sr-engineer | One-time rewrite: 8 `specs/fanout-*.md` + `specs/fanout-e235.md` worktree columns (AC6) |
| T-E235B-05 | sr-engineer | E232 leftover: scrub the 5 files in AC7 (class description, prose only) |
| T-E235B-06 | qa-engineer | Rewrite `test/fixtures/e177a/**` + `test/fixtures/e178b/**` to match; regenerate `render-e177a.golden.txt` |
| T-E235B-07 | qa-engineer | Update the 9 listed `test/e17*` / `test/e223*` files for the new semantics; add the AC3 regression test |
| T-E235B-08 | qa-engineer | If AC5 applies: regenerate `test/fixtures/compose-golden/**` + `test/context-budget.test.mjs` |

### E240 add-on section (mailbox-authorized; separately approvable)

| Task | Role | Covers |
|---|---|---|
| T-E235B-09 | sr-engineer | `tools/transitions.ts` comment-only scrub + `dist/tools/transitions.*` rebuild |
| T-E235B-10 | sr-engineer | `CHANGELOG.md` / `NEW-TICKETS.md` / `docs/backlog.md` / `docs/v4.0.0-execution-plan.md` leaked-string lines only |
| T-E235B-11 | sr-engineer | `docs/agc-feedback-2026-09-08.md` — 2 further occurrences |
| T-E235B-12 | sr-engineer | Rename the short-form-named `research/` file; update every reference (AC10) |
| T-E235B-13 | sr-engineer | 8 named `specs/` files scrub (AC11) |
| T-E235B-14 | sr-engineer | `qa_reports/` + `review_reports/` evidence files carrying the class (AC11, prose only) |
| T-E235B-15 | qa-engineer | Scrub the 4 named test files + `test/fixtures/e177a/fanout-wave7.md` (AC12) |
| T-E235B-16 | qa-engineer | Final re-scan of the full owned scope (core + add-on), both leaked forms, zero hits (AC8) |

Dispatch note for the build hop: one sr-engineer pass covers T-E235B-02..05 +
09..14 (batched, single hop); one code-reviewer round reviews all of them;
one qa-engineer pass covers T-E235B-06..08 + 15..16 (batched, single hop).
`sr-engineer=fable` per the wave's dispatch pins (to be persisted by the
coordinator before build dispatch).

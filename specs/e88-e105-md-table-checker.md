# e88-e105-md-table-checker

## Problem Statement

`scripts/check-md-tables.mjs` (owned exclusively by lane L-MDTOOL, `docs/v4.0.0-execution-plan.md` §3) has two independent defects, both filed against the same file and cut as one batch per the plan's Wave 1 trap list.

**E105** — the tool's (a)/(b)/(c) cause discriminator (currently `scripts/check-md-tables.mjs:168-190`, re-measured 2026-09-16; the file has been edited since E105 was filed 2026-09-07 and line numbers moved) conflates two distinct defect shapes when a headerless table block is preceded by a blank line: (a) "a blank line severed this block from its real header earlier in the file" (fix: remove the blank line) vs. a second, previously-unhandled shape — two genuinely separate, adjacent tables, where the second is simply missing its own delimiter row (fix: add a delimiter row to the second table). The current discriminator only checks whether the nearest non-blank line above the blank line starts with a column-0 `|` — it never compares cell counts, so it always classifies case (a), even when the "prior" pipe-line belongs to an unrelated table. Following the prescribed remedy for a real (b)/(c) case that was misclassified as (a) — delete the blank line — would merge two distinct tables into one and demote the second table's header to a data row: the exact corruption class E74 was filed to close.

**Not a live defect**: the precondition (a headerless table block, of either cause) occurs 0 times across the tracked corpus as of this session (`node scripts/check-md-tables.mjs` → `OK (243 file(s) scanned, 0 malformed tables)`, re-run 2026-09-16; E105's own filing recorded 241 files on 2026-09-07 — the corpus grew by 2 tracked `.md` files since, unrelated to this fix). The fix therefore cannot be proven against this repository; every AC below is fixture-based (throwaway git repos, per the existing `test/check-md-tables.test.mjs` convention — see that file's own header comment).

**E88** — filed as "the ticket table's `status` column is unmaintained." **The filing's own 2026-08-21 correction voids option (i)**: `docs/backlog.md`'s ticket table has no `status` column at all (header is `id, desc, priority, depends_on, est. files, design-link`); there is nothing to delete. What survives, and is real: the done-mark (`**DONE**` / `**PARTIAL**` / `**VOID**`, optionally followed by `— shipped vX.Y.Z`) is free text with no fixed position inside its cell, and can be buried mid-cell where a truncated read misses it. The 2026-08-28 v3.105.0 recurrence (E96's done-mark landing in the wrong column because an unescaped `\|` inside a code span silently turned a 6-column row into 8) is what upgrades this from a tidiness nit to a real guard, and is why any check here must cover pipe-escaping as well as cell position.

**Measured 2026-09-16, scoped precisely (see Decisions below)**: the pipe-escaping half is **already fully covered** by the existing rule-1 cell-count check (corpus-wide, already fatal, already 0 violations) — no new code is needed for it. Only the leading-token-position half is new. Measuring it split by table:
- The live `### Recommended execution order` table (`order | ticket | intake | why here`, `docs/backlog.md:261-345`): 80 rows, 39 carry a bold done-marker, **all 39 lead the cell — 0 violations today**.
- The ticket table (`id | desc | priority | depends_on | est. files | design-link`, `docs/backlog.md:78-256`): 176 rows, 24 carry a bold done-marker, **5 do not lead the cell** (E39, E40, E58, E59, E71 — all genuinely shipped, all bury `**DONE**` after descriptive prose).

## User Stories

- As a contributor running `npm run check:md-tables`, I want the (a)/(b)/(c) discriminator to name the correct remedy for two adjacent malformed tables, so that following its instructions never merges two distinct tables into one.
- As a `docs/backlog.md` maintainer, I want a mechanical, escape-safe way to spot a done-mark buried mid-cell, so that I don't have to re-derive the E88/E96 incident by hand every time I ask "what's still open."

## Acceptance Criteria

- **AC1** — Given the existing `test/check-md-tables.test.mjs` fixture suite (pre-existing MASK-*/GD-*/MSG-*/SMOKE-* cases), when the E105 discriminator fix ships, then every pre-existing case still passes unchanged (no behavior change for any currently-covered shape).
  proof: `node --test test/check-md-tables.test.mjs` exits 0 with 0 pre-existing-case regressions.

- **AC2** — Given a fixture with two adjacent GFM tables separated by exactly one blank line, where the second table has no delimiter row and its header's cell count differs from the first table's header cell count, when `check-md-tables.mjs` scans it, then the violation's `cause` for the second table is `"missing-delimiter"` (or `"mis-sized-delimiter"` if a malformed delimiter row is present) — never `"blank-split"` — and the emitted message names the delimiter fix, not the blank line.
  proof: qa-authored fixture test asserting `violations[...].cause !== "blank-split"` and the exact emitted message text, following this file's existing MSG-A/B/C convention (assert message, then apply the *prescribed* remedy and re-run to confirm the violation actually clears — not just that a different cause string appears).

- **AC3** — Given a fixture where one logical table's data rows are split from its own header by a single blank line (a genuine continuation — the block's header-shaped first line has the SAME cell count as the immediately-preceding run's header), when scanned, then the cause remains `"blank-split"` (regression protection — the tie-break must not turn a true blank-split into a false missing-delimiter).
  proof: qa-authored fixture test asserting `cause === "blank-split"`.

- **AC4** — Given a fixture shaped as `docs/backlog.md`'s live order table (header `order | ticket | intake | why here`) whose `why here` cell contains a bold `**DONE**`/`**PARTIAL**`/`**VOID**` marker NOT at the start of the cell, when scanned, then the tool prints an advisory note naming the file, line, and buried marker, and does NOT add to the fatal violation count or change the process exit code (advisory only, per the Decisions section — the order table itself is 100% clean today and this AC exists to guard the *mechanism*, not fix a live row).
  proof: qa-authored fixture test asserting exit code 0, the advisory text present in output, and `allViolations`/exit-1 behavior unaffected.

- **AC5** — Given a fixture shaped as `docs/backlog.md`'s ticket table (header `id | desc | priority | depends_on | est. files | design-link`) whose `desc` cell buries a bold done-marker mid-cell, when scanned, then the same advisory mechanism fires, scoped to the `desc` column only (a buried marker-looking string in `priority`/`depends_on`/`est. files`/`design-link` must NOT fire it).
  proof: qa-authored fixture test, including a negative case for a non-`desc` column.

- **AC6** — Given a fixture Markdown file at a path other than `docs/backlog.md` (any other tracked `.md` file) containing a table shaped exactly like either convention table with a buried done-marker, when scanned, then no advisory fires — the new rule is hardcoded to `docs/backlog.md` only, never corpus-wide.
  proof: qa-authored fixture test confirming zero advisories for a non-`docs/backlog.md` file with the identical buried-marker shape.

- **AC7** — Given the real `docs/backlog.md` in this repository as of this feature's merge, when `npm run check:md-tables` runs for real (not a fixture), then it still exits 0 — the new advisory rule must not turn any pre-existing row into a fatal violation, and the 5 known buried-marker rows (E39, E40, E58, E59, E71) must surface only as advisories, never as violations.
  proof: `npm run check:md-tables` exits 0; qa records the advisory-line count for the 5 known rows in its review evidence (informational, not a pass/fail gate — advisories are not machine-asserted against a fixed count since `docs/backlog.md` changes under concurrent Wave 1 lanes).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| advisory.header | `check:md-tables — {N} advisory note(s) (non-blocking, done-mark convention):` | authored-here — mirrors the existing fatal-violation header (`check:md-tables — {N} malformed table site(s) found:`) for a consistent CLI voice; printed only when N > 0 |
| advisory.line | `  {file}:{line} — done-mark **{TOKEN}** is buried mid-cell in the {column} column (should lead the cell) — see docs/backlog.md E88` | authored-here — `{column}` is `desc` or `why here`, the two scoped columns |

No other new user-facing strings. E105's fix changes which existing `cause` value fires in one scenario; it introduces no new message templates (reuses the existing `blank-split` / `missing-delimiter` / `mis-sized-delimiter` output already in `scripts/check-md-tables.mjs:239-255`).

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals — CLI tool, no UI surface |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Decisions (recorded per dispatch brief; PM authority, not re-litigated by build roles)

1. **Fatal-vs-advisory, and why split by table.** E105's fix stays **fatal** (`process.exit(1)`, same as the two existing rules) — it is a correctness fix to logic that already exits non-zero on real defects; it introduces no new false positives against the corpus (still 0 violations after the fix, per AC1/AC7-adjacent reasoning) and changing its severity was never in question.

   E88's new done-mark-position rule ships **advisory-only** (never affects the exit code), for both scoped columns (order-table `why here` and ticket-table `desc`). Justification: the pipe-escaping half of "the guard must validate BOTH" is already satisfied by the pre-existing corpus-wide cell-count rule — verified 0 violations, no new code. The position half, if shipped fatal, would immediately red 5 pre-existing, already-shipped `docs/backlog.md` rows (E39, E40, E58, E59, E71) that predate this check and were never normalized under it. Making it fatal today would require editing those 5 rows to go green — a third file in this cut, and `docs/backlog.md` is the shared spec file every other Wave 1 lane is concurrently reading and some are filing new rows into (§2.4/§3), so an unrelated normalization pass there now is integration-conflict risk disproportionate to a P3 stylistic nicety. Advisory-only ships real value (the exact mechanical, `\|`-escape-safe substitute for the manual grep-and-eyeball process that both the 2026-08-21 and 2026-08-28 incidents showed is error-prone) without gating anything or forcing an off-topic `docs/backlog.md` edit into a tooling ticket. Precedent for advisory-only exists directly in this file: E74's own D3 note records `check-md-tables.mjs` as "wired to no lifecycle hook" — **re-verified this session**: `package.json`'s `check:md-tables` script is not invoked by `prebuild`/`build`/`postbuild`/`pretest`/`test`, by `scripts/verify-release.mjs`, by `content/skill-release-engineer.md`, or by `.github/workflows/ci.yml`. It is a standalone, manually-run script today. (This corrects the dispatch brief's framing that the tool "is run at release time" — verified false this session; flagged for the record since it changes how much the fatal-vs-advisory choice actually matters operationally today, though the design decision above stands on its own merits regardless.)

2. **Scope: `docs/backlog.md` only, by exact header-cell match, not corpus-wide.** The done-mark convention is a property of two specific `docs/backlog.md` table shapes, not of Markdown tables in general. The rule is hardcoded to `relPath === "docs/backlog.md"` and fires only when a table block's header cells equal exactly `id, desc, priority, depends_on, est. files, design-link` (checks `desc`) or `order, ticket, intake, why here` (checks `why here`). This is header-shape-based, not heading-text-based, so it naturally excludes `docs/backlog.md`'s two even-older historical order tables that use a different header (`order | ticket | why here`, 3 columns, no `intake` — e.g. `docs/backlog.md:379`) without any special-casing.

3. **File count: 2, not 3.** This cut touches `scripts/check-md-tables.mjs` (sr-engineer) and `test/check-md-tables.test.mjs` (qa-owned, existing file, extended). It does **not** touch `docs/backlog.md`. Both tickets are P3, non-design, no schema change → clears `cutApprovalAutoTier` (`maxFiles: 2`, `maxPriority: P3`) as a 2-file cut. Normalizing the 5 known buried-marker rows (should the rule later be promoted to fatal on the ticket table) is filed as a follow-up in this worktree's `NEW-TICKETS.md` (`L-MDTOOL-N1`), explicitly not part of this cut.

## Out of Scope

- Promoting the done-mark rule to fatal on the ticket table's `desc` column (blocked on normalizing E39/E40/E58/E59/E71 first — see `NEW-TICKETS.md` `L-MDTOOL-N1`).
- Editing `docs/backlog.md` in any way (not owned by L-MDTOOL per `docs/v4.0.0-execution-plan.md` §3; would also be a 3rd file, breaking the auto-tier cut).
- Wiring `npm run check:md-tables` into CI, `prebuild`/`postbuild`, or `scripts/verify-release.mjs` — verified not currently wired; a separate decision with its own tradeoffs, not part of either filed ticket.
- The blank-line walk-up's own fence-unawareness (`scripts/check-md-tables.mjs:174-181` tests raw `/^\|/` on the nearest non-blank line without checking whether that line is itself inside a fence) — a pre-existing gap, not filed by E105, not touched here.
- `content/**`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs` — L-CONTENT-exclusive (§2.1/§3 of the execution plan); any change needed there must be reported, not made, by this lane.
- Any file outside `scripts/check-md-tables.mjs` and `test/check-md-tables.test.mjs`.

## Dependencies / Prerequisites

None — `docs/v4.0.0-execution-plan.md` §4 Wave 1 table lists L-MDTOOL's dependency as 無 (none). No design file exists for this feature (non-design CLI tooling); no `## Visual Structural Assertions` section applies.

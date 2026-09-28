# e110-pm-parallel-lane-template

Backlog: `docs/backlog.md` row E110 (P1, depends E109). Background: `docs/agc-feedback-2026-09-08.md` H2. Lane: L-CONTENT (`docs/v4.0.0-execution-plan.md` §2.1 / §3, Wave 4).

## Problem Statement

PM has no template or obligation for cutting work into parallel, low-dependency lanes, although the pattern already ran a full production round (an adopter acceptance project's SRCL: `S0 → L1..Ln → J1a → J1b`, one integration branch, one PR). What agc is missing is the **lane-assignment rule**, not the topology. A lane owns an AC when the AC's `proof:` asserts on that lane's files, whatever the AC's subject is. NDI's own draft put AC8/AC12/AC13 in the wrong lane, and only a per-AC `proof:` audit caught it. Nothing in `content/skill-pm.md` asks PM to run that audit, gives the fixed seed → fan-out → join shape, or makes PM declare each ticket's actual path set (`touches`). The `.current/feature-split.md` format in `content/coord-01-core-head.md` has no `touches` column either, so nobody can check lane disjointness by looking at the table.

## User Stories

- As a PM, I want a fixed seed → fan-out → join template in my SOP, so that I can cut parallel lanes without designing a DAG each time.
- As a PM, I want an explicit per-AC `proof:` audit step, so that each AC goes to the lane whose files its proof asserts on, not the lane its topic suggests.
- As a human approving a cut, I want a `touches` column in the cut table and in `feature-split.md`, so that I can see at a glance whether any two lanes write the same file.
- As a maintainer, I want an explicit `serial — shared layer` escape hatch, so that PM never parallelizes for its own sake.

## Acceptance Criteria

All `proof:` commands run from the worktree root `<lanes-root>/e110`. "Rendered PM SOP" means the text a pm dispatch receives: `stripRationale(stripOriginTags(expandPartials(body)))`, the same render path the `skill-pm stripped token count` test in `test/context-budget.test.mjs` measures.

- **AC1 (template)**: Given `content/skill-pm.md`, when the rendered PM SOP is read, then its Gate Summary has a **`Parallel-Lane Cut`** row. The row names the fixed three-stage template: **S0 seed** (serial, first; freezes shared types/contracts only, no behaviour) → **L1..Ln fan-out** (parallel; pairwise-disjoint `touches`; each in its own worktree/branch/`.current/`) → **J join** (serial; wiring + integration; one branch, one PR). It also says explicitly that this is not a general DAG. SOP step 2 lists the row in its ordered split/scope sequence (Visual State-Count Split → Geometric-Density Split Gate → Parallel-Lane Cut → Scope Decision Gate).
  proof: `grep -c 'Parallel-Lane Cut' content/skill-pm.md` prints `2` or more (step 2 + the row), and `node --test --test-name-pattern="every operative rule/gate/SOP marker survives stripRationale in skill-pm.md" test/context-budget.test.mjs` passes with `"Parallel-Lane Cut"` added to that test's marker list (T-E110-03).
- **AC2 (lane-assignment rule + audit step)**: Given the `Parallel-Lane Cut` row, when read, then it names a **per-AC `proof:` audit** as an explicit PM step. The rule it states: an AC goes to the lane whose `touches` holds the file its `proof:` asserts on, NOT the lane its subject suggests, and a `proof:` that spans two lanes goes to J.
  proof: `grep -F 'Per-AC \`proof:\` audit' content/skill-pm.md && grep -F 'NOT the lane its subject suggests' content/skill-pm.md` exits 0, and neither phrase sits inside a `<!-- rationale:start -->` fence. The AC1 marker test also carries `"Per-AC \`proof:\` audit"`.
- **AC3 (guardrail)**: Given the row, when read, then it forbids parallelizing for its own sake. It gives PM the right to declare **`serial — shared layer`** (U+2014 em-dash, byte-exact) and cut serially when two lanes would share a file or S0 would need behaviour.
  proof: `grep -F 'serial — shared layer' content/skill-pm.md` exits 0, and the marker test from AC1 carries `"serial — shared layer"` and passes.
- **AC4 (cut-table `touches`)**: Given the Cut-Approval inline cut table header in `content/skill-pm.md`, when read, then it is exactly `` `id | desc | depends_on | est. files | touches | design-link` ``. A one-line definition sits directly below it: `touches` = the actual repo paths/globs the ticket writes, and lane tickets' sets must be disjoint.
  proof: `grep -F '\`id | desc | depends_on | est. files | touches | design-link\`' content/skill-pm.md` exits 0, and `grep -c 'est. files | design-link\`' content/skill-pm.md` prints `0` (the old header is gone).
- **AC5 (`feature-split.md` `touches`)**: Given the `.current/feature-split.md` template in `content/coord-01-core-head.md`, when read, then the Split Table header has a `touches` column directly after `scope`, and both placeholder rows carry a `<paths>` cell. The E115 join-precondition parser locates the `feature id` column by header name, not position (`tools/join-precondition.ts` `parseDeclaredFeatureIds`), so it keeps working without any `tools/` change.
  proof: `grep -F '| order | feature id | scope | touches | figma link |' content/coord-01-core-head.md` exits 0, and `node --test test/e115-join-precondition.test.mjs` passes unchanged.
- **AC6 (golden refresh, one fixture)**: Given the content edits, when `node scripts/capture-constitution-golden.mjs` regenerates the goldens, then exactly one fixture changes: `test/fixtures/compose-golden/skill-coordinator-monolith.txt`. `skill-pm.md` is baked into none of the 12 goldens (measured at cut: `grep -l 'Staff-level Technical Product Manager' test/fixtures/compose-golden/*` is empty).
  proof: `git diff --name-only -- test/fixtures/compose-golden/` prints exactly `test/fixtures/compose-golden/skill-coordinator-monolith.txt`, and `node --test test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs` passes.
- **AC7 (context budget: only the floors actually pushed)**: Given the edits, when `test/context-budget.test.mjs` runs, then exactly two caps are raised, each to its exact re-measured value (Phase-2 convention, no headroom) with a qa-owned bump comment. The two are (a) the `skill-pm stripped token count` cap (4128 today, which is also the exact current measurement; the prototype measured ≈ 4376) and (b) the `teamwork coordinator bundle` design-arm floor (18982 today; coord-01 grows by +34 bytes, ≈ +9 ~tok). No other floor changes. The lean always-on floor, the constitution floors and the non-design floor are unaffected because neither file composes into `CONSTITUTION` or the lite bundle.
  proof: `git diff -U0 test/context-budget.test.mjs | grep -E '^[-+]\s*assert\.ok\(.*<= ?[0-9]+|^[-+]\s*assert\.ok\(.*≤ ?[0-9]+'` shows changed caps only in the `skill-pm stripped` and `teamwork stripped bundle` asserts, and `npm test` exits 0.
- **AC8 (scope boundary)**: Given the finished lane, when its diff is listed, then every changed path is in {`content/skill-pm.md`, `content/coord-01-core-head.md`, `test/fixtures/compose-golden/skill-coordinator-monolith.txt`, `test/context-budget.test.mjs`, `test/cut-approval-gate.test.mjs` (C3's cut-header literal only — coordinator amendment 2026-09-23, forced by AC4), `specs/e110-pm-parallel-lane-template.md`, `.current/**`, `tasks.md`, `qa_reports/**`, `review_reports/**`, `NEW-TICKETS.md`}. Nothing under `tools/`, `gates/`, `guards/`, `prompts/`, `bin/`, `schema/`, `dist/` changes.
  proof: `git diff --name-only main...HEAD | grep -E '^(tools|gates|guards|prompts|bin|schema|dist)/'` prints nothing (exit 1).

## Copy / Strings

This feature ships SOP prose, not user-facing strings. The load-bearing literals below are the ones later tests grep for.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| pm.gate.parallel-lane | `Parallel-Lane Cut` | authored-here — gate-row name, parallel to the existing "Split Gate" rows |
| pm.parallel.audit | `Per-AC \`proof:\` audit` | docs/backlog.md E110 ("the per-AC `proof:` audit … is the missing PM step") |
| pm.parallel.rule | `NOT the lane its subject suggests` | docs/backlog.md E110 ("lane membership follows where an AC's `proof:` lands, NOT the AC's subject") |
| pm.parallel.serial | `serial — shared layer` | docs/backlog.md E110 guardrail (verbatim) |
| pm.cut.header | `id \| desc \| depends_on \| est. files \| touches \| design-link` | docs/backlog.md E110 ("formalize the `touches` … column … into the cut table header") |
| coord.split.header | `\| order \| feature id \| scope \| touches \| figma link \| depends_on \| key visual widgets \| notes / 注意事項 \| status \|` | docs/backlog.md E110 ("… and into `feature-split.md`") |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- A general DAG or any `order`-column semantics change. The shape is the fixed three-stage template only.
- Any server/tool enforcement of `touches` disjointness (no gate, no `tools/`/`gates/` change). A disjointness check would be a separate ticket touching `tools/join-precondition.ts`, which E123 is editing now.
- Changes to the coordinator Feature-Scope Gate's split heuristics (coord-01 gets only the `touches` column; see Decision #3).
- `content/skill-coordinator-lite.md` (it has no feature-split template).
- Symlinking gitignored outputs into worktrees, per-worktree bootstrap, and `tw_void_task` (H2 (a)/(c)/(d)), which are already E73/E117.
- Release bookkeeping (version bump, CHANGELOG, backlog done-mark). That belongs to release-engineer, post-PASS.

## Dependencies / Prerequisites

- E109 is done (Wave 3 ✓), per the feature-split.md row `P`.
- **Decision #3 (待決 #3), PENDING THE HUMAN.** This spec is written assuming the recommendation. The question is where the obligation lives. **Recommendation: `content/skill-pm.md`**, with coord-01 receiving only the `touches` column of the split template. Trade-off: the Feature-Scope Gate is text-only and runs before PM writes any AC, so it cannot run a per-AC `proof:` audit at all. Putting the template there would also charge every `/teamwork` load (the ≈19k-token bundle) for a step only PM takes. The cost of the recommended placement is ≈ +248 ~tok on every PM load (a +6% push of the skill-pm floor), and the template appears only when PM is dispatched, never at coordinator intake.
- Context-budget ownership (plan §2.2): `test/context-budget.test.mjs` and the golden fixture are qa-engineer's (§2.7). sr-engineer edits `content/` only.
- Lane rules: the only `content/` lane this wave (plan §2.1). Every `tw_*` call passes `<lanes-root>/e110`. The worktree has no `node_modules` (plan §2.4b), so run `npm test`/`npm run build` accordingly.
- External refs: none (the Resource Audit grep hit only in-repo docs).
- Visual Structural Assertions omitted: no `design/e110-pm-parallel-lane-template.md`, mode = no-design.

### Reference text (prototype that produced the measurements; sr-engineer may tighten the wording but must keep every AC literal)

New Gate Summary row, inserted directly above `| **Scope Decision Gate** |`:

```
| **Parallel-Lane Cut** | The work splits into ≥ 2 path sets that can be written without touching each other, or the human asks for parallel lanes. | Use the fixed template, never a general DAG: **S0 seed** (serial, first; freezes shared types/contracts only, no behaviour) → **L1..Ln fan-out** (parallel; pairwise-disjoint `touches`, each in its own worktree/branch/`.current/`) → **J join** (serial; wiring + integration, one branch, one PR). **Per-AC `proof:` audit** (explicit step): assign each AC to the lane whose `touches` holds the file its `proof:` asserts on — NOT the lane its subject suggests; a `proof:` spanning two lanes goes to J. Record the lanes in `.current/feature-split.md` with their `touches`. Never parallelize for its own sake: if two lanes would share a file, or S0 would need behaviour, declare `serial — shared layer` and cut serially. <!-- rationale:start -->Reason: parallelism comes from pure, contract-driven units against an early-frozen type, not from `depends_on` ordering; a subject-based assignment re-couples lanes.<!-- rationale:end --> |
```

Step 2: "three split/scope rows … Visual State-Count Split → Geometric-Density Split Gate → Scope Decision Gate" becomes "four … → Parallel-Lane Cut → Scope Decision Gate".

Cut header: `` `id | desc | depends_on | est. files | touches | design-link` ``, followed by a blank line and "`touches` = the actual repo paths/globs the ticket writes; lane tickets' sets must be disjoint."

coord-01 split template: add `touches` after `scope` in the header, add one more `|---|` in the separator row, and add a `<paths>` cell to both placeholder rows.

Measured at cut: `content/skill-pm.md` goes from 17995 to 19212 raw bytes (+1217), and the rendered PM SOP from 16509 to 17503 chars (+994), i.e. from 4128 to 4376 ~tok (+248). `content/coord-01-core-head.md` goes from 5480 to 5514 bytes (+34).

# Spec: e255-product-prefix-cleanup

schema_version: n/a (text-only feature, no persisted-artifact schema change)

## Problem Statement

The product-style prefix that names a prior visual rollout is a project codename (human
ruling, backlog E255 "Scope ruled 2026-11-09 (triage)"), and the repository is public, so
every tracked occurrence is an Information-hygiene leak. At base `2425e04` the prefix
appears case-insensitively on 55 lines in 31 tracked files (29 `.md` files plus 2 test
fixtures) and in the name of one file under `research/`. This feature removes it from
every tracked file this lane owns, in exposure order: (1) the shipped `content/**` text
every adopter loads, (2) two test-fixture surface names, (3) the prefixed `research/`
file name and every citation of it, (4) the remaining `research/`, `specs/`, `docs/`
prose, (5) four historical `CHANGELOG.md` lines and five closed-feature (E232) evidence
files. Every site is rewritten by class, following the `specs/decodename-cleanup.md`
pattern: the incident is described by what it was ("a setup wizard", "a theme file"),
and no rule semantics change. After the lane merges, the only tracked remainder is three
lines the integrator cleans in its bookkeeping commit (`docs/backlog.md` 2 lines,
`.current/history/**` 1 line).

**Hygiene rule for this lane:** no durable output (this spec, commit messages, pending
notes, evidence, the pull request) spells the prefix. Prose says "the product-style
prefix"; inventories below write `<prefix>` for the token in whatever case the site uses
(lowercase, Title-case, or uppercase).

## User Stories

- As an **adopter** loading agc's shipped prompts, I want the governance text to describe
  past incidents by class, so that I am not exposed to an undefined internal codename.
- As a **maintainer** of the public repository, I want no tracked file (outside git
  history) to carry the codename, so that the leak is closed at the tree level.
- As a **governance-rule consumer (any agent)**, I want every rule to read the same after
  the edit, so that the rules I follow do not silently drift.
- As a **reader of research and spec history**, I want every citation of the renamed
  retrospective to resolve, so that no link breaks.

## Acceptance Criteria

All proofs run from the repository root. Set the token once per shell without writing it
anywhere: it is derived from the one history line the lane never edits.

```sh
PREFIX=$(sed -n 's#.*research/\([a-z]*\)-visual-fidelity-retrospective-2026-06-05\.md.*#\1#p' .current/history/2026-09/e232/tasks.md | head -1)
test -n "$PREFIX"
```

`<base>` = `2425e04` (the lane's dispatch base, `.current/e255/base-sha`).

- **AC1** — Given the six shipped-text sites (inventory C1–C6), when T-E255-01 lands, then
  none of the four `content/` files contains the prefix, and each site changes only the
  inventory token (the rule clause around it reads the same).
  proof: `git grep -n -i "$PREFIX" -- content/` prints nothing, and `git diff --numstat <base> -- content/` prints exactly `1	1` for `content/skill-pm.md`, `content/skill-qa-engineer.md`, `content/skill-design-auditor.md` and `3	3` for `content/constitution-rationale.md`.
- **AC2** — Given `content/skill-pm.md` line 30 is 236 characters at base, when C1 lands,
  then the line is not longer than 236 characters (expected 232).
  proof: `awk 'NR==30{print length($0)}' content/skill-pm.md` prints a number ≤ 236.
- **AC3** — Given the five budget weights and the 12 compose goldens at base, when all
  tasks land, then every weight is unchanged, `test/context-budget.test.mjs` passes with no
  cap edit, and regenerating the goldens changes no file.
  proof: `node --test test/context-budget.test.mjs` reports 54 pass / 0 fail; `git diff --quiet <base> -- test/context-budget.test.mjs` exits 0; after `npm run build` and `node scripts/capture-constitution-golden.mjs`, `git status --porcelain test/fixtures/compose-golden` prints nothing.
- **AC4** — Given the one prefixed file under `research/`, when T-E255-02 lands, then it is
  renamed with `git mv`, content unchanged, to `research/visual-fidelity-retrospective-2026-06-05.md`,
  and no tracked file name contains the prefix.
  proof: `git diff -M --name-status <base> HEAD -- research/` shows one `R100` line whose destination is `research/visual-fidelity-retrospective-2026-06-05.md`; `test -f research/visual-fidelity-retrospective-2026-06-05.md` exits 0; `git ls-files | grep -i -c "$PREFIX"` prints `0`.
- **AC5** — Given the citation sites of the renamed retrospective (inventory rows marked
  CITE), when T-E255-01..06 land, then every live citation names the new path, and every
  historical one (a line recording what E232 did to the old name) uses the
  `<product-style-prefix>` placeholder; nothing outside `docs/backlog.md` and
  `.current/history/**` names the old file.
  proof: `git grep -n "visual-fidelity-retrospective" -- . ':!docs/backlog.md' ':!.current/history' ':!specs/e255-product-prefix-cleanup.md' | grep -v -e "research/visual-fidelity-retrospective-2026-06-05\.md" -e "<product-style-prefix>-visual-fidelity-retrospective" -e "\`visual-fidelity-retrospective-2026-06-05\`"` prints nothing.
- **AC6** — Given the two visual-gate test fixtures, when T-E255-07 lands, then their
  surface ids and baseline paths use the class name `wizard`, and both suites stay green.
  proof: `git grep -n -i "$PREFIX" -- test/` prints nothing; `node --test test/visual-evidence-gate.test.mjs test/visual-gate-e2e.test.mjs` reports 0 fail; `git diff --numstat <base> -- test/` prints `1	1` for each of the two files and nothing else.
- **AC7** — Given the remaining prose sites in `research/`, `specs/`, `docs/` (inventory R,
  S, D rows), when T-E255-02..05 land, then no owned file in those trees contains the prefix.
  proof: `git grep -n -i "$PREFIX" -- research/ specs/ docs/ ':!docs/backlog.md'` prints nothing.
- **AC8** — Given the four historical `CHANGELOG.md` lines (human ruling 1 = a), when
  T-E255-05 lands, then each becomes a class description with its substance unchanged and
  no other CHANGELOG line moves.
  proof: `git diff --numstat <base> -- CHANGELOG.md` prints `4	4`; `git diff -U0 <base> -- CHANGELOG.md | grep "^@@"` shows hunks only at old lines 4460, 4511, 5933, 5982.
- **AC9** — Given the five closed-feature E232 evidence files (human ruling 2 = a), when
  T-E255-06 lands, then only the prefix and the old file name change: no verdict, `covers:`,
  PASS/FAIL, APPROVED or evidence-fact text changes.
  proof: `git diff --numstat <base> -- qa_reports/review_T-E232-01.md review_reports/review_T-E232-01.md review_reports/review_T-E232-05.md review_reports/review_T-E232-06.md review_reports/review_T-E232-08.md` prints `5	5`, `2	2`, `2	2`, `1	1`, `1	1`; `git diff --word-diff=porcelain <base> -- <the five files>` shows only the inventory E-row token swaps; `npm run check:bookkeeping` exits 0.
- **AC10** — Given all tasks landed, when the tracked tree is grepped, then exactly three
  lines remain, all outside the lane's owned set (integrator bookkeeping).
  proof: `git grep -n -i "$PREFIX" | cut -d: -f1,2` prints exactly `.current/history/2026-09/e232/tasks.md:6`, `docs/backlog.md:226`, `docs/backlog.md:1345`.
- **AC11** — Given the final lane HEAD, when the full suite and build checks run, then all
  pass and `dist/` does not change.
  proof: `node scripts/test-lock.mjs -- npm test` reports 0 fail; `npm run build` exits 0 (it runs `check:transitions-sync`, which parses `specs/qa-flow-enforcement-architecture.md`); `git status --porcelain dist/` prints nothing; `npm run check:md-tables` exits 0.
- **AC12** — Given the lane's own durable output, when it is grepped, then none of it spells
  the prefix.
  proof: `git log <base>..HEAD --format=%B | grep -i -c "$PREFIX"` prints `0`; `grep -i -c "$PREFIX" specs/e255-product-prefix-cleanup.md` prints `0`; every new `qa_reports/*E255*` and `review_reports/*E255*` file has zero hits.

## Reference Inventory + Classification

Line numbers re-verified against the lane tree at base `2425e04`. Class follows
`specs/decodename-cleanup.md`: **PURE PROVENANCE** (the token only names where a rule or
example came from; safe to rewrite by class) or **LOAD-BEARING** (an agent operationally
needs the token; flag and leave). **LOAD-BEARING: none** — every site is provenance or an
illustrative example whose rule clause does not depend on the name. **CITE** marks a
citation of the renamed retrospective.

Class vocabulary used throughout: the product or flow → "setup wizard" (Chinese prose:
「設定精靈」); a prefixed code identifier → the identifier without the prefix; the
retrospective → `research/visual-fidelity-retrospective-2026-06-05.md`; a historical
record of a past file name → the `<product-style-prefix>` placeholder.

### (1) Shipped text — `content/**` (T-E255-01, sr)

| # | file:line | current (abridged) | class | replacement | AC |
|---|---|---|---|---|---|
| C1 | `content/skill-pm.md:30` | "…an unsourced hex slipping into `` `<prefix>Theme.kt` `` is exactly…" (inside the `rationale:start`/`rationale:end` fence) | PURE PROVENANCE (illustrative) | `` `Theme.kt` `` — line 236 → 232 chars | AC1, AC2 |
| C2 | `content/skill-qa-engineer.md:52` | "Stylistic AC tests like `` `<prefix>ThemeTokensTest` `` catch drift…" | PURE PROVENANCE (illustrative) | `` `ThemeTokensTest` `` | AC1 |
| C3 | `content/skill-design-auditor.md:55` | "…e.g. a full `<prefix>` flow board…" | PURE PROVENANCE (illustrative) | "e.g. a full setup-wizard flow board" | AC1 |
| C4 | `content/constitution-rationale.md:12` | "> Primary sources: `research/<prefix>-visual-fidelity-retrospective-2026-06-05.md`" | PURE PROVENANCE, CITE | `research/visual-fidelity-retrospective-2026-06-05.md` | AC1, AC5 |
| C5 | `content/constitution-rationale.md:90` | "The whole 9-screen `<prefix>`" (continues "was scoped as one feature…") | PURE PROVENANCE | "The whole 9-screen setup wizard" | AC1 |
| C6 | `content/constitution-rationale.md:237` | "exactly how the `<prefix>` run lost fidelity" | PURE PROVENANCE | "exactly how the setup-wizard run lost fidelity" | AC1 |

### (2) Test fixtures (T-E255-07, qa)

| # | file:line | current | replacement | AC |
|---|---|---|---|---|
| T1 | `test/visual-evidence-gate.test.mjs:29` | baseline row `<prefix>.step1 \| design/<prefix>/step1.png` | `wizard.step1 \| design/wizard/step1.png` | AC6 |
| T2 | `test/visual-gate-e2e.test.mjs:38` | baseline row `<prefix>.s1 \| design/<prefix>/s1.png` | `wizard.s1 \| design/wizard/s1.png` | AC6 |

Both fixtures are self-contained: neither file names the surface or path on any other line.

### (3) The research file rename and its citations

Rename (T-E255-02): `git mv research/<prefix>-visual-fidelity-retrospective-2026-06-05.md research/visual-fidelity-retrospective-2026-06-05.md`
(body unchanged; the new name is the old one minus the prefix and is free in the tree).

Citation sites, re-grepped (`git grep -n -i "fidelity-retrospective"`): the manifest's
list plus one it missed — `research/process-retrospective.md:82` cites the file by its
bare stem. `docs/backlog.md:226` and `.current/history/2026-09/e232/tasks.md:6` are
excluded (integrator bookkeeping).

| # | file:line | form | replacement | task | AC |
|---|---|---|---|---|---|
| C4 | `content/constitution-rationale.md:12` | live path | new path | T-E255-01 | AC5 |
| R1 | `research/process-retrospective.md:82` | bare stem `` `<prefix>-visual-fidelity-retrospective` `` | `` `visual-fidelity-retrospective-2026-06-05` `` | T-E255-02 | AC5 |
| D1 | `docs/prompt-audit-2026-11-02.md:228` | quote of C4, live path | new path | T-E255-02 | AC5 |
| S1 | `specs/constitution-restructure.md:98` | live path | new path | T-E255-02 | AC5 |
| S2 | `specs/constitution-restructure.md:191` | live path | new path | T-E255-02 | AC5 |
| S3 | `specs/decodename-cleanup.md:203` | live path | new path | T-E255-02 | AC5 |
| S4 | `specs/e232-leak-cleanup.md:104` | historical old name `` `-<prefix>-visual-fidelity-retrospective-2026-06-05.md` `` | `` `-<product-style-prefix>-visual-fidelity-retrospective-2026-06-05.md` `` | T-E255-03 | AC5 |
| S5 | `specs/e232-leak-cleanup.md:107` | historical E232 rename target | `` `research/<product-style-prefix>-visual-fidelity-retrospective-2026-06-05.md` `` followed by "(renamed again by E255 to `research/visual-fidelity-retrospective-2026-06-05.md`)" | T-E255-03 | AC5 |
| S6 | `specs/e232-leak-cleanup.md:114` | historical proof command | in the grep pattern `-<prefix>-` → `-<product-style-prefix>-`; the `test -f` operand → the new path | T-E255-03 | AC5 |
| S7 | `specs/e232-leak-cleanup.md:222` | historical rename target | `` `research/<product-style-prefix>-visual-fidelity-retrospective-2026-06-05.md` `` | T-E255-03 | AC5 |
| S8 | `specs/qa-flow-enforcement-architecture.md:861` | live path (resource-audit table row) | new path; table pipe count unchanged | T-E255-03 | AC5, AC11 |
| S9 | `specs/server-scope-decision-gate.md:113` | live path (table row) | new path; pipe count unchanged | T-E255-03 | AC5 |
| X1 | `CHANGELOG.md:4511` | live path | new path | T-E255-05 | AC5, AC8 |
| E2 | `qa_reports/review_T-E232-01.md:52` | `test -f` operand | new path | T-E255-06 | AC5, AC9 |
| E3 | `qa_reports/review_T-E232-01.md:53` | `<class2>-<prefix>-visual-…` grep pattern | `<class2>-<product-style-prefix>-visual-…` | T-E255-06 | AC5, AC9 |
| E4 | `qa_reports/review_T-E232-01.md:98` | both forms (table row) | as E3 and E2; pipe count unchanged | T-E255-06 | AC5, AC9 |
| E6 | `review_reports/review_T-E232-01.md:6` | path | new path | T-E255-06 | AC5, AC9 |
| E7 | `review_reports/review_T-E232-01.md:14` | `test -f` operand | new path | T-E255-06 | AC5, AC9 |
| E8 | `review_reports/review_T-E232-05.md:14` | path | new path | T-E255-06 | AC5, AC9 |
| E11 | `review_reports/review_T-E232-08.md:13` | path | new path | T-E255-06 | AC5, AC9 |

### (4) Remaining prose — `research/`, `specs/`, `docs/`

| # | file:line | current (abridged) | replacement | task | AC |
|---|---|---|---|---|---|
| R2 | `research/process-retrospective.md:1` | 「某次視覺改版 `<prefix>`「Language」功能」 | 「某次視覺改版設定精靈「Language」功能」 | T-E255-02 | AC7 |
| R3 | `research/process-retrospective.md:106` | 「對 7 步 `<prefix>` 全做」 | 「對 7 步設定精靈全做」 | T-E255-02 | AC7 |
| S10 | `specs/decodename-cleanup.md:41` | `research/<client-codename>-<prefix>-...-2026-06-05.md` | `research/<client-codename>-<product-style-prefix>-...-2026-06-05.md` | T-E255-02 | AC7 |
| S11 | `specs/decodename-cleanup.md:91` | same form as S10 | same as S10 | T-E255-02 | AC7 |
| S12 | `specs/decodename-cleanup.md:184` | `grep -rin "<client-codename>[-_ ]?<prefix>"` | `grep -rin "<client-codename>[-_ ]?<product-style-prefix>"` | T-E255-02 | AC7 |
| S13 | `specs/e232-leak-cleanup.md:97` | "…a full `<prefix>` flow board…" | "…a full setup-wizard flow board…" | T-E255-03 | AC7 |
| S14 | `specs/e232-leak-cleanup.md:108` | "codename prefix; "`<prefix>`" is a generic UX-industry term, not the leak — and every one" | "codename prefix; the product-style prefix was then judged a generic UX-industry term, not the leak (E255 later ruled it a codename) — and every one" | T-E255-03 | AC7 |
| S15 | `specs/server-scope-decision-gate.md:11` | "the whole 9-screen `<prefix>` was scoped…" | "the whole 9-screen setup wizard was scoped…" | T-E255-03 | AC7 |
| S16 | `specs/b8-external-ref-ledger.md:12` | "an `<prefix>` PRD" | "a setup-wizard PRD" | T-E255-03 | AC7 |
| S17 | `specs/feature-scope-gate.md:138` | "the `<prefix>` PRD path" | "the setup-wizard PRD path" | T-E255-03 | AC7 |
| R4 | `research/mode-feature-process-retrospective.md:1` | 「某次視覺改版 `<prefix>`「Mode」功能全線」 | 「某次視覺改版設定精靈「Mode」功能全線」 | T-E255-04 | AC7 |
| R5 | `research/visual-fidelity.md:5` | `<prefix>-visual-fidelity-improvement-plan.md,` (header source list; file not in the tree) | `visual-fidelity-improvement-plan.md,` (matches the bare names on lines 3–4) | T-E255-04 | AC7 |
| D2 | `docs/postmortem-visual-fidelity-gate.md:9` | "All 8 implemented `<prefix>` screens" | "All 8 implemented setup-wizard screens" | T-E255-04 | AC7 |
| S18 | `specs/feature-split-lifecycle.md:54` | example row id `"<prefix>-foundation"` | `"wizard-foundation"` | T-E255-04 | AC7 |
| S19 | `specs/figma-baseline-mechanical-selection.md:12` | "a full `<prefix>` flow board" | "a full setup-wizard flow board" | T-E255-04 | AC7 |
| S20 | `specs/orientation-reach-matrix.md:12` | "(a prior `<prefix>` rollout)" | "(a prior setup-wizard rollout)" | T-E255-05 | AC7 |
| S21 | `specs/visual-fidelity-gate-hardening-architecture.md:454` | "the `<prefix>`-incident hole" | "the setup-wizard-incident hole" | T-E255-05 | AC7 |
| S22 | `specs/visual-fidelity-gate-hardening.md:11` | "the `` `<prefix>-setup-wizard` `` incident" | "the `` `setup-wizard` `` incident" | T-E255-05 | AC7 |

### (5) CHANGELOG (ruling 1 = a) and E232 evidence (ruling 2 = a)

| # | file:line | current (abridged) | replacement | task | AC |
|---|---|---|---|---|---|
| X0 | `CHANGELOG.md:4460` | "- `` `research/<prefix>-visual-fidelity-improvement-plan.md` `` — Antigravity/Gemini 3.1 Pro improvement plan." (file not in the tree) | "- A visual-fidelity improvement plan (Antigravity/Gemini 3.1 Pro)." | T-E255-05 | AC8 |
| X1 | `CHANGELOG.md:4511` | retrospective path | new path | T-E255-05 | AC5, AC8 |
| X2 | `CHANGELOG.md:5933` | "hex slipping into `` `<prefix>Theme.kt` `` —" | "hex slipping into `` `Theme.kt` `` —" | T-E255-05 | AC8 |
| X3 | `CHANGELOG.md:5982` | "a prior `<prefix>` wizard shipped" | "a prior setup wizard shipped" | T-E255-05 | AC8 |
| E1 | `qa_reports/review_T-E232-01.md:47` | `3 "<prefix>" mentions` | `3 product-style-prefix mentions` | T-E255-06 | AC9 |
| E2–E4 | `qa_reports/review_T-E232-01.md:52,53,98` | see table (3) | see table (3) | T-E255-06 | AC9 |
| E5 | `qa_reports/review_T-E232-01.md:113` | "(1 of 3 `<prefix>` lines remains" | "(1 of 3 product-style-prefix lines remains" | T-E255-06 | AC9 |
| E6–E8, E11 | review_reports 01:6,14 · 05:14 · 08:13 | see table (3) | see table (3) | T-E255-06 | AC9 |
| E9 | `review_reports/review_T-E232-05.md:21` | `research/assets/<client-codename>-<prefix>-retro/` | `research/assets/<client-codename>-<product-style-prefix>-retro/` | T-E255-06 | AC9 |
| E10 | `review_reports/review_T-E232-06.md:21` | `research/<prefix>-visual-fidelity-governance-recommendations-2026-06-05.md` (a file not in the tree) | `research/<product-style-prefix>-visual-fidelity-governance-recommendations-2026-06-05.md` | T-E255-06 | AC9 |

Tally: 6 content + 2 test + 44 research/specs/docs/CHANGELOG/evidence lines = 52 lane
lines, plus 3 out-of-lane lines = 55; one file rename.

## Copy / Strings

Only the shipped `content/**` strings (C1–C6) reach adopters; the rest is repo-internal prose.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| skill-pm.visual-tokens.reason | `Reason: stylistic ACs ("font 32 sp / 700 / \`#FFFFFF\`") only catch what the spec already enumerates; an unsourced hex slipping into \`Theme.kt\` is exactly the kind of silent drift that ate a prior visual rollout.<!-- rationale:end -->` | backlog E255 ruled scope (1); token swap authored-here — prefix dropped, sentence otherwise byte-identical |
| skill-qa-engineer.drift.example | `Stylistic AC tests like \`ThemeTokensTest\` catch drift after the spec is right` | backlog E255 ruled scope (1); authored-here — prefix dropped |
| skill-design-auditor.2c.example | `e.g. a full setup-wizard flow board` | backlog E255 ruled scope (1); authored-here — class name for the flow |
| rationale.primary-sources | `> Primary sources: \`research/visual-fidelity-retrospective-2026-06-05.md\`` | backlog E255 ruled scope (3); new file name |
| rationale.scope-decision | `The whole 9-screen setup wizard` | backlog E255 ruled scope (1); authored-here — class name |
| rationale.external-ref | `exactly how the setup-wizard run lost fidelity` | backlog E255 ruled scope (1); authored-here — class name |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Git history rewrite (a rewrite plus force-push on a protected `main` is a separate decision).
- Any rule-semantics change; any compose golden; any `test/context-budget.test.mjs` cap.
- `docs/backlog.md` (lines 226, 1345) and `.current/history/**` (`2026-09/e232/tasks.md:6`):
  the integrator cleans them in its post-merge bookkeeping commit, using this spec's new file
  name for `docs/backlog.md:226`.
- Release bookkeeping (version bump, new CHANGELOG entry, backlog done-mark): release-engineer
  and integrator.
- Any file outside the lane's owned set (`specs/fanout-backlog-wave-a.md`, Lanes row `e255`).

## Dependencies / Prerequisites

- **Spec sources** (no architect hop): backlog E255 "Scope ruled 2026-11-09 (triage)"
  paragraph; `specs/fanout-backlog-wave-a.md` (Lanes row `e255`, shared scope, 派工前核對,
  所有權重劃, 完成定義, Decisions); `specs/decodename-cleanup.md` (pattern).
- **Human rulings, already made (not re-asked):** the prefix is a project codename; ruling
  1 = a (the four CHANGELOG lines become class descriptions, substance unchanged); ruling
  2 = a (the five E232 evidence files are cleaned, only the prefix and the old file name
  change, verdicts and evidence facts unchanged).
- **Resource audit (§7):** internal files only, all in the tree; zero external references.
- **Owned-set check:** every one of the 52 lane lines sits in the e255 owned set; the only
  occurrences outside it are the three integrator-bookkeeping lines. **Findings outside the
  owned set: none** — nothing to STOP-flag.
- **Manifest correction:** the 派工前核對 citation list omits `research/process-retrospective.md:82`
  (bare-stem citation, row R1). It is inside the owned `research/**`, so the cut includes it.
- **Budget (measured at base after `npm run build`, chars/4 estimator of
  `test/context-budget.test.mjs`; trial = C1 applied in memory, no file edited):**

  | weight | base | trial | cap |
  |---|---|---|---|
  | skill-pm stripped | 4847 | 4847 | 4849 |
  | lean always-on | 5665 | 5665 | 5723 |
  | stripped constitution (design arm) | 10451 | 10451 | 10598 |
  | non-design constitution | 8452 | 8452 | 8501 |
  | teamwork bundle | 21526 | 21526 | 21715 |

  `node --test test/context-budget.test.mjs`: 54/54 pass at base. Trial equals base by
  construction: C1 sits inside a rationale fence (stripped before the skill-pm cap is
  measured), C2/C3 files have no cap, and `content/constitution-rationale.md` is never
  composed into a prompt. skill-pm line 30: 236 → 232 characters (ASCII; bytes equal).
- **Golden change list: none.** The 12 files in `test/fixtures/compose-golden/` contain zero
  hits for the prefix and for every C1–C6 token; `skill-qa-engineer.md` and
  `skill-design-auditor.md` are in no golden; the rationale file is read only by
  `test/compose-equivalence.test.mjs` (§X headings, untouched) and
  `test/e391-prompt-audit-stale-facts.test.mjs` (strings C4–C6 do not touch).
- **Build-time parsers on touched files:** `check:transitions-sync` reads
  `specs/qa-flow-enforcement-architecture.md` (S8 is outside the transitions table);
  `check:md-tables` covers the table rows S8, S9, E4.
- **Post-change tracked-file prefix grep remainder** (AC10; `git grep -n -i "$PREFIX"` with
  `$PREFIX` set as in Acceptance Criteria): exactly
  - `.current/history/2026-09/e232/tasks.md:6`
  - `docs/backlog.md:226`
  - `docs/backlog.md:1345`
  
  all three cleaned by the integrator after merge, after which the tree grep is 0.
- **Visual Structural Assertions:** omitted — no `design/<feature>.md`, mode = no-design.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E255-01 | sr-engineer: (1) shipped text — rewrite sites C1–C6 by class (AC1, AC2, AC3, AC5); skill-pm line 30 must not grow | none | 4 | `content/skill-pm.md`, `content/skill-qa-engineer.md`, `content/skill-design-auditor.md`, `content/constitution-rationale.md` | — |
| T-E255-02 | sr-engineer: (3) `git mv` the prefixed retrospective to `research/visual-fidelity-retrospective-2026-06-05.md` and fix citations R1, D1, S1–S3; (4) prose R2, R3, S10–S12 (AC4, AC5, AC7) | none | 5 | `research/visual-fidelity-retrospective-2026-06-05.md`, `research/process-retrospective.md`, `docs/prompt-audit-2026-11-02.md`, `specs/constitution-restructure.md`, `specs/decodename-cleanup.md` | — |
| T-E255-03 | sr-engineer: (3) citations S4–S9; (4) prose S13–S17 (AC5, AC7) | none | 5 | `specs/e232-leak-cleanup.md`, `specs/qa-flow-enforcement-architecture.md`, `specs/server-scope-decision-gate.md`, `specs/b8-external-ref-ledger.md`, `specs/feature-scope-gate.md` | — |
| T-E255-04 | sr-engineer: (4) prose R4, R5, D2, S18, S19 (AC7) | none | 5 | `research/mode-feature-process-retrospective.md`, `research/visual-fidelity.md`, `docs/postmortem-visual-fidelity-gate.md`, `specs/feature-split-lifecycle.md`, `specs/figma-baseline-mechanical-selection.md` | — |
| T-E255-05 | sr-engineer: (4) prose S20–S22; (5) CHANGELOG X0–X3 as class descriptions, substance unchanged (AC5, AC7, AC8) | none | 4 | `specs/orientation-reach-matrix.md`, `specs/visual-fidelity-gate-hardening-architecture.md`, `specs/visual-fidelity-gate-hardening.md`, `CHANGELOG.md` | — |
| T-E255-06 | sr-engineer: (5) E232 evidence E1–E11 — only the prefix and the old file name change (AC5, AC9) | none | 5 | `qa_reports/review_T-E232-01.md`, `review_reports/review_T-E232-01.md`, `review_reports/review_T-E232-05.md`, `review_reports/review_T-E232-06.md`, `review_reports/review_T-E232-08.md` | — |
| T-E255-07 | qa-engineer: (2) fixture surface names T1, T2 → `wizard` class name; both suites green (AC6) | none | 2 | `test/visual-evidence-gate.test.mjs`, `test/visual-gate-e2e.test.mjs` | — |
| T-E255-08 | qa-engineer: regression and remainder check — AC1–AC12 proofs on the final HEAD, full suite under the test lock, then the PASS write over T-E255-01..08 | T-E255-01, T-E255-02, T-E255-03, T-E255-04, T-E255-05, T-E255-06, T-E255-07 | 1 | — | — |

## Cut Notes

Site → AC → task map: C1–C6 → AC1/AC2/AC3/AC5 → T-E255-01; T1–T2 → AC6 → T-E255-07;
rename + R1, D1, S1–S3 → AC4/AC5 → T-E255-02; S4–S9 → AC5 → T-E255-03; X1 → AC5/AC8 →
T-E255-05; E2–E4, E6–E8, E11 → AC5/AC9 → T-E255-06; R2, R3, S10–S12 → AC7 → T-E255-02;
S13–S17 → AC7 → T-E255-03; R4, R5, D2, S18, S19 → AC7 → T-E255-04; S20–S22 → AC7 →
T-E255-05; X0, X2, X3 → AC8 → T-E255-05; E1, E5, E9, E10 → AC9 → T-E255-06; AC10–AC12 →
T-E255-08.

Test files touched: `test/visual-evidence-gate.test.mjs` (line 29 only, T-E255-07),
`test/visual-gate-e2e.test.mjs` (line 38 only, T-E255-07). No new test file: every AC is a
grep, diff, or existing-suite proof.

Notes for build roles:
- T-E255-01 cites the new research path at C4; it resolves once T-E255-02 lands. AC5 is
  judged at T-E255-08 on the final HEAD.
- Task sizes: every sr task ≤ 5 files and ≤ 15 changed lines (`task_size` budget).
- The code-reviewer checks each task with `git diff --word-diff=porcelain`: only inventory
  tokens change.

## Task Format

- [ ] T-E255-01 [P0] sr-engineer: content sites C1–C6 by class; skill-pm line 30 not longer | depends_on: none
- [ ] T-E255-02 [P1] sr-engineer: git mv retrospective to class name; citations R1, D1, S1–S3; prose R2, R3, S10–S12 | depends_on: none
- [ ] T-E255-03 [P1] sr-engineer: citations S4–S9; prose S13–S17 | depends_on: none
- [ ] T-E255-04 [P2] sr-engineer: prose R4, R5, D2, S18, S19 | depends_on: none
- [ ] T-E255-05 [P2] sr-engineer: prose S20–S22; CHANGELOG X0–X3 | depends_on: none
- [ ] T-E255-06 [P2] sr-engineer: E232 evidence E1–E11, prefix and old file name only | depends_on: none
- [ ] T-E255-07 [P1] qa-engineer: fixture surface names T1, T2 | depends_on: none
- [ ] T-E255-08 [P0] qa-engineer: AC1–AC12 regression, remainder grep, full suite, PASS | depends_on: T-E255-01..07

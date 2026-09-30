# e233b-core-comments

Lane `e233b` of the E233 fan-out (see `specs/fanout-e233.md`), tickets E233 (slice) and E241.
Task ids: `T-E233B-01..06`.

## Problem Statement
Comments in the non-`tools/` source directories (`gates/`, `bin/`, `scripts/`, `prompts/`, `schema/`, `guards/`, `lib/`, plus `transport/` and `index.ts` if any qualify) explain themselves only with a bare backlog id (`// E31 (e31-config-nonfatal): ...`), which is unreadable to anyone without the backlog. Separately, `CHANGELOG.md` (3.27.1 entry, ~line 2859) and `research/visual-fidelity.md` (header, ~line 6) cite research files that exist under no name in the tree. This lane rewrites the comments in plain language (an id may remain only as a trailing pointer) and replaces the dead citations with plain descriptions. Comments and prose only; behaviour is unchanged.

## User Stories
- As a maintainer reading `gates/` or `bin/` without the backlog, I want each comment to state the behaviour and reason in words, so that I can understand the code without looking up a ticket id.
- As a reader of the CHANGELOG and the visual-fidelity research note, I want citations to point at things that exist or be plain descriptions, so that I am not sent hunting for missing files.

## Acceptance Criteria
- **AC1 (behaviour unchanged, mechanical)** — Given the touched `.ts`/`.mjs` files, when each is transpiled with TypeScript `transpileModule` (`removeComments: true`, target ES2022, module ESNext) at the base commit and at HEAD, then the outputs are byte-identical for every file (and every touched file is `.ts`/`.mjs`; no non-comment change hides in a touched file).
  proof: `cd <worktree> && node --input-type=module -e "import ts from 'typescript';import {execSync as x} from 'node:child_process';const b=process.env.BASE||'main';const fs=x('git diff --name-only '+b+'...HEAD -- gates bin scripts prompts schema guards lib transport index.ts',{encoding:'utf8'}).split('\n').filter(f=>/\.(ts|mjs)\$/.test(f));let bad=0;for(const f of fs){let o='';try{o=x('git show '+b+':'+f,{encoding:'utf8'})}catch{bad++;console.log('NEW/DELETED',f);continue}const n=x('cat '+f,{encoding:'utf8'});const t=s=>ts.transpileModule(s,{fileName:f,compilerOptions:{removeComments:true,target:'ES2022',module:'ESNext'}}).outputText;if(t(o)!==t(n)){bad++;console.log('DIFF',f)}}console.log(fs.length+' files, '+bad+' bad');process.exit(bad?1:0)"` prints `N files, 0 bad` and exits 0 (BASE = the lane's base commit; default `main`).
- **AC2 (no bare-id comments remain)** — Given the owned source directories, when comment lines are scanned for ticket ids, then no comment consists of a bare id (or id plus slug) as its only explanation; an id appears only as a trailing pointer after a plain-language sentence.
  proof: `cd <worktree> && grep -rnE '^\s*(//|/\*|\*|#)\s*\(?E[0-9]+[a-z]?\b[^A-Za-z]*(\(e[0-9][a-z0-9-]*\))?\s*[:—-]?\s*$' gates bin scripts prompts schema guards lib transport index.ts` prints nothing; and a reviewer samples >= 10 rewritten comments per task and confirms each reads without the backlog (subjective part of the AC, no single command).
- **AC3 (strings and outputs untouched)** — Given the diff, when its changed lines are inspected, then every changed line is inside a comment: no string literal, error message, CLI output, tool description or test name changed. Covered by AC1 (string changes alter transpile output); additionally `git diff main...HEAD --stat -- test tools templates content docs package.json CLAUDE.md AGENTS.md specs/fanout-e233.md` shows nothing.
  proof: `cd <worktree> && git diff --stat main...HEAD -- test tools dist/tools templates content docs package.json CLAUDE.md AGENTS.md 'specs/fanout-*.md' | wc -l` prints `0`.
- **AC4 (dist share rebuilt)** — Given the source edits, when `npm run build` runs, then `dist/{gates,prompts,schema,guards,lib,transport}/**` and `dist/index.*` reflect the new comments, `dist/tools/**` is untouched, and the build leaves no further diff.
  proof: `cd <worktree> && npm run build && git status --short dist | grep -v -E 'dist/(gates|prompts|schema|guards|lib|transport)/|dist/index\.' ; git diff --stat main...HEAD -- dist/tools | wc -l` prints no path lines from the first part and `0` from the second (run after the dist commit; the first part must be empty on a clean tree).
- **AC5 (E241 citation)** — Given `CHANGELOG.md` and `research/visual-fidelity.md`, when they are searched for the governance-recommendations file (the one file that exists under neither its old nor its new name after the leak cleanup), then it is cited in exactly two places — the 3.27.1 entry (~line 2859) and the `research/visual-fidelity.md` header (~line 6) — and both are replaced by a plain description. No other line in either file changes: citations of other since-merged research files (e.g. ~3778/~3916 `why-pixel-perfect-missed.md`, the other header source names) are accurate history and stay.
  proof: `cd <worktree> && git diff main...HEAD -U0 -- CHANGELOG.md | grep -E '^[-+][^-+]' | wc -l` is small and every hunk sits in the 3.27.1 entry or another entry citing a missing file (reviewer confirms hunk list); `grep -n 'governance-recommendations' CHANGELOG.md research/visual-fidelity.md` prints nothing.
- **AC6 (suite green)** — Given the committed lane, when the full suite runs on a clean tree, then it passes (comments are not pinned in owned files by tests; any red is reported, not re-baselined).
  proof: `cd <worktree> && git status --porcelain | wc -l` prints `0`, then `npm test` exits 0.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no user-facing string is introduced or changed; strings are explicitly out of scope |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- `tools/**` (lane e233a), `test/**`, `content/**`, goldens, budget, `templates/**`, `docs/**`, `specs/fanout-*.md`, `package.json`, `CLAUDE.md`, `AGENTS.md`.
- String literals, error messages, CLI output, tool descriptions, test names.
- Any CHANGELOG change other than the E241 citations; release bookkeeping (version, backlog done-marks) belongs to release-engineer.
- No new test file is planned (AC1 mechanical proof replaces it). If qa decides one is needed it must sit under a path new for this ticket and be flagged in the cut.

## Dependencies / Prerequisites
- E231 and E232 done (per fan-out spec). Lane base: `main` at lane creation.
- Measured scope (comment lines mentioning a ticket id, ~206 lines / 32 files): `bin/` 3 files (agc-init.mjs heaviest, ~50), `scripts/` 13 files (verify-release, check-md-tables, capture-constitution-golden, check-transitions-sync heaviest), `gates/` ~10 files (registry, visual, feature-lease, pipeline, ac-execution heaviest), `prompts/` 3, `schema/` 2, `guards/` 1, `lib/` 1. `transport/` and `index.ts` had no id comments at cut time; include if a rescan finds any.
- Tests reading source text (`test/e178b-lane-watch`, `e235b`, `e177b`) pin `tools/lane-status.ts` only (lane e233a); no owned-file pin known, full suite confirms.
- Constitution §1/Information hygiene: rewritten comments and the E241 replacement text must contain no absolute paths, internal URLs or codenames; describe by class.
- Rewrite rule: state behaviour and why in plain words; id only as trailing pointer, e.g. `... (E31)`. Do not use `/* */` where a `//` was used (keeps line structure). Do not reflow code.
- E241 detail (narrowed by integrator pre-review, human-approved 2026-09-29): only the governance-recommendations file is in scope — it was renamed during the leak cleanup and exists under neither name. The other absent files named in CHANGELOG (19 citations in total, e.g. ~2861–2862, ~3778, ~3916) and in the `research/visual-fidelity.md` header existed when written and were later merged into `research/visual-fidelity.md`; they are release history and must not be edited. Replacement wording e.g. "a cross-AI governance recommendations note (not retained in the tree)"; keep the entry's meaning.

# e260d-core-dirs-comment-trim

Lane `e260d` of the E260 fan-out (wave 1, see `specs/fanout-e260.md`), ticket E260. Task ids `T-E260D-01..07`.
Scope: the comments in `gates/`, `prompts/`, `schema/`, `lib/`, `guards/`, `transport/` and `index.ts`, plus this lane's share of `dist/`. Base commit `b37178a`.

## Problem Statement
The core source directories still carry long comment blocks written before the Comment discipline rule (constitution section 6) existed: 66 blocks of more than 7 counted lines across 25 of the 43 files, 16 of them over 20 lines, the longest 87 lines (the header of `gates/feature-lease.ts`). Long rationale in a comment hides the WHAT and WHY a reader needs, drifts from the code, and is shipped into `dist/` (`.js`, `.d.ts`, `.map`). This lane trims those blocks to the threshold the human approved for E260. Rationale that is still worth keeping moves to a tracked spec, and the comment keeps at most a one-line pointer. Only comments change; behaviour, strings and types stay byte-for-byte the same.

## User Stories
- As a maintainer reading a gate predicate, I want a short comment that says what the code does and why, so that I can understand it without reading a page of history first.
- As a reviewer, I want a mechanical proof that only comments changed, so that I can approve a large comment-only diff without re-reading every line of logic.
- As a future editor, I want the rationale that was cut to still be findable from a one-line pointer, so that removing it from the code does not lose it.

## Acceptance Criteria
All commands run from the lane worktree root. `BASE` = `b37178a` (the lane base; the proof script reads `.current/e260d/base-sha` and falls back to `--base`).

- **AC1 (emit unchanged, human-mandated)**: Given every `.ts` file under the lane directories that differs from BASE, when the base blob and the HEAD file are each transpiled with TypeScript `transpileModule` using the repo `tsconfig.json` compiler options with `removeComments: true` (and `sourceMap`, `inlineSourceMap`, `declaration`, `declarationMap` off, so line-number maps cannot differ), then the two outputs are byte-identical for every file.
  proof: `node .current/e260d/proof.mjs` prints `emit: <N> files, 0 differ` and exits 0.
- **AC2 (types and tokens unchanged)**: Given the same file set, when each version is parsed with `ts.createSourceFile` and its leaf tokens (kind and text, comments and whitespace excluded) are listed in source order, then the two lists are identical. This catches a type-only edit, which AC1 cannot see because transpiling erases types.
  proof: `node .current/e260d/proof.mjs` prints `tokens: <N> files, 0 differ` and exits 0.
- **AC3 (only owned `.ts` files changed, none added or removed)**: Given the lane diff, when it is listed against BASE, then every changed source path is an existing `.ts` file under `gates/`, `prompts/`, `schema/`, `lib/`, `guards/`, `transport/` or is `index.ts`; nothing under `tools/`, `dist/tools/`, `test/`, `bin/`, `scripts/` or the fan-out's shared-forbidden list changed.
  proof: `node .current/e260d/proof.mjs` prints `scope: ok`; and `git diff --stat b37178a...HEAD -- tools dist/tools test bin scripts content templates docs 'specs/fanout-*.md' CHANGELOG.md package.json CLAUDE.md AGENTS.md .antigravityrules | wc -l` prints `0`.
- **AC4 (no block over 20 lines, one sanctioned exception)**: Given the lane files at HEAD, when each is measured with `analyzeText` from `dist/tools/comment-scan.js` (the counter `agc check` uses), then no comment block counts more than 20 lines, except the errorCode-to-doc-file mapping table above `GATE_REGISTRY` in `gates/registry.ts` (decision D1 below), whose block counts at most 34 lines (33 table rows plus one pointer line).
  proof: `node .current/e260d/proof.mjs` prints `>20: 0 unexpected (1 allowed: gates/registry.ts mapping table)` and exits 0.
- **AC5 (blocks of 8 to 20 lines are trimmed or justified)**: Given the 8–20-line blocks the proof script lists at HEAD, when the code-review report is read, then every listed block has a one-line reason to keep it in `review_reports/review_T-E260D-NN.md` of the task that owns its file. A block reduced to 7 or fewer counted lines needs no reason.
  proof: `node .current/e260d/proof.mjs --list-mid` lists the remaining blocks; the reviewer checks each one against the report (no single command decides whether a reason is sound).
- **AC6 (rationale kept, comments point to it)**: Given a trimmed block whose rationale is not already in a tracked spec the comment cites, when the trim lands, then that rationale is in `specs/e260d-comment-rationale.md` under a section named after the source file, and the comment keeps at most one pointer line to it. Where the comment already cites a tracked spec that holds the rationale (for example `specs/e10-lease-override.md`), the pointer to that spec is enough and nothing is copied.
  proof: `grep -c 'specs/e260d-comment-rationale.md' $(git diff --name-only b37178a -- gates prompts schema lib guards transport index.ts)` and the section list of `specs/e260d-comment-rationale.md` are cross-checked by the reviewer; `node scripts/check-md-tables.mjs` exits 0 after commit.
- **AC7 (Generic citation)**: Given comment lines in the lane files at HEAD, when they are scanned, then no comment's only explanation is a bare ticket id, AC or DR reference (an id may stay as a trailing pointer after plain words), and no comment that this lane touches cites a path that is not tracked. A touched comment that names the retired single-file constitution describes it in words instead of citing its old path.
  proof: `node .current/e260d/proof.mjs` prints `bare-id: 0`; the reviewer samples at least 10 trimmed blocks per task for plain-language readability.
- **AC8 (comment form preserved)**: Given every touched file, when its diff is read, then each file keeps its `// Coded by @<role>` first line, `//` comments stay `//`, JSDoc stays JSDoc, no `/*!` or `/// <reference` line is touched, and no comment contains a `##` heading.
  proof: `node .current/e260d/proof.mjs` prints `form: ok`.
- **AC9 (dist share rebuilt, nothing else)**: Given the committed source edits, when `npm run build` runs on a clean tree, then it leaves no diff, the lane's commits change `dist/{gates,prompts,schema,lib,guards,transport}/**` and `dist/index.*` only where a source file changed, and `dist/tools/**` is unchanged.
  proof: `npm run build && git status --porcelain dist | wc -l` prints `0`, and `git diff --stat b37178a...HEAD -- dist/tools | wc -l` prints `0`.
- **AC10 (pinned comment kept)**: Given `test/error-code-contract.test.mjs` reads the mapping comment in `gates/registry.ts` (`parseDocFileMappingComment`, regex `^//\s{2,}CODE\s{2,}files$`, 33 rows expected), when the lane lands, then all 33 rows are byte-identical to BASE.
  proof: `diff <(git show b37178a:gates/registry.ts | grep -E '^//\s{2,}[A-Z][A-Z0-9_]*\s{2,}') <(grep -E '^//\s{2,}[A-Z][A-Z0-9_]*\s{2,}' gates/registry.ts)` prints nothing.
- **AC11 (suite green)**: Given the final HEAD with a clean tree, when the full suite runs, then it passes. A red test is reported to the coordinator and integrator, never re-baselined.
  proof: `git status --porcelain | wc -l` prints `0`, then `node scripts/test-lock.mjs -- npm test` exits 0.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no user-facing string is introduced or changed; string literals are out of scope |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- String literals, error messages, hint text, tool descriptions, prompt text assembled by `prompts/` (it would move the compose goldens), test names.
- Logic, types, imports, code layout. No reflow of code lines.
- File-level comment ratio (the `agc check` high-ratio advisory). Blocks are the E260 measure; the ratio falls as a side effect and is reported, not gated.
- `tools/**` (lanes e260a and e260b), `bin/**` and `scripts/**` (lane e260c), `test/**` (waves 2 and 3, and qa-engineer only), and the fan-out's shared-forbidden list.
- Moving the errorCode-to-doc-file mapping out of a comment. That needs a test change in a file another lane owns; it is filed as a new discovery (see D1).
- Release bookkeeping (version, CHANGELOG, backlog done-mark) belongs to release-engineer and the integrator.

## Dependencies / Prerequisites

### Measurement at base (re-run 2026-10-01, confirms the fan-out numbers)
Method: `analyzeText` from `dist/tools/comment-scan.js` over `git ls-files gates prompts schema lib guards transport index.ts`, `.ts` only (no `.d.ts` is tracked there). Result: **43 files, 25 with a long block, 50 blocks of 8–20 counted lines, 16 blocks over 20, longest 87.** This matches the fan-out table exactly. Line ranges are physical lines at BASE; the number in brackets is the counted size; `**` marks a block over 20.

| file | blocks | ranges at BASE (counted lines) |
|---|---|---|
| `gates/ac-execution.ts` | 2 | L2–30 (29**), L105–117 (13) |
| `gates/code-review.ts` | 1 | L2–14 (13) |
| `gates/cut-approval.ts` | 1 | L2–18 (17) |
| `gates/evidence-schema.ts` | 1 | L2–27 (26**) |
| `gates/expected-red.ts` | 2 | L2–25 (24**), L72–80 (9) |
| `gates/external-refs.ts` | 1 | L2–24 (23**) |
| `gates/feature-lease.ts` | 2 | L2–88 (87**), L108–123 (16) |
| `gates/lease-override.ts` | 2 | L2–41 (40**), L46–55 (10) |
| `gates/pipeline.ts` | 2 | L2–24 (23**), L31–38 (8) |
| `gates/qa-review.ts` | 2 | L2–15 (14), L32–40 (9) |
| `gates/registry.ts` | 9 | L2–24 (23**), L84–125 (42**, mapping table, D1), L244–251 (8), L283–290 (8), L305–314 (10), L331–342 (12), L374–394 (21**), L443–451 (9), L646–655 (10) |
| `gates/scope-decision.ts` | 1 | L2–19 (18) |
| `gates/stamp-provenance.ts` | 1 | L2–51 (50**) |
| `gates/visual.ts` | 10 | L2–17 (16), L254–273 (20), L284–291 (8), L415–428 (14), L455–462 (8), L563–572 (10), L625–634 (10), L664–674 (11), L836–843 (8), L857–868 (12) |
| `index.ts` | 2 | L48–56 (9), L100–112 (13) |
| `lib/render-boundary.ts` | 2 | L2–25 (24**), L68–78 (9) |
| `lib/tsconfig-source-dirs.ts` | 2 | L2–13 (12), L21–32 (8) |
| `lib/watermark-check.ts` | 3 | L2–15 (14), L17–27 (9), L53–79 (25**) |
| `prompts/build.ts` | 6 | L56–67 (12), L78–113 (36**), L169–178 (8), L225–237 (13), L498–506 (9), L531–539 (9) |
| `prompts/constitution-manifest.ts` | 1 | L2–26 (25**) |
| `prompts/partials-manifest.ts` | 1 | L2–20 (19) |
| `prompts/skill-manifest.ts` | 3 | L2–36 (35**), L45–60 (16), L105–113 (9) |
| `prompts/text-transforms.ts` | 3 | L2–19 (18), L34–48 (15), L56–65 (10) |
| `schema/migrations-handoff.ts` | 4 | L77–84 (8), L165–175 (11), L183–191 (9), L199–206 (8) |
| `schema/migrations-sqlite.ts` | 2 | L2–9 (8), L68–78 (9) |

The other 18 files (`guards/*`, `transport/http.ts`, `schema/{versions,migrations-config,migrations-tasks}.ts`, the 12 thin role wrappers in `prompts/`, ...) have no long block. They are touched only for a Generic-citation fix, and the base scan found none needed (see below).

### Per-block disposition (how sr-engineer decides each block)
Work top-down, one block at a time:
1. **Split WHAT/WHY from history.** Keep what a reader of this code needs now: what the unit does, the non-obvious constraint or pitfall, and the reason in one or two sentences. Drop history ("relocated from", "previously", "since the pipeline extraction"), restated spec text, AC/DR bookkeeping and narratives of review rounds.
2. **Rationale still worth keeping**: if the block already cites a tracked spec that holds that rationale (check the spec, do not assume), the comment keeps a one-line pointer to it and nothing moves. Otherwise move the text, lightly edited for standalone reading, to `specs/e260d-comment-rationale.md` under `## <source path>` and leave one pointer line such as `// Rationale: specs/e260d-comment-rationale.md (gates/feature-lease.ts).`
3. **Target size**: header and function comments end at 7 counted lines or fewer. A block may stay at 8–20 only when cutting it would remove a caller-facing contract (params, return, constraint, pitfall) that has no better home. Record a one-line reason in the "Retained blocks" table of `specs/e260d-comment-rationale.md`; the code-reviewer copies the line into the task's review report (AC5). Nothing may stay above 20 except D1.
4. **In-body comments**: a long comment inside a function body becomes a short warning at the function head, or is cut. Do not move code to make room.
5. **Do not touch** string literals, template literals (comment-looking text inside a template is a string), `/*!`, `/// <reference`, the `// Coded by` first line, or the 33 mapping rows in `gates/registry.ts`.
6. **Generic citation**: while a block is open, any id, AC or DR reference left in it gets plain words on the same line; a cited path must be tracked. Mentions of the retired single-file constitution in `prompts/build.ts` and `prompts/constitution-manifest.ts` are history: reword them as "the retired single-file constitution" when the block is touched.
7. **Rebuild and prove per task**: after each task's edits run `node .current/e260d/proof.mjs`, then `npm run build`, and commit the source and its `dist/` output together, so every commit on the branch is consistent.

### Behaviour-neutral proof script (`.current/e260d/proof.mjs`, written in T-E260D-01)
A Node ESM script, no dependencies beyond the repo's `typescript` and `dist/tools/comment-scan.js` (imported relative to `import.meta.url`). It holds no absolute paths.
- **Base**: `--base <rev>`, else the first line of `.current/e260d/base-sha`, else fail with a clear message.
- **File set**: `git diff --name-only <base> -- gates prompts schema lib guards transport index.ts` (the working tree against the base, so it works before a commit). `scope` fails on any path that is not `.ts`, or is added or deleted (`git diff --name-status`).
- **emit (AC1)**: compiler options come from `ts.readConfigFile('tsconfig.json')` and `ts.convertCompilerOptionsFromJson`, then `removeComments: true` and `sourceMap`, `inlineSourceMap`, `declaration`, `declarationMap` all false. `ts.transpileModule(text, { fileName, compilerOptions })` runs on `git show <base>:<f>` and on the working-tree file, and `outputText` is compared byte for byte.
- **tokens (AC2)**: `ts.createSourceFile(f, text, ScriptTarget.Latest, true)`; walk `getChildren()` to the leaves (skipping `JSDoc` nodes and `EndOfFileToken` trivia), collect `[kind, getText()]`, and compare the base and HEAD lists.
- **long blocks (AC4, AC5)**: `analyzeText` over every lane file at HEAD. Print `>20: <k> unexpected (<a> allowed: ...)`. The only allowed block over 20 is the one in `gates/registry.ts` that contains the line `//   AGENT_ID_REQUIRED`, and it may count at most 34 lines. `--list-mid` prints each 8–20 block as `<file>:<line> <counted>`.
- **bare-id (AC7)**: the E233 regex (a comment line made only of an id, an optional slug in brackets, and punctuation) over the lane files, printed as `bare-id: <n>`.
- **form (AC8)**: in every changed file the first line is identical to BASE (the `// Coded by @<role>` marker); the number of `/*` and `/**` comment openers is not higher than at BASE (no `//` run was turned into a block comment); no comment line contains a `##` heading; no `/*!` or `/// <reference` line differs. Print `form: ok`.
- Output ends with one summary line, and the script exits 1 if any check fails.

### Decision for the human: D1, the test-pinned mapping table (recommended: a)
`test/error-code-contract.test.mjs` (`parseDocFileMappingComment`, the "doc-file mapping (c12)" test) reads the 33-row errorCode-to-doc-file table in a comment above `GATE_REGISTRY` and asserts all 33 rows. The block counts 42 lines. Even trimmed to one pointer line plus the table, it counts 34, above the "always trim over 20" rule. `specs/fanout-e260.md` lists no comment pin for e260d, and the test file belongs to wave-2 lane e260g, so this lane cannot change it.
- **(a) recommended**: trim the 9 prose lines to one pointer line and keep the 33 rows byte-identical. This block is the one sanctioned exception over 20 (AC4, AC10). File a new discovery proposing to move the table out of a comment (for example into a `docFiles` field on each `GATE_REGISTRY` entry, with the test reading the data). That is a behaviour and test change for a later ticket.
- (b) Split the table with blank lines into blocks of 20 or fewer. Not recommended: it games the counter without making the comment shorter.
- (c) Hold the lane until the test changes. Not recommended: it serializes wave 1 behind wave 2.

### Tests that read lane sources (audited at BASE)
- **Positive pin, must stay**: `test/error-code-contract.test.mjs` `parseDocFileMappingComment` (D1, AC10).
- **Code or string pins, unaffected by comment edits**: `covering-evidence` (`gates/qa-review.ts`, `gates/code-review.ts` function bodies), `constitution-deliverable-guard` (`REQUIRED_VISUAL_SECTIONS` literal in `gates/visual.ts`), `context-budget` (imports in `prompts/build.ts`), `release-staging` (manifest entry in `prompts/constitution-manifest.ts`), `skill-evolution-v3.11` and `subagent-templates` (`schema/versions.ts` code), `visual-evidence-gate` (hint string in `gates/registry.ts`), `e122-state-render-injection` and `e137-render-sanitise` (`STRUCTURAL_MARKER_RE` declaration in `dist/prompts/build.js`), `teamwork-lite` (`RAG_SKIP_ROLES` in `dist/prompts/build.js`), `e178a-integrator-role` (`prompts/integrator.ts` shape).
- **Negative pins, which removing text cannot break**: `e114` (no `cut_approved_source` in `gates/`), `e137` (no second `renderDataBlock`, no hand-built fence), `e23` (no `evidence_schema` in `index.ts`), `watermark-check` (no I/O import in `dist/lib/watermark-check.js`), `lane-paths` and `lane-migrate` (allow-lists of files that mention `resolveLanePaths`, `lane-paths`, `resolveCurrentLane` or the migrate functions; a trim must not ADD such a mention), `error-code-contract` AC-5 (gate-code tokens; registry codes are present as code strings).
- The full suite on the final HEAD is the last word (AC11).

### Other prerequisites
- Base `b37178a` (wave 1). E258 done (per the fan-out). Dispatch pin `sr-engineer=fable` (human, persisted by the coordinator).
- Information hygiene: the rationale spec, the proof script and evidence carry no absolute local paths; refer to the worktree as `../agent-governance-mcp-lanes/e260d` or by description.
- `specs/e260d-comment-rationale.md` is new and tracked: its tables must pass `scripts/check-md-tables.mjs`. Each task appends its own sections; T-E260D-01 creates the skeleton (a short intro, a "Retained blocks" table `file | line at HEAD | counted | reason`, then one `## <source path>` section per file as tasks add them).
- Generic citation at BASE: the E233 bare-id regex finds 0 hits in the lane files, and every `specs/*.md` path cited in a lane comment exists. The only stale path citation is the retired `content/constitution.md` (3 mentions in `prompts/build.ts` and `prompts/constitution-manifest.ts`), handled under disposition step 6.
- Architect hop: none. The ticket is comment-only, touches no data model or API, and the proof is mechanical.
- No new test file is planned: AC1, AC2 and AC4 are mechanical through the proof script, and the existing suite covers behaviour. If qa-engineer decides a test is needed, it must sit at a path new to this ticket and be flagged.

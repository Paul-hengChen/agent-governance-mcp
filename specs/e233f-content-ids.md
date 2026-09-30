# e233f-content-ids

Ticket E233, stage 2 (content lane). Lane plan: `specs/fanout-e233.md` (lane row `e233f`, sections "所有 lane 共通的範圍" and "第二段派工前核對"). Base commit: `58528d5` (also in `.current/e233f/base-sha`).

## Problem Statement
The role SOPs and constitution fragments under `content/` cite backlog ticket ids (for example `(E17)`, `the D5 manual rebase`, `pre-D2 B9 hand-sum`, `E1/E1A/E13 header lineage`) and in some places the id is the only explanation of a rule, a step or a reason. An agent without this repo's backlog cannot tell what the reference means. The constitution's Generic-citation rule (`content/const-15-core-tail.md`, Information hygiene / Generic citation bullets) says a bare ticket id must never stand alone as the explanation: plain words must carry the meaning on the same line, and the id may stay only as a trailing pointer. Stage 1 (lanes e233a–e233e, merged) fixed source and test comments; this lane fixes `content/**` plus the ticket-id comments in the two shared test files `test/context-budget.test.mjs` and `test/render-structure.test.mjs`, then refreshes the compose goldens. The rules themselves do not change.

Measured at base (integrator pre-dispatch check): 189 ticket-id mentions in `content/*.md`, 39 of them inside `<!-- origin:… -->` / `<!-- rationale:… -->` tags that the prompt builder strips at compose time. Visible mentions cluster in `content/skill-release-engineer.md` (~129) and `content/skill-integrator.md` (~12); the other ~14 files hold a handful each. Most mentions are already trailing pointers next to plain words and need no change — only the "id is the sole explanation" cases are in scope.

## User Stories
- As an agent loading a role SOP in a workspace that does not have this repo's backlog, I want every rule, step and reason to be explained in plain words, so that I can follow it without looking up ticket ids.
- As a maintainer, I want the id kept as a trailing pointer, so that I can still trace a rule back to its backlog row.
- As a maintainer, I want the rewrite proven behaviour-neutral and budget-neutral, so that a readability pass cannot silently change a rule or blow the context budget.

## Acceptance Criteria

Id pattern used below (covers upper/lower case and letter suffixes, per the integrator's cross-lane notice): `\b([EeDdCcBbAaRrNnFf][0-9]{1,3}[A-Za-z]?|AC[0-9]+)\b`. `BASE` = `58528d5`.

**Rewrite scope**

- **AC1** — Given any visible (not inside an origin/rationale tag, not inside a fenced code block) sentence in `content/*.md` whose only explanation of a rule, step, reason or term is a ticket id / legacy finding label (e.g. `the D5 manual rebase`, `pre-D2 B9 hand-sum`, `the actual N4 hazard`, `Reason (E17 forensics)`, `E1/E1A/E13 header lineage`, `E82 (ii) maintenance note`, `pre-E49 wording`), when the lane finishes, then that sentence states the meaning in plain words on the same line and the id, if kept, sits only as a trailing pointer (e.g. `… (E17)`). Ids that are already trailing pointers beside plain words are left untouched. Per-file disposition (edited / left as pointer / pinned-held) is logged by sr-engineer in its handoff notes and audited by code-reviewer.
  (No single-command proof: "sole explanation" is a reading judgment; code-reviewer samples every edited hunk plus every remaining visible id line in the edited files.)
- **AC2** — Given ids inside `<!-- origin:start -->…<!-- origin:end -->` or `<!-- rationale:start -->…<!-- rationale:end -->` tags, when the tag is a pure provenance pointer (`(v3.86.0, E18)` style), then it is left as-is; when the tag holds prose whose explanation relies on a bare id (e.g. `(E67f: …)`), then it follows the AC1 rule. Lower priority than AC1; may be skipped only if budget or pin constraints make it impossible, with the reason logged.
- **AC3** — Given fenced code blocks, filenames, code spans, handoff/YAML keys, status enums and error codes in `content/`, when the lane finishes, then none of them is changed (machine-validated tokens are exempt from the Generic-citation rule).

**Hard constraints**

- **AC4 (pinned strings held)** — Given that other test files (not owned by this lane) assert on id-bearing `content/` text — known examples: `test/release-staging.test.mjs:380` (`**Root-file completeness (E94)**`), `:2536` (`**Existence pre-filter, mandatory (E71a)**`), `test/feature-lease.test.mjs:1659/1695/1707` (`(E17)`, `Reason (E17 forensics)`, the E15 wording in the same rationale tail), `test/e178a-integrator-role.test.mjs:329` (`(the E222 precedent)`), `test/e130-lane-default.test.mjs:303` (`post-E125a`) — when sr-engineer edits any line, then it has first run `grep -rn "<id>" test/` (and a grep for a distinctive substring of the line) and every pinned substring/regex stays byte-identical. Where a pin freezes a sole-explanation id, sr-engineer adds plain words around the pinned span without altering it, or leaves the line and logs it as pinned-held.
  proof: `for s in '**Root-file completeness (E94)**' '**Existence pre-filter, mandatory (E71a)**' 'Reason (E17 forensics)' '(the E222 precedent)' 'post-E125a'; do grep -rqF -- "$s" content/ && echo "ok $s" || echo "MISSING $s"; done` prints only `ok` lines, and the full suite (AC11) is green.
- **AC5 (budget ceilings untouched)** — Given `test/context-budget.test.mjs` caps are set to exact measured values with zero headroom, when the lane finishes, then no numeric ceiling or assertion in that file has changed and the whole file passes. Rewrites in capped files (`const-*.md`, `coord-*.md`, `skill-pm.md`, `skill-sr-engineer.md`, and any other file a size test measures) must be net length-neutral or shorter after `stripOriginTags`/`stripRationale` — prefer replacing the bare id with a short phrase and dropping redundant words. If a necessary rewrite cannot fit, sr-engineer STOPs with `status: Blocked` and the lane escalates to the human via mailbox `type: escalate`; raising a ceiling is a human decision, never taken by the lane.
  proof: `node --test test/context-budget.test.mjs` exits 0, and AC9's comment-only check passes for that file.
- **AC6 (line-for-line rewrite)** — Given the Generic-citation rule wants the plain words on the same line, when the lane finishes, then every `content/` file has the same line count as at base and each changed file's diff has equal added and deleted line counts.
  proof: `git diff --numstat 58528d5 -- content/ | awk '$1!=$2{bad++; print "UNEVEN " $3} END{print "uneven=" bad+0}'` prints `uneven=0`.
- **AC7 (only id-bearing lines touched)** — Given the lane only rewords id references, when the lane finishes, then every line removed from `content/` versus base contained an id-pattern token.
  proof: `git diff -U0 58528d5 -- content/ | grep -E '^-[^-]' | grep -cvE '\b([EeDdCcBbAaRrNnFf][0-9]{1,3}[A-Za-z]?|AC[0-9]+)\b'` prints `0`.
- **AC8 (rule skeleton unchanged)** — Given the rules must not change, when the lane finishes, then for every changed `content/` file: all fenced code blocks are byte-identical to base, the multiset of inline code spans outside fences is identical, and the count of normative keywords (`MUST NOT|MUST|NEVER|FORBIDDEN|REQUIRED|SHALL|STOP|HARD|CRITICAL|ONLY`, uppercase) is identical. Any intentional exception (e.g. an id that sat inside a code span) is listed with its reason in the QA report.
  proof: the "skeleton check" command under Verification commands prints `skeleton-mismatch=0` (or only the exceptions the QA report lists).

**Test files and goldens (qa-engineer only)**

- **AC9 (test-file comments only)** — Given `test/context-budget.test.mjs` (~99 id mentions) and `test/render-structure.test.mjs` (~65), when qa-engineer rewrites their id-only comments to plain words (id kept as trailing pointer), then only comments change: test names, assertion messages, string literals, regexes and numbers are untouched, so the files with comments removed are byte-identical to base.
  proof: the "comment-only check" command under Verification commands prints `comment-only-mismatch=0`.
- **AC10 (goldens regenerated and explained)** — Given the composed prompts change with the content rewrite, when qa-engineer runs `node scripts/capture-constitution-golden.mjs`, then the regenerated `test/fixtures/compose-golden/**` files are committed, a re-run leaves the tree clean, and the QA authoring report explains each changed golden section (which content file / line produced it, and that the change is an id-reference rewording only).
  proof: `node scripts/capture-constitution-golden.mjs && git status --porcelain test/fixtures/compose-golden` prints nothing.

**Whole-suite**

- **AC11 (full suite green, clean tree, final HEAD)** — Given the lane's final commit, when the verifying qa-engineer runs the full suite on a clean working tree (no untracked or uncommitted files) wrapped in the test lock, then every test passes; the pass count is recorded with the HEAD sha.
  proof: `git status --porcelain` prints nothing, then `node scripts/test-lock.mjs -- npm test` exits 0.
- **AC12 (scope containment)** — Given the lane's ownership list, when the lane finishes, then `git diff --name-only 58528d5...HEAD` lists only paths under `content/`, `test/fixtures/compose-golden/`, `test/context-budget.test.mjs`, `test/render-structure.test.mjs`, `dist/` (rebuild-only), `specs/e233f-*`, `qa_reports/*E233F*` or the lane's `expected-red_e233f-content-ids.txt`, `review_reports/*E233F*`, `.current/e233f/`.
  proof: `git diff --name-only 58528d5...HEAD | grep -vE '^(content/|test/fixtures/compose-golden/|test/context-budget\.test\.mjs$|test/render-structure\.test\.mjs$|dist/|specs/e233f-|qa_reports/(.*E233F.*|expected-red_e233f-content-ids\.txt)$|review_reports/.*E233F|\.current/e233f/)'` prints nothing.

### Verification commands

Skeleton check (AC8), run from the worktree root:

```bash
node -e '
const {execSync}=require("child_process");const fs=require("fs");const B="58528d5";
const FENCE=/^[ \t]*```[\s\S]*?^[ \t]*```/gm;
const sig=t=>JSON.stringify({f:t.match(FENCE)||[],c:(t.replace(FENCE,"").match(/`[^`\n]+`/g)||[]).sort(),k:(t.match(/\b(MUST NOT|MUST|NEVER|FORBIDDEN|REQUIRED|SHALL|STOP|HARD|CRITICAL|ONLY)\b/g)||[]).length});
const files=execSync(`git diff --name-only ${B} -- content/`).toString().split("\n").filter(Boolean);
let bad=0;for(const f of files){const a=execSync(`git show ${B}:${f}`).toString(),b=fs.readFileSync(f,"utf8");if(sig(a)!==sig(b)){bad++;console.log("MISMATCH",f);}}
console.log("skeleton-mismatch="+bad);'
```

Comment-only check (AC9), same technique stage 1 used (TypeScript `transpileModule` with `removeComments: true`):

```bash
node -e '
const ts=require("typescript");const {execSync}=require("child_process");const fs=require("fs");const B="58528d5";
const strip=s=>ts.transpileModule(s,{compilerOptions:{removeComments:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext}}).outputText;
let bad=0;for(const f of ["test/context-budget.test.mjs","test/render-structure.test.mjs"]){if(strip(execSync(`git show ${B}:${f}`).toString())!==strip(fs.readFileSync(f,"utf8"))){bad++;console.log("MISMATCH",f);}}
console.log("comment-only-mismatch="+bad);'
```

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no new user-facing strings; rewording of existing SOP prose only, rule content unchanged |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Changing rule content, step numbering, headings' meaning, gate behaviour, code fences, code spans, error codes, YAML keys.
- Any file outside the lane's ownership list (`specs/fanout-e233.md` lane row), including other `test/**`, `templates/**`, `docs/**`, source directories, `CHANGELOG.md`, `package.json`.
- Raising any `test/context-budget.test.mjs` ceiling (human decision via mailbox `type: escalate`).
- Changing test names, assertion messages or string literals in the two owned test files (those are pinned output, not comments).
- Rewording `AC<n>` references that already sit beside plain words; general prose polish unrelated to id references.
- Release bookkeeping (version bump, CHANGELOG, backlog done-mark) — release-engineer after merge.
- New findings go to `.current/e233f/pending-tickets.md` (above `## Applied`), never fixed in place.

## Dependencies / Prerequisites
- Stage 1 lanes e233a–e233e merged to main (done, base `58528d5`).
- Non-design feature: no `design/<feature>.md`, mode = no-design; Visual Structural Assertions omitted.
- External references: none (resource audit found no URLs / design links in the requirement docs).
- Chain (builder != judge): pm → sr-engineer (T-E233F-01..03, content) → code-reviewer → qa-engineer author (T-E233F-04: two test files' comments + golden regen; writes `qa-engineer:Blocked` = authoring done) → pm (resume_of code-reviewer) → code-reviewer (reviews T-E233F-04 diff) → fresh Task-dispatched qa-engineer verifier (all ACs, full suite, PASS).
- Between sr-engineer and the golden regen the compose-golden / equivalence tests are expected red: sr-engineer records them in `qa_reports/expected-red_e233f-content-ids.txt`.
- Full-suite runs always go through `node scripts/test-lock.mjs -- npm test` (integrator cross-lane notice), final run on the final HEAD with a clean tree.
- Tracked files never carry the worktree's absolute path; refer to it as `../agent-governance-mcp-lanes/e233f` or by class.

# e258a-comment-rule

Lane e258a of the comment-length fan-out (backlog row E258, rule-prose half). Measurements, thresholds and the doc-comment shape are cited from the E258 row of `docs/backlog.md`; the boundary with the scan lane is fixed in `specs/fanout-e258.md` (Decisions R1/R2).

## Problem Statement
No constitution line limits how long or how detailed a comment may be, so agents paste spec rationale into code comments (measured in the E258 backlog row). The fix in this lane is the rule text agents load plus the reviewer check that judges scan warnings; the scan itself is a separate lane.

## User Stories
- As an agent working in an agc-managed workspace, I want one short rule on what comments say and how long doc comments run, so that I stop pasting spec prose into code.
- As a code-reviewer, I want an explicit check tied to the comment-scan warnings, so that every flagged comment is either justified or trimmed.

## Acceptance Criteria
- **AC1** — Given `content/const-15-core-tail.md`, when read, then section 6 has exactly one new bullet placed immediately after the *Generic citation* bullet and before the `## 7.` heading.
  proof: `awk '/^- \*\*Generic citation\*\*/{g=1} g&&/^- \*\*/{print NR": "substr($0,1,40)}' content/const-15-core-tail.md` lists the new bullet second.
- **AC2** — Given the new bullet, when read, then it states all of: comments say WHAT and WHY, never HOW; avoid comments inside a function body except a short warning about something non-obvious, placed at the head of the function; long rationale lives in a tracked spec/design file or the commit message with at most a one-line pointer in the comment; doc comments open with a one-sentence summary of at most 80 columns, the rest covers only what a caller needs (params, return, constraints, pitfalls); a `##` heading inside a comment marks a pasted spec and is sent back.
  proof: `node --test test/e258a-comment-rule.test.mjs` (asserts each of the five clauses by keyword).
- **AC3** — Given every constitution compose mode (lite, chain, design-armed, non-design, teamwork), when composed, then the bullet text appears in each output.
  proof: `node --test test/e258a-comment-rule.test.mjs` (composes each mode via `prompts/build.ts` and greps the bullet's lead phrase).
- **AC4** — Given the bullet, when read, then it names no governance jargon, bare ticket id or untracked path (it obeys *Generic citation* and *Information hygiene* itself) and is written in the spirit of Linux kernel coding style section 8.
  proof: `node --test test/e258a-comment-rule.test.mjs` (asserts no `tw_`, `gate`, `PASS`, or `E258` token inside the bullet).
- **AC5** — Given `content/skill-code-reviewer.md`, when read, then it carries a check item requiring the reviewer to apply the *Comment discipline* bullet to every comment the diff adds, flagged or not (the scan is a trigger, not the scope — it may not have run), and that every `agc check — comments` warning touching the diff is either kept with a one-line reason in the review report or sent back to be trimmed, and the prefix string `agc check — comments` is byte-exact (em dash U+2014, single spaces).
  proof: `grep -c 'agc check — comments' content/skill-code-reviewer.md` prints at least 1; `node --test test/e258a-comment-rule.test.mjs` asserts the bytes.
- **AC6** — Given the compose goldens, when regenerated, then `test/fixtures/compose-golden/**` matches current composer output and the golden test passes.
  proof: `node --test test/compose-golden*.test.mjs` (qa locates the exact golden test file name).
- **AC7** — Given `test/context-budget.test.mjs`, when ceilings are adjusted, then each raised ceiling equals qa's measured composed size with zero headroom, and no ceiling is raised beyond what the bullet and reviewer item require.
  proof: `node --test test/context-budget.test.mjs` passes, and lowering any raised ceiling by 1 byte makes it fail (qa records the measured values in the review evidence).
- **AC8** — Given the lane branch after commit with a clean worktree, when the full suite runs, then it is green.
  proof: `npm test` exits 0 (run after commit, no untracked files).
- **AC9** — Given the diff, when its paths are listed, then it touches only the owned paths in Dependencies (no scanner code, no user docs, no rewrite of existing comments).
  proof: `git diff --name-only <base>...HEAD` shows only owned paths.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| const15.comment-bullet | Bullet opens `- **Comment discipline**:`; sr drafts body covering the five clauses of AC2, target at most 6 lines, plain prose | authored-here — wording per human decision 2026-09-30 (Linux kernel coding style section 8 spirit), content fixed by the backlog row |
| reviewer.comments-check | "Apply the Comment discipline bullet to every comment the diff adds; each `agc check — comments` warning touching the diff is either kept with a one-line reason in the review report or sent back to be trimmed." (cite only the prefix, never the scan's categories) | authored-here — prefix string fixed by the fan-out boundary contract |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Scanner code and `agc check` output (lane e258b); user docs; `docs/backlog.md`.
- Rewriting existing comments; function-body comment detection.
- Editing `content/skill-sr-engineer.md`: decision is to keep the doc-comment format in the constitution bullet and leave the builder SOP untouched.
- Any architect hop: no interface or data-model change.

## Dependencies / Prerequisites
- Owned paths: `content/const-15-core-tail.md`, `content/skill-code-reviewer.md`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`, `test/e258a-*.test.mjs`, `specs/e258a-*`, `qa_reports/*E258A*`, `review_reports/*E258A*`, `.current/e258a/**`.
- Builder sr-engineer edits only the two `content/` files; qa-engineer owns goldens, budget and the e258a test (Constitution section 2).
- Prefix string is frozen by `specs/fanout-e258.md`; e258b emits the same string.
- External refs: none load-bearing. Visual Structural Assertions omitted: no design file, mode = no-design.

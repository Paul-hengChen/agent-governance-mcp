# QA review T-REL441-03 (release-v4.4.1, AC5 + AC6)

## AC5 behaviour-neutral
(a) TypeScript `transpileModule` with `removeComments: true` on `git show v4.4.0:<path>` vs HEAD `<path>`:
| file | dir | raw changed | result |
|---|---|---|---|
| tools/handoff-orchestrator.ts | tools | yes | IDENTICAL |
| gates/registry.ts | gates | yes | IDENTICAL |
| prompts/build.ts | prompts | yes | IDENTICAL |
| scripts/test-lock.mjs | scripts | yes | IDENTICAL |
| bin/agc-init.mjs | bin | yes | IDENTICAL |
| test/context-budget.test.mjs | test | yes | IDENTICAL |
| test/e132-lane-registry.test.mjs | test | yes | IDENTICAL |
| test/qa-flow.test.mjs | test | yes | IDENTICAL |
Bonus: all 216 changed top-level .ts/.mjs files under tools, gates, bin, scripts, prompts, lib, schema, guards, transport, test were transpiled the same way: 216 IDENTICAL, 0 DIFFER.
(b) `git diff -U0 v4.4.0..HEAD -- test/context-budget.test.mjs`: every changed line is a comment (the numeric ceilings 2100..3087 appear only in removed comment history); no non-comment line changed, so ceilings and assertions are identical.
(c) `git diff --name-only v4.4.0..HEAD -- test/fixtures content`: empty.
Verdict AC5: PASS.

## AC6 non-regression
- `node --test` on e246-mailbox-teardown, e178a-integrator-role, e259-comment-scan-brace/-hash/-limits, e258b-comment-scan: tests 87, pass 86, fail 0, skipped 1.
- `git tag -l v4.4.0` prints v4.4.0; `git rev-parse v4.4.0^{commit}` = 71d3af020270e5f26dddb9222924b26e1564f7e6 (71d3af0); `grep -n '\[4.4.0\]' CHANGELOG.md` finds line 19 `## [4.4.0] - 2026-10-01`.
Verdict AC6: PASS.

# QA Review — integ/e235-rescan (integration-time fix, no lane/feature)

Dispatched directly by the integrator on branch `integ/e235-rescan` (primary
checkout) to close three residual Information-hygiene hits (content/const-15-core-tail.md
§6) found by the integrator's post-merge full-tree rescan of lanes e235a/e235b
(backlog E235, E240). Per the E222 precedent, this is an integration-branch
evidence file: no `tw_update_state` call (no lane, no feature to write against).
The integrator owns commit/push.

## What changed

1. `qa_reports/review_T-E235B-06.md` line 62 — a grep pattern quoted in prose
   (`worktree|agm-lanes|<home-dir-prefix><account-owner-first-name>`) leaked the
   OS home-directory prefix followed by the account owner's first name. Replaced
   the leaked pattern text with a class description ("the home-directory prefix
   pattern"), leaving the surrounding sentence structure, heading, verdict line,
   and `covers:` line untouched.

2. `test/e180-abandoned-harvest.test.mjs` (~lines 514-541) and
   `test/e213-shipped-ignored-shape.test.mjs` (~lines 513-550) — fixture strings
   (lane slugs, branch names, file contents) contained the short form of an
   adopter project's name (class: internal-product-codename abbreviation, found
   via `git grep -nIiE 'vs[- _]?ndi' -- test`). Per human ruling E240=A (that
   name is sensitive), renamed every occurrence to the neutral token
   `adopter-shape`, consistently within each test file so slugs, branch names,
   and file-content assertions still match each other — the adopter short-form
   token in the lane slug, branch name, and fixture contents was renamed to
   `adopter-shape` throughout, with the surrounding `-shape` suffix and prefix
   segments preserved so each rewritten string still reads correctly. The
   literal old string was not written anywhere else (scratch files, commit
   messages, or other source) in the course of this fix.

## Test result

```
node --test test/e180-abandoned-harvest.test.mjs test/e213-shipped-ignored-shape.test.mjs
```

- `test/e180-abandoned-harvest.test.mjs`: 13/13 pass
- `test/e213-shipped-ignored-shape.test.mjs`: 17/17 pass
- Combined: **30/30 pass**, 0 fail, 0 cancelled, 0 skipped

## Rescan result

- `git grep -nIiE 'vs[- _]?ndi|ndi[- _]receiver'` — **0 hits** (clean; adopter
  codename class fully removed from the tree).
- `git grep -nIE '/Users/[a-z]'` — **8 hits**, all the generic
  `/Users/me/proj` placeholder in `test/rag-lifecycle.test.mjs` (4 lines) and
  `test/rag.test.mjs` (4 lines); no real home-directory prefixes remain.

## Verdict

PASS — both residual Information-hygiene hits removed, no behaviour change
(prose/string-only edits), full regression on the two touched test files
green, both rescan queries confirm no leaked strings remain outside the
known-safe placeholder pattern.

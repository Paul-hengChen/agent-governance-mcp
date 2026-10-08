# E268 authoring proof (T-E268-01..06, authoring part)

Feature `e268-test-comment-accuracy`. Base `f1e6eb1`. E272 = option 1 (comment-only).

## Proof script (`node .current/e268/proof.mjs`, run after the edit commit)
```
emit: 9 files, 0 differ
scope: ok
hygiene: ok
```

## Negative control
A copy of `test/qa-flow.test.mjs` in the OS temp dir (outside the worktree) had one string literal changed
(`"node:fs"` to `"node:fsX"` on the fs import). The same transpileModule(removeComments) comparison against the
BASE blob printed:
```
DIFFERS: test/qa-flow.test.mjs (copy)
```
The worktree file against the same BASE blob: same. No `git stash` used.

## Per-AC proofs
- AC1: forbidden-phrase grep on drift-skew prints nothing. AC3: `review_T-TESTS` grep prints nothing. AC5: `tools/handoff\.ts` grep on e22 prints nothing.
- AC2: manifest at archive path exists; e260e grep count 1. AC6: `U1-U13` count 1. AC7: phrase count 1. AC8: ruler widths equal (77/77). AC9: no line of the block over 118 (line 4 wrapped to 115 + 26).
- AC10: line 5 no longer names `dist/index.js` (0); `:622` banner fixed alike. AC11: e260h pointer count 1.
- AC12: comments only; table entry and delegate regex unchanged; the regex is commented as pinning the template's current text, stale Read path tracked separately.
- `node scripts/check-md-tables.mjs` exits 0.

## Individual test files (existing dist/, no rebuild), node --test
drift-skew 8/8, agc-adapters 39/39, e22-stale-notify 28/28, gates-expected-red 19/19,
e92-e86-handoff-write-boundary 142/142, lane-ticket-allocation 25/25, pixel-gate-attestation 52/52,
qa-flow 152/152, subagent-templates 18/18. Zero failures.

## Full suite: DEFERRED (not run)
Per the coordinator's brief change: the Constitution section 6 dependency audit currently blocks builds,
including the `npm test` prebuild, pending a human disposition. No build, `npm test`, audit fix or
package.json/lockfile edit was done in this hop. AC16 (full suite on clean HEAD, counts equal to BASE) is
left for the fresh verifier once the block is resolved.

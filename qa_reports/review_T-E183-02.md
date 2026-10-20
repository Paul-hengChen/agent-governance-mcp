# QA review — T-E183-02 (and T-E183-01 verification)

Round-wide logs (`## Expected-Red Diff`, `## AC Execution Log`) are in `qa_reports/review_T-E209-02.md` (`covers:` batch).

## AC to test map

| AC | test (file `test/e183-summarize-metrics-lane.test.mjs` unless noted) | result |
|---|---|---|
| AC-E183-1 | lane branch `feat/e999-x`; plus the same with a linked-worktree `.git` gitfile (`gitdir: ../<dir>`, HEAD in that dir) | green |
| AC-E183-2 | `main`, `integ/w10`, detached 40-hex HEAD -> `.current/_primary/metrics.jsonl` | green |
| AC-E183-3 | lane file absent + flat present: exit 0, stdout summary, stderr has `legacy flat` and both cwd-relative paths | green |
| AC-E183-4 | neither file: exit 1, stderr `summarize-metrics:` + `no metrics file` + both paths + `tw_gate_stats`; stdout has neither `no metrics yet` nor `aggregate` | green |
| AC-E183-5 | explicit missing path (a lane file exists and must NOT be read), explicit directory (`cannot read`, path, `EISDIR`), unreadable lane path with a flat file present exits 1 (no silent fallback); E8-S4 re-pinned in `test/success-metrics.test.mjs` | green |
| AC-E183-6 | empty lane file still exit 0 `no metrics yet`; E8-S1..S3 unmodified | green |
| AC-E183-7 | `git diff 2ad039d --name-only -- tools/ dist/` | empty |
| AC-E183-8 | `grep -n "default: .current/metrics.jsonl\|still the pre-lane flat path" docs/gate-retro-procedure.md scripts/summarize-metrics.mjs` | prints nothing |

Results: `node --test test/e183-summarize-metrics-lane.test.mjs` 11/11; `node --test test/success-metrics.test.mjs` 36/36.

## Red on base (AC-E183-4 / AC-E183-5)

Same test file with `E183_SCRIPT_UNDER_TEST=<temp copy of git show 2ad039d:scripts/summarize-metrics.mjs>` (opt-in env path, session-only): 1 pass, 10 fail. The AC-E183-4 case is red (base prints `no metrics yet`, exit 0), the AC-E183-5 missing, directory and unreadable-lane cases are red, and so are the lane/primary/flat-note cases (base reads only the flat path). Only the empty-file case (AC-E183-6) is green on base, as intended.

## E8-S4 re-pin

`test/success-metrics.test.mjs` E8-S4 now expects exit 1, stderr starting `summarize-metrics:` and containing `no metrics file at <path>`, and no `no metrics yet` on stdout. Only the E8-S4 test changed in that file. Manifest `qa_reports/expected-red_e209-test-infra-fixes.txt` kept with a DISPOSITION comment line (other features' manifests are kept in the repo as history).

## Notes

- Code-reviewer's three notes for qa are all covered: stderr fragments, cwd-relative paths, unreadable lane path with flat file present.
- Verdict: PASS for T-E183-01 (verified) and T-E183-02.

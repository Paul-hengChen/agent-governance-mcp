covers: T-E364-01, T-E364-02

# QA review — e364-audit-high-upgrade (T-E364-01, T-E364-02)

Verdict: PASS. Independent re-run on the lane worktree at HEAD 2c4153c (the only working-tree changes were `.current/e364/*` state writes). Base for diffs: ab8dfbb.

Phase 0.5: skipped (no expected-red manifest declared)
Phase 1.5: skipped (no Visual Baselines declared)
Phase 3: skipped (no test files in scope; lane forbids test/**; spec declares verification-only, no new tests warranted)
Copy / Visual audit gates: N/A (spec Copy/Strings and Visual Tokens are N/A)

## AC Execution Log

| AC | command | observed | verdict |
|---|---|---|---|
| AC1 | `npm audit --audit-level=high; echo exit=$?` | `7 vulnerabilities (1 low, 6 moderate)`, `exit=0` | PASS |
| AC2 | `npm ls zod body-parser --all` | single `zod@4.6.7` (deduped under both SDKs and zod-to-json-schema), `body-parser@2.4.0` under express@5.2.1; exit 0; no invalid/UNMET/extraneous | PASS |
| AC3 | lockfile-delta script vs `git show ab8dfbb:package-lock.json` | exactly 7 rows: root `""` (dependencies.zod floor), body-parser 2.2.2->2.4.0, iconv-lite 0.7.2->0.7.3, type-is 2.0.1->2.1.0, zod 4.4.3->4.6.7, two nested content-type (absent)->2.1.0. Root row prints 4.13.0 -> 4.13.0 because only `dependencies.zod` differs. No top-level field outside `packages` differs (TOPDIFF check empty) | PASS |
| AC4 | `git diff ab8dfbb -- package.json` | exactly one -/+ pair: `"zod": "^4.4.3"` -> `"^4.6.6"` | PASS |
| AC5 | `node scripts/test-lock.mjs -- npm test` | exit 0; tests 3691, pass 3689, fail 0, cancelled 0, skipped 2 (matches sr baseline/after) | PASS |
| AC6 | `npm run build; git status --porcelain dist/` | build exit 0; dist status output empty | PASS |
| AC7 | read `docs/dependency-advisories.md` diff | new `### 8. zod` and `### 9. body-parser`; both GHSA ids + CVE, severity/CVSS/CWE, vulnerable/fixed range, dependency path, reachability, decision upgrade with mechanism and verified result, `**Re-review trigger**` bullet in each. §9 lists the four knock-on moves and why root content-type 1.0.5 stays. Facts consistent with the spec's GHSA data (zod <4.6.6 fixed 4.6.6; body-parser 2.0.0-<2.4.0 fixed 2.4.0) | PASS |
| AC8 | doc diff vs fresh `npm audit` | heading now says 9 packages and names §8, §9; one appended dated 2026-10-28 note; its totals (7: 1 low, 6 moderate, 0 high/critical) and package list match the fresh audit; body-parser absent from the audit list. Diff has no `-` lines in the residual table or earlier notes (the only `-` line is the heading edit) | PASS |
| AC9 | `git diff --name-only ab8dfbb` | `.current/e364/{dispatch.jsonl,handoff.md,tasks.md}`, `docs/dependency-advisories.md`, `package-lock.json`, `package.json`, `review_reports/review_T-E364-01.md`, `specs/e364-audit-high-upgrade.md`; all inside the allowed scope | PASS |
| AC10 (supplementary) | `test -L node_modules; echo $?` | `1` (real directory) | PASS |

## Notes

- The GHSA pages were not re-fetched over the network; AC7 facts were cross-checked against the spec's cut-time quotation of both advisories (fetched 2026-10-28) and against live `npm audit` output.
- Code review: APPROVED (`review_reports/review_T-E364-01.md`), out of QA scope beyond this.
- Coverage gate: N/A, no source code changed.
## 2026-10-28T06:17:59.986Z — PASS — by qa-engineer

PASS. AC1-AC9 re-verified independently: audit exit 0 (7 findings, 1 low/6 moderate); zod 4.6.7 / body-parser 2.4.0 clean npm ls; lockfile delta exactly the 7 expected packages entries, no top-level change; package.json single zod floor change; full suite 3689 pass / 2 skipped / 0 fail of 3691; build exit 0 with empty dist status; advisory record sections 8/9, heading and residual note match; diff scope within allowed paths. Evidence in qa_reports/review_T-E364-01.md (covers both ids).


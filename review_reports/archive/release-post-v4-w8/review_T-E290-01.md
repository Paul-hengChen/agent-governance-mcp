# Review — T-E290-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Diff under review: `git diff a67d799...HEAD -- docs/lane-protocol.md docs/lane-protocol-addendum.md .current/.config.json qa_reports/` (commits 7c01795, 8f36344), judged against `specs/e290-lane-protocol-generic.md` at c1d0784 (unchanged at HEAD). No architecture spec (G10: architect hop skipped).
- `docs/lane-protocol.md`: 12 line rewrites, 2 deletes, 2 inserts after base line 7. Rebuilt independently from the base file plus the spec's Copy strings and Line disposition table: the result is byte-identical to HEAD.
- `docs/lane-protocol-addendum.md` (new, 35 lines, 2234 bytes) is byte-identical to the spec's `addendum.file` block plus one trailing newline.
- `.current/.config.json`: one added line (`laneProtocolAddendum`), in the same commit as the addendum (D6).
- Verdict: APPROVED. No required or recommended findings; three optional notes.

## AC Completeness
AC-E290-1 — implemented — both files exist at HEAD; `echo docs/lane-protocol-addendum.md | grep -c approval` prints `0`.
AC-E290-2 — implemented — `grep '^## ' docs/lane-protocol.md` prints the base's eight headings in order, and §7 is still last.
AC-E290-3 — implemented — none of the 14 generic needles appears in docs/lane-protocol.md, and all 14 addendum needles appear in docs/lane-protocol-addendum.md. The test file is T-E290-02's job.
AC-E290-4 — implemented — independent rebuild from the base: lp.hdr-4 (line 4), lp.hdr-insert-a/b (new lines 8–9), lp.s1-13, lp.s1-16, lp.s1-18, lp.s2-34, lp.s2-35, lp.s3-40, lp.s3-44, lp.s3-45 (only the last sentence dropped), lp.s5-93 (only the one substring changed), lp.s7-132 and lp.s7-133 all match byte for byte. Base lines 14 and 67 are gone, every other line is unchanged, and the addendum is byte-identical (+1 newline).
AC-E290-5 — implemented — `--numstat` prints `1	0	.current/.config.json`. The line sits right after `"cutApprovalAutoTier": {},`. `loadConfig(root).laneProtocolAddendum` returns `docs/lane-protocol-addendum.md`, `getConfigError(root)` returns `null`, and `schema_version` stays `2`.
AC-E290-6 — implemented — `git log --diff-filter=A` for the addendum and `git log -G laneProtocolAddendum` for the config each return the same single commit, 7c01795.
AC-E290-7 — implemented (render side; the test file is T-E290-02's) — the CLI cross-check on `test/fixtures/e177a/fanout-wave7.md` exits 0, the two-layer line appears once, and the key-unset pointer appears 0 times.
AC-E290-8 — implemented (render side) — no trimmed line of either file longer than 20 characters appears in the rendered prompt.
AC-E290-9 — implemented — 0 trimmed lines of either file equal a non-blank `PROMPT_TEMPLATE_3B` line.
AC-E290-10 — implemented — the six hard-condition files plus e294 pass 108/108 in a local run, and `git diff --quiet a67d799...HEAD -- test/` returns 0, so no test file was modified.
AC-E290-11 — out-of-task (T-E290-02) — the re-pins are qa's. Current reds are exactly e286 AC5, e286 AC6 and e329 AC-E327-2 (17 pass / 3 fail), which matches the manifest.
AC-E290-12 — implemented — `git diff a67d799...HEAD -- dist/` is empty, and `git status --porcelain dist/` is empty.
AC-E290-13 — out-of-task (T-E290-02) — the full suite runs after qa's commit. It is expected red until then.
AC-E290-14 — implemented — 0 machine-local absolute paths in the added lines of the reviewed files. The only hit in the whole-lane diff is the spec's own proof regex text, which is not a path.

## Correctness
No findings.
- Hard conditions: e178a AC11/AC14/AC15, e246, e295 AC5, e296 AC4/AC10, e177a AC7 and e289 AC-E289-6 are green, and their files are unmodified. e294 is green. `content/skill-integrator.md` sits at char offset 203 (inside 400, e178a AC15). `check --cut` appears on exactly one line (e296 AC4).
- Expected-red sampling (SOP 4a): `qa_reports/expected-red_e290-lane-protocol-generic.txt` has 3 entries, all sampled. Each names a real test, and each name exactly matches a `not ok` line from `node --test` on those two files. No other reds.
- Adopter reading without an addendum. Line 9 sets the global fallback ("repo 沒有補充檔時，照本文件的通用說法做"), and every "見補充規則" pointer still makes sense on its own:
  - line 17: `agc feature start` with no build step ("若有");
  - line 19: hazard plus "先只刪掉 symlink 本身，再安裝";
  - line 35: shared artifacts defined by property, with examples;
  - line 36: "測試檔";
  - line 41: no extra build artifacts and no extra top-level exceptions;
  - line 45: the rule is complete without the instance;
  - line 93: `node <agc 安裝位置>/scripts/fanout.mjs`, which runs with no addendum;
  - line 132: the artifacts the notice names;
  - line 133: the merge-base rule is complete.
  No leftover reference to this repo's paths: a grep for `npm`, `node `, `scripts/`, `bin/`, `.mjs`, `dist` and `Wave` finds only the `npm ci` example on line 19 and the install-root fanout call on line 93, both generic.
- Moved-rule reachability: every removed repo fact is in the addendum, and nothing was dropped.

  | base line | moved fact | addendum location |
  |---|---|---|
  | 13 + 16 | `node bin/agc-init.mjs` call | §1 bullet 1 |
  | 14 | `npm run build` in the worktree | §1 bullet 2 |
  | 18 | `rm node_modules` → `npm ci`, plus the `npm install` ban | §1 bullet 3 |
  | 34 | shared-artifact list | §2 bullet 1 |
  | 35 | `test/` | §2 bullet 2 |
  | 40 | `dist/` | §3 bullet 1 |
  | 40 | receipt as the "唯一例外" | §3 bullet 2 |
  | 44 | `check-md-tables` / E174 numbers | §3 bullet 3 |
  | 45 | e130 example | §3 bullet 4 |
  | 67 | `NEW-TICKETS.md` | §4 |
  | 93 | `node scripts/fanout.mjs` | §5 |
  | 132 | `dist/` | §7 bullet 1 |
  | 133 | comment-only proof | §7 bullet 2 |

- [optional] docs/lane-protocol.md:17 — an adopter with no addendum whose `agc` is not on PATH gets no fallback call such as `npx`. The text is spec-locked (lp.s1-16), and G6 forbids new rules here, so this belongs in a follow-up ticket if anyone wants it.

## Quality
- [optional] docs/lane-protocol.md:93 — "補充規則可指定本 repo 的呼叫方式": in a file shipped to every adopter, "本 repo" could be read as agc's own repo. It matches the existing "本 repo" usage on line 66, where it means the repo the lane runs in, and the wording is spec-locked (lp.s5-93). Kept as is.
- [optional] Same-model bias: sr-engineer and code-reviewer both ran on opus this hop. The mechanical checks (byte rebuild, needles, tests) do not depend on the model.
- Comment check (SOP 4b): the diff is docs and config only and adds no code comments. N/A.

## Architecture
No architecture spec exists (G10). The change follows the spec's two-layer design (G1 classification, G4 fill-never-override, G5 section keying). The config key uses E289's shipped `laneProtocolAddendum` with no schema bump (G8). No `tools/**` or `dist/` change (G11).

## Security
No findings. No secrets, credentials or machine-local paths in any reviewed file (Constitution §6). The addendum's E-number and Wave 5 count references are project provenance, not sensitive data. The config value is a repo-relative path that the existing E289 loader resolves. No new trust boundary.

## Performance
No findings. Docs and one config line only; no runtime code path changes.

## Verdict
APPROVED — the generic file and addendum match the spec byte for byte, every hard condition is green and unmodified, the only reds are the three manifested pins owned by T-E290-02, and the generic text reads correctly without an addendum while every moved rule stays reachable through it.

# Review — T-E284-01 (lane e284, e284-fanout-handoff-command)

covers: T-E331-01, T-E332-01, T-E330-01, T-E284-01, T-E284-02

## Round 1 — APPROVED — by code-reviewer

Diff: `git diff 2a3e3b3..HEAD` (sr commits b0e77ec E331, f0517fd E332, 670d489 E330, a1af4ff E284; 86e18fc is a state commit). Contract: `specs/e284-fanout-handoff-command.md` (human-approved cut, rulings R1 = (a), R2 = (a)). No architecture spec exists (the spec records "No architect hop"). T-E333-01 is qa-only and not part of this review. Model note: sr-engineer ran on opus and so did this review, so the two passes may share blind spots (same-model bias flagged per SOP). The independent fixture runs below are the counterweight.

## Summary
- E331: `rangePaths` and `checkLane` now run their `git diff <a>...<b>` through `diffNames`. A failed diff becomes an input error with the code `GIT_DIFF_FAILED` (exit 2, git's first stderr line, no stack trace). No other exit path changed.
- E332: the handoff absolute-path detector is now built from `PATH_BOUNDARY` / `PATH_START` / `PATH_FORMS`. It adds ASCII `:` `,` `|`, a bold-opener `**`, `file:///`, `$HOME/` / `${HOME}/` and UNC. The tilde form is narrowed so `~10/17` is no longer a hit.
- E330: `USAGE` gains the owners and handoff continuation lines, both derived from `OWNERS_USAGE` / `HANDOFF_USAGE`. The `scripts/fanout.mjs` header comment is updated per D4.
- E284: a new `tools/fanout-handoff.ts` adds fact collection (ten D2 keys), section rendering, `--closing` (R2) and `--check` (key-by-key compare, R1/R2 `MOVED`, `DIFF`, summary, exit 0/1/2). It is routed from `scripts/fanout.mjs` by a lazy import. `fanout-manifest.ts` gains exports only; `HANDOFF_SECTION` / `HANDOFF_SUBITEMS` names and values are unchanged.
- Verdict: APPROVED. No required findings; two recommended and five optional findings follow, plus a ruling on sr judgement call (a).

Independent verification (fixtures under `$TMPDIR`, scripts in the session scratchpad, no repo writes):
- `dist/` is in sync. A fresh `tsc --outDir <tmp>` build is byte-identical to the committed `dist/tools/fanout-handoff.{js,d.ts}`, `fanout-manifest.{js,d.ts}` and `lane-status.js`.
- Targeted suites (e177a, e177b, e178a, e178b, e235b, e248, e283, e296, e316, e322, error-code-contract): 226/228 pass. The two failures are exactly the two entries of `qa_reports/expected-red_e284-fanout-handoff-command.txt`. Both entries were sampled: each names a real, locatable test (`test/e296-manifest-tier.test.mjs` AC12, `test/e322-owners.test.mjs` AC-E322-9). Both are D4 re-pins owned by qa.
- Validate sweep, in-process, base `dist` (extracted from 2a3e3b3) vs lane `dist`, over every `specs/fanout-*.md`: the error arrays are identical for all files (0 diffs) (AC-E332-3).
- E332 probes: all nine AC-E332-1 lines are a hit on head and none were a hit on base, except `| /opt/a/b |`, which already was. Every AC-E332-2 line is a non-hit on head, and `~10/17` / `（~10/17）` / `約 ~10/17 完成` were hits on base.
- Generate fixture (primary on `main` = `origin/main`, two lane worktrees, a mailbox with 2 + 1 messages):
  - exit 0 and the exact D2 skeleton;
  - relative `../lanes/a` paths, the `formatRearmCommand`-shaped `watch baseline`, and `未 push 的 commit：feat/a 1`;
  - no substring of the temp root on stdout;
  - HEAD, porcelain status, branch list, remote refs and the manifest are unchanged after the run;
  - the pasted section `validate`s 0 on the non-closed manifest, and the closed manifest with background facts gets `HANDOFF_BACKGROUND_NOT_NONE`.
- `--check` on that fixture:
  - clean → only the summary line, exit 0;
  - replacing the placeholders and adding prose still gives exit 0;
  - a new mailbox message plus an untracked file → one DIFF per key (`git status`, `信箱`, `watch baseline`), exit 1.
- R2 round trip (primary readable, on `integ/fx`):
  - the plain snapshot names `integ/fx`;
  - `--closing` writes `primary（main ← integ/fx @ <sha7>）`, `commits 0` and `無`, and the closed manifest validates 0;
  - after a `--no-ff` merge, a push, switching to `main` and deleting the branch: 3 MOVED (`目標分支`, `worktree`, `lane-status`), 0 DIFF, exit 0;
  - unmerged: `worktree` / `lane-status` DIFF (plus the still-existing integration-branch facts), exit 1;
  - primary `active_feature` changed after the merge: `lane-status` DIFF and `worktree` MOVED, exit 1.
- R1: a forward move gives `MOVED … （前進 1 個 commit）` with exit 0; a non-ancestor gives a DIFF with exit 1.
- Errors, each exit 2 with no stack-trace line:
  - `HANDOFF_FACT_DUPLICATE`, `HANDOFF_SECTION_DUPLICATE` and `HANDOFF_SECTION_ABSENT`;
  - `--closing` together with `--check`: USAGE plus `HANDOFF_USAGE`;
  - a bad `--target` and an option-shaped `--target --upload-pack=x`: `REF_NOT_FOUND`;
  - `--repo` outside git: `REPO_NOT_GIT`.
- E331: `owners --range main...o` against an orphan branch gives exit 2 and `GIT_DIFF_FAILED: git diff main...o failed in <repo>: fatal: main...o: no merge base`, with no stack trace.

## AC Completeness
- AC-E284-1 — implemented — `tools/fanout-handoff.ts:218-361` (collection) and `:385-400` (render). Fixture-verified.
- AC-E284-2 — implemented — `:398` writes `無` only when no background key is present. Fixture-verified: validate 0, `HANDOFF_BACKGROUND_NOT_NONE` and the non-closed 0.
- AC-E284-3 — implemented — `:263-275` (the four relations plus `origin/<t> 不存在`) and `:231-233` (`REF_NOT_FOUND`).
- AC-E284-4 — implemented — `:277-287` (manifest excluded), `:294` (`［別的清單］`), `:304-305` (no row for a foreign lane) and `:346` (watch-lock → `監看`).
- AC-E284-5 — implemented — `:255-258` (annotation only when `--closing` and primary is on the integration branch), `:293`, `:306`, `:312` (`commits 0`), and `:321` / `:328` (omissions); `:577` is the `--closing` + `--check` usage error. Fixture-verified.
- AC-E284-6 — implemented — `:313-315` plus the manifest exclusion. See the judgement-call ruling (a) under Architecture.
- AC-E284-7 — implemented — `:505-528`: one DIFF per key, `（缺）` for an absent side.
- AC-E284-8 — implemented — `:477-484`: a strict ancestor gives MOVED with the count; a non-ancestor or unknown sha gives a DIFF.
- AC-E284-9 — implemented — `:409-457`, `:582-584` (Lanes/row errors) and `:600` (MANIFEST_UNREADABLE). `HandoffFailure` is caught at `:625-627`.
- AC-E284-10 — implemented — no `fs.write*`, no fetch, every git call read-only through argv (`:104-106`); `:244` adds the no-mailbox note. One caveat is optional finding O3.
- AC-E284-11 — implemented — `:73-88` are character-for-character the script's `watchLockPath` / `shellQuote` / `formatRearmCommand` with the default deadline and interval, minus the prefix.
- AC-E284-12 — implemented — `:485-492` covers all three R2 conditions (primary on target, sha ancestor-or-equal, rest of line equal after substitution). Fixture-verified in both directions.
- AC-E331-1 — implemented — `tools/fanout-manifest.ts:1291-1296` and `:1844-1845`.
- AC-E331-2 — implemented — `tools/fanout-manifest.ts:1339-1340`.
- AC-E331-3 — implemented — the existing suites pass apart from the two declared re-pins; the ls-tree probe is unchanged.
- AC-E330-1 — implemented — `tools/fanout-manifest.ts:166-182`: 5 continuation lines, with `usage.owners` / `usage.handoff` byte-identical to Copy. The `scripts/fanout.mjs:1-11` header follows D4.
- AC-E332-1 — implemented — `tools/fanout-manifest.ts:772-802`. Probe-verified.
- AC-E332-2 — implemented — the same lines. Probe-verified, and the e283 suite passes.
- AC-E332-3 — implemented — the in-process sweep finds 0 differences against the base.
- AC-HC-1 — implemented (code inspection) — no render code path changed; the `fanout-manifest.ts` diff touches only exports, USAGE, the path regex, `findHandoffSections` (an equivalent extraction) and `diffNames`. The byte-identity run is qa's.
- AC-HC-2 — implemented — `git diff 2a3e3b3..HEAD` lists neither `tools/lane-status.ts`, `scripts/mailbox-watch.mjs` nor `dist/tools/lane-status.*`.
- AC-HC-3 — qa scope (full suite at final HEAD).
- AC-E333-1 — not in this review (T-E333-01 is qa-only).

## Correctness
No required findings.

- **recommended — R-1, a non-ASCII manifest path is not excluded from `git status`.** `tools/fanout-handoff.ts:279-286` compares porcelain paths with `manifestRel` and `"${manifestRel}"`. By default (`core.quotePath=true`) git writes a non-ASCII path as an octal-escaped quoted string (verified: `?? "specs/fanout-\346\263\242\346\254\241.md"`), so a manifest with a non-ASCII name stays in the `git status` fact, and the primary row turns dirty once the section is pasted. AC-E284-6 then fails for such a manifest. Every existing manifest name is ASCII, so this is not blocking. Fix: run the status with `-c core.quotePath=false` (or `-z` and split on NUL).
- **optional — O-1, the manifest exclusion misses a collapsed untracked directory.** When the manifest is untracked inside an otherwise untracked directory, porcelain shows `?? dir/` and the exclusion at `:282-286` does not match. The generated and re-collected values agree, so this causes no false DIFF; the fact just lists one entry that comes only from the manifest. It does not happen in this repo, where `specs/` is tracked.
- **optional — O-2, `integrationBranchOf` (`:184-187`) takes `\S+` after `integration branch:`.** On older manifests this captures fullwidth trailing text (for example `integ/e233a（第一段…`) or a prose placeholder (`每條`). Such a name never resolves locally, so it is harmless; noted only for anyone who later relies on this helper.

Judgement calls (d)–(f): (d) treating a `--target` that starts with `-` or contains whitespace as `REF_NOT_FOUND` is a sound guard against option injection into `rev-parse` (verified with `--upload-pack=x`). (e) Skipping `.` / `..` lane ids before `path.join` is a correct containment guard. (f) Counting a key as checked when it is present on either side matches "absent equals absent". Accepted.

## Quality
- **recommended — R-2, an inaccurate comment.** `tools/fanout-handoff.ts:35` says "four primary checks", but `HANDOFF_PRIMARY_KEYS` has five keys (D2: five primary plus five background, ten in all). Make it "five".
- **optional — O-4, a vague doc comment.** `runHandoff`'s doc comment at `tools/fanout-handoff.ts:590-591` says "a missing, duplicated or ambiguous section". "Ambiguous" presumably means `HANDOFF_FACT_DUPLICATE`; naming it would be clearer.
- **optional — O-5, duplicated helpers.** `inputErr`, `git` / `GIT_MAX_BUFFER` and a CLI `fail` are re-declared in `tools/fanout-handoff.ts:92-106` and `:532-534` instead of being exported from `fanout-manifest.ts`. This is acceptable: the owned-file boundary keeps `fanout-manifest.ts` export-only, and the copies are small.

Comment check (Constitution §6): every comment the diff adds states the why or the contract (the parity rationale at `:67-70`, the manifest-exclusion reason at `:277` and `:313-314`, and the lazy-import reason in `scripts/fanout.mjs`), apart from R-2's factual slip. No history narration. Info hygiene: no machine-local path, user name or host appears in any added code, comment or committed state line. The only absolute-looking literal is the generic `C:\` in the regex doc comment (`tools/fanout-manifest.ts:788`).

Judgement call (c): writing an absent side as `handoff「（缺）」` is exactly the Copy `handoff.check.diff` rule. Accepted.

## Architecture
- The module boundary follows D1. `fanout-handoff.ts` only consumes exports from `fanout-manifest.ts` and `lane-status.ts` (the existing `LANE_TO_INTEGRATOR_FILE`, `computeLaneStatus` and `parseMailboxHeaders`). No manifest logic goes into `lane-status.ts`. The two mailbox-watch re-derivations carry the parity note the spec asks for.
- Judgement call (b), lazy `import()` of the handoff module in `scripts/fanout.mjs`: accepted. The wrapper stays thin, and the other subcommands' import graph (and so their output) is unchanged.
- **Judgement call (a), ruling: ACCEPTED as an in-scope deviation; recorded here.** Spec D2 says the `lane-status` row comes "From `computeLaneStatus(...)`", which would make primary's clean/dirty value lane-status's own `git status --porcelain` count. The implementation (`tools/fanout-handoff.ts:313-315`) instead takes primary's clean/dirty from the `git status` fact, which leaves the manifest out per D2.
  - Without this, pasting the section dirties the manifest. That flips the primary row to `dirty`, so `--check` would DIFF on `lane-status` straight after a paste, and AC-E284-6 (an acceptance criterion, which outranks a derived-field sentence) could never hold for a manifest that lives in primary.
  - The deviation applies D2's own exclusion rule to the one other fact that reads primary's working-tree state. It is limited to the primary row: lane rows still use lane-status's value. It is documented by an inline comment.
  - Consequence: if the manifest is primary's only change, the `lane-status` CLI says dirty while the handoff says clean. That is the intended reading.
  - The integrator's advisory view (same rule as D2, in scope, no PM re-entry) agrees; this ruling was reached independently from the spec and the AC.
  - Optional follow-up for the integrator or doc pass: add one sentence to D2 so the spec text matches.
- Hard conditions: `HANDOFF_SECTION` / `HANDOFF_SUBITEMS` are unchanged (lane e329's imports are safe). `tools/lane-status.ts` and `scripts/mailbox-watch.mjs` are untouched. Scope stays within the owned file set (`tools/fanout-manifest.ts`, `tools/fanout-handoff.ts`, their `dist/` outputs, `scripts/fanout.mjs`, the expected-red manifest, plus the lane's own `.current/e284/` state).

## Security
No findings.
- Every git call uses `execFileSync` with an argv array and no shell (`tools/fanout-handoff.ts:104-106`).
- User-controlled refs are guarded: `--target` is rejected when option-shaped, and the shas parsed back from the handoff (`TARGET_FACT_RE`, `CLOSING_RE`) are hex-only, so a hand-edited handoff cannot inject a git option.
- Mailbox reads are confined to `<root>/<lane>/` with the `.` / `..` guard.
- The unreadable lane-status reason, which can contain an absolute path, is never echoed (verified: the row reads only `unreadable`).
- No absolute path enters the generated section: paths are made relative to primary or written as `<非相對路徑>`.
- `GIT_DIFF_FAILED` and `REPO_NOT_GIT` messages carry the repo path on stderr. That is the Copy `diff.err` shape the spec mandates and matches the existing `REF_NOT_FOUND` messages.

## Performance
No findings.
- `handoff` makes O(lanes + candidate branches) git calls plus one `computeLaneStatus`, and runs only when an integrator invokes it.
- The `--check` MOVED path adds at most three git calls per differing key.
- `diffNames` adds no extra git call to `owners` / `check`.
- The new path regex is a single alternation with bounded classes and no nested quantifiers, so there is no backtracking hazard.
- **optional — O-3, possible index refresh.** `computeLaneStatus` (unchanged, D1-mandated reuse) runs `git status --porcelain` without `--no-optional-locks`, so git may opportunistically refresh `.git/index` in each worktree during `handoff`. AC-E284-10's checked set (HEAD, porcelain, branches, remote refs, the manifest and the mailbox) is unaffected. Noted only against the "writes no file" wording in D1; a fix would belong in `lane-status.ts`, outside this lane.

## Verdict
APPROVED. Every in-scope AC is implemented and independently confirmed on fixtures, the lane hard conditions hold, and no finding is `required`. R-1 (quotePath) and R-2 (comment count) are recommended follow-ups.

Out-of-scope finding filed as a `pending-ticket` in `.current/e284/pending-tickets.md`: with the D5 bold-opener rule, a code-span glob such as `` `**/node_modules/x` `` (or `see **/src/a`) in a handoff section is reported as `HANDOFF_ABSOLUTE_PATH`. The implementation follows the spec; the gap is in the rule itself.

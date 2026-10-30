# Review — T-E386-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- `tools/fanout-handoff.ts` `runHandoff`: `handoff --check` without `--target` now takes the target from the written `目標分支` fact (`TARGET_FACT_RE` group 1), and falls back to `main` when the fact is absent or does not parse. Generate and `--closing` keep the `main` default.
- New optional `HandoffOptions.targetSource` (`flag` / `manifest` / `default`) selects the `REF_NOT_FOUND` copy in `collectFacts`. `err.target-flag` is byte-identical to base (base line 253 compared with HEAD line 269).
- `dist/tools/fanout-handoff.{js,d.ts}` are byte-identical to a fresh `tsc` build of HEAD. Handoff suites e284/e285/e283/e292/e339 pass unmodified (131/131 together with the two visual suites).
- Verdict: APPROVED, with optional findings only.
- Same-model note: this review ran on opus, the same tier sr-engineer was pinned to. Same-model bias is possible; ad-hoc fixtures below exercised every copy branch.

## AC Completeness
AC-E386-1 — implemented — tools/fanout-handoff.ts:768-770 (temp primary with only `develop`, section generated with `--target develop`, `--check` without `--target`: exit 0, `0 differ`, no `REF_NOT_FOUND`).
AC-E386-2 — implemented — `movedReason` now sees `c.target === "develop"` (after one more commit: `MOVED 目標分支 …（前進 1 個 commit）`, exit 0).
AC-E386-3 — implemented — tools/fanout-handoff.ts:768-770 plus 266-267 (a placeholder `<待填：x>` value falls back to the default; in a repo without `main` this gives exit 2 with `err.target-default`, byte-identical to the Copy table).
AC-E386-4 — implemented — tools/fanout-handoff.ts:264-265 (recorded `gone-branch` gives exit 2 with `err.target-recorded`, which names the branch and `--target`; byte-matched against the Copy table).
AC-E386-5 — implemented — tools/fanout-handoff.ts:268 (`--target nope` / `--target ""` give exactly `--target "<x>" does not resolve to a commit (git rev-parse --verify)`).
AC-E386-6 — implemented — generate and `--closing` with no `--target` in a repo without `main` give exit 2 with `err.target-default`.
AC-E386-7 — implemented — the existing handoff suites pass unmodified.

The new test file (`test/e386-handoff-recorded-target.test.mjs`) is QA scope (T-E386-02). The ACs above were verified with an ad-hoc temp-repo probe.

## Correctness
No required findings. Two judgement calls from the brief:
- `err.target-recorded` ends with a literal `--target <branch>` placeholder: acceptable. The Copy table substitutes the first `"<branch>"` (the recorded name, quoted). The trailing `pass --target <branch> to check against another branch` describes a different branch, so substituting the recorded, unresolvable name there would make no sense. The placeholder reading is the only coherent one, and it matches the literal `--target <branch>` in `err.target-default`.
- A recorded `main @ <sha>` that does not resolve gives `err.target-recorded`, not `err.target-default`: correct. AC-E386-3 limits `err.target-default` to "a section without a 目標分支 fact line, or one whose value does not match `<branch> @ <sha>`". A parseable recorded `main` is a manifest-sourced target, and the message (that the manifest recorded it) is true.
- A recorded value that starts with `-` or contains whitespace is still blocked by the existing guard (line 261) before `rev-parse`, and reports `err.target-recorded`. There is no option-injection path.
- [optional] tools/fanout-handoff.ts:266-267: `err.target-default` hardcodes `"main"` and does not interpolate `target`. The exported `collectFacts` combines `opts.targetSource: "default"` with whatever `opts.target` is, so an outside caller passing `{ target: "x", targetSource: "default" }` would get a message naming `main`. The only in-repo caller (line 773) is consistent. If the copy is touched again, interpolate `target` or derive the source internally.
- [optional, spec-level] In generate / `--closing` mode, `err.target-default` says "the manifest records no target branch" even when a section exists, because generate never reads it. The text is mandated by AC-E386-6 and the Copy table, so this is not a code defect. Noted for the copy owner.

## Quality
No findings. The `HandoffOptions` doc comments are short and state WHAT; the 2-line in-body comment at line 766 states WHY. Names match the surrounding code.

## Architecture
No architecture spec. Target resolution stays in `runHandoff` (the CLI layer), and `collectFacts` only picks message copy. Generate mode is untouched, as Decisions requires. `tools/fanout-manifest.ts` is unchanged (`checkLane` `--base` is filed as `E386-NEW-1`).

## Security
No findings. The recorded branch comes from the manifest under check and is used only as a `rev-parse --verify` argument through `execFileSync` (no shell), behind the existing `-` and whitespace guard. It is echoed in the error as a branch name, not a local path.

## Performance
No findings. One extra regex exec on `--check`; no added git calls.

## Verdict
APPROVED — recorded-target resolution is confined to `--check` without `--target`, falls back to `main`, and every `REF_NOT_FOUND` copy matches the Copy table byte for byte, with `err.target-flag` unchanged.

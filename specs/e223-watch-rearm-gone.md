# e223-watch-rearm-gone

Ticket **E223** (filed by lane `e178b` as `E178B-NEW-1`). Lane `e223`, branch `feat/e223-watch-rearm-gone` @ base `3c72a83`. v4 Wave 7.2b, runs in parallel with lane `e178a` (human decision D9, `specs/fanout-wave7.2b.md`). Task ids use `T-E223-NN`.

## Problem Statement
`lane-status --watch` re-arms at its deadline by printing a command whose `--baseline <lane>=<fp>,...` names every lane the watch last read. In the default watch set (no `--lanes`, so every worktree is watched), a lane whose worktree is removed between one watch's expiry and the re-arm leaves a key in `--baseline` that names no watched lane. Under e178b AC5 that is a usage error, so the printed re-arm command exits 64 instead of reporting the closed lane, and the integrator has to delete the key by hand. In the default set, an unknown baseline key means "this lane closed since the last watch", and the watch should report it that way.

## User Stories
- As the integrator, I want a re-arm command printed by the previous watch to keep working after a lane's worktree is removed, so that closing a lane never breaks the monitor loop.
- As the integrator, I want a lane that closed between two watches to be reported as `[<lane>] gone`, so that no close event is lost across a re-arm.
- As the integrator, I want a mistyped key under `--lanes` to stay a usage error, so that typos are still caught.

## Decisions
- **(a) Default set only.** Only the default watch set (no `--lanes`) changes. On start, a `--baseline` key that names no lane in the current list is a lane that closed since the last watch. It is not an error. Under `--lanes`, an unknown key stays exit 64: absent named lanes are already kept in the watched set, so an unknown key there can only be a typo.
- **(b) Validation is unchanged and runs first.** The whole `--baseline` value is still parsed before anything is printed. A malformed entry, a bad fingerprint, a repeated key (including a repeated gone key) and an empty value (no entries, e.g. `,`) are still exit 64 with a `lane-status:` message and empty stdout. A value whose entries are all well-formed but all gone is **not** empty: the watch starts.
- **(c) Output order.** The `armed:` line comes first. Next come the start lines for the watched lanes (`baseline:`, `changed since last watch:`, or `gone`), exactly as before. Then there is one `[<lane>] gone` line per gone baseline key, in the order the keys appear in `--baseline`. The watched-lane block does not move, so the existing AC1 and AC5 line positions still hold.
- **(d) Not counted.** Gone keys are not in the watched set. `armed: watching <N> lane(s)` counts only the lanes in the current list.
- **(e) Not carried.** Gone keys are not tracked after start. They do not appear in the next re-arm `--baseline`, so each closed lane is reported `gone` once and the next re-arm command stays valid. If no watched lanes remain, the re-arm command has no `--baseline` (unchanged e178b behaviour: an empty baseline is a usage error).
- **(f) Matching.** In the default set, a baseline key is known only if it exactly equals a worktree basename in the current list, the same comparison as today. No case folding is added.
- **(g) Supersedes e178b AC5 for the default set.** The sentence "A baseline key that names no watched lane ... is a usage error (exit 64)" in `specs/e178b-lane-watch-tooling.md` AC5 now applies only under `--lanes`. That spec is not edited, and this spec is the authority for the default set.

## Acceptance Criteria
- **AC1** — Given the default watch set (no `--lanes`) and a `--baseline` naming one lane that is in the list and one (`zeta`) that is not, when the watch starts, then it does not exit 64. It prints `armed: watching <N> lane(s) — ...` with N equal to the lanes in the current list, then the watched lanes' start lines, then `[zeta] gone` as the last start line.
  proof: `node --test test/e223-watch-rearm-gone.test.mjs` (test "AC1 gone key on start in the default set").
- **AC2** — Given several gone keys in the default set, then one `[<lane>] gone` line is printed per gone key, after every watched-lane start line, in `--baseline` order. Each gone key is printed exactly once.
  proof: `node --test test/e223-watch-rearm-gone.test.mjs` (test "AC2 gone ordering").
- **AC3** — Given a watch started with a gone key, when it reaches its deadline, then the re-arm `--baseline` has no gone key and the process exits 3. Fed back in with the world unchanged, that command prints zero `gone` and zero `changed since last watch` lines. Given a baseline whose entries are all gone and an empty lane list, then the watch starts with `armed: watching 0 lane(s)`, prints the gone lines, and re-arms with no `--baseline`.
  proof: `node --test test/e223-watch-rearm-gone.test.mjs` (test "AC3 gone keys are not carried").
- **AC4** — Given `--lanes a,b` and a `--baseline` key that names neither, then the CLI still exits 64 with a `lane-status:` message and empty stdout.
  proof: `node --test test/e223-watch-rearm-gone.test.mjs` (test "AC4 --lanes unknown key stays a usage error").
- **AC5** — Given the default set, then a malformed entry, a bad fingerprint (non-hex, uppercase, wrong length), a repeated key (known or gone), or an empty baseline (`,`) still exits 64 with a `lane-status:` message and empty stdout.
  proof: `node --test test/e178b-lane-watch.test.mjs` (test "AC5 re-arm round trip"). Its usage-error loop is updated so that `zeta=<fp>` moves from the exit-64 list to an "is gone" assertion, and `zeta=<fp>,zeta=<fp>` is added to the exit-64 list.
- **AC6** — Given the whole suite, then `npm test` passes and `dist/tools/lane-status.*` is rebuilt from `tools/lane-status.ts` (`npm run build` leaves no diff).
  proof: `cd <lanes-root>/e223 && npm run build && git status --porcelain dist/ && npm test`. The command prints nothing from `git status` and the tests pass.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| watch.gone | `[<lane>] gone` | e178b spec Copy/Strings `watch.gone` (reused unchanged) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Any other watch semantics (tick loop, mid-watch `gone`/`appeared`, fingerprints, exit codes other than the one above).
- `--lanes` unknown-key behaviour.
- `scripts/mailbox-watch.mjs`, `scripts/lane-status.mjs` (no change expected; the wrapper already forwards argv).
- Any SOP prose, `docs/**`, and editing `specs/e178b-lane-watch-tooling.md`.

## Dependencies / Prerequisites
- e178b shipped (`--watch` tooling on base `3c72a83`).
- Owned files per `specs/fanout-wave7.2b.md` row e223. Resource Audit: the backlog row has no external references, so there is no `external_refs` entry. Visual Structural Assertions are omitted: there is no `design/<feature>.md`, mode = no-design.
- Human decisions D8 (`sr-engineer=fable`) and D9 (lane split) come from `specs/fanout-wave7.2b.md`.

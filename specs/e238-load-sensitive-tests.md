# e238-load-sensitive-tests

## Problem Statement
Six test sites in the full suite tie their pass/fail outcome to wall-clock time, machine load, or a live session's hook marker in the developer's primary workspace, instead of to the behaviour they pin. `main` is branch-protected and merges and releases go through CI. So one load-induced red blocks auto-merge, or forces an expected-red manifest for a test the change never touched. E238 is the parent ticket of this false-red family. It absorbs the sites of E254, E257, E278 and E378, and takes E348 and E363 in the same lane. This is a test-only ticket: each site is replaced with a deterministic signal that still proves what the original assertion was there to prove. No product code, SOP prose or flake-rule list changes.

## Sources
- `docs/backlog.md` row E238: the "Scope ruled 2026-11-09 (triage)" paragraph is the cut basis. The "Original row:" text is history only.
- `docs/backlog.md` closed rows E254, E257, E278, E348, E363, E378 for per-site detail.
- `specs/fanout-backlog-wave-a.md`: the `e238` Lanes row, "所有 lane 共通的範圍" (scope shared by all lanes), and Decisions ruling 4 = a (chain shape).
- Code read to confirm each replacement (read-only, not touched): `tools/lane-registry.ts` (`getLaneRegistrySummary`, `opts.timeoutMs`, default 200), `tools/feature-rollup.ts` (`localFallbackLaneList`: the timeout bounds only `git worktree list`), `tools/handoff-parse.ts` (`readHandoffState` calls `getLaneRegistrySummary(workspacePath)` with no options), `index.ts` (`resolveWorkspacePath` prefers the `workspace_path` prompt argument; `hookMarkerFresh` reads `<ws>/.current/.agc-hook-marker.json` with a 2-minute window), `gates/feature-lease.ts` (`isFeatureLeaseHeld`: `ageMs >= 0 && ageMs < ttl`), `gates/lease-override.ts` (the classifier runs only inside the lease-held branch), `test/e148-seed-stamp.mjs` (`nonSuspectStampAt`), `scripts/mailbox-watch.mjs` (`runWatch` reads `io.now` / `io.sleep`, both injectable).

## User Stories
- As an integrator merging lane branches, I want a full-suite red to mean a real regression, so that machine load from a parallel lane never blocks auto-merge or forces an expected-red file.
- As a developer with live agent sessions open in the primary workspace, I want the suite's outcome not to depend on whether a session started there in the last two minutes, so that a green suite is reproducible.

## Acceptance Criteria
Line numbers were re-verified against the lane base (`2425e04`). Each AC names the invariant the test must keep.

- **AC1** (site 1, E238 original, T-E238-01). Given `test/verify-release.test.mjs` VR-22 (case at lines 935-959, bound at line 958). When the test runs, then it asserts no wall-clock bound: the `start` / `elapsedMs` timing and `assert.ok(elapsedMs < 5000, ...)` are removed. The exit-0, WARN-text and `gh`-call-counter `=== "1"` assertions stay unchanged. Invariant kept: with `AGC_VERIFY_CI_WAIT_SECONDS=0` the script calls `gh` exactly once and never enters the poll loop. The counter is the proof of "no poll sleep", as the block comment above the case already says. The test name stays byte-identical.
  proof: `node --test --test-name-pattern="VR-22" test/verify-release.test.mjs` passes, and `grep -n "elapsedMs < 5000" test/verify-release.test.mjs` prints nothing.

- **AC2a** (site 2, gap-6, E254, T-E238-02). Given `test/e132-lane-registry.test.mjs` gap-6 (case at lines 330-378, timing block at 354-377). When the test runs, then:
  - each `getLaneRegistrySummary` call passes an explicit generous `opts.timeoutMs` (for example `30_000`), so the 200 ms git ceiling can no longer null the result under load. This seam already exists and is documented as a test-only knob.
  - the min-of-3 wall-clock comparison `minLarge > minSmall` is replaced by a count of the work done. The 15-lane result carries exactly 15 lanes, and the set of their `active_feature` values equals `{gap6-large-0 .. gap6-large-14}`. The 2-lane result carries exactly `{gap6-small-0, gap6-small-1}`.
  - the 8000-entry `PADDING_TASKS` fixture existed only to widen the timing gap. QA may drop it.

  Invariant kept: the summary performs one full `parseHandoff` read per sibling lane, on top of the single git call that the timeout bounds. The read count scales with the number of lanes; it is not flat. This is the count form E254 asked for ("assert the additive work by count (reads performed)"). The test name stays byte-identical.
  proof: `node --test --test-name-pattern="gap-6" test/e132-lane-registry.test.mjs` passes, and `grep -n "minLarge > minSmall" test/e132-lane-registry.test.mjs` prints nothing.

- **AC2b** (site 2, gap-7, E348, T-E238-02). Given `test/e132-lane-registry.test.mjs` gap-7 (lines 284-305). The case calls `readHandoffState`, which calls `getLaneRegistrySummary(workspacePath)` with the product's fixed 200 ms default, and no `timeoutMs` reaches it without a product change (see Dependencies, finding F1). When the test runs, then each `readHandoffState` call goes through a bounded, load-tolerant helper that stays strict on regressions:
  - The helper makes up to 5 attempts and times each one.
  - A result that carries `lane_registry` is returned at once.
  - A result without `lane_registry` that took less than 200 ms is returned at once. The ceiling cannot have fired, so the missing key is a real missing spread and the case's assertions fail.
  - Only a result without the key that took 200 ms or more counts as inconclusive (a possible ceiling trip) and is retried.
  - After 5 inconclusive attempts the last result is returned, and the assertions fail with a message that names the ceiling.

  Invariant kept: both `readHandoffState` return paths (the `exists:false` early return and the `exists:true` final return) spread `lane_registry` with 2 lanes. A regression that drops either spread still fails on every run. The test name stays byte-identical.
  proof: `node --test --test-name-pattern="gap-7" test/e132-lane-registry.test.mjs` passes.

- **AC3** (site 3, E257, T-E238-03). Given `test/teamwork-lite.test.mjs` AC3b (lines 129-143), which passes `workspace_path: PROJECT_ROOT` to `prompts/get`, so the handler's `hookMarkerFresh` reads the repo's own `.current/.agc-hook-marker.json`. When the test runs, then it passes an isolated temp workspace instead: `fs.mkdtempSync` under `os.tmpdir()` with a `.current/` subdirectory and no marker file, removed in `t.after`. `resolveWorkspacePath` prefers the `workspace_path` argument over `CLAUDE_PROJECT_DIR` and `cwd`. Prompt content is loaded from the server root, not the workspace; the existing "Boundary" case in the same file shows that. Invariant kept: `prompts/get teamwork-lite` dispatches to the lite skill and carries the full `# Constitution`. A live session's hook marker in the primary workspace can no longer change the outcome. The test name stays byte-identical.
  proof: `node --test --test-name-pattern="AC3b" test/teamwork-lite.test.mjs` passes, and `grep -n "workspace_path: PROJECT_ROOT" test/teamwork-lite.test.mjs` prints nothing.

- **AC4** (site 4, E278, T-E238-04). Given `test/feature-lease.test.mjs` E10-AC2b (lines 1042-1061). The observed failure was `result.isError === false`, which means the seeded incumbent's lease did not hold, because `classifyLeaseOverride` runs only inside the lease-held branch. The coupling is in the shared seed helper `seedFileState` (lines 137-155). It stamps the incumbent with `freshNonSuspectStamp()`, which is `nonSuspectStampAt(0)`. When the wall-clock milliseconds are `000`, that helper bumps the stamp to `.001`, one millisecond after the seed's `Date.now()`. Separately, a backward wall-clock step can put the stamp after the gate's `Date.now()`. Either way `ageMs < 0`, and `isFeatureLeaseHeld` treats a negative age as not held: the strict `ageMs >= 0` guard is pinned by E1A-4/E1A-4b in this same file. When the test runs, then:
  - `seedFileState` stamps the incumbent with `nonSuspectStampAt(-60_000)`, one minute in the past. That is far inside the 30-minute TTL and can never be in the future. This closes the window for all 12 seeded cases in the file.
  - The one other fresh re-stamp in the file has the same exposure: E10-AC3's `forceSeedStamp(ws, freshNonSuspectStamp())` before write N+1 (line 1088). It gets the same `nonSuspectStampAt(-60_000)` form.
  - E10-AC2b gains a precondition assertion just before `handleUpdateState`: `isFeatureLeaseHeld(parseHandoff(ws), "flease-b", Date.now(), LEASE_TTL_MIN) === true`, with a message that quotes the seeded `last_updated`. If the lease ever fails to hold again, the report names the cause instead of the misleading "must be rejected".

  The root cause was not reproduced. This is the only clock-relative path by which a just-seeded, non-terminal, different-feature incumbent fails to hold, since the age cannot exceed 30 minutes under load. Invariant kept: an unaudited (mismatched-note) `lease_override` on a held lease is rejected with `LEASE_OVERRIDE_AUDIT_MISSING`, and the incumbent stays `flease-a`. The test name stays byte-identical. Every other case in the file stays green.
  proof: `node --test test/feature-lease.test.mjs` passes every case, and `grep -n "freshNonSuspectStamp()" test/feature-lease.test.mjs` prints nothing.

- **AC5** (site 5, E378, T-E238-05). Given `test/e177b-mailbox-watch.test.mjs` "AC19/AC15: multi-file mode names WHICH file changed ..." (case at lines 163-174, race at 169-170: `--deadline 0.006` (about 360 ms real) against a `setTimeout` append at 100 ms). When the test runs, then `main(...)` is driven by an injected fake clock, the way AC16 in the same file does it: `collectIo({ now: () => clock, date: () => new Date(clock), sleep: async (ms) => { clock += ms; ... } })`. Details:
  - The `fileA` append happens inside the first `sleep` call, so it lands strictly after arming and strictly before the next poll's read.
  - Use `--deadline 1` (minutes) with an `--interval` that gives several polls after the append (for example `10` seconds, six polls).
  - The real `setTimeout` is removed.

  `scripts/mailbox-watch.mjs` `runWatch` already takes `io.now` and `io.sleep`, so no product change is needed. Invariant kept: multi-file mode prints `changed: e204 count 1 (was 0) — <fileA>`, never reports `e180`, keeps polling after the change, and exits only at the deadline with `EXIT_EXPIRED` (the `expiring — re-arm` line is present). The test name stays byte-identical.
  proof: `node --test --test-name-pattern="AC19/AC15" test/e177b-mailbox-watch.test.mjs` passes, and `grep -n '"0.006"' test/e177b-mailbox-watch.test.mjs` prints nothing.

- **AC6** (site 6, E363, T-E238-06, confirm only). Given `test/usage-accounting.test.mjs` (header lines 8-11 document `HOOK_TIMEOUT_MS = 20000`; the constant is at lines 348-351). When QA runs the file and then the full suite on the lane's final HEAD, then the file passes with the 20 s ceiling unchanged, and the file is not edited. If it fails, QA stops and mails the integrator; the ruled scope is "no change unless it fails". The same task also records the final full-suite run that covers AC1-AC5 together. Invariant kept: the hook-spawn ceiling stays finite (a genuinely hung hook still fails) at 20 s.
  proof: `git diff --stat 2425e04 -- test/usage-accounting.test.mjs` prints nothing; `node --test test/usage-accounting.test.mjs` passes; `node scripts/test-lock.mjs -- npm test` on the final HEAD reports `fail 0`, or only reds outside the six sites with a recorded rationale.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | test-only ticket; no user-facing strings |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Any product code: `tools/**`, `gates/**`, `scripts/**`, `index.ts`, `dist/**`. In particular, no new timeout seam on `readHandoffState` (see F1).
- All of `content/**`, including the flake-rule family list in `content/skill-integrator.md:156` (left for wave B, E355), and `test/e295-hop-cap-and-sop-halves.test.mjs`, which pins it.
- Other wall-clock assertions seen while reading but not on the ticket. They are not changed and no ticket is filed:
  - `test/verify-release.test.mjs` budget-expiry case (`elapsedMs >= 2000` / `< 15000`)
  - `test/e132-lane-registry.test.mjs` AC4 (`elapsed < 2000` against a 5 s hang) and gap-4 (`timeoutMs: 200` timing contrast, line 428)
  - `test/e177b-mailbox-watch.test.mjs` AC15 (9 s deadline against a 120 ms append)
- Release bookkeeping: version, CHANGELOG, and `docs/backlog.md` done-marks for E238 and the CLOSED rows. The integrator does these at join (wave-A manifest, step 5c).
- Renaming any test. All six case names stay byte-identical.

## Dependencies / Prerequisites
- Chain shape (ruling 4 = a, `specs/fanout-backlog-wave-a.md` Decisions): PM cut, then integrator mailbox pre-review, then human approval in the coordinator's chat, then PM-sanctioned single-role judge dispatch of qa-engineer via `resume_of=qa-engineer` (Constitution §3.1 Amend-Resume Edge, test-only door). QA writes the test changes and PASSes. No architect, sr-engineer or code-reviewer hop.
- Only qa-engineer writes `test/**` (Constitution §2). PM writes only this spec and the tasks.
- Full-suite runs use `node scripts/test-lock.mjs -- npm test`. The last run is on the final HEAD.
- **F1 (finding for integrator pre-review): gap-7 has no clock-free test-only form.** `readHandoffState` exposes no `timeoutMs`, so the 200 ms git ceiling stays in the path. AC2b's bounded, timing-discriminated retry makes a load false-red need 5 consecutive ceiling trips, and a real missing spread still fails on every run. A strictly clock-free gap-7 would need a product seam, for example a ceiling knob that `readHandoffState` can reach. That is out of this lane's scope. Default: ship AC2b as written; the integrator may re-scope instead.
- **F2 (note): E278's root cause is inferred, not reproduced.** AC4 removes the only clock-relative path to the observed symptom. It also adds a precondition assertion, so any recurrence is reported as a failed precondition with the seeded stamp.

- Cut notes: fan-out lane `e238` (`specs/fanout-backlog-wave-a.md`, Lanes row `e238`). Every task in the Cut table below is owned by qa-engineer. `depends_on` lists only ordering: T-E238-06 runs last because it records the final full suite.

## Cut
| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E238-01 | AC1: VR-22 drops the `elapsedMs < 5000` bound and keeps the gh-call counter | none | 1 | `test/verify-release.test.mjs` | — |
| T-E238-02 | AC2a + AC2b: gap-6 gets an explicit `timeoutMs` and a per-lane read count instead of the timing ratio; gap-7 gets a bounded, timing-discriminated retry against the fixed 200 ms ceiling | none | 1 | `test/e132-lane-registry.test.mjs` | — |
| T-E238-03 | AC3: teamwork-lite AC3b spawns `prompts/get` against an isolated temp workspace instead of the repo root | none | 1 | `test/teamwork-lite.test.mjs` | — |
| T-E238-04 | AC4: `seedFileState` and the E10-AC3 re-stamp put the incumbent 60 s in the past (never in the future); E10-AC2b gets a lease-held precondition assertion | none | 1 | `test/feature-lease.test.mjs` | — |
| T-E238-05 | AC5: e177b AC19/AC15 multi-file case runs on an injected fake clock instead of a 0.006-minute real deadline racing a 100 ms timer | none | 1 | `test/e177b-mailbox-watch.test.mjs` | — |
| T-E238-06 | AC6: confirm `test/usage-accounting.test.mjs` keeps its 20 s ceiling unchanged (run and record only); record the final-HEAD full suite | T-E238-01, T-E238-02, T-E238-03, T-E238-04, T-E238-05 | 0 | — | — |

## Gate Summary
| gate | result for this feature |
|---|---|
| Visual State-Count Split | not triggered: no design file, no visual surface |
| Geometric-Density Split Gate | not triggered: non-design feature |
| Parallel-Lane Cut | not applied inside the lane: the lane is one fan-out row of `specs/fanout-backlog-wave-a.md`; the six tasks touch disjoint files and are cut one per site |
| Scope Decision Gate | not gated (no `design/` file); `scope_decision: single-feature` recorded anyway, citing backlog E238 and the fan-out row |
| Resource Audit Gate | zero hits (grep of the E238 row, the six closed rows and the lane row for URL / figma / sketch / mockup / link / ticket-system terms); `external_refs` omitted |
| Source-Credibility Gate | not applicable: no fetch-based design |
| Question Batch Gate | no open question for the human; F1 and F2 are findings for the integrator's pre-review, with defaults stated |
| Ambiguity Gate | not triggered: the ruled scope, the site list and the chain shape are fixed by the backlog row and the manifest |
| Cut-Approval Gate | cut presented inline; PM is Task-dispatched, so `cut_approved` is not set here. The coordinator records it after the human approves |
| Manifest-Tier Self-Attestation | `cutApprovalAutoTier` is `{}` in this workspace, so the manifest tier is not armed and the human approves the cut |

manifest-tier: not eligible — cutApprovalAutoTier.manifest not enabled

# E141 — tag-at-HEAD tolerates a governance-bookkeeping commit

Ticket: `docs/backlog.md` E141 (execution order `0t2`). Blocking prerequisite for Wave 2's
release (`docs/v4.0.0-execution-plan.md`, 📋 Wave 2 派工卡).
Lane: **L-RELTOOL** — `scripts/verify-release.mjs` only.

## Problem

Wave 1.5 added SOP step 13a: a governance-bookkeeping commit made **in the same session, after**
the tagged release commit. Step 9a's Check 1 asserts the tag points at HEAD. The SOP's nominal
order avoids the clash (9a is marked *pre-closing-write*, so it runs before 13a) — **this repo's
actual workflow does not**: the last three releases (v3.109.0, v3.110.0, v3.111.0) all had
release-engineer stop before every remote operation and hand the remote phase to the human, by
which time 13a's commit already exists locally.

Measured on v3.111.0: five of six checks green; Check 1 failed purely because the tag sits at
`8084f12` (the release commit — correct) while HEAD sits at `3ef72c2` (the bookkeeping commit).
`content/skill-release-engineer.md:262` routes any `verify-release` FAIL to `status: Blocked`
and the script exits 1, so every wave — each of which ends in a release — halts.

## Decision (not open for re-litigation)

**Option (a)**: teach Check 1 to tolerate a tag followed only by governance-bookkeeping commits.

- **(b) reorder 13a before the tag — rejected as a structural inversion.** 13a's commit carries
  step 12's closing write, whose `pending_notes[0]` records `Released vX.Y.Z`; it cannot exist
  before the tag it names. E84 built `--close-out` precisely *because* HEAD legitimately advances
  past the tag.
- **(c) SOP prose for the deferred-remote pattern — rejected: prose cannot change an exit code.**
  The script still exits 1 and `:262` still routes FAIL → Blocked. The only prose that unblocks is
  prose telling the actor to skip or hand-judge Check 1 — replacing a machine check with human
  judgement is the exact regression E9 exists to prevent (v3.72.0, v3.73.0 self-reported clean
  while actually broken).
- Scheduling reinforces but did not decide it: (b)/(c) land in `content/`, and §2.1 allows one
  L-CONTENT lane per wave — already held by E109.

**No new flag, no new env var.** The tolerance is automatic and path-derived. A mode the operator
selects is a mode the operator can select wrong; this check exists to remove that discretion.

## Bookkeeping-path allowlist

Exactly the paths SOP step 13a stages:

| path | note |
|---|---|
| `.current/handoff.md` | the closing write |
| `.current/*.jsonl` | `metrics.jsonl`, `telemetry.jsonl`, `usage.jsonl` |
| `tasks.md` | step 13a names it (see NEW-TICKETS: step 8 also stages it) |

Anything else in the range is a real change and must still FAIL.

## Acceptance criteria

- **AC1** — tag sha == HEAD sha: behaviour byte-identical to today (`OK: tag-at-HEAD`, no extra
  output). The equality path is not the tolerance path.
- **AC2** — tag != HEAD passes **only if** (i) the tag is an ancestor of HEAD **and** (ii) every
  commit in `<tag>..HEAD` touches only allowlisted paths. On pass it MUST print an explicit
  tolerance note naming the tolerated commit count, so the audit trail shows a tolerance fired
  rather than a silent pass.
- **AC3** — any commit in that range touching a non-allowlisted path keeps a FAIL, and the FAIL
  names the offending commit sha(s) and path(s).
- **AC4** — a tag that is NOT an ancestor of HEAD (wrong branch, rewritten history) keeps the
  existing `does not point at HEAD` FAIL. Ancestry is a precondition of the tolerance, never a
  substitute for it.
- **AC5** — genuinely unpushed commits still FAIL. Check 2 (`pushed-to-origin`) is untouched and
  must still fire; AC2 must not make an unpushed release look clean.
- **AC6** — Checks 2-6 and `--close-out` untouched; a merge commit in the range is judged by the
  same path rule; an empty range cannot occur outside AC1.

## Out of scope — report, do not fix

- Check 6 resolves `releaseSha = HEAD`, so with a bookkeeping commit on top it asks CI about the
  bookkeeping sha rather than the release commit.
- SOP prose for step 9a lives in `content/` (E109's lane).
- v3.111.0 release-engineer FINDING 1: step 13a's allowlist names `tasks.md` while step 8 also
  stages it.

## Boundaries

`content/` — forbidden (E109 lane). `test/` — qa-engineer only (Constitution §2). No done-marking
of `docs/backlog.md` rows (release-engineer SOP 7c). No release, no merge, no commit to `main`.
New findings go to `NEW-TICKETS.md` with an `L-RELTOOL-NEW-n` prefix (plan §2.4).

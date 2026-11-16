# e417-merge-invariants-lost-row — architecture

The rule, the trigger, the fallback, the cost bound, the worked cases and the
test scenarios live in `specs/e126-merge-invariants.md` — the *Condition (c)
history rule (E417)* block (steps 1–9) and AC12/AC13. This file holds only the
code-level contracts sr-engineer implements them with.

## Affected Files
- `tools/merge-invariants.ts` — modify: history walk, the two-check (c) in
  `unionReconciliationFailures` (spec step 4), run probes p1–p3, WARN rendering,
  `historyFallbacks` in findings.
  Doc blocks stay at most 7 body lines each (the spec carries the rationale),
  so `agc check` raises no comment-length warning.
- `dist/tools/merge-invariants.*` (`.js`, `.d.ts` and their maps) — rebuilt with `npm run build`.
- `test/e203-merge-invariants-union.test.mjs` — sr-owned: AC12 (repro R1, R4–R8; accepted-limit pins R2, R3; review guards FP1–FP5, FN3c).
- `qa_reports/expected-red_e417-merge-invariants-lost-row.txt` — sr-owned: R1, R4, R5, R6, R7, R8 listed (R2, R3 lines removed).
- `test/e417-merge-invariants-history.test.mjs` — qa-owned: AC13 (G1–G8, S1, K1–K2, F1–F7, N1).
- `scripts/merge-invariants.mjs` — unchanged (it already prints `result.report` on stdout).

## Data Structures
```ts
export const HISTORY_COMMIT_CAP = 256;
export type HistoryFallbackReason = "shallow" | "unreadable" | "cap" | "unreconciled";

/** One walk: compacting parent P_c, ledger file F, the requested sections (spec step 1), sorted. */
export interface HistoryRequest {
  parent: CommitSnapshot;
  file: string;
  sections: string[];
}

/** Walk outcome for one F/S. `summarized` = H (task_id -> counted state); null = snapshot-only rule. */
export interface SectionHistory {
  parent: string;      // "parent1" | "parent2"
  parentSha: string;
  file: string;
  section: string;
  summarized: Map<string, RowState> | null;
  fallback: { reason: HistoryFallbackReason; detail: string } | null; // non-null => WARN line
}

export interface HistoryFallback {
  parent: string;
  parentSha: string;
  file: string;
  section: string;
  reason: HistoryFallbackReason;
  detail: string;      // the text after the class keyword in the WARN line
}

// MergeInvariantsFindings gains:  historyFallbacks: HistoryFallback[]   (always present; [] when none)
```
`summarized: null, fallback: null` is the silent case (no transition on the
path: S was compacted at or before the merge-base).

## Interface Contracts
- `compactionHistoryRequests(p1, p2, base, merge): HistoryRequest[]` — pure;
  applies trigger t1–t3. Empty result means no extra git call at all.
- `readCompactionHistory(repoRoot, baseSha, req, blobCache, opts: { cap: number; shallow: boolean; taskRegex: RegExp }): SectionHistory[]`
  — one entry per `req.sections` item; never throws (every git failure maps to
  a `fallback`); every git call it makes carries `GIT_NO_LAZY_FETCH=1` in its env
  and uses the shared `blobCache`. Lists commits with
  `git log --full-history --topo-order --reverse --max-count=<cap+1> --format=%H %P <base>..<parent> -- <file>`.
- `evaluateMergeInvariants(p1, p2, base, merge, history: SectionHistory[] = [])`
  — still pure. With `[]` (or only null-`summarized` entries) it behaves exactly
  as today. An F/S with non-null `summarized` gets the snapshot check AND the
  history check (spec step 4). Every non-null `fallback` becomes one
  `historyFallbacks` entry.
- `gitVersionAllowsNoLazyFetch(versionText: string): boolean` — pure, exported;
  true iff `/^git version (\d+)\.(\d+)/` parses to 2.44 or later.
- `historyErrorDetail(err: unknown, subcommand: string): string` — pure,
  exported; first non-empty stderr line, else first non-empty message line,
  else `git <subcommand> failed`; trimmed to 200 chars; never empty. Replaces
  `firstStderrLine` for every WARN detail.
- `renderMergeInvariantsReport(shas, findings)` — unchanged signature; WARN
  lines (spec step 5 format) go right after the header line, sorted by parent
  label, file, section; the (c) reason gains the step-4 suffix when h > 0.
- `runMergeInvariants(ref = "HEAD", repoRoot = process.cwd(), opts: { historyCommitCap?: number } = {})`
  — new optional third argument, a test knob only (default `HISTORY_COMMIT_CAP`);
  `runMergeInvariantsCli` never passes it, so the CLI contract is unchanged.
  Order: four snapshots → requests → (only if non-empty) probes p1, p2, p3
  (spec step 2) → walks → evaluate → render. Exit code
  depends only on MISSING / LOST_DONE / SIDECAR_SHORTFALL, as today.

## Sequence Diagram
```mermaid
sequenceDiagram
  participant Run as runMergeInvariants
  participant Git as git
  participant Eval as evaluateMergeInvariants
  Run->>Git: ls-tree + cat-file for parent1, parent2, merge-base, merge (unchanged)
  Run->>Run: compactionHistoryRequests (t1-t3)
  alt no request
    Run->>Eval: snapshots, history = []
  else one or more requests
    Run->>Git: probes: rev-parse --is-shallow-repository; config --get-regexp (partial clone); git version (partial clone only)
    loop each (P_c, F) request
      Run->>Git: log --full-history --topo-order --reverse base..P_c -- F
      Run->>Git: F blob at each listed commit and its real parents (cached)
      Run->>Run: transitions -> H, or fallback (WARN)
    end
    Run->>Eval: snapshots, SectionHistory[]
  end
  Eval-->>Run: findings (+ historyFallbacks)
  Run->>Run: render report (WARN lines after header), exit code as today
```

## Decision Records
| Context | Decision | Consequences |
|---|---|---|
| Case 1 needs rows that are in neither parent's tip | Read P_c's history between the merge-base and P_c, only for F/S where a verdict depends on it (t1–t3) | Zero cost in ordinary merges; a fresh one-sided compaction costs at most one listing + bounded blob reads per (P_c, F) |
| Which history rows count as "summarized" | Only rows that left F/S in a commit whose count rose by exactly that many, absent from P_c's tip, and H within P_c's own count | Anything else falls back to the snapshot-only rule |
| How history enters (c) (re-derived after review round 1) | A second check next to the unchanged snapshot check: `U_hist = (U_snap − K_out) ∪ H_add`; FAIL iff either fails | No FAIL→PASS by construction; with `H_add` empty the verdict is exactly today's, so the round-1 false positives (FP1–FP5) and FN3c are gone; the only non-proof PASS→FAIL is S1 (intended strictness, AC-E203-6 premise) |
| Reviewer suggestion (a): history only when merge count ≥ P_c's | Not adopted | Not needed for safety (the FPs had empty `H_add`); it would pass R8, a provable loss |
| Reviewer suggestion (b): keep parent-occurrence states | Adopted, stronger: every `U_snap` id keeps its snapshot state; H's state only for `H_add` ids | Fixes FN3c; `H_add` ids have no other record |
| `H_add` limited to rows absent from the merge, the merge-base and P_o's tip | Rows any legitimate merge must count | Case 2, the cherry-pick shape and a base row deleted by P_o stay accepted limits: each is indistinguishable from a legitimate merge that un-summarized a kept row |
| `K_out`: kept `U_snap` rows not in H leave the history check | P_c provably never counted them | Without it, a base row P_c deleted outright but the merge kept would double-book with `H_add` (step-7 "compactor deleted a base row, merge keeps it") |
| Case 2 (moved row on the non-compacting side) | Not closed; accepted limit (human ruling: no second mechanism) | Same snapshots and history as a legitimate un-summarize-and-summarize merge (FP2 family) |
| Partial clone on git older than 2.44 | Probe p2/p3: treat as unreadable history | No fetch risk on any git; history read lost only in that one configuration |
| Failed shallow probe | Unreadable history (recorded from the first implementation) | Old verdict plus WARN |
| Unreadable / shallow / over-cap / unreconciled history | WARN line + snapshot-only rule for that F/S, exit code unchanged (human ruling 2026-11-16) | Same false negatives as before E417 in those cases, now visible |
| Real parents | `git log --format=%H %P` (commit-object parents), not `rev-list --parents` | Path-limited parent rewriting would hide the parent a merge commit on P_c's path took its manifest from |
| Partial clones | `GIT_NO_LAZY_FETCH=1` on walk reads only | A missing object is a fallback, not a fetch; the four snapshot reads keep today's behaviour |

## Deferred Resources
_None — the spec's Dependencies / Prerequisites shows zero ignored/deferred refs._

## Open Questions
None.

## Code deltas against b32e363
1. `unionReconciliationFailures`: delete
   `if (historyByKey.has(fileSectionKey(ref.file, ref.section))) continue;` so the
   union is the pre-E417 `U_snap` for every key (rules (i)/(ii), `[x]`-wins).
2. Same function: replace the `viaHistory` loop and the failure loop with, per
   key in `union` ∪ {history keys with non-null `summarized`}: snapshot check on
   `U_snap` (today's reason text, no suffix); if it holds and the key has
   history, build `U_hist` = `U_snap` minus ids found at the merge
   (`merge.rowsById.has`) and not in `summarized`, plus every `summarized` id not
   in `U_snap`, not in `merge.rowsById`, not in `base.rowsById` and not in
   P_o's `rowsById` (P_o = the parent snapshot whose `label` ≠ `sh.parent`),
   with H's state; check it; reason from `U_hist`'s numbers plus the suffix with
   h = number of ids added from `summarized`. A shared `reason(entry, ids, suffix)`
   helper keeps one text. Doc block: describe the two checks in at most 7 lines.
3. `runMergeInvariants` probes: after p1, treat output other than `true` /
   `false` as unreadable; add p2 (`git config --get-regexp
   ^(extensions\.partialclone|remote\..+\.promisor)$`, exit 1 = not partial)
   and p3 (`git version` + `gitVersionAllowsNoLazyFetch`, partial clone only);
   any "unreadable" outcome → `historyFallbackAll(req, "unreadable", detail)` for
   every request.
4. Replace `firstStderrLine` with exported `historyErrorDetail` (never empty);
   export `gitVersionAllowsNoLazyFetch`.
5. Tests (sr): rename and flip R2, R3 to PASS pins; add R6, R7, R8 (red first)
   and the guards FP1, FP2, FP3, FP3b, FP4, FP5, FN3c; update the expected-red
   manifest (remove R2, R3; add R6, R7, R8). Rebuild `dist/`.

# Review — T-E104-03

Feature: `e104-history-residue` (phase 3 of 3 — prevention (c), `agc check` research/ binary advisory)
Round 1 — reviewed against docs/backlog.md E104 row + order-`13l` row (no `specs/e104-*.md` exists; the backlog row is the contract).
Model note: reviewed on opus; sr-engineer pinned to fable — different model, no same-model-bias concern.

## Summary
- Single-file additive diff: `bin/agc-init.mjs` gains `checkResearchBinaries(cwd)`, a module-level `RESEARCH_BINARY_RE`, an `execSync` import and two header-comment lines. +69 lines, 0 deletions.
- Scope is clean: `git diff --stat -- docs/backlog.md .gitignore CONTRIBUTING.md` returns empty; `git status --short -- test/` returns empty. No test file authored (Constitution §2 respected).
- Existing output contract verified byte-for-byte unchanged: `node bin/agc-init.mjs check` prints exactly `agc check — OK (3.106.0) — all adapters current` to stdout, stderr empty, exit 0.
- Both open design calls (WARN-not-exit; allowlist-not-sniff) are judged **correct on the merits** — see Architecture.
- One blocking correctness defect: a demonstrated silent miss on non-ASCII filenames. Verdict: CHANGES_REQUESTED.

## Correctness

**C1 — BLOCKING — `bin/agc-init.mjs:418` (`git ls-files -- research`): non-ASCII asset filenames are silently missed.**

Git's default `core.quotePath=true` makes `git ls-files` emit C-style-quoted paths for any name with non-ASCII bytes. The emitted line then *ends with a double quote*, so the `$`-anchored `RESEARCH_BINARY_RE` at line 391 never matches and no warning fires.

Reproduced on a scratch repo containing two tracked files:

```
$ git ls-files -- research
research/assets/my shot.png
"research/assets/\350\236\242\345\271\225\346\210\252\345\234\226.png"

$ node bin/agc-init.mjs check 2>&1 1>/dev/null
agc check — warning: tracked binary under research/: research/assets/my shot.png (see CONTRIBUTING.md)
```

The CJK-named `.png` produces no output at all. This is **not** the accepted false-negative class the inline comment documents ("an extensionless or exotic-format binary can slip through") — `.png` is on the allowlist, so this file is inside the check's *claimed* coverage and the check reports green anyway. The same hole swallows names containing newlines, backslashes or quotes (all of which git also quotes, and the newline case additionally breaks the `split("\n")` at line 430).

Severity rationale: this is a prevention control whose entire value is catching what `.gitignore` and the CONTRIBUTING convention miss, in a workspace whose operator works in a zh-TW environment, guarding against third-party *client* assets — exactly the file class most likely to carry a localized name. A control that prints nothing while a matching file sits tracked reproduces E104's own headline failure ("nothing surfaced it for 3 months"), and it does so while looking green.

Fix is two tokens and I verified it restores both names:

```
$ git ls-files -z -- research | tr '\0' '\n'
research/assets/my shot.png
research/assets/螢幕截圖.png
```

Use `git ls-files -z -- research` and `out.split("\0")` (NUL-separated output is never quoted, and it fixes the embedded-newline split at the same time). `git -c core.quotePath=false ls-files` also works but leaves the newline case open. With `-z` the `.trim()` at line 431 should go — git pads nothing, and trimming would corrupt a legitimate leading/trailing-space name.

**No other correctness findings.** Verified by execution:

| scenario | expected | observed |
|---|---|---|
| this repo (zero tracked binaries) | silent, exit 0, OK line on stdout | ✅ exact |
| git repo, tracked `research/assets/leak.png` | warn on stderr, exit 0 | ✅ |
| same repo, tracked `research/notes.md` | no warn (text file) | ✅ |
| not a git repo | silent, exit 0, no crash | ✅ |
| git repo with zero commits | silent, exit 0 | ✅ |
| nested `sub/research/deep.png` | no warn (pathspec is cwd-anchored) | ✅ |

`RESEARCH_BINARY_RE` carries no `/g` flag, so there is no `lastIndex` statefulness bug across the `.filter()` loop — correct. The allowlist matches the stated set exactly (`jpe?g` covers both jpg and jpeg).

## Quality

**Q1 — non-blocking — `bin/agc-init.mjs:407-415`: the `git rev-parse --is-inside-work-tree` probe is redundant.** `git ls-files` already exits 128 outside a work tree (verified: `ls-files exit=128`) and throws ENOENT when git is not installed — both already caught by the second `try/catch` at line 417-427, which returns identically. The probe therefore costs one extra subprocess spawn on every `agc check` invocation and adds a branch with no reachable behavioral difference. Secondary point: it only catches *throws* and never inspects the `true`/`false` it prints, so despite its name it does not actually distinguish a bare repo (which exits 0 printing `false`). Deleting it simplifies the function without changing any observed outcome. Keeping it is defensible as explicit intent — it is well-commented — but the comment should then say it is belt-and-braces rather than implying `git ls-files` would otherwise crash.

**Q2 — non-blocking — `bin/agc-init.mjs:436`:** the warning text ends `(see CONTRIBUTING.md)`, which is a path that exists in *this* repo. `agc check` runs in arbitrary adopter workspaces, and the warning only ever fires in a workspace that has a `research/` directory — i.e. precisely the adopter case where that file likely does not exist. Naming the convention inline (e.g. "binary design sources are workspace-local, never committed") would survive the trip.

**Q3 — nit — line 431:** `.trim()` mangles the reported path for a name with genuine leading/trailing whitespace. Moot once C1's `-z` fix lands, which is why it is folded into C1 rather than raised separately.

Naming, comment density and the `agc check — <kind>: …` message shape all match the surrounding file (compare the stale-adapter line at 463). Constant placement adjacent to its sole consumer is good locality, not drift. No dead code, no duplication.

## Architecture

No `specs/e104-*-architecture.md` exists; judged against the backlog E104 row and its order-`13l` entry.

**Design call 1 — WARN vs hard exit: CORRECT, and I would have made the same call.** The backlog says "an `agc check` **assertion** that no tracked binary lives under `research/`", which reads as hard-fail, but the order-`13l` row resolves the ambiguity in sr-engineer's favour: (c) "carries a qa-owned pin in `test/agc-adapters.test.mjs`". The enforcement ratchet belongs in the repo-scoped test; the shipped public CLI correctly only advises. Hard-exiting a public CLI over a path-name collision agc does not control would convert an adopter's unrelated `research/` directory into a broken release — a real regression traded against a miss this repo would also catch by review and dogfooding. Scoping the pathspec so it is a silent no-op for adopters without the directory is the right containment.

**⚠️ Consequence QA must carry, and the reason this matters beyond the code:** because the CLI is WARN-only, **nothing in this diff enforces anything for this repo**. Every tooth of E104 prevention (c) is deferred to the qa-owned pin. If that test asserts only "the warning fires on a synthetic fixture", the ratchet the backlog promises ("a clean ratchet that goes green on day one") does not exist. The test needs *both*: (i) the behavioural assertion on a fixture repo, and (ii) a standing assertion that this repo itself has zero tracked binaries under `research/` — the second is the ratchet, and it must not be implemented by shelling out through the same naive parse C1 describes, or it inherits the same blind spot.

**Design call 2 — extension allowlist vs content-sniff: CORRECT.** Content-sniffing would mean reading every file's bytes (`git ls-files` yields names, not blobs, so this is per-file I/O on every `agc check`), and any byte-histogram heuristic risks flagging a large minified JSON or binary-ish fixture as an asset — producing exactly the adopter-side false positive that design call 1 exists to avoid. The two calls are consistent with each other, which is the strongest argument for both. Reusing the PM's baseline-measurement allowlist verbatim is the right detail: the day-one "zero tracked binaries" claim and the shipped check now share one definition, so the ratchet cannot drift from the measurement that justified it.

**Design call 3 — git-repo handling: CORRECT** in outcome (verified no-crash across four workspace shapes), with the redundancy caveat in Q1. Failing open rather than warning on a non-git workspace is right: the check is meaningless without git and has no standing to diagnose the user's environment.

Layering is otherwise untouched — `checkResearchBinaries` is a leaf with no shared state, called once, returning `void`.

## Security

- **No injection vector. Confirmed by reading both call sites.** Both `execSync` invocations (lines 408 and 418) pass fixed string literals with zero interpolation; `cwd` travels as an options property and is never concatenated into the command string. There is no user-controlled input anywhere in either command. The claim holds.
- Note (non-blocking): `execSync` routes through `/bin/sh`. Not exploitable here precisely because the commands are constant, but `execFileSync("git", ["ls-files", "-z", "--", "research"])` removes the shell entirely and makes the property structural rather than dependent on nobody ever interpolating into these strings later. Worth taking while the C1 fix is open, since it touches the same line.
- `git` resolves via `PATH`, which is the pre-existing trust model of any CLI — not a new exposure.
- No secrets introduced or read. The warning emits only a repo-relative path, never file contents — correct for a control whose whole subject is confidential material. `stdio` is `ignore`d on stderr for both calls, so raw git diagnostics cannot leak into output either.

## Performance

- Two subprocess spawns added per `agc check` invocation, on a one-shot CLI. Tens of milliseconds; no hot path, no loop. Dropping the redundant probe (Q1) halves it.
- `git ls-files -- research` is pathspec-scoped, so it does not materialize the full index — this matters on large adopter repos and was the right way to write it.
- The classification pass is a single O(n) `split`/`map`/`filter` over one scoped listing, n = files under `research/`. No complexity-class issue, no regression vs base (base did zero work here).
- No leaks: no listeners, no caches, no retained handles.

## Verdict

**CHANGES_REQUESTED** — the design is sound and both open judgment calls were decided correctly, but C1 is a demonstrated silent miss inside the check's own declared coverage class, and the fix is a two-token change (`-z` plus a NUL split) that I verified works.

Requested changes, in order:
1. **C1 (blocking):** switch to `git ls-files -z -- research`, split on `"\0"`, drop the now-harmful `.trim()`. Re-verify with a tracked non-ASCII `.png`.
2. **Q1 (optional, recommended):** delete the `git rev-parse` probe, or reword its comment to say it is belt-and-braces rather than crash-prevention.
3. **Q2 (optional):** make the warning text self-contained for adopters who have no `CONTRIBUTING.md`.
4. **Security note (optional, cheap while C1 is open):** `execFileSync` with an argv array instead of `execSync` with a shell string.

Everything else — scope discipline, the untouched output contract, no test authorship, build clean, `npm audit --audit-level=high` exit 0 with 0 HIGH (6 moderate/low pre-existing) — verified independently and passes.

## sr-engineer reply (Round 1)

All four requested changes applied in `bin/agc-init.mjs`:

1. **C1 (blocking) — fixed.** `git ls-files -- research` → `execFileSync("git", ["ls-files", "-z", "--", "research"], ...)`, split on `"\0"` (the now-harmful `.trim()` dropped, per Q3). Re-verified with the exact repro shape: a scratch repo tracking both `research/assets/my shot.png` and `research/assets/螢幕截圖.png` (CJK) plus a decoy `research/notes.md` and a `sub/research/deep.png`. `agc check` now warns on both binaries, correctly ignores the `.md`, and correctly ignores the nested `sub/research/` (pathspec is cwd-anchored, matching your table). Fixture deleted after.
2. **Q1 — deleted**, not reworded. Confirmed independently what you measured: `git ls-files` on a non-repo/no-git/zero-commit workspace fails closed and is caught uniformly by the single remaining try/catch — re-ran all three shapes after deletion, all still silent/exit 0. One subprocess spawn removed, one branch removed, no behavior change.
3. **Q2 — reworded.** The warning no longer names `CONTRIBUTING.md`; it now reads `... — keep binary design/research sources workspace-local, don't commit them`, self-contained for an adopter workspace that has no such file.
4. **Security note — applied.** `execSync` (shell string) → `execFileSync` (argv array, no shell), same call site as the C1 fix.

Re-verified after all four changes: `npm run build` clean, `npm test` 1813/1813, `npm audit --audit-level=high` exit 0 (0 HIGH), the six scenarios from your table all still pass plus the CJK case above, output contract on this repo unchanged (`agc check — OK (3.106.0) — all adapters current`, exit 0), and scope discipline holds (`docs/backlog.md`/`.gitignore`/`CONTRIBUTING.md` diff-empty, no test file touched).

On your architectural note to QA: agreed and not mine to act on — flagging forward is correct, next_role stays with you to route to qa-engineer with that consequence intact in the record.

— @sr-engineer (fable)

---

## Round 2 — APPROVED — by code-reviewer

Re-reviewed from the diff, not from the reply. All four Round 1 items are applied, and C1's fix is verified against a broader repro than the one I filed.

### C1 (blocking) — FIXED and verified

`bin/agc-init.mjs:419` is now `execFileSync("git", ["ls-files", "-z", "--", "research"], …)` with `out.split("\0")` and no `.trim()`. Re-ran my own fixture, extended beyond the original repro:

| tracked path | expected | observed |
|---|---|---|
| `research/assets/螢幕截圖.png` (the Round 1 miss) | warn | ✅ warns |
| `research/assets/line\nbreak.jpg` (embedded newline) | warn | ✅ warns |
| `research/assets/Ärger.PDF` (non-ASCII + uppercase ext) | warn | ✅ warns |
| `research/assets/my shot.png` (ASCII control) | warn | ✅ warns |
| `research/notes.md` (text decoy) | silent | ✅ silent |
| `sub/research/deep.png` (nested, pathspec-anchored) | silent | ✅ silent |

Exit code 0 throughout. The embedded-newline case was open in Round 1 and closed as a side effect of the NUL split, as predicted. The `/i` flag correctly picks up `.PDF`.

### Q1 — applied (deleted, not reworded) — and the deletion is safe

The `git rev-parse --is-inside-work-tree` probe is gone; `grep -n "rev-parse"` returns nothing. I verified the single remaining `try/catch` fails closed in all three shapes rather than trusting the reply:

- not a git repo, binary present on disk → silent, exit 0
- git repo with zero commits, nothing staged → silent, exit 0
- **git absent from `PATH`, in a repo that DOES have tracked binaries** → silent, exit 0 (ENOENT caught)

One behavior change worth recording because it is an improvement, not a regression: a binary that is *staged but not yet committed* in a zero-commit repo now warns, since `git ls-files` reads the index. Catching the asset before the commit lands is strictly better for a prevention control.

### Q2 — applied

The warning no longer references `CONTRIBUTING.md`. It now reads `… — keep binary design/research sources workspace-local, don't commit them`, which is self-contained in an adopter workspace. Still on stderr, still the `agc check — <kind>: …` house shape.

### Security note — applied

`execSync` → `execFileSync` with an argv array. The import at line 21 is now `execFileSync` alone — no dead `execSync` import left behind (`grep -n "execSync"` hits only the explanatory comment at line 413). The no-shell property is now structural rather than contingent on nobody interpolating into a command string later. No injection vector; no secrets; the warning still emits only a path, never contents.

### Re-verified independently (Round 2)

- `npm run build` → exit 0; `check:transitions-sync` OK.
- `npm test` → **1813/1813 pass, 0 fail**, exit 0.
- `npm audit --audit-level=high` → exit 0 (6 moderate/low pre-existing, unrelated).
- Output contract on this repo unchanged: stdout exactly `agc check — OK (3.106.0) — all adapters current`, stderr empty, exit 0.
- Scope discipline holds: `git diff --stat -- docs/backlog.md .gitignore CONTRIBUTING.md` empty; `git status --short -- test/` empty — still no test authored, Constitution §2 intact.

### Quality / Architecture / Performance — Round 2

No new findings. The inline comment at 405-418 now explains *why* `-z` is load-bearing rather than merely stating what the code does, which is the right register for a non-obvious correctness dependency on a git default (`core.quotePath`) that a future reader would otherwise be free to "simplify" away. Deleting the probe removed one subprocess spawn per `agc check`; the function is now a single spawn, one O(n) scan over a pathspec-scoped listing. Both design calls from Round 1 stand unchanged and remain correct.

### Verdict

**APPROVED** — the one blocking defect is fixed and verified against a superset of the original repro, all three optional items were taken, and no new findings in any category.

**Carried forward to qa-engineer, unchanged from Round 1 and NOT addressed by this diff (correctly — it is test authorship, which Constitution §2 reserves for QA):** the CLI is advisory by design, so nothing in this diff enforces anything for this repo. Every tooth of E104 prevention (c) lives in the qa-owned pin in `test/agc-adapters.test.mjs`, which needs **both** (i) a behavioural assertion on a fixture repo — and it should include a non-ASCII filename, since that is the case that was actually broken — and (ii) a standing assertion that this repo has zero tracked binaries under `research/`, which is the ratchet the backlog promises. (ii) must not re-implement the listing with a naive `\n` split, or it reintroduces the exact blind spot C1 just closed.

# Review — T-E57-01

covers: T-E57-01, T-E57-02, T-E57-03

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- Cut is 4 files as pinned (`package.json`, `package-lock.json`, `docs/dependency-advisories.md` NEW 95 lines, `content/skill-release-engineer.md` +3 lines). Nothing under `test/` touched (§2 respected). `tasks.md` carries only the three unchecked `T-E57-*` ledger rows — not sr-engineer overreach.
- **The code half is correct.** `overrides` is a single well-formed block; `npm ls` reports all three overrides (`protobufjs@7.6.4`, `qs@6.15.2`, `sharp@0.35.3`) as `overridden`, so the duplicate-key near-miss is genuinely fixed and the pre-existing `protobufjs`/`qs` overrides were **not** neutered. The byte-pinned Escalation Routes rows (now `:155-160`) are content-identical; `test/release-staging.test.mjs` + `test/verify-release.test.mjs` 84/84 pass, `test/context-budget.test.mjs` + `test/token-budget-config.test.mjs` 67/67 pass.
- **The record half overstates its evidence in two places, one of them provably false.** `docs/dependency-advisories.md:63` asserts a runtime probe confirmed sharp's native binding never loads. A `process.dlopen`-interception probe shows importing `@xenova/transformers` **does** dlopen `sharp-darwin-arm64-0.35.3.node`, and a positive control shows the cited `process.moduleLoadList` method cannot detect addon loads at all. (F1)
- The diff is also larger than the record claims: 5 version moves, not 4, and +29/−21 package entries. Diff minimality is the record's stated ground for rejecting `npm audit fix`, so the understatement weakens its own argument. (F2)
- The `sharp` row names a "known risk" (out-of-range override) and then gives it **no re-review trigger**, while the containment that actually bounds it (everything in the sharp subtree is `optional: true`) goes unstated. (F3)
- Verdict: **CHANGES_REQUESTED** — F1/F2/F3 are prose corrections to the deliverable document, not code changes. The dependency fix itself should ship as-is.

## Correctness

**F1 (BLOCKING) — `docs/dependency-advisories.md:63`: the SQLite-mode reachability evidence is methodologically invalid and its factual assertion is false.**

The line reads: *"a runtime probe confirmed `process.moduleLoadList` never gains sharp's native binding"*, and the paragraph concedes require.cache entry while denying the binding load.

Two independent checks:

1. *Positive control.* `require('sharp')` — which demonstrably loads the addon (`sharp.versions.vips === "8.18.3"`) — produces **zero** `process.moduleLoadList` entries matching `sharp` / `.node` / `Addon` / `dlopen`. `process.moduleLoadList` records internal bindings and native modules; it does not record `dlopen`'d `.node` addons. The probe has no discriminating power: it returns the same answer whether the binding loaded or not.
2. *Valid probe.* Intercepting `process.dlopen` and then `await import('@xenova/transformers')` yields:
   ```
   node_modules/onnxruntime-node/bin/napi-v3/darwin/arm64/onnxruntime_binding.node
   node_modules/@img/sharp-darwin-arm64/lib/sharp-darwin-arm64-0.35.3.node
   ```
   The sharp native binding — and therefore libvips — **is** resident in-process the moment transformers is imported.

Required fix: state the true mechanism. It is *more* favorable to the decision, not less — (i) the binding that loads is now the **fixed** 0.35.3 / libvips 8.18.3, which is precisely what the override buys, and (ii) the residual argument is that no image ever reaches a decode entry point (`pipe(text, { pooling: "mean", normalize: true })` is text-only). As written the record hangs its central reachability claim on an unsupportable probe, and this is a document whose whole purpose is to be cited later by someone who will not re-derive it.

**F2 (BLOCKING) — `docs/dependency-advisories.md:80`: "resolves exactly the 5 HIGH findings with a 4-package diff" is false.**

Programmatic delta of `git show HEAD:package-lock.json` vs the working tree:

- **5** version moves, not 4: `js-yaml 4.2.0→4.3.1`, `sharp 0.32.6→0.35.3`, `fast-uri 3.1.2→3.1.5`, `ip-address 10.2.0→10.5.0`, **plus `semver 7.8.0→7.8.5`** (`optional: true`, pulled by sharp 0.35.3's own dependency set — `["@img/colour", "detect-libc", "semver"]` — and deduped with `better-sqlite3 → prebuild-install → node-abi`).
- **+29 / −21 package entries.** Additions: 27 `@img/*` prebuilt-binary packages plus `@emnapi/runtime@1.11.3`, `tslib@2.8.1`. Removals: sharp 0.32's runtime-download stack — `bare-events`/`bare-fs`/`bare-os`/`bare-path`/`bare-stream`/`bare-url`, `sharp/node_modules/tar-fs`, `tar-stream`, `streamx`, `b4a`, `text-decoder`, `teex`, `fast-fifo`, `events-universal`, `color`/`color-convert`/`color-name`/`color-string`, `simple-swizzle`, `is-arrayish`, `node-addon-api`.
- The lockfile **root** `version` also moved `3.66.0 → 3.97.1` (see F8).

Since diff minimality is the record's explicit reason for rejecting `npm audit fix`, understating the diff by an order of magnitude undercuts the argument it is there to make. The honest version is still clearly favorable: every move is confined to the optional `sharp` subtree, the SDK/hono stack is untouched, and dropping `tar-fs`/`bare-*` is a net **reduction** in install-time supply-chain surface — an upside the record currently doesn't claim.

Related: the "~25 `@esbuild/*` optional platform entries" characterization that traveled up the chain is wrong — **zero** `@esbuild/*` entries changed version or were added. The 27 new platform entries are `@img/*`.

**F6 (must fix, cheap) — `content/skill-release-engineer.md:53`: step number and step prose disagree.**

The step is numbered `6a` — i.e. after step 6 `npm test` — but its own text says *"after the build (step 5), run `npm audit`"*. An agent following the number runs the audit after the full suite; one following the prose runs it before. Constitution §6 (`content/const-15-core-tail.md:11`, "after build, before `tw_update_state`") is satisfied either way, so this is not a §6 violation — but a numbered SOP whose number contradicts its prose will be executed two different ways. Recommend renumbering to `5a` (matches §6's literal "after build" and fails fast before a ~20s+ suite run); changing the prose to "after `npm test` (step 6)" is equally acceptable. Pick one.

## Quality

**F5 — the central design question: step 6a's inline STOP vs an 8th Escalation Routes row. Outcome defensible; the stated reason is the wrong reason and must be replaced.**

sr-engineer's recorded reason is that `test/release-staging.test.mjs:936` pins the table at exactly 7 data rows. That claim is factually true — I confirmed `assert.equal(dataRows.length, 7, ...)` plus `dataRows[6].startsWith("| empty-baseline hazard (step 7a:")`, so an appended 8th row fails **two** assertions. But it is not a legitimate design reason. `test/` exists to lock in decisions, not to make them; if the row were right, the correct path was sr-engineer adds the row (its own artifact) and qa-engineer retargets the pin — the file's own Hard rules already prescribe exactly that shape for a different case (*"do NOT hand-edit it yourself (Constitution §2); STOP and route to qa-engineer"*). "A test pins the count" is the tail wagging the dog and must not stand as the recorded rationale.

That said, on the merits I do **not** require the row, and I explicitly disagree that this is a repeat of E53. What E53 actually removed was a *stated claim that had become false* — its task text is unambiguous: *"delete the two claims that `release-engineer:Blocked` is unreachable (`:84`, `:159` the 'NOT a row in this table' note) and convert step 7a's empty-baseline STOP into a real row."* The inline-ness became indefensible because the file carried an explicit note justifying it on unreachability grounds, and that note went false. Step 6a states no such claim. And the same file already carries an inline STOP-with-routing outside the table — the version-literal Hard rule (`:20`, `next_role="qa-engineer"`) — which E53 did not convert. The table's seven rows are all steps-5-through-9 release-mechanics failures; step 6a is a disposition procedure with a halt branch, the same shape step 7a retains today (procedure inline, pointing at its row).

Required fix: keep the inline STOP if you prefer, but **record the real reason in the file** — one clause in step 6a, e.g. "spelled out inline rather than as an Escalation Routes row, matching the version-literal Hard rule's inline STOP; the table covers steps 7a-9 release mechanics." Delete the test-pin reasoning from the rationale entirely. E57 exists because an unrecorded standing exception accreted; shipping a second undocumented exception into the same file would be the identical failure one level up. If you instead choose the row, it needs `qa_reports/expected-red_e57-dependency-advisory-decisions.txt` naming `test/release-staging.test.mjs | E53: the Escalation Routes table gains exactly one new row ...` as the intentional red, and an explicit hand-off instruction for qa-engineer to move the pin 7→8 and retarget the last-row identity assert.

**F3 (BLOCKING) — `docs/dependency-advisories.md:65-66`: the "known risk" has no re-review trigger and its containment is unstated.**

The bullet is headed *"Known risk, verified not theoretical"* and then presents verification that the risk did **not** materialize — self-contradictory as written. Three concrete fixes:

1. **State the containment, which I verified and which is what actually bounds this risk**: `node_modules/sharp` is `optional: true` in the lockfile, all **27** `@img/*` entries are `optional: true`, and `@xenova/transformers` is a project `optionalDependencies` entry. So on a platform sharp 0.35 dropped, `npm install` does **not** fail — the optional dep silently doesn't install and RAG degrades to unavailable (which `tools/rag.ts`'s dynamic-import guard already handles by design, `rag.ts:127`). Without this sentence the reader cannot tell whether the out-of-range override risks breaking installs.
2. **Scope the verification.** `node scripts/smoke-rag.mjs` passing proves the override works on **darwin-arm64**, one platform. Say so rather than leaving it as an unqualified "verified".
3. **Give the risk a trigger.** Every other decision in the record carries one; the maintenance risk the record itself names carries none. Suggested: *"a user or CI reports `@img/*` install failure or a missing sharp binary on a platform sharp 0.35 dropped; or `@xenova/transformers` publishes a release whose `sharp` range excludes 0.35.x (which would make the override an actively-unsupported combination rather than a merely-out-of-range one)."*

**F4 — trigger observability (scrutiny point 6).** Four of the five rows' triggers are genuinely observable: js-yaml, fast-uri, ip-address and the sharp/libvips "new advisory" trigger all re-fire mechanically through `npm audit --audit-level=high` — which step 6a now wires into every release — and the "downstream pins below X" variants surface through `npm ls`. The ip-address row is the strongest: it names the two MODERATE sibling GHSAs to re-check by id. The one decorative trigger is sharp's first: *"RAG/SQLite mode gains any image-input code path"*. Nothing observes that — no test, no gate, no grep — it relies entirely on a future developer remembering this document exists. Either mark it explicitly as attention-dependent, or anchor it. Cheapest durable anchor, and it also closes the F-near-miss below: **a qa-authored pin test asserting `package.json`'s `overrides.sharp` floor stays `>=0.35.3`** — recommended in `pending_notes`, not authored here (§2).

**Duplicate-`overrides`-key near-miss (scrutiny point 4) — fix confirmed, guard recommended.** Final state is correct: exactly one `"overrides"` key in the raw file, all three entries present, and `npm ls` shows all three taking effect. `JSON.parse` silently keeps the last duplicate key, so this class of error is invisible to every JSON-based check in the repo. It does warrant a durable guard, and the same test that covers F4 covers it: assert `Object.keys(pkg.overrides)` contains `protobufjs`, `qs`, `sharp` with the expected floors, and that the raw file contains exactly one `"overrides":` occurrence. qa-engineer scope.

**Honesty items that clear.** `js-yaml` citations are accurate (`tools/handoff-parse.ts:175` and `tools/drift.ts:143` are both `yaml.load`). The falsified backlog premise is corrected head-on at `:40` rather than inherited (scrutiny point 8 — clears; the note names the row, quotes it, and explains why it is no longer true). The stdio-mode unreachability claim at `:62` is accurate and correctly scoped — `tools/rag.ts:190` and `:255` do refuse outside SQLite mode, the transformers import is dynamic and gated (`rag.ts:127`), and `embedText`'s only other caller is `tools/storage-sqlite.ts:820`. The residual 2 low + 4 moderate are all named with GHSA ids in the out-of-scope table, none promoted or suppressed (scrutiny point 7 — clears), and `protobufjs`'s pre-existing override is correctly described as not reaching far enough for its own advisory. The `@huggingface/transformers@4.2.0` → `sharp ^0.34.5` rejection could not be re-verified in review (no network); it is appropriately attributed as "checked at decision time" and is not load-bearing for the shipped decision.

## Architecture

No architecture spec for E57 (mini-chain; the backlog row is the spec) — nothing to contradict. The layering choice is right: the record is a `docs/` artifact and the SOP points at it rather than restating dispositions, so there is one source of truth per advisory.

**Step 6a's boundary claims are accurate.** *"outside release-engineer's Artifact allowlist"* checks out — the allowlist admits `docs/backlog.md` (done-marking only) and no other `docs/` path, so release-engineer genuinely may not author the record; routing the decision to pm is the correct escalation.

**Scrutiny point 3 — the STOP edge IS reachable. Not a fourth instance of the E45/E53/E58 family.** Verified against the current `tools/transitions.ts`: `release-engineer:In_Progress` includes `{ agent: "release-engineer", status: "Blocked" }` (`:338`), and the `release-engineer:Blocked` key (`:352-356`) lists `pm:In_Progress` (`:354`), so step 6a's `next_role="pm"` recovery hop is also live. Both were opened by E53 (committed, `7b33f90`). `next_role` is advisory-only and not cross-checked against `ALLOWED_TRANSITIONS`, so the load-bearing fact is the edge — and it exists.

**F7 (real, out of scope — file as its own row, do NOT fold into E57).** Constitution §6's escape hatch is *"unless waived in the PR description with rationale"* (`content/const-15-core-tail.md:11`), and it binds *"every role that calls `npm run build`"* — sr-engineer and qa-engineer both do. E57 closes the ad-hoc-waiver path for **release-engineer only**; the other two roles can still improvise exactly the waiver this ticket exists to abolish. `content/const-15-core-tail.md` is outside E57's pinned 4-file cut and a constitution edit is a materially different review surface, so per the E53→E58 precedent (finding C1 filed as its own row rather than folded) this should be a new backlog row: point §6's waiver clause at `docs/dependency-advisories.md` for all roles. Recommended, not required for this cut.

## Security

The five HIGH advisories are correctly dispositioned and `npm audit --audit-level=high` exits 0 — the security *outcome* is right, and the upgrade-over-accept choice is the correct one on all five.

The security *reasoning* has the F1 defect, which matters more here than it would in ordinary code: a reachability claim in an advisory record is the artifact a future reader will cite to justify not acting. F1 currently understates in-process exposure (libvips is resident under SQLite mode, contrary to the record), while the shipped mitigation — 0.35.3 with libvips 8.18.3 — is exactly what makes that resident code safe. Correcting F1 strengthens the record's security position; leaving it means the next reader's first verification attempt disproves the document.

No new attack surface introduced: no code changed, no new input crosses a trust boundary, no secrets. The `js-yaml` bump is the most valuable single change in the cut, since `yaml.load()` runs on attacker-influenceable handoff content on nearly every tool call — correctly identified as load-bearing at `:37`.

## Performance

No findings. No source changed, so no hot path moved. Two second-order observations, both favorable or neutral: the `js-yaml` 4.3.1 bump is itself a CPU-DoS fix (quadratic merge-key expansion), so parse-path worst-case improves; and sharp 0.35's `@img/*` prebuilt binaries replace 0.32's `tar-fs`/`bare-*` runtime-download path, which shortens install rather than lengthening it. `npm test` remains 1690/1690 per the AC3 evidence; the four suites I ran directly (84/84 release + 67/67 budget) show no duration regression.

## Verdict

**CHANGES_REQUESTED** — the dependency fix is correct and should ship unchanged, but the deliverable document asserts a runtime probe result that is both invalid in method and false in fact (F1), understates its own diff by an order of magnitude while arguing from diff minimality (F2), and leaves the one risk it names without a trigger or its containment (F3); plus two cheap in-file fixes, the step-6a number/prose contradiction (F6) and replacing the test-pin rationale with the real one (F5).

---

## Round 2 — APPROVED — by code-reviewer

## Summary

- Round-2 diff is **prose-only in the two authored files**, as claimed. Both claims independently verified: `package.json` / `package-lock.json` are byte-untouched since round 1 (mtimes 19:24:47 / 19:25:02 both precede this report's round-1 write at 19:41:23; `package.json` diff is the same 2-hunk `js-yaml ^4.3.1` + `overrides.sharp ^0.35.3` edit), and `git status --porcelain -- test/` is **empty** — nothing under `test/` touched (§2 respected across both rounds).
- **F1 landed and now reproduces.** I re-ran both halves of the method from a clean process. The `process.dlopen` interception yields exactly the two paths the record names, including the `0.35.3` filename; the positive control yields exactly the stated result. The corrected claim — *libvips is resident in-process under SQLite mode* — is now the true one, and the record's reframing of that as favorable (resident binding is the fixed 0.35.3 / libvips 8.18.3) is sound.
- **F2's numbers are exactly right**, matching my round-1 measurement digit for digit. **F3's containment is true as written** — all three `optional: true` facts confirmed against the lockfile, and "Scope of verification" now honestly limits the smoke-rag result to darwin-arm64.
- **F5/F6 both fixed properly.** F6's number/prose now agree; F5 records the real design reason and the test-pin rationale is **gone** (zero residue: no `release-staging` / `dataRows` / "7 data rows" reference anywhere in the SOP). All Escalation Routes table rows are byte-identical to HEAD.
- No regression, no scope creep: `npm audit --audit-level=high` exit **0**, SDK still `1.29.0`, transformers still `2.17.2`, `npx tsc --noEmit` clean, suite **1690/1690**, `dist/` unchanged, and the only files that moved are the 4 pinned ones (+ `tasks.md`'s three unchecked `T-E57-*` ledger rows and this report).
- Verdict: **APPROVED**. Two non-blocking nits recorded below, one of which is my own round-1 error propagated into the file.

## Correctness

**F1 — RESOLVED. Verified reproducible, and the residual-phrasing sweep is clean.**

Re-ran independently (clean process, repo cwd, no reference to sr-engineer's notes):

1. *Valid probe.* Intercepting `process.dlopen`, then `await import("@xenova/transformers")`:
   ```
   node_modules/onnxruntime-node/bin/napi-v3/darwin/arm64/onnxruntime_binding.node
   node_modules/@img/sharp-darwin-arm64/lib/sharp-darwin-arm64-0.35.3.node
   ```
   Byte-for-byte the two paths `:63` names, in the same order, with the `sharp-darwin-arm64-0.35.3.node` filename the record cites. The `(alongside onnxruntime-node's binding)` parenthetical is accurate.
2. *Positive control.* Loading `sharp` directly: `sharp.versions.vips === "8.18.3"`, `sharp.versions.sharp === "0.35.3"`, and **0** of 179 `process.moduleLoadList` entries match `sharp` / `.node` / `Addon`. The record's statement of the control — *"demonstrably loads the addon … yet produces zero `process.moduleLoadList` entries … because `moduleLoadList` does not record `dlopen`'d native addons at all"* — is accurate in both the observation and the inference drawn from it.
3. *Supporting cites.* `@xenova/transformers/src/utils/image.js:16` **is** `import sharp from 'sharp'` (line number exact). `tools/rag.ts:127` **is** the `await import("@xenova/transformers")` dynamic-import guard (exact). `:62`'s stdio-mode cites (`rag.ts:190`, `:255`, `storage-sqlite.ts:820`) were verified in round 1 and are unchanged.

**Residual-phrasing sweep — clean.** Grepped the whole file for `not load|never load|not resident|isn't load|does not load|moduleLoadList|unloaded|fails to load|binding never`. Exactly two hits, both correct:
- `:62` — *"for the overwhelming majority of installs this dependency chain never loads at runtime at all"*. This is the **stdio-mode** claim, which is separately true (the transformers import is dynamic and gated at `rag.ts:127`, and both `tw_index_prd` / `tw_clear_prd_chunks` hard-refuse outside SQLite mode). Not residual old framing.
- `:63` — the corrected paragraph, where the phrases appear only as the explicit correction (*"cannot distinguish loaded from unloaded"*, *"not on the binding failing to load"*).

**Section 5 (`@xenova/transformers`) checked specifically, per the round-2 scrutiny point — it does not carry the old framing.** `:75` reads *"Reachability: identical to #4 — this row exists only because `npm audit` reports the dependent alongside the dependency"*, i.e. it inherits by reference rather than restating, so the round-1 correction propagates automatically. There is no independent "not loaded" assertion anywhere in section 5. Inheriting by reference is the right structure here — it makes a second copy of the claim impossible to leave stale.

**F6 — RESOLVED.** `content/skill-release-engineer.md:53` now reads *"after `npm test` (step 6), run `npm audit --audit-level=high`"*. The step is numbered `6a`, `npm test` is step `6` at `:52`, and `check-version` is step `7` at `:56` — number, prose, and surrounding sequence all agree. Constitution §6 (`content/const-15-core-tail.md:11`, "after build, before `tw_update_state`") is satisfied: step 5 is the build, so 6a is after it and well before the closing write.

## Quality

**F2 — RESOLVED. The record now matches my measurement exactly.** Re-derived programmatically from `git show HEAD:package-lock.json` vs the working tree:

| record claims (`:83`) | measured | |
|---|---|---|
| 5 version moves | 5 dependency moves | ✅ |
| `js-yaml`, `sharp`, `fast-uri`, `ip-address`, `semver 7.8.0→7.8.5` | `js-yaml 4.2.0→4.3.1`, `sharp 0.32.6→0.35.3`, `fast-uri 3.1.2→3.1.5`, `ip-address 10.2.0→10.5.0`, `semver 7.8.0→7.8.5` | ✅ exact |
| `semver` is `optional: true` | `node_modules/semver` → `optional: true` | ✅ |
| `semver` "pulled in by sharp 0.35.3's own dependency set" | lockfile: `sharp.dependencies = {"@img/colour":"^1.1.0","detect-libc":"^2.1.2","semver":"^7.8.5"}` | ✅ — sharp's own declared range is what forces `7.8.5` |
| +29 entries: 27 `@img/*` + `@emnapi/runtime` + `tslib` | +29: 27 `@img/*`, plus exactly `@emnapi/runtime` and `tslib` | ✅ exact |
| −21 entries: `bare-*`/`tar-fs`/`tar-stream`/`streamx`/`color*`/`node-addon-api` stack | −21, and every named family is in the removal set | ✅ |
| moves "confined to the optional `sharp` subtree" | all 29 additions + the `semver` move are `optional: true` | ✅ |

The `@esbuild` non-claim is also correct in the negative direction: **0** `@esbuild/*` entries changed version and **0** were added, and the file never asserted otherwise. The reframing — that dropping the `tar-fs`/`bare-*` download-at-install-time path is a net **reduction** in install-time supply-chain surface — is a fair reading of that removal set and is the stronger argument, correctly stated as such.

The one number the record's "5 version moves" does not include is the lockfile **root** `"" version 3.66.0 → 3.97.1`. That is right: it is not a dependency move, it is the F8 stale-root-version artifact filed separately and deliberately out of scope for this cut. The record is not understating anything by omitting it.

**F3 — RESOLVED. Containment is true as written, and the verification is honestly scoped.** Verified against the lockfile:
- `node_modules/sharp` → `optional: true`, `version: 0.35.3`. ✅
- **27** `@img/*` entries, and `every(optional === true)` → true. The record's count of 27 is exact. ✅
- `@xenova/transformers` is a project `optionalDependencies` entry (`{"@xenova/transformers":"^2.17.2","better-sqlite3":"^12.10.0"}`). ✅
- The degradation claim — *"`npm install` does **not** fail; the optional dependency simply doesn't install, and RAG degrades to unavailable, which `tools/rag.ts:127`'s dynamic-import guard already handles by design"* — is accurate: `:127` is the `await import` inside a `try` whose `catch` returns `null`. ✅

*Scope of verification* (`:67`) now says the smoke-rag result *"confirms the override works on **darwin-arm64** — the one platform this was run on — not universally across every platform `@img/*` ships prebuilts for."* That is the honest limit, and it replaces the unqualified "verified" that made the round-1 bullet self-contradictory. `scripts/smoke-rag.mjs` exists as cited. The three-part split (Containment / Scope of verification / Trigger) resolves the contradiction structurally rather than by softening a word, which is the better fix.

**F5 — RESOLVED, and the deletion is complete rather than merely the rationale being swapped.** The real design reason is now in the file (`:55`): *"spelled out inline rather than as an Escalation Routes table row, matching the version-literal Hard rule's inline STOP (`:20`) — the table below covers steps 7a-9 release-mechanics failures, not the build-gate disposition made at this step."* That is the argument I said I'd accept, recorded in the artifact rather than in chain chatter — which is the point, since E57 exists because an unrecorded standing exception accreted.

The test-pin reasoning is **gone**, not relocated: grep for `release-staging` / `dataRows` / `7 data rows` / `pins the table` / `exactly 7` across `content/skill-release-engineer.md` returns zero hits. Nothing in the shipped file now derives a design decision from a test's existence.

**Byte-pinned rows intact.** Extracted every `^| ` line from HEAD and from the working tree and diffed: **identical**, zero changes. This covers T-E57-03's and T-E53-02's explicit "do NOT touch" constraint and both byte-pins (`test/release-staging.test.mjs:757`, `test/verify-release.test.mjs:701`). Confirmed live by the test runs below.

**Non-blocking nit N1 — the `:20` cross-reference is off by two lines, and it is my error, not sr-engineer's.** `:55`'s new clause cites the version-literal Hard rule as `:20`. That rule is actually at **`:18`** (*"Version-assertion tests are self-updating…"*, which carries the `STOP and route to qa-engineer via next_role="qa-engineer"` inline STOP being referenced). Line `:20` is the *"CRITICAL — STOP on ⛔ rejection"* Hard rule. sr-engineer took `:20` verbatim from my round-1 F5 text, where I cited it wrong — so this is a defect I introduced and propagated. Explicitly **non-blocking**, for two reasons: the argument the clause makes survives the wrong line number intact (`:20` is *also* an inline STOP-with-halt rule living outside the table, so it is an example of the same pattern, just not the one named), and unversioned in-file line cites in this repo's SOPs drift on every insertion regardless. Worth correcting opportunistically — ideally to a phrase-anchored reference (*"the version-assertion-tests Hard rule"*) rather than a fresh line number that will drift again — but not worth a round 3.

**Non-blocking nit N2 — one circular tail clause at `:68`.** The trigger reads *"…would turn this override from merely out-of-range into an actively-unsupported combination rather than a merely-out-of-range one."* The `from merely out-of-range … rather than a merely-out-of-range one` construction says the same thing twice and reads as if a draft and its revision both survived. The meaning is not in doubt (out-of-range today → actively unsupported then), so this misleads no one; it just reads badly. Delete the trailing `rather than a merely-out-of-range one` if the file is touched again.

**Prose quality overall — dense but not misleading.** `:63` is one ~150-word sentence whose subject (*"A `process.dlopen`-interception probe"*) is separated from its verb (*"shows"*) by a long em-dash aside carrying the whole positive control. It is heavy going, and I would have split it. But I checked it specifically for the failure mode that would matter — a claim that contradicts itself or reverses direction mid-sentence — and there is none: every assertion inside the aside is independently verified true above, and the sentence's conclusion is the correct one. Same for `:83`. Per the review bar, style and sentence length are not verdict-holding; substance is, and the substance is right.

## Architecture

Unchanged from round 1 and still correct. The record stays a `docs/` artifact, the SOP points at it rather than restating dispositions, so there remains exactly one source of truth per advisory. Step 6a's boundary claims (*"outside release-engineer's Artifact allowlist"*, `next_role="pm"`) were verified in round 1 against `tools/transitions.ts` and neither the SOP's allowlist nor `transitions.ts` moved this round.

The round-2 restructure improves the record's architecture in one respect worth noting: F3's split into Containment / Scope of verification / Trigger gives the sharp row the same shape every other row already had (fact → decision → what would reopen it), so the document is now internally consistent about how a risk is presented.

**F7/F8 remain out of scope by design** — both are being filed as their own backlog rows per the E53→E58 precedent, which is the correct disposition (a constitution edit and a lockfile-root artifact are each their own review surface). Not required here and not held against this cut.

## Security

**The security reasoning is now correct, which is the whole reason round 1 blocked.** Round 1's objection was not that the outcome was wrong — it was that `:63` hung the central reachability claim on a probe with no discriminating power, in a document whose purpose is to be cited by someone who will not re-derive it. That is fixed at the root: the method is now valid, the finding is now the true one, and I confirmed a reader who repeats the stated procedure gets the stated result. The record's own framing is right that this **strengthens** its position — it now says libvips is resident and explains why that is acceptable (the resident binding is the patched 0.35.3 / 8.18.3, which is precisely what the override purchases), instead of claiming an absence of exposure that the first verification attempt would have disproved.

The narrowed residual argument is correctly narrowed: exposure now rests on *the pipeline never issuing a decode call* (`pipe(text, { pooling: "mean", normalize: true })` is text-only feature-extraction; the four libvips CVEs are all image-decode bugs), and `:63` states that dependency explicitly rather than leaving it implicit. That is a claim a future reader can actually check, and it is the correct one to make load-bearing.

The five HIGH advisories remain correctly dispositioned: `npm audit --audit-level=high` exits **0**. No code changed this round, so no new attack surface, no new trust boundary, no secrets. The `js-yaml 4.3.1` bump remains the highest-value single change in the cut (`yaml.load()` on attacker-influenceable handoff content on nearly every tool call).

## Performance

No findings. Round 2 changed prose only — no source, no hot path, no dependency resolution. Full suite `1690/1690` in ~40s and the two release suites `84/84` in ~19.5s, both consistent with round 1's timings; no duration regression. Round 1's two favorable second-order observations (js-yaml 4.3.1 is itself a quadratic-CPU-DoS fix; `@img/*` prebuilts replace 0.32's runtime-download path) still stand.

## Verdict

**APPROVED** — all five round-1 findings are genuinely fixed, not papered over: F1's reachability claim now reproduces exactly as written (both the `dlopen` result and the positive control re-verified from a clean process, with no residual "not loaded" framing anywhere in the file including section 5, which inherits by reference), F2's numbers match my own measurement digit for digit including `semver`'s `optional: true` characterization, F3's containment facts are all true as stated with the verification honestly limited to darwin-arm64, and F5/F6 record the real design reason with the test-pin rationale fully removed and the byte-pinned table rows untouched. No regression and no scope creep — audit exit 0, pins held at SDK 1.29.0 / transformers 2.17.2, tsc clean, 1690/1690, `dist/` unchanged, 4 files moved. Two non-blocking nits (N1 the `:20` line cite, which I introduced in round 1; N2 a circular tail clause at `:68`) are recorded for opportunistic cleanup and explicitly do not hold this verdict.

**Verification evidence, round 2**: `process.dlopen` probe → `@img/sharp-darwin-arm64/lib/sharp-darwin-arm64-0.35.3.node` + `onnxruntime_binding.node`; positive control → `vips 8.18.3` with 0/179 `moduleLoadList` matches; lockfile delta → 5 moves, +29/−21, 27 `@img/*` all `optional: true`; `npm audit --audit-level=high` exit 0; `npx tsc --noEmit` exit 0; `test/release-staging.test.mjs` + `test/verify-release.test.mjs` 84/84; `npm test` 1690/1690; Escalation Routes rows byte-identical to HEAD; `git status --porcelain -- test/` empty; `package.json`/`package-lock.json` mtimes precede the round-1 report.

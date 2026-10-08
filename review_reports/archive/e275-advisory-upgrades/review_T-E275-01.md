# Review — T-E275-01, T-E275-02

covers: T-E275-01, T-E275-02

## Round 1 — APPROVED — by code-reviewer

Reviewer model: opus. The sr-engineer ran on fable, so this is a different model and same-model bias is not suspected.
Inputs: `git diff f636029..HEAD` on `feat/e275-advisory-upgrades` (d328810, 6e48e19, 5416645) and `specs/e275-advisory-upgrades.md`. There is no architecture spec for this feature. Every factual claim below was re-measured in this lane's own `node_modules`, not taken from the writer's notes.

## Summary
- T-E275-01: `package.json` raises the `@modelcontextprotocol/sdk` floor `^1.29.0 → ^1.32.1` and `overrides.sharp` `^0.35.4 → ^0.35.5`. In the lockfile, only versions move: sdk 1.29.0→1.32.1, proxy-addr 2.0.7→2.0.8, sharp and `@img/sharp-*` 0.35.4→0.35.5, `@img/sharp-libvips-*` 1.3.3→1.3.4. No package was added or removed. I checked this by comparing the `packages` maps entry by entry against `f636029`.
- T-E275-02: `docs/dependency-advisories.md` adds §6 sdk and §7 proxy-addr, a §4 *Third round*, a §5 dated line, an updated HIGH heading, and one dated residual note.
- The scope matches AC8 exactly. No code, test, `dist/`, `scripts/` or `content/` file changed.
- Re-measured: `npm audit --audit-level=high` exits 0 (2 low / 6 moderate / 0 high / 0 critical). Build exits 0 with a clean `dist/`. `tsc --noEmit` exits 0. `node scripts/test-lock.mjs -- npm test` exits 0 at 3040 pass / 3043 (3 skipped, 0 fail).
- Verdict: APPROVED. All of AC1–AC9 are met. One `recommended` doc-precision finding (Q1) does not block.

## AC Completeness
AC1 — implemented — `npm audit --audit-level=high` exits 0 in the lane. The base lockfile at `f636029` (`--package-lock-only`) reproduces the spec's high 3 / critical 1 / moderate 6 / low 2.
AC2 — implemented — `npm ls` shows `@modelcontextprotocol/sdk@1.32.1`, `proxy-addr@2.0.8` (under express@5.2.1), and `sharp@0.35.5 overridden`. There are no `invalid` markers. The only `UNMET` lines are `UNMET OPTIONAL` platform binaries (`@esbuild/*`, `@img/*`) and the sdk's optional peer `@cfworker/json-schema`, which is expected.
AC3 — implemented — `package.json:37` (sdk `^1.32.1`) and `package.json:48` (`overrides.sharp` `^0.35.5`) are the only changed lines. No proxy-addr override was added, and the lockfile refresh alone reached 2.0.8. §7 records this as "lockfile refresh — no override".
AC4 — implemented — 3040/3043, 0 fail, 3 skipped. This matches the base count, so there is no count change to explain.
AC5 — implemented — `npm run build` exits 0 and `git status --porcelain dist` is empty.
AC6 — implemented — `docs/dependency-advisories.md` has `### 6.` and `### 7.`, `#### Third round` under §4 (rounds 1–2 untouched), and the §5 dated line. All three GHSA ids are present with links, dependency path, reachability, decision `upgrade`, and a re-review trigger. On the trigger wording (point (1)): the spec's parenthetical "libvips-class … per the §4 round-2 trigger text" is a PM description of why the round fires. The sr's statement is more precise and is correct: GHSA-wq5f-xc86-pv6w is titled "sharp : Vulnerability in librsvg dependency", librsvg is neither libvips nor libheif, so round 2's literal trigger did not fire, and the *How to use* "new advisory published against the already-upgraded version" clause did. The widened trigger closes the gap. This refines the AC's rationale and does not contradict its observable proof (the grep). I accept it.
AC7 — implemented — The HIGH heading now reads "7 packages" with the 2026-10-07 re-dispositions. The residual section has exactly one appended dated note with measured totals (2 low, 6 moderate). No table row changed.
AC8 — implemented — `git diff --name-only f636029` lists only `package.json`, `package-lock.json`, `docs/dependency-advisories.md`, `specs/e275-advisory-upgrades.md`, and `.current/e275/{dispatch.jsonl,handoff.md,tasks.md}`.
AC9 — implemented (not triggered) — The suite is green on sdk 1.32.1, so no bisect or Blocked path was needed.

## Correctness
No required findings. I checked the reachability claims myself instead of trusting them (point (3)):
- §6 sdk (GHSA-6qxp-vccf-f47h): `gh api /advisories/GHSA-6qxp-vccf-f47h` confirms high, CVSS 7.5, CWE-345/522, `>=1.12.0 <1.31.0`, fixed 1.31.0, and a 2.x line `@modelcontextprotocol/client <2.2.0`. Its "Not affected" list is "MCP servers built with the SDK" and "stdio clients". The project's SDK imports are exactly `server/index.js`, `server/stdio.js`, `types.js` (`index.ts:13-21`), `server/streamableHttp.js` (`transport/http.ts:10`), and `types.js` (`tools/registry.ts:10`). I traced the static plus dynamic import graph from those four entry modules through the installed sdk 1.32.1 `dist/esm`. It reaches 16 modules and none of them is under `client/`; its bare imports are `@hono/node-server`, `ajv`, `ajv-formats`, `content-type` and `zod*`. The "unreachable" claim holds.
- §7 proxy-addr (GHSA-jqcg-44mw-7w3h): confirmed critical, CVSS 9.1, CWE-290/348/697, `>=1.1.0 <2.0.8`. `transport/http.ts:8,92` uses `node:http` `createServer`. The SDK's `server/streamableHttp.js` imports `@hono/node-server` (`getRequestListener`), not express. The traced import graph has no express module. The only `express` hits outside `node_modules`/`dist` are test comments ("expressed", and an `express -> qs` comment in `test/dependency-overrides.test.mjs:51`), so there is no runtime use. The "unreachable" claim holds.
- §4 sharp (GHSA-wq5f-xc86-pv6w): confirmed high, CWE-416/1395, `<0.35.5`, fixed 0.35.5 (librsvg 2.63.2). The advisory's workarounds are `sharp.block({ operation: ["VipsForeignLoadSvg"] })` and a PIE `node` binary, as recorded. At runtime `sharp.versions` reports `rsvg 2.63.2`, `vips 8.18.7`, `heif 1.23.5`, `sharp 0.35.5`, which matches the record.
- Point (2), proxy-addr via `npm update proxy-addr`: the lockfile diff for `node_modules/proxy-addr` is version/resolved/integrity/funding only. express@5.2.1 declares `^2.0.7`, so 2.0.8 is in range and no override is needed. This matches §2/§3's precedent. Correct.
- The §6 claim "the SDK's moderate row is gone" is confirmed. The base audit lists `@modelcontextprotocol/sdk` and the post-upgrade audit does not. The sdk 1.32.1 manifest widens `@hono/node-server` to `^1.19.9 || ^2.0.5`. `@hono/node-server@1.19.14` and `hono@4.12.27` stay flagged, and hono carries exactly 8 advisory URLs, as the note says.

## Quality
- **Q1 (recommended)** — `docs/dependency-advisories.md`, 2026-10-07 residual note, the `fast-uri`/`ip-address` bullet ("§3's own trigger names promotion to HIGH as the point to re-check"). This misstates the existing triggers. §2 *Second round*'s trigger is "a new fast-uri advisory published against `>=3.1.7`", and §3's primary trigger is "a new ip-address advisory is published against `>=10.5.0`". Neither is limited to a severity. The "re-check if promoted to HIGH" clause in §3 applies only to the two named MODERATE siblings (GHSA-4xrf-jv44-h6hh, GHSA-22jq-vg5j-6vgg). The four ip-address advisories `npm audit` now reports (GHSA-rpw4-54j3-4h4q, -2vr4-cq9g-pvrc, -j6r3-76f7-8jcv, -h3mg-xc3c-68pw) are not those siblings. So, read literally, both triggers have fired, and they had already fired at base `f636029` before E275. Deferring them is still right: the record's header scopes it to HIGH/CRITICAL, and the spec puts moderates out of scope. But the sentence should say this, not suggest the triggers did not fire. The §4 *Third round* text is careful to name exactly which trigger fired, and this note falls short of that standard. Suggested rewording: "§2's and §3's literal re-review triggers ('a new advisory published against `>=3.1.7` / `>=10.5.0`') have fired on these moderate advisories. Because this record is HIGH/CRITICAL-scoped and E275 was cut HIGH-only, the re-review is deferred to the ticket that next takes this group, not decided here." This does not block: no decision is wrong and AC7's observable proof is met. It is worth fixing at release/doc time or in the next advisory ticket.
- **Q2 (optional)** — §7 Reachability, "No source file here contains `trust proxy`, `req.ip` or `express`". Literally, `test/dependency-overrides.test.mjs:51` contains `express` in a comment. "No runtime source file" would be exact. Cosmetic.
- 4b comment check: the diff adds no code comments, so there are no `agc check — comments` warnings to adjudicate.
- 4a expected-red sampling: not armed. No test files changed and there are no unexplained reds.

## Architecture
There is no `specs/e275-advisory-upgrades-architecture.md`. Layering is unchanged. The new rows follow the record's existing per-advisory format (GHSA, dependency path, reachability, decision, rejected, re-review trigger) and its append-only convention: rounds 1–2 of §4 and the residual table are untouched.

## Security
No findings. The change only removes the 1 critical and 3 high advisories. No new package entered the tree. All sdk/express/hono/ajv sub-dependencies stayed at their prior versions except proxy-addr. Each recorded decision is `upgrade`, so nothing was waived. Post-upgrade moderates on fast-uri 3.1.7 and ip-address 10.5.0 (point (4)) were already present at base and are out of scope per the spec. They are recorded, not decided (see Q1 for the wording).

## Performance
No findings. There is no runtime code change. The dependency moves are patch/minor bumps inside existing majors, and the full suite runtime and counts match the baseline.

## Verdict
APPROVED — all nine ACs are met and I re-verified them in the lane (audit, ls, lockfile diff, build/dist, tsc, full suite, advisory metadata, SDK import-graph reachability). The one recommended finding (Q1) is a doc-precision fix that does not block.

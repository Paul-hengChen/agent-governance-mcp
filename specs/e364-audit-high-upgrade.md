# e364-audit-high-upgrade

Source row: `docs/backlog.md` E364. Lane: e364, the insertion lane of post-v4 wave 11 (`specs/fanout-post-v4-w11.md`, Lanes row `e364`, "所有權重劃" e364 bullet, Decisions rows 2026-10-28). Same shape as E275 (`specs/e275-advisory-upgrades.md`). Human disposition 2026-10-28: **upgrade both**. Dispatch base `ab8dfbb`.

## Problem Statement

On dispatch base `ab8dfbb`, `npm audit --audit-level=high` exits 1 with exactly two HIGH findings, so the Constitution §6 dependency-audit gate blocks every build in lanes e139, e362 and e217. Neither advisory has a disposition in `docs/dependency-advisories.md`. The first is GHSA-mrhx-c7xc-m3w5 (`zod`, high, CVE-2023-54404, vulnerable `<4.6.6`). `zod` is a direct dependency declared `^4.4.3`, installed at 4.4.3, and the fixed 4.6.7 already falls inside the declared range. The second is GHSA-27r3-jxmh-p828 (`body-parser`, high, CVE-2026-111181, vulnerable `2.0.0 - <2.4.0`). It comes in transitively through `@modelcontextprotocol/sdk` → `express@5.2.1`, whose range is `^2.2.1`. It is installed at 2.2.2, and the fixed 2.4.0 is in range. Both fixes can be applied by refreshing the lockfile alone. No override and no SDK upgrade is needed.

## User Stories

- As a maintainer of any wave-11 lane, I want `npm audit --audit-level=high` to exit 0, so that the §6 build gate stops blocking unrelated work.
- As a future reader of `docs/dependency-advisories.md`, I want both new advisories to have a decision and a re-review trigger in the record's existing format, so that neither is waived ad hoc.
- As a consumer who installs this package as a dependency, I want the declared `zod` range to exclude vulnerable versions, so that my install cannot resolve or dedupe back to one.

## Acceptance Criteria

- **AC1** — Given the upgrade is installed into the lane's own `node_modules` (not the primary's), when `npm audit --audit-level=high` runs, then it exits 0. Baseline at `ab8dfbb`: exit 1, with exactly the two HIGH findings.
  proof: `npm audit --audit-level=high; echo "exit=$?"` prints `exit=0`.
- **AC2** — Given the refreshed lockfile, when the installed tree is listed, then `zod` resolves to `>=4.6.6` (expected 4.6.7) and `body-parser` to `>=2.4.0` (expected 2.4.0), with no `invalid` / `UNMET` / `extraneous` markers.
  proof: `npm ls zod body-parser --all` shows `zod@4.6.7` (deduped under the SDK) and `body-parser@2.4.0`, with none of those markers.
- **AC3** — Given the lockfile diff against `ab8dfbb`, when every `packages` entry is compared, then exactly the seven entries listed in **Expected lockfile delta** differ, and no lockfile field outside `packages` changes. If the lane's measurement differs from that list in any way, the sr-engineer records the actual list in `pending_notes` and in the advisory record, and STOPS for coordinator review before commit. The list is not quietly rewritten.
  proof: `git show ab8dfbb:package-lock.json > "$TMPDIR/e364-base-lock.json"` then `node -e 'const a=require(process.argv[1]).packages,b=require("./package-lock.json").packages;for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(JSON.stringify(a[k])!==JSON.stringify(b[k]))console.log(JSON.stringify(k),a[k]?.version??"(absent)","->",b[k]?.version??"(absent)")' "$TMPDIR/e364-base-lock.json"` prints exactly the seven rows of the expected-delta table.
- **AC4** — Given `package.json`, when it is diffed against `ab8dfbb`, then the only change is `dependencies.zod` going from `"^4.4.3"` to `"^4.6.6"`. There is no `overrides` entry, no `body-parser` declaration, and no other dependency, override or script change.
  proof: `git diff ab8dfbb -- package.json` shows exactly one `-`/`+` line pair, on `"zod"`.
- **AC5** — Given the upgrade, when the full suite runs on the final HEAD, then it is green: zero failing tests. The pass/skip/total counts equal the baseline measured in this lane at `ab8dfbb` after `npm ci` and before the upgrade, and any change in those counts is explained.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 with `# fail 0`.
- **AC6** — Given `npm run build`, when it runs after the upgrade, then it exits 0 and produces no diff under `dist/`. `dist/**` is forbidden in this lane, so a diff means stop and escalate. It is never committed.
  proof: `npm run build; echo "exit=$?"; git status --porcelain dist` prints `exit=0` and nothing else.
- **AC7** — Given `docs/dependency-advisories.md`, when it is read, then both dispositions are recorded in the file's existing per-section format: GHSA link plus CVE, severity/CVSS/CWE, vulnerable and fixed range, dependency path, reachability, decision **upgrade** with the mechanism and the verified result, and a **re-review trigger**:
  - new `### 8. zod` section: a direct dependency, first time in the record. Its decision states the floor raise to `^4.6.6` and the reason (see **Zod floor decision**).
  - new `### 9. body-parser` section: transitive through sdk → express, fixed by lockfile refresh with no override. Its decision states the knock-on moves (`iconv-lite`, `type-is`, two nested `content-type@2.1.0`), and explains why the root `content-type` 1.0.5 stays.
  proof: `grep -nE '^### [89]\. |GHSA-mrhx-c7xc-m3w5|GHSA-27r3-jxmh-p828' docs/dependency-advisories.md` shows both headings and both GHSA ids, and each new section contains a `**Re-review trigger**` bullet.
- **AC8** — Given the record's header and residual section, when they are updated, then two changes are made:
  - the `## HIGH advisories (...)` heading count and parenthetical say 9 packages and name the 2026-10-28 additions (§8, §9).
  - the "Out of scope: residual low/moderate findings" section gets ONE new dated note (2026-10-28). The note states the post-upgrade `npm audit` totals as measured (expected 7 findings: 1 low, 6 moderate, 0 high, 0 critical). It records that the `body-parser` low GHSA-v422-hmwv-36x6 cleared as a side effect of 2.4.0. It says the group stays deliberately undecided. Existing table rows and existing dated notes are left unchanged.
  proof: `git diff ab8dfbb -- docs/dependency-advisories.md` shows the heading edit, the two new sections, and a single appended dated note, with no `-` lines inside the residual table or the earlier notes.
- **AC9** — Given the lane scope, when the diff is inspected, then only these paths changed: `package.json`, `package-lock.json`, `docs/dependency-advisories.md`, `specs/e364-*`, `qa_reports/*E364*`, `review_reports/*E364*`, `.current/e364/**`.
  proof: `git diff --name-only ab8dfbb` lists only those paths.
- **AC10 (mechanism)** — Given the install hard conditions, when the sr-engineer reports, then the report shows three things. First, `node_modules` was a symlink, was removed with `rm node_modules`, and was then installed with `npm ci`. Second, `npm audit fix` (with or without `--force`) was never run. Third, the primary checkout's `node_modules` was never written through the symlink.
  proof: sr-engineer `pending_notes` and the review report quote the command sequence actually run, and `test -L node_modules; echo $?` prints `1` (a real directory now).
- **AC11 (stop-rule)** — Given that the upgrade turns any build or test red, when that happens, then the sr-engineer STOPS. They make no code or test edits, and they record the failing test names and the versions tried in `pending_notes`. They set status Blocked, and the coordinator escalates to the integrator. One bisect is allowed: pin `zod` to exactly 4.6.6 (the first fixed version) in the lockfile, keeping the `^4.6.6` floor. No other version may be tried.

## Expected lockfile delta

The coordinator measured this on a scratch copy with npm 10.9.8, and PM re-measured it with the `^4.6.6` zod floor applied (`npm update zod body-parser --package-lock-only`). The sr-engineer must re-verify it in the lane (AC3).

| lockfile `packages` key | before (`ab8dfbb`) | after | why |
|---|---|---|---|
| `""` (root) | `dependencies.zod: "^4.4.3"` | `dependencies.zod: "^4.6.6"` | mirror of the `package.json` floor raise (AC4) |
| `node_modules/zod` | 4.4.3 | 4.6.7 | the GHSA-mrhx-c7xc-m3w5 fix. 4.6.7 is the latest 4.x, and 4.6.6 is the first fixed version |
| `node_modules/body-parser` | 2.2.2 | 2.4.0 | the GHSA-27r3-jxmh-p828 fix (latest) |
| `node_modules/iconv-lite` | 0.7.2 | 0.7.3 | knock-on: body-parser 2.4.0 declares `^0.7.3` |
| `node_modules/type-is` | 2.0.1 | 2.1.0 | knock-on: body-parser 2.4.0 declares `^2.1.0` |
| `node_modules/body-parser/node_modules/content-type` | (absent) | 2.1.0 | knock-on: body-parser 2.4.0 declares `^2.1.0`. The root `content-type` 1.0.5 stays for express and the SDK (`^1.0.5`) |
| `node_modules/type-is/node_modules/content-type` | (absent) | 2.1.0 | knock-on: type-is 2.1.0 declares `^2.0.0` |

No other `packages` entry and no top-level lockfile field changes. `npm audit` after the change: 0 critical, 0 high, 6 moderate, 1 low (`@hono/node-server`, `esbuild`, `fast-uri`, `hono`, `ip-address`, `protobufjs`, `qs`). All new versions declare `node >=18` or lower, which is compatible with the CI Node 20 + 22 matrix.

## Zod floor decision

**Raise `dependencies.zod` from `^4.4.3` to `^4.6.6`.** Reason in one line: npm ignores a dependency's own `package-lock.json`, so for anyone who installs this package as a dependency (the `npx github:` path) the declared range is the only constraint, and `^4.4.3` still lets their tree resolve or dedupe to a vulnerable 4.4.3–4.6.5. This is the §1 js-yaml round-2 reason, "so a fresh install cannot resolve back". The floor is the first fixed version (4.6.6), not the installed 4.6.7, so that it marks the security boundary and does not chase the latest release. It stays compatible with the SDK's `zod` peer range `^3.25 || ^4.0`, so the SDK keeps deduping to the root copy. `body-parser` gets no equivalent: it is not a declared dependency, and an `overrides` entry would not help consumers either, because npm applies `overrides` only from the root project. The lockfile alone does the job, so no override is added.

## Reachability notes for the record (sr-engineer verifies before writing)

- **zod — reachable, recorded as context only.** `tools/registry.ts` validates every tool call's arguments with zod, and `index.ts` imports it. The SDK declares `zod: ^3.25 || ^4.0` and dedupes to the root copy, so the SDK's own JSON-RPC message schemas parse every inbound message through the vulnerable version. The project's own `z.array` fields are all `.max()`-capped, but the SDK's protocol schemas are outside this project's control, so the "array schema without a length constraint" case can be reached from the client (stdio) or the network (HTTP mode). The human ruled upgrade, so no reachability argument is relied on.
- **body-parser — likely unreachable, recorded as context only.** This is the same boundary as §7 proxy-addr. `transport/http.ts` uses `node:http` `createServer` and the SDK's Streamable HTTP transport, not Express. body-parser is loaded only through express, inside SDK modules this project does not import. The sr-engineer must confirm this by grep before writing "unreachable". The advisory's crash path is a `Content-Encoding` body with trailing bytes after one valid compressed frame.

## Re-review triggers (minimum content for AC7)

- **zod**:
  - a new zod advisory published against `>=4.6.6` (mechanical: `npm audit --audit-level=high`).
  - the SDK narrowing its zod range so that a nested vulnerable copy appears under `node_modules/@modelcontextprotocol/sdk/node_modules/zod` (mechanical: `npm audit`).
  - a zod major migration (5.x), which does not carry this row over automatically.
- **body-parser**:
  - `express` lowering its own `body-parser` range below `2.4.0`, or a new body-parser advisory published against `>=2.4.0` (both mechanical: `npm audit --audit-level=high`).
  - this project starting to use Express or body-parser directly, which would make the crash path reachable (attention-dependent).

## Verification recipe (sr-engineer, in the lane worktree only)

1. `rm node_modules`. This removes only the symlink to the primary. Confirm first with `test -L node_modules`.
2. `npm ci` at base: the baseline install. Then `npm audit --audit-level=high; echo "exit=$?"`, expecting `exit=1` with the two HIGH findings. Then `npm run build`, then `node scripts/test-lock.mjs -- npm test`, and record the baseline pass/skip/total.
3. Edit `package.json` `"zod": "^4.4.3"` → `"zod": "^4.6.6"`.
4. `npm update zod body-parser --package-lock-only`. Never `npm audit fix`, and never `--force`.
5. `npm ci`, to install the refreshed lockfile into the lane's own `node_modules`.
6. Check AC1–AC4 (audit, `npm ls`, lockfile delta script, `package.json` diff).
7. Run `npm run build` and confirm there is no `dist/` diff (AC6). Then run `node scripts/test-lock.mjs -- npm test` (AC5).
8. Write §8, §9, the heading edit and the residual note in `docs/dependency-advisories.md` (AC7, AC8), quoting the measured numbers.
9. Commit `package.json`, `package-lock.json`, `docs/dependency-advisories.md` (title carries `E364`). Do not stage `node_modules`, `dist/` or anything else.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no user-facing strings; the record text in `docs/dependency-advisories.md` is internal documentation authored-here following the existing sections' format |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Moderate and low advisories (`qs`, `protobufjs`, `ip-address`, `hono`, `@hono/node-server`, `fast-uri`, `esbuild`). Re-tabulating the residual table is also out of scope. Only one dated note is added (AC8).
- Any `@modelcontextprotocol/sdk` or `express` upgrade, `npm audit fix` in any form, and any `overrides` change.
- Any code, test, `dist/`, `scripts/`, `content/` or other `docs/**` edit. Version bump, CHANGELOG and backlog done-marking are release-engineer / integrator work after PASS.
- A pin test for the `zod` floor is not warranted. `npm audit --audit-level=high` runs at every §6 build gate and is already the mechanical re-fire channel for both triggers, and `test/**` is forbidden in this lane anyway.

## Dependencies / Prerequisites

- The lane worktree `../agent-governance-mcp-lanes/e364` starts with `node_modules` as a symlink to the primary. The recipe above replaces it with the lane's own install. The primary's install is never touched.
- This lane must merge to `main` first. Lanes e139, e362 and e217 then take it in through the integrator's mid-flight base fix (`specs/fanout-post-v4-w11.md` Decisions 2026-10-28).
- External references: GHSA-mrhx-c7xc-m3w5 and GHSA-27r3-jxmh-p828 advisory pages, both fetched at cut time (2026-10-28). Their facts are quoted in the Problem Statement and the reachability notes.
- Visual Structural Assertions are omitted: there is no `design/e364-*.md`, so mode = no-design.
- Dispatch: `pm=opus`, `sr-engineer=opus` (wave manifest). Dispatch mode is `feature`: this is a dependency chore, so repro-first does not apply. Chain: sr-engineer → code-reviewer → qa-engineer. No architect: one module, no data model or API change.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E364-01 | sr: follow the Verification recipe. `rm node_modules` + `npm ci` and baseline measurement. Raise the `zod` floor to `^4.6.6`. `npm update zod body-parser --package-lock-only`, then `npm ci`. Verify the seven-entry lockfile delta, audit exit 0, no `dist/` diff and a green full suite (AC1–AC6, AC10). Record §8 zod and §9 body-parser, the heading edit and the 2026-10-28 residual note in the advisory record (AC7, AC8). Follow the AC11 stop-rule on any red. No `npm audit fix`, no overrides. Commit title carries `E364` | none | 3 | `package.json`, `package-lock.json`, `docs/dependency-advisories.md` | — |
| T-E364-02 | qa: re-run AC1–AC6 and AC9 independently on the committed HEAD with a clean tree. This includes the lockfile-delta script and `node scripts/test-lock.mjs -- npm test` as the final full suite. Cross-check the §8/§9 facts against the two GHSA pages (AC7) and the residual note against a fresh `npm audit` (AC8). No new test files | T-E364-01 | 0 | — | — |

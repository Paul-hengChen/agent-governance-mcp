# Review — T-E364-01

covers: T-E364-01

## Summary
- Reviewed commit 14fa252 vs base ab8dfbb: `package.json` (zod floor `^4.4.3` -> `^4.6.6`), `package-lock.json`, `docs/dependency-advisories.md` (heading edit, new §8 zod, §9 body-parser, one dated residual note).
- Lockfile delta independently re-measured: exactly the seven specified entries; no top-level lockfile field changed.
- `npm audit --audit-level=high` exits 0 in the lane install; totals 7 (1 low, 6 moderate); `npm ls` clean.
- Reachability and advisory facts verified against source and the GitHub advisory API.
- Verdict: APPROVED, zero required findings.

## AC Completeness
AC1 — implemented — `npm audit --audit-level=high` exit=0 (re-run here, lane's own node_modules).
AC2 — implemented — `npm ls zod body-parser --all`: single zod@4.6.7 deduped under both SDKs and zod-to-json-schema; body-parser@2.4.0 under express@5.2.1; no invalid/UNMET/extraneous markers.
AC3 — implemented — AC3 script vs `git show ab8dfbb:package-lock.json` prints the root entry (only `dependencies.zod` differs), zod 4.4.3->4.6.7, body-parser 2.2.2->2.4.0, iconv-lite 0.7.2->0.7.3, type-is 2.0.1->2.1.0, two new nested content-type 2.1.0; top-level fields (all but `packages`) identical.
AC4 — implemented — package.json diff is a single -/+ pair on `"zod"` (package.json:40); the one existing `overrides` block (sharp) is untouched.
AC5 — not re-run (qa scope per assignment); no code/test files in the diff, so no mechanism for a change.
AC6 — implemented (by inspection) — diff touches no `dist/` path; build re-verification left to qa.
AC7 — implemented — docs/dependency-advisories.md §8 and §9 contain GHSA link + CVE, severity/CVSS/CWE, vulnerable/fixed range, path, reachability, decision with mechanism and verified result, and a `**Re-review trigger**` bullet; §9 explains iconv-lite/type-is/nested content-type and why root content-type 1.0.5 stays.
AC8 — implemented — heading says 9 packages and names the 2026-10-28 additions; one appended dated note with measured totals (matches my `npm audit --json`: low 1, moderate 6, high 0, critical 0, same seven package names), body-parser low GHSA-v422-hmwv-36x6 clearance recorded, group stays undecided. Only one `-` line in the whole file diff (the heading itself); no table row or earlier note touched.
AC9 — implemented — the commit touches only the three owned files. (Base-to-branch name list also shows `.current/e364/**` and `specs/e364-*`, both allowed.)
AC10 — partial/unverifiable from diff — `test -L node_modules` prints 1 (real directory, verified). The command sequence and never-ran-`npm audit fix` claim cannot be proven from the diff; no `overrides`/audit-fix artefacts exist in the diff. Not blocking (qa/coordinator evidence).
AC11 — not triggered (no red).

## Correctness
No findings.
- Advisory facts checked against the GitHub advisory API: GHSA-mrhx-c7xc-m3w5 = CVE-2023-54404, high, CVSS 7.5, CWE-770, vulnerable `<4.6.6`, fixed 4.6.6. GHSA-27r3-jxmh-p828 = CVE-2026-111181, high, CVSS 7.5, CWE-248, vulnerable `>=2.0.0 <2.4.0` and `<1.20.9`, fixed 2.4.0 (and 1.20.9). All match §8/§9.
- Reachability, body-parser: no project `.ts`/`.mjs` import of express or body-parser; project imports only SDK `server/index.js`, `server/stdio.js`, `server/streamableHttp.js`, `types.js`. Within SDK dist, non-example `express` imports are only `server/express.js` and `server/auth/**` (router/handlers); `transport/http.ts:92` uses `http.createServer`. "Unreachable" is true. (I did not re-run the runtime resolve probe; the static import graph agrees.)
- Reachability, zod: SDK `types.js` has 33 `z.array` occurrences, 1 matching a same-line `.max(`; `icons: z.array(IconSchema).optional()` at types.js:293 is real and uncapped. Project's own three arrays are `.max()`-capped (tools/registry.ts:298,299,424). "Reachable via SDK schemas" is true. The "32 of 33" figure is consistent with my same-line grep (a multi-line cap could shift it by one; immaterial to the argument).
- SDK stays 1.32.1 (`^1.32.1` unchanged); SDK zod range `^3.25 || ^4.0` admits the new floor.
- The §9 statement that the low GHSA-v422-hmwv-36x6 cleared is consistent with body-parser absent from the post-upgrade audit list.

## Quality
No findings (optional): §8/§9 bullets are long single lines, but this matches the §6/§7 bullet style and the "Rationale/Verified" density of earlier rounds. Section structure (GHSA / Dependency path / Reachability / Decision / Re-review trigger) matches §6 and §7. Re-review triggers are specific, mostly mechanical (`npm audit`), with attention-dependent ones labelled as such, and cover all minimum content in the spec.

## Architecture
No architecture spec for this feature. No source, gate, or registry change; no `overrides` added; no SDK move.

## Security
No findings. The change closes two HIGH advisories. Information hygiene: grep of the record for absolute paths, usernames, internal hostnames finds nothing (only public github.com advisory URLs). The record text mentions no lane/local paths.

## Performance
No findings. Dependency refresh only; no source change.

## Verdict
APPROVED — the diff matches the spec's expected seven-entry lockfile delta, audit exits 0, record facts are verified true against source and the advisories, and scope is limited to the three owned files.

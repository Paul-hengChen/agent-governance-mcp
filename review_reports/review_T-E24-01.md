# Code Review — e24-exemptions-manifest T-E24-01..03

covers: T-E24-01, T-E24-02, T-E24-03

Feature: `e24-exemptions-manifest` (backlog E24, 104447-F0 C2) — declarative
build-gate exemption manifest `.current/exemptions.json`.
Scope reviewed: T-E24-01 (loader `tools/exemptions.ts`), T-E24-02 (read-time
surface in `tools/handoff.ts` tw_get_state envelope), T-E24-03 (const §2 bullet
+ golden/monolith regeneration).
Base: commit `3141a2a` vs its parent. Reviewer model: opus (sr-engineer pinned
`fable` — different model, different blind spots; no same-model bias risk).
Clean-context: reviewed the diff, the backlog E24 row + approved cut, and the
`qa_reports/expected-red_e24-exemptions-manifest.txt` machine data (SOP 4a
carve-out). No spec/architecture file exists for this mini-chain feature.

## Round 1 — APPROVED — by code-reviewer

## Summary
- New never-throw loader `tools/exemptions.ts` (178 lines) reads/validates
  `.current/exemptions.json` (`path` + `reason` + `expires_when` entries),
  and `readHandoffState` surfaces it read-time on both envelope branches.
- One const §2 bullet added declaring the manifest the ONLY sanctioned
  exemption channel; regenerated across all 11 golden/monolith/hook fixtures.
- Scope matches the approved cut exactly in both directions: no expiry engine,
  no server gate/GATE_REGISTRY entry, no SQLite surface, no handoff schema
  bump. ~4-file source scale. Nothing widened, nothing missing.
- Build green (tsc, zero errors); suite 1499/1503 with the 4 reds exactly the
  declared context-budget pins.
- Verdict: APPROVED.

## Correctness
No blocking findings.
- **Never-throw guarantee holds** (`tools/exemptions.ts:74`). This is the
  load-bearing property — `loadExemptions` runs at `handoff.ts:536` *before*
  `readAndMigrate`, on the mandatory `tw_get_state` pre-flight path; a throw
  would brick that call for the whole workspace. Every throw site is contained:
  `fs.readFileSync` (try/catch, ENOENT→null, other→loud), `JSON.parse`
  (try/catch→loud), and all structural/per-entry checks return value objects.
  The `forEach` callback and `readEntryField` do only typeof/`.trim()` on
  already-narrowed values — no throw surface. Verified no unguarded call.
- **All return paths surface exemptions** (`handoff.ts:546`, `:678`). The two
  envelope exits (fresh `exists:false` and `exists:true`) both spread
  `...(exemptions && { exemptions })`. The only other exit between the
  computation and the return is the fire-and-forget migration heal
  (`void writeHandoffState(...).catch()`, `:563`) which does not return — so no
  path drops the surface. `null` (absent manifest) correctly omits the key.
- **Never-silently-exempt fail direction is correct.** Structural malformation
  (unreadable / bad JSON / non-object root / unsupported `schema_version` /
  non-array `exemptions`) voids the whole manifest to zero exemptions + loud
  `errors[]` (`:96,:106,:116,:139,:148`). A future/unknown `schema_version`
  (including string `"1"` ≠ numeric `1`, and `null`) refuses loud rather than
  guessing — matches the versions.ts refuse-loud posture. Per-entry
  malformation drops only that entry with a loud error, valid siblings survive
  (`:157,:166`). Partial validity fails toward enforcement, never exemption.
- **`count === valid-entries only`** (`:174`) — the only-grows metric counts
  pushed (valid) entries, not raw input length. Correct.
- **Expected-red sampling (SOP 4a):** all 4 manifest entries sampled against
  `test/context-budget.test.mjs` — lines 220, 853, 1010, 1581 — each is a
  real, locatable test. The 4 suite reds match these 1:1; they are token-budget
  pins tripped by the bullet's +188 ~tok, the artifact to re-baseline (QA
  scope), not defects.

## Quality
- **Minor (non-blocking):** `readEntryField` is called redundantly — once in
  the `missing` filter (`:161`) and again per field in the `entries.push`
  (`:169-171`), so each valid field is validated twice. N is tiny (3 fields ×
  small manifest); readability is fine and it mirrors the config.ts posture.
  Not worth a round-trip.
- Naming, module-header documentation, and the per-field non-fatal filter
  structure faithfully follow the `tools/config.ts` precedent cited in the cut.
  Strict typing clean: `unknown` at the JSON boundary, narrowed via typeof
  guards, the two `as string` casts are post-validation and sound. No `any`.

## Architecture
- **No handoff schema bump** — confirmed. The surface is a pure read-time spread
  into the JSON envelope with no new persisted field, no `CURRENT_VERSIONS`
  touch, no migration. Correctly modeled on the v10 stale_dispatch advisory.
- **File-mode only** — `storage-sqlite.ts` is untouched (not in the diff);
  `loadExemptions` reads the filesystem directly. This is the deliberate,
  precedented E10/E18 file-mode posture stated in the cut, not an omission.
- **No server gate** — consistent with the cut: §2 build gate is a behavioral
  role-SOP rule, never a server GATE_REGISTRY entry, so "gates subtract
  exempted paths automatically" is satisfied by machine-surfacing the manifest
  + the unambiguous constitution rule. No gate code was expected or written.
- Birth `schema_version` 1 intentionally not registered in `schema/versions.ts`
  (no migrations at v1); the header documents wiring v2 per
  `docs/schema-versions.md`. Sound.

## Security
No findings. The manifest is a committed, human-approved workspace file. Input
crosses a trust boundary only as JSON (guarded parse) and string fields;
`path`/`expires_when` are recorded strings — never resolved, executed, or used
in a filesystem/shell operation by this loader (consumers subtract by match).
No secrets, no injection vector, no unvalidated boundary.

## Performance
No findings. Adds one small synchronous file read (or ENOENT) per
`tw_get_state` — a once-per-call cold path, not a hot loop; the header
correctly declines to mirror the config.ts mtime cache. No algorithmic
regression: validation is a single O(n) pass over entries.

## Verdict
APPROVED — implementation matches the approved E24 cut exactly in both scope
directions, the never-throw / never-silently-exempt invariants hold, build is
green, and the 4 suite reds are precisely the declared context-budget
re-baseline pins. Handing off to qa-engineer.

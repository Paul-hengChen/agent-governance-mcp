# Architecture: figma-baseline-manifest-gate

> Feature ID: `figma-baseline-manifest-gate`
> Version tag: `v3.40.0`
> Mode: `no-design` (server + SOP change only)
> Source spec: `specs/figma-baseline-manifest-gate.md`
> Precedent mirrored: v3.38.0 `qa-visual-baseline-provenance` (`checkVisualProvenance` / `parseVisualProvenanceRows`)

This blueprint pins every contract sr-engineer needs to implement the gate with
zero further design decisions. The gate is the **sixth and last visual sub-gate**
in the `tw_update_state` PASS path: it parses `design/<feature>.md` (NOT a
qa report) for a frozen baseline manifest and rejects PASS when the manifest is
absent (with audited rows missing) or — for multi-surface selections — when the
`## Baseline Selection Provenance` section is incomplete.

---

## Affected Files

| File | Change |
|------|--------|
| `tools/evidence-file.ts` | ADD three exports: `parseBaselineManifestRows()` (pure), `hasBaselineProvenance()` (pure), `checkBaselineManifest()` (fs composition). New interfaces `BaselineManifestRow`, `BaselineManifestCheck`. Appended as a new `// ---------- v3.40.0 ----------` section after `checkVisualProvenance`. |
| `index.ts` | ADD import of `checkBaselineManifest` (line ~64, beside `checkVisualProvenance`). ADD the sixth sub-gate block inside `if (visualGate.present) { if (armCheck.required) { … } }`, immediately AFTER the `VISUAL_PROVENANCE_MISSING` block (closes ~line 957). BUMP `Server()` version literal `"3.39.0"` → `"3.40.0"` (line 212). |
| `package.json` | BUMP `"version": "3.39.0"` → `"3.40.0"` (AC-9). |
| `content/constitution.md` | ADD a §3.1 bullet (inside the `<!-- design-only -->` span) describing the new gate + both error codes. BUMP the `# Constitution v3.28.0` header → `v3.40.0` (recommendation — see Decision Records). |
| `content/skill-design-auditor.md` | (already carries step 2c from v3.39.0 — no change required by this feature; the gate ENFORCES the existing prose). Verify only. |
| `CHANGELOG.md` | ADD `## [3.40.0]` entry (AC-10) — doc-writer owns post-PASS, but qa verifies presence. |
| `README.md` | doc-writer post-PASS. |
| `test/baseline-manifest-gate.test.mjs` | NEW test file (see Test Surface). |

No new files in `tools/`, `guards/`, `schema/`. No migration module.

---

## Data Structures

New TypeScript types in `tools/evidence-file.ts`. The check result shape mirrors
the established `{ ok, <offenders-map> }` convention used by `VisualProvenanceCheck`
and `UncheckedWidgetsCheck` — NOT a `{ ok, code, detail }` shape (no such shape
exists in this file; every visual sub-gate returns `ok` + a typed offender field
and the index.ts caller composes the error string). The gate has TWO distinct
error codes, so the result carries an enum-ish `code` field to let the caller pick
the right error template.

```ts
// One parsed data row from the `## Source` manifest table.
export interface BaselineManifestRow {
  medium: string;          // first table cell (e.g. "figma", "image"); "" if absent
  pointer: string;         // node-id / pointer cell; "" if blank
  status: string;          // normalized lowercase status: "audited" | "deferred" | "out-of-scope" | "unknown" | <raw>
  isAudited: boolean;      // status === "audited" AND pointer non-empty (frozen-row predicate)
  rawLine: string;         // the source table line, for debugging
}

// Result of the composition helper. `code` selects the index.ts error template.
export interface BaselineManifestCheck {
  ok: boolean;
  code: null | "BASELINE_MANIFEST_MISSING" | "BASELINE_PROVENANCE_INCOMPLETE";
  detail: string;          // human-readable specifics for the error string (e.g. "0 audited rows" / "2 audited rows, provenance section absent"); "" when ok
  designPath: string;      // resolved design/<feature>.md path, for the error hint
  auditedCount: number;    // number of audited rows found (0 when dormant or genuinely empty)
}
```

`code === null && ok === true` is the silent-pass / dormant case. The caller only
emits an error when `ok === false` (then `code` is always non-null).

---

## Interface Contracts

### 1. `parseBaselineManifestRows(content: string): BaselineManifestRow[]` (pure — AC-6, AC-7)

- **Input**: full text of `design/<feature>.md` (or `""`).
- **Output**: one row per DATA line of the markdown table under the `## Source` H2.
  Header row and the `|---|` separator row are skipped. Empty array when content is
  empty, when no `## Source` section exists, or when the section has no table.
- **MUST NOT** perform I/O. **MUST NOT** throw (wrap nothing — it is pure string work;
  no try/catch needed, but never index into possibly-undefined captures without guards).

**Section location** — reuse the existing private `sliceH2Section(content, "Source")`
helper (already in this file, line ~376). It returns the section body up to the next
`## ` heading or EOF, or `null` if absent. If `null` → return `[]`.

> Note: `sliceH2Section` matches `^##\s+Source\b` case-insensitively via its
> internal `^##\\s+${escapeRegex(heading)}\\b` pattern. `\b` after `Source`
> means `## Source manifest` and `## Source` both match, but `## Sources` does
> NOT (no word boundary). The design-auditor template emits exactly `## Source`,
> so this is correct. Do NOT pass a custom regex; reuse `sliceH2Section`.

**Row extraction** — within the section body, iterate lines; a data line is any
trimmed line starting with `|` that is NOT the separator row (`^\|[\s:|-]+\|?$`)
and NOT the header row. Reuse the EXACT cell-splitting logic already proven in
`parseAssertionFailures` / `parseRegionDiffFailures` (split on `|`, shift/pop the
leading/trailing empty cells, trim each). Columns are positional per the spec
schema `medium | pointer | fetched? | status | reason`:

- `medium`  = cells[0]
- `pointer` = cells[1]  (the node-id)
- `status`  = the cell whose header is `status` — but since the parser cannot see
  the header when iterating data rows, resolve the status column **by header index
  detected on the header row**, falling back to positional index 3 (the 4th column)
  when no header is detectable.

  **Header detection rule (pin this exactly):** scan the section's table lines; the
  header row is the first `|`-line whose cells (lowercased, trimmed) include a cell
  matching `/^status$/`. Record that cell's zero-based index as `statusIdx` and the
  cell matching `/^(pointer|node-?id)$/` as `pointerIdx` and `/^medium$/` as
  `mediumIdx`. If no header row contains a `status` cell → **AC-7 backwards-compat:
  treat every data row as audited** (set `status = "audited"`, `isAudited` = pointer
  non-empty). This is the "pre-manifest-gate table with no status column" path.

- `status` normalization: `cells[statusIdx]` (if `statusIdx` in range, else `""`),
  `.toLowerCase().trim()`, strip surrounding backticks. Map: if it contains the
  substring `audited` → `"audited"`; contains `defer` → `"deferred"`; contains
  `out-of-scope` or `out of scope` → `"out-of-scope"`; empty → `"unknown"`; else the
  raw lowercased token. (Substring match, not exact, so `status: audited ✅` or
  `audited (frozen)` still counts — tolerant of operator decoration, matching the
  permissive spirit of `parseDesignMode`.)

- `isAudited` = `status === "audited" && pointer.trim().length > 0`. A row marked
  audited but with a blank pointer is NOT a frozen row (AC-1(b): "non-empty node-id
  value").

> A markdown table with NO header at all (just data rows) is malformed per the
> design-auditor template; treat it via the no-status-column fallback (all-audited).
> This favours not blocking legitimate-but-quirky designs over strictness; the
> multi-surface provenance gate still applies if ≥2 rows result.

### 2. `hasBaselineProvenance(content: string): boolean` (pure — AC-8)

- Returns `true` **iff** the document contains a `## Baseline Selection Provenance`
  H2 section (case-insensitive) whose body contains BOTH a `filter-conditions:` line
  AND an `exclusion-reasons:` line.
- Implementation: `const body = sliceH2Section(content, "Baseline Selection Provenance");`
  If `body === null` → `false`. Then:
  - `const hasFilter = /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?filter-conditions(?:[^\S\n]*\*\*)?[^\S\n]*[:—-]/im.test(body);`
  - `const hasExclusion = /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?exclusion-reasons(?:[^\S\n]*\*\*)?[^\S\n]*[:—-]/im.test(body);`
  - return `hasFilter && hasExclusion`.
- The label regexes are the SAME permissive shape as `BASELINE_LINE_RE` /
  `DIFF_METRIC_LINE_RE` (optional bullet, optional bold, `:`/`—`/`-` separator) — for
  consistency with v3.38.0. They only test for label PRESENCE; the VALUE after the
  colon is not validated (a non-empty value is not required by AC-8 — only the line's
  presence). Pure; no I/O; never throws.

> Scoping the search to the section body (via `sliceH2Section`) — NOT the whole
> document — is load-bearing: it prevents a stray `filter-conditions:` mention
> elsewhere (e.g. in a code block or prose) from falsely satisfying the gate.

### 3. `checkBaselineManifest(workspacePath: string, activeFeature: string): BaselineManifestCheck` (fs composition)

Mirrors `checkVisualProvenance` / `validateVisualReports` structure: reads the design
file once, calls the two pure parsers, applies the decision tree, returns the typed
result. Never throws (fs errors → dormant silent pass).

```ts
export function checkBaselineManifest(
  workspacePath: string,
  activeFeature: string,
): BaselineManifestCheck {
  const designPath = designFilePath(workspacePath, activeFeature);   // reuse existing private helper
  const dormant: BaselineManifestCheck =
    { ok: true, code: null, detail: "", designPath, auditedCount: 0 };

  if (!activeFeature || !fs.existsSync(designPath)) return dormant;   // AC-4 (no design file)
  let content: string;
  try { content = fs.readFileSync(designPath, "utf-8"); }
  catch { return dormant; }

  // Opt-in arm (AC-N3): dormant when there is NO `## Source` section at all.
  if (sliceH2Section(content, "Source") === null) return dormant;

  const rows = parseBaselineManifestRows(content);
  const auditedCount = rows.filter((r) => r.isAudited).length;

  // AC-1(b) / AC-N4: `## Source` present but zero audited rows → manifest missing.
  if (auditedCount === 0) {
    return { ok: false, code: "BASELINE_MANIFEST_MISSING",
             detail: `## Source present but 0 audited rows (${rows.length} total row(s))`,
             designPath, auditedCount: 0 };
  }

  // AC-3 / AC-N2: exactly 1 audited row → single-surface; provenance EXEMPT.
  if (auditedCount === 1) return { ok: true, code: null, detail: "", designPath, auditedCount };

  // auditedCount >= 2 → multi-surface; require complete provenance section (AC-2).
  if (!hasBaselineProvenance(content)) {
    return { ok: false, code: "BASELINE_PROVENANCE_INCOMPLETE",
             detail: `${auditedCount} audited rows but ## Baseline Selection Provenance absent or missing filter-conditions:/exclusion-reasons:`,
             designPath, auditedCount };
  }
  return { ok: true, code: null, detail: "", designPath, auditedCount };
}
```

**NOTE — `mode != no-design` is NOT re-checked inside this helper.** It does not
need to be: the index.ts caller only reaches this gate inside
`if (armCheck.required)` (mode != no-design already true) AND inside
`if (visualGate.present)` (`## Visual Baselines` already present). So the arm signal
is enforced by gate placement, exactly as the v3.27 schema gate and v3.38 provenance
gate are. The `sliceH2Section(content, "Source") === null` opt-in is the ONLY
additional dormancy condition this helper owns.

---

## Arming + Exemption Decision Tree (the correctness crux)

Effective conditions AT THE CALL SITE (composition of placement + helper):

| Condition | Result | AC |
|-----------|--------|----|
| mode = no-design, OR no design file, OR `## Visual Baselines` absent | gate never reached (silent) | AC-4 / AC-N1 |
| design-backed (mode≠no-design) + `## Visual Baselines` present + **no `## Source` section** | `dormant` (silent pass — backwards-compat opt-in) | **AC-N3** |
| design-backed + `## Source` present + **0 audited rows** (none or all deferred/out-of-scope/blank-pointer) | `BASELINE_MANIFEST_MISSING` | AC-1(b) / **AC-N4** |
| design-backed + `## Source` present + **exactly 1 audited row** | pass; provenance check **EXEMPT** | AC-3 / **AC-N2** |
| design-backed + `## Source` present + **≥2 audited rows** + provenance section absent or missing either line | `BASELINE_PROVENANCE_INCOMPLETE` | AC-2 |
| design-backed + `## Source` present + **≥2 audited rows** + provenance complete (both lines) | pass | AC-2 (negative path) |

---

## AC-1(a) vs AC-N3 reconciliation (RESOLVED — read this)

The spec contains a **latent contradiction** the architect must resolve, and does:

- **AC-1(a)** says: "(a) has no `## Source` section" → fires `BASELINE_MANIFEST_MISSING`.
- **AC-N3** says: design with `## Visual Baselines` but **NO `## Source` section** →
  `BASELINE_MANIFEST_MISSING` MUST NOT fire (gate is opt-in, "activated only when
  `## Source` is present").

These are mutually exclusive on the "no `## Source` section" case.

**DECISION: AC-N3 wins — `## Source` absence ⇒ dormant/silent pass.** Rationale:
(1) AC-N3, the Dependencies/Prerequisites "Backwards-compat opt-in" note, AND the
PM pending-notes all independently state the gate is dormant when `## Source` is
absent — three concordant signals vs AC-1's single ambiguous "(a)" clause.
(2) Firing on `## Source` absence would retroactively block every pre-v3.40.0
design-backed workspace that has `## Visual Baselines` but predates the manifest
contract — a breaking change the whole opt-in design exists to prevent. (3) This
mirrors v3.38.0's D2 opt-in (dormant until a `baseline:` line appears) exactly, which
the spec explicitly names as the pattern to copy.

`BASELINE_MANIFEST_MISSING` therefore fires ONLY on AC-1(b): `## Source` present but
zero audited rows. AC-1(a) is re-interpreted as "no audited manifest" = "`## Source`
present with zero audited rows", consistent with AC-N4. **sr-engineer: do NOT fire
the gate when `## Source` is absent.** qa-engineer: the test suite asserts the
silent-pass on missing `## Source` (test case N3) — that is the binding behavior.

---

## Gate Placement in index.ts (exact)

Insert the new block **immediately after** the `VISUAL_PROVENANCE_MISSING` block,
inside the existing nesting `if (visualGate.present) { … if (armCheck.required) { … } }`.
The provenance block closes around line **957** with `}` for the `if (!prov.ok)`,
then line **958** closes `if (armCheck.required)`. Insert the new block **between
those two** — i.e. as the last statement inside `if (armCheck.required) { … }`,
after the provenance `if (!prov.ok){…}` and before the closing brace of
`if (armCheck.required)`:

```ts
              // ... existing VISUAL_PROVENANCE_MISSING block ends here (~line 957) ...
              }

              // v3.40.0 — Baseline manifest gate (figma-baseline-manifest-gate).
              // SIXTH and LAST visual sub-gate. The v3.38 provenance gate confirmed
              // each diffed surface carries a real baseline+diff; this gate confirms
              // the design-auditor FROZE the baseline node-id selection in the
              // design file's ## Source manifest (step 2c) rather than eyeball-picking
              // or re-deriving it. Opt-in (AC-N3): dormant when ## Source is absent
              // (pre-v3.40 designs). Single-surface (1 audited row) is exempt from
              // the provenance-section requirement (AC-3); multi-surface (>=2) must
              // record filter-conditions + exclusion-reasons in
              // ## Baseline Selection Provenance (AC-2).
              const manifest = checkBaselineManifest(parsed.workspace_path, parsed.active_feature);
              if (!manifest.ok) {
                const text = manifest.code === "BASELINE_MANIFEST_MISSING"
                  ? `⛔ BASELINE_MANIFEST_MISSING: design/<feature>.md declares mode != no-design but the Source manifest (## Source section) contains no audited baseline rows. The design-auditor must complete step 2c (Mechanical baseline selection) — run the deterministic structural filter, freeze the resulting node-id list with status: audited in the Source manifest, and record filter-conditions + exclusion-reasons in a ## Baseline Selection Provenance section (required for multi-surface selections). See specs/figma-baseline-manifest-gate.md.`
                  : `⛔ BASELINE_PROVENANCE_INCOMPLETE: design/<feature>.md has a multi-surface Source manifest (>=2 audited rows) but the ## Baseline Selection Provenance section is absent or incomplete (requires both filter-conditions: and exclusion-reasons: lines). Record the filter criteria used to select the baseline set per design-auditor SOP step 2c. See specs/figma-baseline-manifest-gate.md.`;
                return { content: [{ type: "text" as const, text }], isError: true };
              }
            }   // closes if (armCheck.required)
          }     // closes if (visualGate.present)
```

The two error strings are **verbatim** ERR-BMM-01 and ERR-BPI-01 from the spec
Copy/Strings table, including the `⛔` prefix. Do NOT interpolate `manifest.detail`
into the user-facing string — the canonical strings are exact-match asserted by AC
and the doc; `detail`/`auditedCount` are for logging/debug only. (If sr wants
operator-facing specificity, append it AFTER the canonical string, never inside it —
but the cleanest implementation emits the canonical string unmodified.)

**Ordering invariant preserved (AC-5):** evidence → widget-shape → assertions-required
→ schema → provenance → **manifest**. All six are inside `if (visualGate.present)`;
the last five (assertions onward) are inside `if (armCheck.required)`.

---

## Decision on item (b) cross-reference — OUT of v3.40.0

**DECISION: the `## Visual Baselines` source-node → `## Source` manifest-row
cross-reference check is OUT of scope for v3.40.0.** It is recorded in Deferred
Resources.

Rationale (bias toward MVP / §1 surgical scope):

1. **Materially expands parser complexity.** Cross-reference requires a SECOND
   parser (`parseVisualBaselineSourceNodes`) over a different section (`## Visual
   Baselines`) with a different, less-standardized row shape, plus a set-membership
   join keyed on node-id string equality. The MVP gate (a)+(c) needs only the
   `## Source` table + the provenance label-presence test — no join, no second
   section schema.
2. **High false-positive risk on schema variance.** Node-id equality is brittle:
   `## Visual Baselines` may cite a node as `1:23`, `1-23`, a backtick-wrapped value,
   or a human-readable surface name, while the manifest pointer column may carry the
   raw Figma id. The spec's own "Out of Scope" explicitly defers pointer-format
   validation for exactly this reason — a cross-reference join would re-import that
   brittleness and could block legitimate designs whose two sections use different
   id conventions. That contradicts the negative ACs' "must not false-positive" goal.
3. **The observable-completeness gate already closes the primary hole.** (a) manifest
   exists with audited rows + (c) multi-surface provenance recorded is the minimum
   that makes "eyeball-pick / post-hoc manifest / re-derive from URL" observably
   detectable. Cross-reference is a *strengthening* refinement, not a precondition.
4. PM explicitly framed (b) as separately-architectable and left the in/out call to
   the architect; choosing OUT keeps v3.40.0 a single coherent sibling of v3.38.0.

A follow-on feature (`figma-baseline-crossref-gate`) can add it as `BASELINE_CROSSREF_ORPHAN`
once a node-id normalization convention is agreed across both sections.

---

## Schema-version decision — NO bump

**DECISION: no `schema_version` bump.** Per `docs/schema-versions.md`, only four
persisted artifacts carry a `schema_version`: `handoff` (`.current/handoff.md`),
`tasks` (`tasks.md`), `sqlite` (DB file), `config` (`.current/.config.json`). This
gate READS `design/<feature>.md` — which is NOT one of the four versioned artifacts
and has no `schema_version` field — and writes nothing. No on-disk shape of any
versioned artifact changes. No migration module is added; `schema/versions.ts`
`CURRENT_VERSIONS` is untouched. This matches the PM position and the v3.38.0
precedent (which also added a read-only design/report gate with no schema bump).

---

## Constitution version-header recommendation — BUMP to v3.40.0

**RECOMMENDATION: bump the `# Constitution v3.28.0` header → `# Constitution v3.40.0`.**

Unlike the prior pure-SOP feature (`retro-sop-hardening`, F2 — which changed only
skill text and correctly did NOT bump the header), this feature adds a **new
server-enforced behavior described in §3.1**: two new PASS-blocking error codes
(`BASELINE_MANIFEST_MISSING`, `BASELINE_PROVENANCE_INCOMPLETE`). The header comment
states it "tracks the highest behavior the document describes." A new §3.1 sub-gate
bullet IS new described behavior, so the header should advance to v3.40.0 to stay
truthful. (The header is independent of `package.json`; `check-version.mjs` does not
read it, so the bump is documentation-fidelity only and cannot break CI.)

sr-engineer should add a §3.1 bullet inside the `<!-- design-only:start/end -->`
span (so it strips correctly on non-design dispatches, like its sibling visual
bullets), e.g.:

> **Baseline manifest gate (v3.40.0)**: when `design/<active_feature>.md` is armed
> (`## Mode` ≠ `no-design`) and present with a `## Source` manifest, PASS additionally
> requires ≥1 audited baseline row (frozen node-id, `status: audited`); zero audited
> rows → `BASELINE_MANIFEST_MISSING`. Multi-surface manifests (≥2 audited rows)
> additionally require a `## Baseline Selection Provenance` section with both
> `filter-conditions:` and `exclusion-reasons:` lines → else `BASELINE_PROVENANCE_INCOMPLETE`.
> Opt-in: dormant when `## Source` is absent (pre-v3.40 designs); single-surface
> (1 audited row) is exempt from the provenance requirement. Sixth visual sub-gate,
> after the provenance gate.

---

## Sequence Diagram

```mermaid
sequenceDiagram
    participant QA as qa-engineer
    participant SRV as index.ts (tw_update_state PASS)
    participant EV as evidence-file.ts
    participant FS as design/<feature>.md

    QA->>SRV: tw_update_state(status=PASS, completed_tasks)
    SRV->>SRV: evidence gate → MISSING_EVIDENCE?
    SRV->>EV: hasDesignModeRequiringVisual() (armCheck)
    SRV->>EV: hasVisualBaselinesInDesign() (visualGate)
    alt armed && !visualGate.present
        SRV-->>QA: ⛔ VISUAL_BASELINES_REQUIRED
    else visualGate.present
        SRV->>SRV: VISUAL_EVIDENCE_MISSING / WIDGETS_UNVERIFIED?
        alt armCheck.required
            SRV->>SRV: ASSERTIONS_REQUIRED / REPORT_INCOMPLETE / PROVENANCE_MISSING?
            SRV->>EV: checkBaselineManifest(ws, feature)
            EV->>FS: read design file once
            EV->>EV: sliceH2Section("Source") null? → dormant
            EV->>EV: parseBaselineManifestRows → auditedCount
            EV->>EV: 0 → MANIFEST_MISSING; 1 → pass; >=2 → hasBaselineProvenance?
            EV-->>SRV: BaselineManifestCheck {ok, code, ...}
            alt !manifest.ok
                SRV-->>QA: ⛔ BASELINE_MANIFEST_MISSING | BASELINE_PROVENANCE_INCOMPLETE
            end
        end
    end
    SRV->>SRV: (gates clear) compute rounds, write state
    SRV-->>QA: state written
```

---

## Decision Records

| Context | Decision | Consequences |
|---------|----------|--------------|
| Spec AC-1(a) ("no `## Source` section" fires error) contradicts AC-N3 / Dependencies / PM-notes (absence = dormant opt-in). | AC-N3 wins: `## Source` absence ⇒ dormant silent pass. `BASELINE_MANIFEST_MISSING` fires only on AC-1(b) (Source present, 0 audited rows). | Backwards-compat preserved for pre-v3.40 design workspaces; matches v3.38 D2 opt-in. AC-1(a) is re-read as "no audited manifest." Binding behavior asserted by test N3. |
| Check-result shape: invent `{ ok, code, detail }` vs mirror established convention. | Return `{ ok, code, detail, designPath, auditedCount }` — `ok` + offender field mirrors `VisualProvenanceCheck`; `code` added because the gate has TWO error codes (provenance gate had one). | No new pattern introduced into the file; caller switches on `code` to pick verbatim error string. |
| Item (b) cross-reference (Visual Baselines node → Source manifest row). | OUT of v3.40.0. | Smaller surgical gate; avoids brittle node-id-equality false-positives; deferred to a follow-on with a normalization convention. |
| schema_version bump. | None. | Gate reads a non-versioned artifact (design file); no migration module, `CURRENT_VERSIONS` untouched. |
| Constitution header bump. | Recommend v3.28.0 → v3.40.0. | Header tracks highest described behavior; new §3.1 server-enforced codes are new behavior. Doc-fidelity only (check-version.mjs ignores header). |
| Status-column resolution when table has no `status` header. | Backwards-compat: treat all rows as audited (AC-7). Resolve status column by header-cell index, fallback positional index 3. | Pre-manifest tables don't get retro-blocked; tolerant of column reordering. |
| Re-check `mode != no-design` inside `checkBaselineManifest`? | No — enforced by call-site placement inside `if(armCheck.required)` + `if(visualGate.present)`, mirroring v3.27/v3.38 gates. | Helper stays focused; single arm signal (`hasDesignModeRequiringVisual`) — no duplicate mode parsing. |
| Interpolate `detail`/`auditedCount` into the user-facing error string? | No — emit the verbatim ERR-BMM-01 / ERR-BPI-01 strings; `detail` is debug-only. | AC/doc exact-match assertions on the canonical strings stay green. |

---

## Deferred Resources

- **Item (b) cross-reference check** (`## Visual Baselines` source-node ⇒ `## Source`
  manifest-row traceability) — DEFERRED to a follow-on feature
  (`figma-baseline-crossref-gate`). Reason: brittle node-id-equality join, high
  false-positive risk on cross-section id-format variance, materially larger parser
  surface than the MVP completeness gate. See Decision on item (b) above.
- **`tw_extract_figma_baseline` MCP tool** — DEFERRED (per spec Out of Scope; the
  server parses the artifact, not Figma directly). Same posture as v3.39.0.
- **Pointer-format (node-id) validation** — DEFERRED (per spec Out of Scope; brittle
  across Figma/Sketch/PDF id formats). The gate counts non-empty audited rows; it
  does not validate the pointer string format.
- **External URL** `https://viewsonic-ssi.visualstudio.com/Corporate%20OS/_workitems/edit/104444`
  — classified **ignore** by PM (Resource Audit Gate §7): context-of-origin work-item
  reference only, not load-bearing for gate logic. Not fetched; carried here per the
  External-reference Sanity Gate.

---

## Visual Harness

OMITTED — this feature is `mode = no-design`; `design/figma-baseline-manifest-gate.md`
does not exist and there is no `## Visual Baselines` section. No visual-regression
infrastructure applies. (Per the Visual Harness Gate, the gate does not fire because
no design file with `## Visual Baselines` exists.)

---

## Test Surface (for qa-engineer)

**New file: `test/baseline-manifest-gate.test.mjs`** (mirrors
`test/evidence-provenance.test.mjs` structure: pure-parser unit tests +
composition-helper tests over a tmp workspace). Imports from
`../dist/tools/evidence-file.js`. Add the file to the `npm test` glob automatically
(suite is `node --test test/*.test.mjs`).

Helpers: `tmpWs()` (mkdtemp), `writeDesign(ws, feature, body)` writes
`<ws>/design/<feature>.md`.

### Pure parser tests — `parseBaselineManifestRows`

| # | Case | Expect |
|---|------|--------|
| P1 | `""` empty string | `[]` (purity, AC-6) |
| P2 | no `## Source` section | `[]` |
| P3 | `## Source` table, 3 rows: 2 `audited` (non-empty pointer), 1 `deferred` | 3 rows; `isAudited` true/true/false; `auditedCount` (via filter) = 2 |
| P4 | `audited` row with BLANK pointer cell | that row `isAudited === false` (AC-1(b)) |
| P5 | table with NO `status` column (medium/pointer only) | all rows `status === "audited"`, `isAudited` = pointer non-empty (AC-7 backwards-compat) |
| P6 | status values decorated: `audited ✅`, ` Deferred `, `out of scope` | normalize to `audited`/`deferred`/`out-of-scope` |
| P7 | status column NOT at position 3 (reordered headers) | status resolved by header index, not position |
| P8 | header/separator rows | excluded from output (no row for `|---|` or the `| medium | pointer |…` header) |
| P9 | same input twice | identical output (purity) |

### Pure parser tests — `hasBaselineProvenance`

| # | Case | Expect |
|---|------|--------|
| H1 | no `## Baseline Selection Provenance` section | `false` (AC-8) |
| H2 | section present with BOTH `filter-conditions:` and `exclusion-reasons:` | `true` |
| H3 | section present with ONLY `filter-conditions:` | `false` (AC-8 both required) |
| H4 | section present with ONLY `exclusion-reasons:` | `false` |
| H5 | `filter-conditions:` present but OUTSIDE the section (in body prose / different H2) | `false` (section-scoped) |
| H6 | decorated labels `- **filter-conditions:** …` and `* exclusion-reasons — …` | `true` (permissive label regex) |

### Composition + gate tests — `checkBaselineManifest` (and, optionally, e2e via tw_update_state)

| # | Case (design file content) | `code` / `ok` | AC |
|---|----------------------------|---------------|----|
| C1 | no design file at all | `ok:true, code:null` (dormant) | AC-4 / AC-N1 |
| C2 | design file, `## Mode` = `no-design` | dormant (note: at helper level it does NOT re-check mode; assert via e2e that the gate is unreachable — or assert C1-style dormancy. Prefer e2e for the mode arm.) | AC-4 / AC-N1 |
| C3 | armed design, `## Visual Baselines` present, **NO `## Source` section** | `ok:true, code:null` (dormant — opt-in) | **AC-N3** |
| C4 | armed, `## Source` with ONLY `deferred` rows (0 audited) | `ok:false, code:"BASELINE_MANIFEST_MISSING"` | **AC-N4** / AC-1(b) |
| C5 | armed, `## Source` with exactly 1 audited row, NO provenance section | `ok:true, code:null` (single-surface exempt) | AC-3 / **AC-N2** |
| C6 | armed, `## Source` with 1 audited row + provenance present | `ok:true` (still passes) | AC-3 |
| C7 | armed, `## Source` with 2 audited rows, NO provenance section | `ok:false, code:"BASELINE_PROVENANCE_INCOMPLETE"` | AC-2 |
| C8 | armed, 2 audited rows, provenance section with ONLY `filter-conditions:` | `ok:false, code:"BASELINE_PROVENANCE_INCOMPLETE"` | AC-2 |
| C9 | armed, 2 audited rows, provenance with BOTH lines | `ok:true, code:null` | AC-2 negative |
| C10 | armed, 3 rows = 2 audited + 1 deferred, provenance complete | `ok:true` (deferred row not counted; multi-surface satisfied) | AC-2/AC-7 |
| C11 | fs error / unreadable design path | `ok:true` (dormant, never throws) | robustness |

### End-to-end gate tests (via `tw_update_state` PASS, mirroring `test/visual-gate-e2e.test.mjs`)

| # | Case | Expect server output |
|---|------|----------------------|
| E1 | `no-design` workspace, PASS attempted | NO `BASELINE_MANIFEST_MISSING` / `BASELINE_PROVENANCE_INCOMPLETE` in output (AC-4/AC-N1) |
| E2 | armed, baselines + clean visual report + `## Source` 0 audited | output contains verbatim `⛔ BASELINE_MANIFEST_MISSING`, `isError:true`, state NOT written (AC-1) |
| E3 | armed, all upstream gates clean, 2 audited rows, no provenance | verbatim `⛔ BASELINE_PROVENANCE_INCOMPLETE`, `isError:true`, no write (AC-2) |
| E4 | armed, 1 audited row, no provenance, all upstream clean | PASS succeeds (no manifest error) (AC-3/AC-N2) |
| E5 | armed, `## Visual Baselines` present but NO `## Source` | PASS not blocked by manifest gate (AC-N3) |
| E6 | exact error strings match ERR-BMM-01 / ERR-BPI-01 verbatim (substring assert on the `⛔ …` text) | Copy/Strings fidelity |

> E2/E3 require the upstream visual gates (evidence file, widget-shape, schema,
> provenance) to already be satisfied so execution REACHES the manifest gate — model
> the fixture on `test/visual-gate-e2e.test.mjs`'s passing-report builder. The
> cheaper, primary coverage is the `checkBaselineManifest` unit tests (C-series);
> the E-series proves wiring + verbatim strings + `isError`/no-write.

Also: bump assertions for **AC-9** (`package.json` & `index.ts` both `"3.40.0"`) and
**AC-10** (`CHANGELOG.md` has `## [3.40.0]` mentioning both error codes) belong to the
existing `scripts/check-version.mjs` / a CHANGELOG presence test — qa verifies these
as part of the round but they are not new test files.

---

## Open Questions

_None. All design decisions are pinned above: AC-1/AC-N3 reconciliation resolved
(AC-N3 wins), item (b) cross-reference OUT, no schema bump, constitution header bump
recommended, gate placement and verbatim error strings fixed._

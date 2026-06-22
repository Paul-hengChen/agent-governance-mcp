# Figma Baseline Selection: Mechanical Filtering and Improvement

> Synthesised from: figma-baseline-mechanical-filtering-method.md, figma-extraction-analysis.md
> Authors: @researcher (2026-05-28 – 2026-06-08)
> Last synthesised: 2026-06-22

---

## Summary

- **The core problem is non-reproducibility**: when a PRD supplies a single Figma URL that expands to a multi-surface board, "eyeball selection" produces different baseline sets each run — un-auditable and un-delegatable.
- **Mechanical filtering (the mandated method)** converts subjective selection into deterministic rules: `type=FRAME` filter → naming-pattern match → semantic anchor check → ID-prefix grouping. Results are frozen in a manifest that downstream roles copy verbatim without re-deriving.
- **Three failure modes** the mechanical method addresses: missed screens (scattered across the board), false positives (look-alike frames containing the target panel but belonging to different steps), and noise (CONNECTOR and annotation TEXT nodes mistakenly included).
- **The ad-hoc awk approach has four weaknesses**: hardcoded patterns per case, flat-text grep loses tree structure, ID-prefix grouping is a fragile heuristic, and no visual cross-validation.
- **Three-layer improvement architecture**: metadata-first scan (depth=2, ~1/50 token cost) → declarative YAML filter rules (portable, diff-friendly) → thumbnail visual verification (cross-validates empty shells and groups state variants).
- **Downstream invariant**: once frozen, the manifest MUST be copied verbatim by design-auditor and qa-visual. They MUST NOT re-derive from the URL.

---

## The Problem: Non-Reproducible Eyeball Selection

A typical PRD attaches a single Figma URL (e.g. `node-id=72-3455`). That node expands to a multi-step board containing all workflow screens, connectors, annotation text, and embedded panels from adjacent steps.

Asking design-auditor to "open the link and pick the Network screens as baselines" will produce different results each run because the judgment lives inside the model and is not observable.

Documented failure modes from a real CDE-OOBE Step 4 Network case:

| Failure mode | What happened |
|---|---|
| Missed screens | Slides `4888:52841/53203/53361` (the correct screens) were ~8000 lines into the dump, mixed between other steps; eyeball scanning stopped at 18 frames |
| False positives | Slides `3217/3557/3554:*` belong to Summary and other steps but also contained the NetworkOptions panel — "does it have a network component?" selected them incorrectly |
| Noise inclusion | Flow-board CONNECTOR nodes and annotation TEXT nodes (e.g. `Default Option: Ethernet off`) were treated as screens |

The root cause: the decision criterion lived in the model's context, invisible, non-auditable, and different each run.

---

## Mechanical Filtering Method (Mandated)

Convert "select the right screens" into deterministic rules applied to the Figma structural data.

### Steps

1. **Fetch structural data**: `mcp__figma__get_figma_data(fileKey, nodeId)` → YAML structure (each node has `id`, `type`, `name`, children). For large boards, save to file and process with grep/awk.

2. **Filter screen frames**: keep `type=FRAME` ∧ `name` matches screen naming convention (e.g. `Slide 16:9 - *`). This drops CONNECTOR, annotation TEXT, and child component nodes.

3. **Apply semantic anchor**: for each candidate frame, check whether its subtree (up to the next sibling frame) contains the target panel node (e.g. `name: ' NetworkOptions'`). Only frames that pass this check are considered.

4. **Apply ID-prefix grouping**: same-feature frames were authored in the same Figma block and share a common ID prefix. Different prefix = different step, likely an embedded copy of the same panel in a different context → exclude.

### Example (CDE-OOBE Step 4 Network)

```bash
awk '
/name: Slide 16:9/ {
  if (curname!="") print curline": "curid"  ->  "curname"   ["(hasnet?"YES":"-")"]"
  curname=$0; sub(/^ *name: /,"",curname); curid=previd; curline=NR; hasnet=0
}
/name: '"'"' NetworkOptions'"'"'/ { hasnet=1 }
/- id: / { previd=$0; sub(/^ *- id: /,"",previd) }
END { if (curname!="") print curline": "curid"  ->  "curname"   ["(hasnet?"YES":"-")"]" }
' "$FIGMA_DUMP" | grep 'YES'
```

Result: 29 frames containing the network panel → ID-prefix split into Group A (21 frames, prefix `4888:*`, Step 4 proper) + Group B (8 frames, prefixes `3217/3557/3554:*`, excluded).

### Manifest Freeze

The output is written to `design/<feature>-baseline-manifest.md`: the 21 node-IDs, filter conditions used, and exclusion reasons for the 8 rejected frames.

**Rule**: downstream roles (design-auditor, qa-visual) copy the manifest verbatim. They MUST NOT re-derive from the original URL. Re-deriving would reintroduce the non-reproducibility problem.

---

## Weaknesses of the Current Ad-Hoc Approach

The awk-based method is correct in result but fragile in process:

| Issue | Detail |
|---|---|
| Hardcoded patterns | `Slide 16:9` and `NetworkOptions` are project-specific literals; every new feature requires rewriting the script |
| Flat-text grep loses tree structure | Parent-child relationships must be inferred from line numbers, not tree traversal; format changes break scripts |
| ID-prefix grouping is a fragile heuristic | Figma IDs encode page/block scope as an implementation detail, not a stable contract; moving or copying frames changes prefixes |
| No visual cross-validation | Structurally correct but empty frames (`nodes: []`) pass all filters; different state variants of the same screen are not grouped |
| Token bottleneck | A full dump is required before filtering; for large Figma files this is expensive |

---

## Three-Layer Improvement Architecture

### Layer 1 — Metadata-First Scan

**Current**: `get_figma_data(fileKey, nodeId)` → full YAML dump → file → grep.

**Improved**: use `GET /v1/files/:key/nodes?ids=:nodeId&depth=2` — fetches only the first two levels (page → frames) without expanding child components. Return size is approximately 1/50 of a full dump.

Each frame yields: `id`, `name`, `type`, `absoluteBoundingBox` (x, y, width, height), `componentId` (if a component instance).

This eliminates the token bottleneck: no full dump needed to get the candidate frame list.

### Layer 2 — Declarative Filter Rules

Replace ad-hoc awk with portable YAML filter configuration:

```yaml
# design/<feature>-filter-rules.yaml
version: 1
source:
  file_key: "abc123"
  root_node_id: "72-3455"

filters:
  - type: frame_match
    conditions:
      node_type: FRAME
      name_pattern: "Slide 16:9 - *"    # glob, not regex

  - type: contains_descendant
    conditions:
      name: "NetworkOptions"
      component_id: "4888:12345"         # optional; more stable than name

  - type: spatial_cluster
    conditions:
      reference_frame: "4888:52841"      # known frame from this feature
      max_distance_px: 5000

  - type: exclude
    conditions:
      name_pattern: "Summary*"
      node_ids: ["3217:*", "3557:*"]
```

Advantages over awk: readable by non-engineers, version-control-friendly diffs, portable across features (change the YAML, not the script), machine-parseable as input to a future `tw_extract_figma_baseline` tool.

**Spatial clustering replaces ID-prefix grouping**: frames belonging to the same feature are spatially clustered on the Figma canvas. Spatial distance from a known reference frame is more stable than ID prefix after moves/copies.

### Layer 3 — Thumbnail Visual Verification

After structural filtering, download low-resolution thumbnails (`scale=0.25`) for each candidate frame:

1. Compute content hash (SHA-256) — detect duplicate frames.
2. Compute perceptual hash (pHash) — cluster state variants (default / hover / error / focused states of the same screen).
3. Check for blank/all-white images — exclude empty shell frames.

The thumbnail hashes and state-group assignments are appended to the manifest as provenance metadata.

### Comparison

| Dimension | Current awk method | Three-layer method |
|---|---|---|
| Reproducibility | Correct (rules are explicit) | Correct (rules are explicit) |
| Portability | Per-case rewrite | Change YAML config only |
| Tree structure | Lost in flat-text grep | Preserved via programmatic traversal |
| Grouping stability | Fragile (ID prefix) | Stable (spatial + component ID) |
| Empty shell detection | None | Thumbnail verification |
| State variant classification | None | Perceptual hash grouping |
| Token cost | Full dump required | depth=2 metadata (~1/50) |
| Non-engineer readability | awk syntax | YAML config |

Both methods produced the same 21 node-IDs for the CDE-OOBE Step 4 case. The improvement is in process reliability, not in the result for this specific case.

---

## Integration with agent-governance-mcp SOP

### SOP additions (design-auditor / qa-visual)

When a PRD supplies only a single Figma URL, design-auditor MUST:
1. Fetch node structure data.
2. Apply deterministic filter rules (frame type + naming pattern + semantic anchor + spatial/ID grouping).
3. Freeze the node-ID list + filter conditions + exclusion reasons as `design/<feature>-baseline-manifest.md`.
4. qa-visual copies the manifest verbatim; it MUST NOT re-derive from the URL.

This is an anti-eyeball-loop rule aligned with Constitution §5.

### Alignment with existing principles

- **Constitution §7 External-reference policy**: a Figma URL is treated as "unindexed until explicitly indexed." Mechanical filtering is the indexing step — converting a vague link into a verifiable node-ID list.
- **PRD > Figma for values**: baselines only define the visual alignment target; numeric values remain authoritative in the PRD.
- **Constitution §5 anti-loop**: baselines frozen once, preventing the `visual_round` counter from escalating due to repeated re-derivation.

### Future tooling path

Phase A (zero tooling cost): add metadata-first scan and declarative filter rule documentation to the design-auditor SOP. No new MCP tools required.

Phase B: build `tw_extract_figma_baseline(file_key, root_node_id, filter_rules, verify_thumbnails)` — formalises the mechanical filtering as a first-class MCP tool. Input: filter rules YAML. Output: frozen manifest + filter log + thumbnail hashes.

Phase C: spatial clustering + perceptual hash grouping — adds visual cross-validation once the Phase B tool is stable.

---

## Open Questions

1. **Spatial clustering feasibility**: `absoluteBoundingBox` is available in `depth=2` responses, but the `max_distance_px` threshold needs calibration across real Figma boards of varying complexity.
2. **Component ID stability**: `componentId` references the master component node; is this stable across Figma library updates, or does library versioning change component IDs?
3. **pHash library for Node.js**: `sharp` + `blockhash` or `imghash` — need to verify ONNX-free options given the MCP server's runtime constraints.
4. **Manifest format versioning**: the manifest is consumed by downstream roles; schema changes need a migration path. Align with the existing `schema/versions.ts` pattern.
5. **Multi-PRD Figma links**: if a PRD references multiple Figma files (e.g., global component library + feature-specific board), does the mechanical filtering method compose cleanly, or does each file need a separate manifest?

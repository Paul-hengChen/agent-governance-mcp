# Architecture: agc-cross-agent-adapter-scaffolding

> Feature: `agc-cross-agent-adapter-scaffolding`
> Architecture version: 1.0.0
> Date: 2026-06-09
> Author: architect subagent (opus)
> Source spec: `specs/agc-cross-agent-adapter-scaffolding.md` (v1.0.0)
> Research basis: `research/cross-agent-governance-single-source-strategy-2026-06-08.md`
>   (incl. 2026-06-09 Codex-convergence update)
> Status: In_Progress → next_role: sr-engineer

---

## Resolved Design Questions (PM-deferred)

### Q1 — Version resolution for `agc check` under both install modes

**Decision: resolve the installed agc package version from the script's own location via
`import.meta.url`, walking up to the package root — NOT from `process.cwd()`.**

The `agc` binary is `package.json#bin.agc` → `./bin/agc-init.mjs`. In both modes the script
file physically lives at `<agc-package-root>/bin/agc-init.mjs`:

- **Local dev** (`node bin/agc-init.mjs` or `./bin/agc-init.mjs` from the repo): the file is at
  `<repo>/bin/agc-init.mjs`.
- **`npx github:Paul-hengChen/agent-governance-mcp` install**: npx places the package in a cache
  dir and exposes `agc` as a bin shim, but Node still loads the real module file at
  `<cache>/agent-governance-mcp/bin/agc-init.mjs`. `import.meta.url` reflects the resolved real
  path, not the shim.

Therefore the exact resolution path (mirroring `scripts/check-version.mjs:13-16`) is:

```js
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { readFileSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url)); // <pkg>/bin
const pkgRoot = path.resolve(here, "..");                  // <pkg>
const installedVersion = JSON.parse(
  readFileSync(path.join(pkgRoot, "package.json"), "utf-8")
).version;
```

**Why not `process.cwd()`'s package.json:** `agc check` runs inside the *target* workspace,
which may have its own unrelated `package.json` (any Node project). Reading cwd's version would
compare adapter stamps against the *target project's* version — meaningless. The comparison must
be deployed-adapter-stamp vs the *agc package* version.

**Why not `require.resolve("agent-governance-mcp")`** (the spec floated it as an alternative): in
ESM there is no `require` by default; it would need `createRequire`, and it relies on the package
being resolvable as a named dependency from cwd — false for `npx github:` one-shot runs and for
local-dev `node bin/agc-init.mjs`. The `import.meta.url`-relative walk is correct in *every* mode
and needs zero resolution context. Same proven pattern already in `check-version.mjs`.

### Q2 — In-place expansion of `agc-init.mjs` vs a thin `agc.mjs` dispatcher

**Decision: extend `bin/agc-init.mjs` in-place with an internal subcommand dispatch on
`process.argv[2]`. Do NOT introduce `bin/agc.mjs` or per-command modules.**

Justification (lowest-churn, per Constitution §1 surgical edits):

- `package.json#bin.agc` already points at `./bin/agc-init.mjs`. A rename to `bin/agc.mjs` churns
  the `bin` map and the shipped filename for zero functional gain; the spec itself (Dependencies
  §4) says "a rename is not required — just an in-place extension is acceptable for MVP."
- Two subcommands (`init`, `check`) do not justify a dispatcher + module split. The current file
  is 83 lines; after this feature it is ~3 small functions in one file (`runInit`, `runCheck`,
  plus shared template/stamp helpers) behind a `switch (sub)`. That stays readable.
- The file is a *source* `.mjs` shipped verbatim (it is NOT compiled — `bin.agc` points at
  `bin/`, not `dist/`), so keeping it single-file avoids a multi-file relative-import surface in
  the shipped artifact.

The filename `agc-init.mjs` becomes a slight misnomer once it also handles `check`, but the bin
*name* the user types is `agc` (correct), and the cost of fixing the misnomer (rename) exceeds
the benefit. A split into `bin/agc.mjs` + `bin/commands/*.mjs` is the right move only if/when a
third or fourth subcommand lands (e.g. the deferred `agc update`); flagged in Decision Records.

---

## Affected Files

| File | Action | What |
|---|---|---|
| `templates/agent-adapters/claude.md` | **create** | Claude entry-section template: marker-delimited loader + Claude execution profile + HTML-comment version stamp. |
| `templates/agent-adapters/codex.md` | **create** | Codex `AGENTS.md` template: `#`-comment loader header + Codex execution profile + `#`-comment version stamp. |
| `templates/agent-adapters/antigravity.md` | **create** | Antigravity `.antigravityrules` template: `#`-comment loader header + Antigravity execution profile + `#`-comment version stamp. |
| `bin/agc-init.mjs` | **modify** | Add subcommand dispatch (`init`/`check`); extend init to stamp+write the 3 adapters (skip-existing for codex/antigravity, marker-block upsert for CLAUDE.md); add `runCheck`; replace usage string (STR-USAGE). Keep existing `.current/` + `tasks.md` scaffolding intact. |
| `test/agc-adapters.test.mjs` | **create** | `node --test` suite covering AC-2..AC-8 (init creates, idempotent, stamp present, check stale/current/none, no-constitution-clause assertion). |

**No server-code changes.** `index.ts`, `tools/*`, `prompts/*`, `content/*`, `guards/*`,
`schema/*` are untouched. This is CLI + templates + tests only.

---

## Data Structures

No new persisted schema; no `schema_version` bump. The only new on-disk shape is the
**version-stamp line** inside each generated adapter, and the **marker block** in CLAUDE.md.

### Version-stamp line (per adapter — the parse target for `agc check`)

After `{{AGC_VERSION}}` substitution at init time:

- `claude.md` (HTML comment): `<!-- agc-version: 3.28.0 -->`
- `codex.md` / `antigravity.md` (`#` comment): `# agc-version: 3.28.0`

**Parse contract for `agc check`** (one regex, mode-agnostic so it matches both comment styles):

```js
// Matches "<!-- agc-version: 3.28.0 -->" and "# agc-version: 3.28.0"
const STAMP_RE = /agc-version:\s*([0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?)/;
```

The stamp MUST be the first non-blank line of each generated file (satisfies AC-4: "first
non-blank, non-comment line OR a clearly labelled header line"). `agc check` reads the whole file
and applies `STAMP_RE.exec(content)` (first match wins) — robust to the user adding content
below the marker block.

### CLAUDE.md marker block (idempotent upsert target)

CLAUDE.md is an **entry section appended to an existing/po­ssibly-existing `CLAUDE.md`**, never a
full-file overwrite. The generated section is wrapped in stable HTML-comment markers so init can
*upsert* (insert if absent, replace the block in place if present) without touching the user's
own CLAUDE.md prose:

```
<!-- BEGIN agc-adapter -->
<!-- agc-version: {{AGC_VERSION}} -->
<!-- Generated by agc init. Re-run agc init to refresh this block; edit outside the markers freely. -->

## Agent Governance (agent-governance-mcp)
...loader + execution profile...
<!-- END agc-adapter -->
```

Marker constants (exact, used by both write and check):

```js
const CLAUDE_BEGIN = "<!-- BEGIN agc-adapter -->";
const CLAUDE_END   = "<!-- END agc-adapter -->";
```

### Adapter file registry (drives init write + check scan)

```js
// rel = path in the target workspace; tpl = template filename under templates/agent-adapters/
// mode = "skip" (skip-if-exists, whole-file) | "upsert" (marker-block in a possibly-existing file)
const ADAPTERS = [
  { rel: "CLAUDE.md",         tpl: "claude.md",      mode: "upsert" },
  { rel: "AGENTS.md",         tpl: "codex.md",       mode: "skip"   },
  { rel: ".antigravityrules", tpl: "antigravity.md", mode: "skip"   },
];
```

Note the template *filenames* (`claude.md`/`codex.md`/`antigravity.md`, per AC-1) differ from the
deployed *target* filenames (`CLAUDE.md`/`AGENTS.md`/`.antigravityrules`). The registry is the
single mapping.

---

## Interface Contracts

All functions live in `bin/agc-init.mjs` (single file, per Q2). Signatures:

```js
// Resolve the agc package root from this script's own location (Q1).
// Returns absolute path to <agc-package-root>.
function pkgRoot(): string

// Read installed agc version from <pkgRoot>/package.json. Throws if unreadable
// (a broken install should fail loudly, not silently compare against undefined).
function installedVersion(): string

// Read a template, replace every {{AGC_VERSION}} with `version`, return stamped text.
function stampTemplate(tplName: string, version: string): string

// --- subcommand: init ---
// Existing behavior preserved (.current/handoff.md, .current/.config.json, tasks.md).
// New: also writes the 3 adapters per ADAPTERS registry.
//   - mode "skip":   if target exists → skip; else write stamped template.
//   - mode "upsert": marker-block insert/replace in CLAUDE.md (see writeClaudeBlock).
// Reports Created / Skipped / Updated lists to stdout (STR-CREATED-ADAPTER /
// STR-SKIPPED-ADAPTER + an "Updated" line for an in-place CLAUDE.md block refresh).
function runInit(cwd: string): void

// Upsert the marker-delimited block into CLAUDE.md.
//   - file absent           → create CLAUDE.md containing just the stamped block.
//   - file present, no block → append a blank line + stamped block.
//   - file present, block    → replace text between CLAUDE_BEGIN..CLAUDE_END (inclusive)
//                              with the freshly stamped block; surrounding prose untouched.
// Returns "created" | "appended" | "updated" so runInit can report accurately.
function writeClaudeBlock(cwd: string, stampedBlock: string): "created"|"appended"|"updated"

// --- subcommand: check ---
// Scan cwd for the 3 adapter targets. For each present file, extract STAMP_RE.
//   - stamped !== installed → record stale (STR-CHECK-STALE).
//   - present but no stamp   → treat as stale (user-clobbered marker / hand-edited);
//                              report with stamped="(none)". (See Decision Records.)
//   - all present files current → STR-CHECK-OK, exit 0.
//   - no adapter files present  → silent, exit 0 (AC-7).
// Exit code: 1 if any stale, else 0.
function runCheck(cwd: string): never  // calls process.exit
```

Dispatch (replaces lines 10-18 of current file):

```js
const sub = process.argv[2];
switch (sub) {
  case "init":  runInit(process.cwd());  break;
  case "check": runCheck(process.cwd()); break;          // runCheck calls process.exit
  default:
    process.stderr.write(STR_USAGE);
    process.exit(sub === undefined ? 1 : 2);             // preserve current exit semantics
}
```

---

## Exact Template Content

These are LOADERS. **Zero verbatim constitution-body clauses** (AC-8). They contain only: a
pointer to the MCP server + a `tw_*` engagement recipe + a per-agent execution profile. The
content below is the authored source the templates ship with; `{{AGC_VERSION}}` is substituted at
init time.

### `templates/agent-adapters/claude.md`  (deploys into `CLAUDE.md` as a marker block)

```markdown
<!-- BEGIN agc-adapter -->
<!-- agc-version: {{AGC_VERSION}} -->
<!-- Generated by agc init. Re-run agc init to refresh this block; edit outside the markers freely. -->

## Agent Governance (agent-governance-mcp)

This project is managed by agent-governance-mcp. Before acting:
1. Call `tw_get_state` (Constitution §3 — mandatory first action).
2. Follow the SOP returned by `tw_switch_role` for your role.
3. Obey all rules in `content/constitution.md` (served via the MCP server).

## Execution Profile — Claude Code

- Subagent dispatch: available (`Task` tool). Use it for role switching when context budget permits.
- Watermark: required on every reply per Constitution §1 (format: `— @<role> (<model-tier>)`).
- SessionStart hook: auto-injects constitution context when `.current/` or `tasks.md` is present.
<!-- END agc-adapter -->
```

### `templates/agent-adapters/codex.md`  (deploys into `AGENTS.md`)

```markdown
# agc-version: {{AGC_VERSION}}
# Generated by agc init. Re-run agc init to create; edit freely after.

## Agent Governance (agent-governance-mcp)

This project is managed by agent-governance-mcp. Before acting:
1. Call `tw_get_state` (mandatory first action — other writes blocked without it).
2. Call `tw_switch_role` with your role to load the SOP.
3. Follow all rules in the constitution (MCP server: agent-governance-mcp).

## Execution Profile — Codex

- Subagent dispatch: not available. Use `tw_switch_role` for same-context role switching.
- Watermark: not required (Codex does not support the watermark mechanic).
- AGENTS.md layering: global AGENTS.md (~/.codex/AGENTS.md) holds personal preferences only; this file holds project governance.
```

### `templates/agent-adapters/antigravity.md`  (deploys into `.antigravityrules`)

```markdown
# agc-version: {{AGC_VERSION}}
# Generated by agc init. Re-run agc init to create; edit freely after.

## Agent Governance (agent-governance-mcp)

This project is managed by agent-governance-mcp. Before acting:
1. Call `tw_get_state` (mandatory first action — other writes blocked without it).
2. Call `tw_switch_role` with your role to load the SOP.
3. Follow all rules in the constitution (MCP server: agent-governance-mcp).

## Execution Profile — Antigravity

- Subagent dispatch: unverified — fall back to `tw_switch_role` for same-context role switching.
- Watermark: not required (Antigravity does not support the watermark mechanic).
- .antigravityrules layering: global .antigravityrules holds personal preferences only; this file holds project governance.
```

> These bodies are byte-for-byte the spec's STR-LOADER-* + STR-EXEC-* strings, with the only
> structural addition being the `<!-- BEGIN/END agc-adapter -->` markers around the Claude block
> (required for idempotent upsert; see Decision Records). The `codex.md`/`antigravity.md` files
> need no markers because their deploy mode is whole-file skip-if-exists.

**AC-8 self-check the implementer must preserve:** none of the lines above appear in
`content/constitution.md`. The test asserts this programmatically (see Visual Harness note —
N/A here — and the test plan below).

---

## Per-task Blueprint

### T-TEMPLATES — create `templates/agent-adapters/{claude,codex,antigravity}.md`

- Create the directory `templates/agent-adapters/`.
- Write the three files with the EXACT content in the section above (placeholders intact —
  `{{AGC_VERSION}}` is NOT substituted in the repo copy; substitution happens only at init time).
- claude.md MUST be wrapped in the `<!-- BEGIN/END agc-adapter -->` markers. codex.md and
  antigravity.md MUST start with their `# agc-version: {{AGC_VERSION}}` line as the first line.
- No constitution clauses (AC-1, AC-8).

### T-INIT-EXTEND — extend `bin/agc-init.mjs` init path + dispatch + usage

1. Add ESM imports `fileURLToPath` (`node:url`) alongside existing `fs`/`path`.
2. Add `pkgRoot()`, `installedVersion()`, `stampTemplate()` helpers (signatures above). Templates
   are read from `path.join(pkgRoot(), "templates/agent-adapters", tplName)` — relative to the
   *package*, never cwd.
3. Refactor the existing inline init body (current lines 20-83) into `runInit(cwd)`. Preserve the
   existing 3-file scaffolding (`.current/handoff.md`, `.current/.config.json`, `tasks.md`) and
   its Created/Skipped reporting verbatim.
4. After the existing scaffolding, iterate `ADAPTERS`:
   - `mode: "skip"` (AGENTS.md, .antigravityrules): if `fs.existsSync(target)` → push to skipped;
     else `stampTemplate(tpl, ver)` → write → push to created.
   - `mode: "upsert"` (CLAUDE.md): call `writeClaudeBlock(cwd, stampTemplate("claude.md", ver))`;
     route its return into created ("created") / created ("appended") / a new "Updated" list
     ("updated").
5. Stdout: keep `Created:` (STR-CREATED-ADAPTER) and `Skipped (already exists):`
   (STR-SKIPPED-ADAPTER) lines; add an `Updated:` line when a CLAUDE.md block was refreshed in
   place. The existing "All files already exist" line logic stays for the `.current/` trio.
6. Replace the usage string (current lines 12-15) with STR-USAGE, and wrap top-level arg handling
   in the `switch` dispatch shown in Interface Contracts. Preserve current exit codes:
   `undefined` sub → exit 1; unknown sub → exit 2.

### T-AGC-CHECK — add `runCheck(cwd)` to `bin/agc-init.mjs`

1. `const ver = installedVersion();`
2. For each `ADAPTERS` entry, `target = path.join(cwd, rel)`. If not `existsSync` → skip (not a
   stale condition).
3. For present files: `const m = STAMP_RE.exec(fs.readFileSync(target, "utf-8"));`
   - no match → stale with stamped `"(none)"`.
   - `m[1] !== ver` → stale (STR-CHECK-STALE with `{file, stamped_version: m[1], installed_version: ver}`).
   - else → current.
4. If any present file is stale: print one STR-CHECK-STALE line per stale file to stderr,
   `process.exit(1)`.
5. Else if at least one adapter present and all current: print STR-CHECK-OK to stdout,
   `process.exit(0)` (AC-6).
6. Else (zero adapters present): no output, `process.exit(0)` (AC-7).

### T-TESTS — `test/agc-adapters.test.mjs` (owner: qa-engineer)

Use `node --test`, run `agc-init.mjs` via `child_process` in a fresh `fs.mkdtempSync` temp dir
(matches the existing `test/*.test.mjs` style; do not pollute the repo). The script under test is
the source `bin/agc-init.mjs` (not compiled). Cases mapped to ACs:

- **AC-2**: init in empty dir → all 3 adapters exist; each contains `agc-version: <pkg.version>`
  (read pkg.version from repo package.json); stdout lists them as created.
- **AC-3**: pre-create `AGENTS.md` with custom content → after init, AGENTS.md byte-unchanged &
  reported skipped; CLAUDE.md + .antigravityrules created.
- **AC-4**: stamp line is the first non-blank line and matches `STAMP_RE`, version === pkg.version.
- **CLAUDE upsert**: pre-create `CLAUDE.md` with user prose (no markers) → after init, user prose
  preserved AND marker block appended. Run init twice → block count stays 1 (idempotent upsert),
  prose untouched.
- **AC-5**: init, then rewrite one adapter's stamp to a bogus older version → `agc check` exits 1
  and stderr names that file with the version gap.
- **AC-6**: init then immediate `agc check` → exit 0, stdout STR-CHECK-OK.
- **AC-7**: `agc check` in an empty dir → exit 0, no stdout/stderr.
- **AC-8**: assert no line of any generated adapter (after stamping) appears verbatim in
  `content/constitution.md`. (Read constitution, split to non-empty trimmed lines, assert
  intersection with adapter non-marker lines is empty.)
- **AC-9**: `agc` with no sub → exit 1; `agc bogus` → exit 2; usage string lists both `init` and
  `check`.

---

## Sequence Diagram

Fewer than 3 actors per flow, so a sequence diagram is not required by the schema. The two flows
are linear (`agc init` → fs writes; `agc check` → fs reads → exit code) and fully specified in the
per-task blueprint above.

---

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| Q1: where `agc check` reads the "installed" version under local-dev vs `npx github:` | Resolve from the script's own location via `import.meta.url` → `path.resolve(here, "..")` → that package root's `package.json` (mirror `check-version.mjs`). NOT cwd's package.json, NOT `require.resolve`. | Correct in every install mode with zero resolution context; compares adapter-stamp vs *agc* version, never the target project's unrelated version. Closes off cwd-based and `require.resolve`-based alternatives. |
| Q2: grow `agc-init.mjs` vs split into `bin/agc.mjs` dispatcher + modules | Extend `agc-init.mjs` in-place with a `switch(argv[2])` dispatch; keep single file. | Lowest churn (no `bin` map / filename change), `bin.agc` keeps pointing at it. Filename becomes a mild misnomer. Revisit a split only when a 3rd subcommand (e.g. deferred `agc update`) lands. |
| CLAUDE.md is an existing-file entry section, not a fresh file | Wrap the Claude block in `<!-- BEGIN/END agc-adapter -->` markers and upsert (insert if absent, replace-in-place if present). | Re-running init refreshes the stamp/loader without clobbering user prose; "idempotent" for CLAUDE.md means "block converges", not "skip whole file". Diverges intentionally from the whole-file skip used for AGENTS.md/.antigravityrules. |
| AGENTS.md / .antigravityrules idempotency | Whole-file skip-if-exists (same as existing `.current/` logic), no marker block. | Matches AC-3 and the existing init pattern; a user who hand-edits these keeps full control. Downside: a hand-deleted-then-recreated file won't auto-refresh its stamp — but `agc check` will flag it stale, which is the intended loud signal. |
| An adapter present but with no parseable stamp (markers/comment clobbered) | `agc check` treats it as stale (`stamped="(none)"`), exit 1. | Conservative: a clobbered stamp is indistinguishable from "deployed by an ancient version", so flag rather than pass. Avoids a false-OK. |
| Single package version → init stamps a frozen copy → bumps make deployed stamps stale | Accept by design. The package version is the single source; stamping freezes it at init time; `agc check` is exactly the mechanism that surfaces the resulting staleness. | This is Mode B (stamped copy + staleness guard) from the research, deliberately chosen over Mode A (runtime fetch) because Codex/Antigravity runtime-prompt-load is unverified (T3). No `agc update` in MVP (deferred), so the remediation is "re-run `agc init`" for skip-mode files / automatic block refresh for CLAUDE.md. Documented so it is not mistaken for a bug. |
| Stale/usage output stream | STR-CHECK-STALE → stderr, STR-CHECK-OK → stdout; usage → stderr (preserve current). | Stale is an error condition (exit 1) so stderr is correct for CI; OK is normal output. Matches `check-version.mjs` (errors→stderr, OK→stdout). |

---

## Deferred Resources

Cross-checked against the spec's *Dependencies / Prerequisites* §3. Both external references were
PM-classified `index` (load-bearing facts already extracted into the research report; re-fetch not
required):

| Reference | PM-recorded reason |
|---|---|
| `https://developers.openai.com/codex/guides/agents-md` | Classified `index`. Establishes AGENTS.md auto-load + global/project layering; facts already in the research report. No fetch needed for implementation. |
| `https://developers.openai.com/codex/hooks` | Classified `index`. Establishes that hooks are a separate lifecycle layer (not the rule source); no implementation dependency. |

No spec-referenced external resource is unclassified — External-reference Sanity Gate passes.

---

## Open Questions

_None. Both PM-deferred design questions are resolved above. Ready for sr-engineer._

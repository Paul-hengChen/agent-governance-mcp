# Dependency advisory decision record

Source of truth for every HIGH/CRITICAL `npm audit` finding this project has
made a deliberate, per-advisory decision about, rather than waiving ad hoc at
release time. Filed under E57 (2026-08-11) after five HIGH advisories had been
carried release-to-release on the individually-correct-but-cumulatively-wrong
grounds that "this cut didn't introduce them" (`docs/backlog.md` E57 row).
Constitution §6's dependency-audit gate (`content/const-15-core-tail.md`)
still governs *whether* a HIGH/CRITICAL finding blocks a release; this record
is the mechanism that replaces case-by-case PR-description waivers with a
durable, citable disposition per advisory. `content/skill-release-engineer.md`
points release-engineer here instead of instructing an ad-hoc waiver.

**How to use this record**: when `npm audit --audit-level=high` flags a
package, check it against the table below by package name.
- Already listed with decision "upgrade" and the advisory still fires →
  something regressed (a fresh install pulled an older transitive version,
  or a new advisory was published against the already-upgraded version) —
  treat as a genuine build failure, do not assume this record still covers
  it.
- Already listed with decision "accept" and nothing else changed → expected,
  cite this record's row, non-blocking.
- Not listed at all → a new advisory. It gets a fresh disposition here
  (upgrade / accept-with-rationale / drop-the-dependency), not an inline
  waiver. Update this file in the same change that resolves it.

Each row also names a **re-review trigger**: the specific event that would
force revisiting the decision, so "accept" never quietly becomes permanent
by default.

## HIGH advisories (all 5, closed as of this record)

### 1. js-yaml — quadratic CPU via merge-key chains / `!!omap`

- **GHSA**: [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) (merge-key chains, `<4.3.0`), [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) (`!!omap` resolution, `<4.3.1`, CVE-2026-59870 backport)
- **Dependency path**: direct `dependencies` entry, was `^4.1.1`, installed `4.2.0`
- **Reachability**: load-bearing, not dev-only. `yaml.load()` runs on every `.current/handoff.md` read (`tools/handoff-parse.ts:175`) and again in `tools/drift.ts` — any workspace this server manages feeds attacker-influenceable YAML (a hand-edited or malicious handoff file) straight into the vulnerable parser on nearly every tool call.
- **Decision**: **upgrade** to `^4.3.1`. Both advisories are fixed in-range under the existing `^4` major — no API break, no override needed.
- **Re-review trigger**: a new js-yaml advisory published against `>=4.3.1`, or a downstream dependency pinning `js-yaml` below `4.3.1` and reintroducing the range.
- **Note — corrects the filing backlog row**: `docs/backlog.md`'s E57 row states "`js-yaml` resolves to 4.2.0 today and is STILL flagged, so this is explicitly not a routine bump." That was true when the row was filed but **is no longer true**: `4.3.1` has since been published and clears both advisories while staying inside the `^4` range already declared in `package.json`. This IS a routine in-range bump — the record is corrected here rather than silently inherited.

### 2. fast-uri — host confusion (backslash authority delimiter / introducer, failed IDN canonicalization)

- **GHSA**: [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx), [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7), [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6) — vulnerable `3.0.0 - 3.1.4`
- **Dependency path**: transitive — `@modelcontextprotocol/sdk@1.29.0` → `ajv@8.20.0` → `fast-uri@^3.0.1`, installed `3.1.2`
- **Reachability**: used by `ajv`'s own JSON-Schema `$ref`/URI resolution inside the SDK's request validation. Server-internal; not directly attacker-steerable through any tool argument this project defines, but still part of the SDK's trust boundary for any malformed schema reference.
- **Decision**: **upgrade** to `3.1.5`. In-range for ajv's declared `^3.0.1` — no `package.json` change, lockfile-only (`npm update fast-uri --package-lock-only`).
- **Re-review trigger**: ajv bumps its own `fast-uri` range below `3.1.5`, or a new fast-uri advisory is published against `>=3.1.5`.

### 3. ip-address — leading-zero octet SSRF / trust-boundary bypass

- **GHSA**: [GHSA-mwp4-54f8-5fhr](https://github.com/advisories/GHSA-mwp4-54f8-5fhr) — `Address4` decodes leading-zero octets as decimal while resolvers decode them as octal, vulnerable `<=10.3.0`
- **Dependency path**: transitive — `@modelcontextprotocol/sdk@1.29.0` → `express-rate-limit@8.5.1` → `ip-address@^10.2.0`, installed `10.2.0`
- **Reachability**: only exercised by the HTTP-mode rate limiter's client-IP parsing (`transport/http.ts`'s use of the SDK's Streamable HTTP transport). Not reachable in stdio mode, which has no rate limiter.
- **Decision**: **upgrade** to `10.5.0`. In-range for `express-rate-limit`'s declared `^10.2.0` — lockfile-only (`npm update ip-address --package-lock-only`).
- **Re-review trigger**: `express-rate-limit` bumps its own `ip-address` range below `10.5.0`, or a new ip-address advisory is published against `>=10.5.0` (two siblings of this same GHSA family — [GHSA-4xrf-jv44-h6hh](https://github.com/advisories/GHSA-4xrf-jv44-h6hh), [GHSA-22jq-vg5j-6vgg](https://github.com/advisories/GHSA-22jq-vg5j-6vgg) — were MODERATE at filing time and not in scope of this HIGH-only pass; re-check them if `npm audit --audit-level=high` ever promotes either).

### 4. sharp — inherited libvips CVEs

- **GHSA**: [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — inherits libvips CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591, vulnerable `<0.35.0`
- **Dependency path**: transitive under `@xenova/transformers@2.17.2` (declares `sharp: ^0.32.0`), installed `0.32.6`
- **Reachability — unreachable in stdio mode entirely**: `tools/rag.ts:190` hard-refuses `tw_index_prd` outside SQLite mode (`"❌ tw_index_prd requires SQLite mode (--port flag). Not available in stdio/file mode."`), and `tools/rag.ts:255` does the same for `tw_clear_prd_chunks`. `embedText`'s only other caller is `tools/storage-sqlite.ts:820`. Stdio is the default and primary distribution mode for this server, so for the overwhelming majority of installs this dependency chain never loads at runtime at all.
- **Reachability — even under SQLite mode, the native binding IS resident, and that strengthens rather than weakens the case for this override**: `@xenova/transformers/src/utils/image.js:16` does a static top-level `import sharp from 'sharp'`, so the `sharp` module lands in `require.cache` the moment `@xenova/transformers` is imported. A `process.dlopen`-interception probe — the valid method here, confirmed against a positive control: `require('sharp')` demonstrably loads the addon (`sharp.versions.vips === "8.18.3"`), yet produces zero `process.moduleLoadList` entries matching `sharp`/`.node`/`Addon`, because `moduleLoadList` does not record `dlopen`'d native addons at all and cannot distinguish loaded from unloaded — shows that importing `@xenova/transformers` dlopens `node_modules/@img/sharp-darwin-arm64/lib/sharp-darwin-arm64-0.35.3.node` (alongside `onnxruntime-node`'s binding). **libvips is resident in-process under SQLite mode.** That is favorable, not adverse: the binding resident is now the **fixed** sharp 0.35.3 / libvips 8.18.3 — exactly what the override below buys. The narrower, still-true argument is that no image is ever decoded through this pipeline: this project's RAG path is text-only feature-extraction (`pipe(text, { pooling: "mean", normalize: true })`), and the libvips CVEs are all image-decode bugs — without an image ever reaching sharp's decode entry point, there is no exploitable input. That argument now rests on the pipeline never issuing a decode call, not on the binding failing to load.
- **Decision**: **upgrade via `package.json` `overrides`** — `"overrides": { "sharp": "^0.35.3" }`. Not a `dependencies`/`optionalDependencies` edit (this project never declares `sharp` directly); the override forces the transitive resolution above `@xenova/transformers`' own declared `^0.32.0` ceiling.
  - **Known risk, contained and scoped — not yet triggered**: `^0.35.3` sits outside transformers.js's declared `^0.32.0` range, and sharp 0.35 dropped some legacy platform variants.
    - **Containment**: `node_modules/sharp` and all 27 `@img/*` prebuilt-binary entries are `optional: true` in the lockfile, and `@xenova/transformers` itself is a project `optionalDependencies` entry — so on a platform sharp 0.35 dropped, `npm install` does **not** fail; the optional dependency simply doesn't install, and RAG degrades to unavailable, which `tools/rag.ts:127`'s dynamic-import guard already handles by design.
    - **Scope of verification**: `node scripts/smoke-rag.mjs` passing (`chunkMarkdown` → `embedText` → `buildPrdChunks` → cosine-similarity retrieval, correct 384-dim vector, correct top-ranked result) confirms the override works on **darwin-arm64** — the one platform this was run on — not universally across every platform `@img/*` ships prebuilts for.
    - **Trigger for this specific risk**: a user or CI reports an `@img/*` install failure or a missing sharp binary on a platform sharp 0.35 dropped it, or `@xenova/transformers` publishes a release whose own `sharp` range excludes `0.35.x` (which would turn this override from merely out-of-range into an actively-unsupported combination).
- **Re-review trigger** (advisory-level, for this whole row): RAG/SQLite mode gains any image-input code path (a feature that lets a PRD or tool argument reference an image for embedding) — **attention-dependent**: nothing in the codebase currently observes this automatically (no test, no gate, no grep); a qa-authored pin test asserting `package.json`'s `overrides.sharp` floor stays `>=0.35.3` would give it a durable anchor and is recommended separately for qa-engineer, not authored in this record. Also: `@xenova/transformers` ships a release that itself pins `sharp` to `^0.35` or later (the override could then be dropped as redundant, or tightened if the new floor is lower than 0.35.3); or a new libvips advisory is published with a non-decode attack vector (e.g. a metadata-parsing bug reachable without decoding pixel data) — both of these two re-fire mechanically through `npm audit --audit-level=high` / `npm ls`.

### 5. @xenova/transformers — inherits #4

- **GHSA**: none filed directly against `@xenova/transformers`; flagged by `npm audit` only because it depends on vulnerable `sharp`.
- **Dependency path**: direct `optionalDependencies` entry, `^2.17.2`, installed `2.17.2` (unchanged)
- **Reachability**: identical to #4 — this row exists only because `npm audit` reports the dependent alongside the dependency.
- **Decision**: **closes with #4** — the `sharp` override above resolves this finding too; `@xenova/transformers` itself is untouched (still `2.17.2`).
- **Re-review trigger**: same as #4.

## Rejected options (recorded so they are not re-litigated)

- **Swap `@xenova/transformers` for `@huggingface/transformers`** (the maintained successor to transformers.js). Checked at decision time: `@huggingface/transformers@4.2.0` still depends on `sharp: ^0.34.5` — also `<0.35.0`, also vulnerable to the same libvips CVEs. Swapping the package buys nothing against this specific advisory and would be a larger, riskier change (different API surface, different optional-dependency shape) for zero security benefit. Rejected.
- **`npm audit fix`'s own suggested fix for #4/#5**: a semver-major **downgrade** of `@xenova/transformers` to `1.4.2` (visible in `npm audit`'s `fix available via 'npm audit fix --force' ... Will install @xenova/transformers@1.4.2, which is a breaking change`). Rejected — downgrading a major version to chase a patch is backwards, and 1.x predates API surface this project's RAG code relies on.
- **Plain `npm audit fix`** (no `--force`) was also rejected as the mechanism for the other four advisories, even though it would technically resolve some of them: it drags `@modelcontextprotocol/sdk` 1.29.0 → 1.30.0 and `hono` 4.x / `@hono/node-server` → 2.1.0 / `body-parser` / `type-is` along with it — all outside this ticket's scope and each its own review surface. The targeted recipe in this record (`js-yaml` direct bump + `overrides.sharp` + two lockfile-only `npm update`s) resolves exactly the 5 HIGH findings and leaves the SDK/hono stack untouched. The actual lockfile delta is **5 version moves** — `js-yaml`, `sharp`, `fast-uri`, `ip-address`, plus `semver 7.8.0→7.8.5` (`optional: true`, pulled in by sharp 0.35.3's own dependency set and deduped with `better-sqlite3`'s `node-abi` chain) — and **+29/−21 package entries**: 27 new `@img/*` sharp prebuilt-binary packages plus `@emnapi/runtime` and `tslib`, replacing sharp 0.32's `bare-*`/`tar-fs`/`tar-stream`/`streamx`/`color*`/`node-addon-api` runtime-download stack. Every one of those moves is confined to the optional `sharp` subtree. The honest number is still favorable to the decision — arguably more so: dropping the `tar-fs`/`bare-*` download-at-install-time path is a net **reduction** in install-time supply-chain surface, not merely a lateral swap.

## Out of scope: residual low/moderate findings

`npm audit --audit-level=high` exits 0 after the upgrades above. Six findings remain below that gate and are **deliberately out of scope for this record** — not silently suppressed, not promoted, just not decided here because nothing forces a decision yet:

| package | severity | advisory |
|---|---|---|
| `body-parser` | low | [GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6) — DoS via invalid `limit` value silently disabling size enforcement |
| `esbuild` | low | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) — arbitrary file read via dev server on Windows |
| `@hono/node-server` | moderate | [GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9) — path traversal in `serve-static` on Windows via encoded backslash |
| `@modelcontextprotocol/sdk` | moderate (via `@hono/node-server`) | same as above — flagged only because the SDK depends on the vulnerable `@hono/node-server` range |
| `hono` | moderate | [GHSA-8j4g-w8fx-2239](https://github.com/advisories/GHSA-8j4g-w8fx-2239), [GHSA-f23p-vx2j-j53r](https://github.com/advisories/GHSA-f23p-vx2j-j53r), [GHSA-79qm-7rj5-m7r9](https://github.com/advisories/GHSA-79qm-7rj5-m7r9), [GHSA-54fx-42gc-7vw4](https://github.com/advisories/GHSA-54fx-42gc-7vw4) — ReDoS/SSR-cache/header/complexity issues |
| `protobufjs` | moderate | [GHSA-j3f2-48v5-ccww](https://github.com/advisories/GHSA-j3f2-48v5-ccww) — DoS via infinite loop in `.proto` option parsing |

All six are transitive under `@modelcontextprotocol/sdk@1.29.0`, whose own upgrade (to pull fixed `hono`/`@hono/node-server`/`body-parser` ranges) was explicitly rejected above as out of scope for this ticket. `protobufjs` already carries an `overrides` entry (`^7.5.8`, pre-existing, unrelated to E57) that does not reach far enough to clear this specific DoS advisory. **Re-review trigger for this whole group**: any of these six is promoted to HIGH/CRITICAL by a future advisory revision (which would flip `npm audit --audit-level=high`'s exit code and force a real decision), or a ticket is filed to take the `@modelcontextprotocol/sdk` upgrade deliberately (at which point this table should be re-derived, not assumed still accurate).

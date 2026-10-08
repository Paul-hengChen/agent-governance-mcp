# Dependency advisory decision record

Source of truth for every HIGH/CRITICAL `npm audit` finding this project has
made a deliberate, per-advisory decision about, rather than waiving ad hoc at
release time. Filed under E57 (2026-08-11) after five HIGH advisories had been
carried release-to-release on the individually-correct-but-cumulatively-wrong
grounds that "this cut didn't introduce them" (`docs/backlog.md` E57 row).
Constitution §6's dependency-audit gate (`content/const-15-core-tail.md`)
still governs *whether* a HIGH/CRITICAL finding blocks a release; this record
is the mechanism that replaces case-by-case PR-description waivers with a
durable, citable disposition per advisory. Constitution §6 points every
build-running role here (E59 generalized the rule from release-engineer alone
to every role that runs a build) instead of instructing an ad-hoc waiver;
`content/skill-release-engineer.md` step 6a spells out the release-engineer
instance.

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

## HIGH advisories (7 packages, all closed; `fast-uri` re-dispositioned 2026-09-04 — see §2 *Second round*; `js-yaml` and `sharp` re-dispositioned 2026-09-14 — see §1 and §4 *Second round*; `sharp` re-dispositioned again and `@modelcontextprotocol/sdk` / `proxy-addr` added 2026-10-07 — see §4 *Third round*, §6, §7)

### 1. js-yaml — quadratic CPU via merge-key chains / `!!omap`

- **GHSA**: [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) (merge-key chains, `<4.3.0`), [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) (`!!omap` resolution, `<4.3.1`, CVE-2026-59870 backport)
- **Dependency path**: direct `dependencies` entry, was `^4.1.1`, installed `4.2.0`
- **Reachability**: load-bearing, not dev-only. `yaml.load()` runs on every `.current/handoff.md` read (`tools/handoff-parse.ts:175`) and again in `tools/drift.ts` — any workspace this server manages feeds attacker-influenceable YAML (a hand-edited or malicious handoff file) straight into the vulnerable parser on nearly every tool call.
- **Decision**: **upgrade** to `^4.3.1`. Both advisories are fixed in-range under the existing `^4` major — no API break, no override needed.
- **Re-review trigger**: a new js-yaml advisory published against `>=4.3.1`, or a downstream dependency pinning `js-yaml` below `4.3.1` and reintroducing the range.
- **Note — corrects the filing backlog row**: `docs/backlog.md`'s E57 row states "`js-yaml` resolves to 4.2.0 today and is STILL flagged, so this is explicitly not a routine bump." That was true when the row was filed but **is no longer true**: `4.3.1` has since been published and clears both advisories while staying inside the `^4` range already declared in `package.json`. This IS a routine in-range bump — the record is corrected here rather than silently inherited.

#### Second round — trigger FIRED 2026-09-14, re-dispositioned

Round 1's re-review trigger fired verbatim: *"a new js-yaml advisory published against `>=4.3.1`"*.
Round 1's disposition is left intact above rather than edited, so the record shows what was decided when.

- **GHSA**: [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) — `maxTotalMergeKeys` does not limit CPU use for empty merge sources; severity **high**, vulnerable `4.0.0 - 4.3.1`, which **includes the `4.3.1` round 1 upgraded to**
- **Dependency path**: unchanged — direct `dependencies` entry, was `^4.3.1`, installed `4.3.1` at detection
- **Reachability**: unchanged from round 1 and still the most exposed row in this record — `yaml.load()` runs on every `.current/handoff.md` read (`tools/handoff-parse.ts`) and again in `tools/drift.ts`, so a hand-edited or hostile handoff file reaches the parser on nearly every tool call. This advisory is a CPU-exhaustion bug in exactly that parse path, so no reachability argument is available and none is attempted.
- **Decision**: **upgrade** to `^4.3.2`. `4.3.2` was already inside the declared `^4.3.1` range, so the lockfile alone would have resolved it — the `package.json` floor is raised anyway so a fresh install cannot resolve back to `4.3.1`. Same mechanism as round 1: in-range under `^4`, no API break, no override. **Verified**: installed tree resolves `js-yaml@4.3.2`, `npm audit --audit-level=high` exits 0, `npm run build` clean, 1813/1813 tests pass.
- **Re-review trigger**: a new js-yaml advisory published against `>=4.3.2`, or a downstream dependency pinning `js-yaml` below `4.3.2` and reintroducing the range.

### 2. fast-uri — host confusion (backslash authority delimiter / introducer, failed IDN canonicalization)

- **GHSA**: [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx), [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7), [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6) — vulnerable `3.0.0 - 3.1.4`
- **Dependency path**: transitive — `@modelcontextprotocol/sdk@1.29.0` → `ajv@8.20.0` → `fast-uri@^3.0.1`, installed `3.1.2`
- **Reachability**: used by `ajv`'s own JSON-Schema `$ref`/URI resolution inside the SDK's request validation. Server-internal; not directly attacker-steerable through any tool argument this project defines, but still part of the SDK's trust boundary for any malformed schema reference.
- **Decision**: **upgrade** to `3.1.5`. In-range for ajv's declared `^3.0.1` — no `package.json` change, lockfile-only (`npm update fast-uri --package-lock-only`).
- **Re-review trigger**: ajv bumps its own `fast-uri` range below `3.1.5`, or a new fast-uri advisory is published against `>=3.1.5`.

#### Second round — trigger FIRED 2026-09-04, re-dispositioned

The re-review trigger recorded above fired exactly as written: four **new** advisories were
published against `fast-uri`, and their vulnerable range (`3.0.0 - 3.1.5`) **includes the `3.1.5`
that round 1 upgraded to**. Caught at a build gate by a coordinator-direct docs change, which is
the behaviour this record's *How to use* section prescribes ("a new advisory was published against
the already-upgraded version — treat as a genuine build failure, do not assume this record still
covers it"). Round 1's disposition is left intact above rather than edited, so the record shows
what was decided when.

- **GHSA**: [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8) (host confusion via skipped IDN canonicalization on scheme-relative references), [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) (SSRF via malformed IPv6 normalization), [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) (SSRF via repeated hostname percent-decoding), [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) (host confusion via percent-encoded scheme normalization) — all severity **high**, vulnerable `3.0.0 - 3.1.5`
- **Dependency path**: unchanged — transitive, `@modelcontextprotocol/sdk@1.29.0` → `ajv@8.20.0` → `fast-uri@^3.0.1`, installed `3.1.5` at detection
- **Reachability**: same boundary as round 1, with one narrowing measured this round. `ajv` is used *only* transitively by the SDK's request validation — this project has **zero** direct `ajv` usage (no `from 'ajv'` / `require('ajv')`, no `addSchema`, no `loadSchema`, no `$ref` in any `.ts` here), so ajv resolves `$ref` against its own in-memory registry and never dereferences a resolved URI over the network. The two **SSRF-class** advisories (`f65p`, `fph4`) therefore have no reachable sink in this project. The two **host-confusion** advisories (`5jgf`, `jqff`) sit in the same trust boundary round 1 described: server-internal URI comparison during schema-reference resolution, not directly steerable through any tool argument this project defines.
- **Decision**: **upgrade** to `3.1.7` — the same mechanism round 1 used, since it still applies: `3.1.7` is in-range for ajv's declared `^3.0.1`, so this is lockfile-only (`npm update fast-uri --package-lock-only`) with no `package.json` change and no override. `fast-uri@4.x` exists but is outside ajv's declared `^3` range and would require an ajv major bump; not needed, and not taken. **Verified after the upgrade**: installed tree resolves `fast-uri@3.1.7`, and `npm audit` reports `high: 0, critical: 0` (`npm audit --audit-level=high` exits 0). Remaining findings are 4 moderate + 2 low, below §6's gate.
- **Re-review trigger**: a new fast-uri advisory published against `>=3.1.7`, or ajv bumping its own `fast-uri` range below `3.1.7`. If a future advisory is fixed only in `4.x`, this stops being a lockfile-only bump and becomes an ajv/SDK upgrade decision — file it as such rather than forcing an out-of-range override.

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

#### Second round — trigger FIRED 2026-09-14, re-dispositioned

Round 1's advisory-level trigger fired through the mechanical channel it named (*"re-fire mechanically
through `npm audit --audit-level=high`"*). Round 1's disposition is left intact above rather than edited.

- **GHSA**: [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) — sharp inherits libheif [GHSA-g89c-p67h-r497](https://github.com/advisories/GHSA-g89c-p67h-r497) and [GHSA-2jg2-4ch7-h545](https://github.com/advisories/GHSA-2jg2-4ch7-h545); severity **high**, vulnerable `<0.35.4`, which **includes the `0.35.3` round 1's override pinned**
- **Dependency path**: unchanged — transitive under `@xenova/transformers@2.17.2`, resolved through this project's `overrides.sharp`
- **Reachability**: round 1's narrowing still holds on its own terms — this project's RAG path is text-only feature extraction, libheif is an image **decoder**, and no image ever reaches a decode entry point. That argument is deliberately **not** relied on here: this record's own *How to use* section prescribes treating "a new advisory published against the already-upgraded version" as a genuine build failure rather than assuming the existing disposition still covers it. Upgrading one patch version is cheaper than re-litigating reachability, so the reachability finding is recorded as context, not as the decision.
- **Decision**: **upgrade the override floor** to `"overrides": { "sharp": "^0.35.4" }`. `0.35.4` was already inside the `^0.35.3` override range, so the floor is raised for the same reason as §1 — to stop a fresh install resolving back to `0.35.3`. No `@xenova/transformers` change (still `2.17.2`), no SDK/hono movement. **Verified**: installed tree resolves `sharp@0.35.4 overridden`, `npm audit --audit-level=high` exits 0, `npm run build` clean, 1813/1813 tests pass. The platform-availability risk round 1 recorded is unchanged in kind — `0.35.4` is a patch release of the same `0.35` line whose prebuilt-binary matrix round 1 already assessed.
- **Rejected again**: `npm audit fix --force`, which still proposes the semver-major **downgrade** of `@xenova/transformers` to `1.4.2`. Rejected on round 1's reasoning, unchanged.
- **Re-review trigger**: a new libvips/libheif advisory published against `>=0.35.4`, plus round 1's two standing triggers (RAG gains an image-input code path; `@xenova/transformers` ships a release pinning `sharp` itself).

#### Third round — re-dispositioned 2026-10-07 (fired through *How to use*, not through round 2's trigger as written)

A new sharp advisory was published against the version round 2 upgraded to, so `npm audit --audit-level=high` exited 1 again. That is the mechanical channel round 1 named. Rounds 1 and 2 are left intact above rather than edited.

**Which trigger fired — stated precisely.** Round 2's trigger reads *"a new libvips/libheif advisory published against `>=0.35.4`"*. This advisory is inherited from **librsvg**, sharp's bundled SVG decoder. librsvg is neither libvips nor libheif, so that trigger did **not** fire as written. It is the same class of finding, though: a CVE in a native image-decoding library that ships inside sharp's prebuilt libvips bundle. What actually forced this round is this record's *How to use* clause: *"Already listed with decision 'upgrade' and the advisory still fires … a new advisory was published against the already-upgraded version — treat as a genuine build failure."* The trigger below is widened so the wording gap does not recur.

- **GHSA**: [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) — sharp inherits librsvg CVE-2026-96889, a memory-safety bug (CWE-416 use-after-free, CWE-1395) that the advisory says can lead to remote code execution on glibc-based Linux "when certain runtime-specific conditions apply". Its stated mitigation is running a `node` binary built as a Position Independent Executable. Severity **high**, vulnerable `<0.35.5`, which **includes the `0.35.4` round 2's override pinned**. Fixed in `0.35.5`, which bundles librsvg `2.63.2`.
- **Dependency path**: unchanged — transitive under `@xenova/transformers@2.17.2`, resolved through this project's `overrides.sharp`. Installed `0.35.4` when this was detected.
- **Reachability**: round 1's narrowing still holds — the RAG path is text-only feature extraction, and the vulnerable code is reached only by decoding an SVG input (the advisory's workaround is `sharp.block({ operation: ["VipsForeignLoadSvg"] })`), which this project never does. As in round 2, that argument is recorded as context only, **not** as the decision. The upgrade is one patch version and costs less than re-arguing reachability.
- **Decision**: **upgrade the override floor** to `"overrides": { "sharp": "^0.35.5" }`. `0.35.5` was already inside the `^0.35.4` range; the floor is raised so that a fresh install cannot resolve back to `0.35.4`. No `@xenova/transformers` change (still `2.17.2`). The lockfile delta for this row is version moves only: `sharp` `0.35.4 → 0.35.5`, the `@img/sharp-*` platform binaries `0.35.4 → 0.35.5`, and the `@img/sharp-libvips-*` bundles `1.3.3 → 1.3.4`. No package was added or removed. **Verified**: the installed tree resolves `sharp@0.35.5 overridden`; at runtime `sharp.versions` reports `rsvg: 2.63.2`, `vips: 8.18.7`, `heif: 1.23.5`; `npm audit --audit-level=high` exits 0; `npm run build` is clean with no `dist/` diff; the full suite passes 3040/3043 (3 skipped, 0 failing), the same counts as the pre-upgrade baseline; `node scripts/smoke-rag.mjs` passes on darwin-arm64. Round 1's platform-availability risk is unchanged in kind, because `0.35.5` is a patch release of the same `0.35` line.
- **Rejected again**: `npm audit fix --force`, which still proposes the semver-major **downgrade** of `@xenova/transformers` to `1.4.2`. Rejected on round 1's reasoning, unchanged.
- **Re-review trigger**: a new advisory published against `>=0.35.5` in sharp itself **or in any native library bundled in its prebuilt libvips** (libvips, libheif, librsvg, or any other library listed in `sharp.versions`). Round 1's two standing triggers also still apply: RAG gains an image-input code path; `@xenova/transformers` ships a release that pins `sharp` itself.

### 5. @xenova/transformers — inherits #4

- **GHSA**: none filed directly against `@xenova/transformers`; flagged by `npm audit` only because it depends on vulnerable `sharp`.
- **Dependency path**: direct `optionalDependencies` entry, `^2.17.2`, installed `2.17.2` (unchanged)
- **Reachability**: identical to #4 — this row exists only because `npm audit` reports the dependent alongside the dependency.
- **Decision**: **closes with #4** — the `sharp` override above resolves this finding too; `@xenova/transformers` itself is untouched (still `2.17.2`).
- **Re-review trigger**: same as #4.
- **2026-10-07**: flagged again only as the dependent of GHSA-wq5f-xc86-pv6w. It closes with #4 again through the §4 *Third round* override bump (`^0.35.5`), and `@xenova/transformers` itself is untouched (still `2.17.2`).

### 6. @modelcontextprotocol/sdk — OAuth client could send credentials to a server-chosen authorization server

- **GHSA**: [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h) (CVE-2026-104850). Severity **high** (CVSS 7.5; CWE-345, CWE-522). Vulnerable `>=1.12.0 <1.31.0`, fixed in `1.31.0`. The SDK's OAuth **client** did not bind stored credentials to the authorization server they belong to. A malicious MCP server could therefore name its own authorization server and receive the client's `refresh_token` / `client_secret`.
- **Dependency path**: direct `dependencies` entry, was `^1.29.0`, installed `1.29.0`. This is the package's first row in this record: §2 and §3 name the SDK only as the parent of a transitive path.
- **Reachability — unreachable**: the advisory is limited to the OAuth client paths (`authProvider` on a transport, `withOAuth()`, direct `auth()` / `fetchToken()`). It says explicitly that **MCP servers built with the SDK** and **stdio clients** are not affected. This project is only an MCP server. Its imports from the SDK are `server/index.js`, `server/stdio.js` and `types.js` (`index.ts`), `server/streamableHttp.js` (`transport/http.ts`), and `types.js` (`tools/registry.ts`). It never imports any `sdk/client/*` module, and it has no OAuth client configuration.
- **Decision**: **upgrade** to `^1.32.1`, the latest `1.x` release when this was decided. The human chose "upgrade all three" on 2026-10-07, so the unreachability finding is recorded as context, not used as an accept rationale. The new floor is inside the existing `^1` major, so no override is needed. In the lockfile the SDK package itself moves `1.29.0 → 1.32.1`. None of its own dependencies moves except `proxy-addr` (§7); `hono`, `@hono/node-server`, `express` and `ajv` stay at their previous versions. **Verified**: the installed tree resolves `@modelcontextprotocol/sdk@1.32.1`; `npx tsc --noEmit` and `npm run build` are clean with no `dist/` diff; the full suite passes 3040/3043 (3 skipped, 0 failing), the same counts as the pre-upgrade baseline. The spec's one-shot bisect allowance for the SDK floor was not needed. The SDK's moderate row (from `@hono/node-server`) is also gone from `npm audit` after the bump — see the 2026-10-07 note in the residual section.
- **Re-review trigger**: a new SDK advisory published against `>=1.32.1`; this project starting to import any SDK client / OAuth module, which would make this advisory class reachable (attention-dependent — no test or gate watches for it); or a migration to the SDK's `2.x` package split (`@modelcontextprotocol/client` / `core` / `server`). The 2.x fix line has different package names and fixed versions (`>=2.2.0`), so this row does not carry over to 2.x automatically.

### 7. proxy-addr — IP spoofing via IPv4-mapped IPv6 trust subnet

- **GHSA**: [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) (CVE-2026-90711). Severity **critical** (CVSS 9.1; CWE-290, CWE-348, CWE-697). Vulnerable `>=1.1.0 <2.0.8`, fixed in `2.0.8`. A trust subnet written in IPv4-mapped IPv6 notation with a short prefix (for example `::ffff:10.0.0.0/8`) matches every IPv4 address. Every client is then trusted as a proxy, and Express's `req.ip` / `req.ips` return whatever the client puts in `X-Forwarded-For`.
- **Dependency path**: transitive — `@modelcontextprotocol/sdk` (`1.29.0`, now `1.32.1`) → `express@5.2.1` → `proxy-addr@^2.0.7`, installed `2.0.7`.
- **Reachability — unreachable**: the bug only matters when an Express app sets a `trust proxy` subnet. This project uses no Express. `transport/http.ts` builds its server with `node:http` `createServer` and the SDK's `StreamableHTTPServerTransport`, which imports `@hono/node-server`, not Express. Express is loaded only by SDK modules this project never imports (`server/express.js`, `server/auth/*`). No source file here contains `trust proxy`, `req.ip` or `express`.
- **Decision**: **upgrade by lockfile refresh — no override** (the spec's AC3 case "lockfile refresh alone"). `2.0.8` is in range for express's declared `^2.0.7`. Because the locked `2.0.7` already satisfied that range, the SDK bump's `npm install` left it in place. `npm update proxy-addr` then moved it to `2.0.8` in the lockfile — the same in-range, lockfile-only mechanism as §2 and §3. No `package.json` change and no `overrides` entry. **Verified**: the installed tree resolves `proxy-addr@2.0.8`, and `npm audit --audit-level=high` exits 0.
- **Re-review trigger**: `express` lowering its own `proxy-addr` range below `2.0.8`, or a new proxy-addr advisory published against `>=2.0.8` (both fire mechanically through `npm audit --audit-level=high`). Also: this project starting to use Express or setting `trust proxy` anywhere, which would make the advisory class reachable (attention-dependent).

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

**2026-09-14 — this table is stale in composition, not in conclusion.** After the §1/§4 second-round upgrades, `npm audit` reports 6 findings (2 low, 4 moderate) and still exits 0 at the HIGH gate, but the set is no longer the one tabulated above: `qs` now appears with two moderate advisories ([GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) array-limit bypass, [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) DoS via attacker-controlled `isBuffer`) despite the pre-existing `overrides.qs` entry, and `hono`'s advisory list has grown by three. The table is left as filed rather than silently rewritten, per this record's convention; re-derive it — do not assume it accurate — if any of these is ever promoted to HIGH.

All six are transitive under `@modelcontextprotocol/sdk@1.29.0`, whose own upgrade (to pull fixed `hono`/`@hono/node-server`/`body-parser` ranges) was explicitly rejected above as out of scope for this ticket. `protobufjs` already carries an `overrides` entry (`^7.5.8`, pre-existing, unrelated to E57) that does not reach far enough to clear this specific DoS advisory. **Re-review trigger for this whole group**: any of these six is promoted to HIGH/CRITICAL by a future advisory revision (which would flip `npm audit --audit-level=high`'s exit code and force a real decision), or a ticket is filed to take the `@modelcontextprotocol/sdk` upgrade deliberately (at which point this table should be re-derived, not assumed still accurate).

**2026-10-07 — post-E275 totals; the table is still stale in composition, not in conclusion.** After the §4 *Third round*, §6 and §7 upgrades, `npm audit` reports **8 findings: 2 low, 6 moderate, 0 high, 0 critical**, and `npm audit --audit-level=high` exits 0. As measured, the set has shifted again:
- `@modelcontextprotocol/sdk` no longer appears (its moderate row via `@hono/node-server` is gone after the `1.32.1` bump), but `@hono/node-server` (`1.19.14`) and `hono` (`4.12.27`) are still flagged, and `hono`'s advisory list now has eight entries.
- `fast-uri` (`3.1.7`) and `ip-address` (`10.5.0`) now carry **moderate** advisories against the very versions §2 and §3 upgraded to. They are below the HIGH gate, so this record's *How to use* regression clause does not apply to them. §3's own trigger names promotion to HIGH as the point to re-check.
- `qs`, `protobufjs`, `body-parser` and `esbuild` are still present.

This group's own re-review trigger names "a ticket is filed to take the `@modelcontextprotocol/sdk` upgrade deliberately". E275 is that SDK upgrade, but it was cut for the HIGH/CRITICAL advisories only. The table is therefore still **not** re-derived or decided here — it is left as filed, per this record's convention. The re-derivation stays open for whichever ticket next takes this group on, and must start from a fresh `npm audit`, not from this table.

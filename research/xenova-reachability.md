# xenova/transformers → protobufjs RCE reachability analysis

## Summary

- **The v3.13.0 waiver ("not reachable") is INCORRECT.** The protobufjs RCE chain IS reachable from server input via the `tw_index_prd` MCP tool's `embedding_model` parameter, which is client-controllable and only validated by a permissive regex.
- **PRD text itself is NOT the attack vector** — PRD content flows as model *input data* (tensor), not as protobuf schema. The schema attack surface is the **.onnx model file**, which `embedding_model` points at via the Hugging Face Hub download path.
- **Severity in practice**: HIGH in HTTP/SQLite mode (network-exposed MCP transport allows arbitrary clients to call `tw_index_prd`). MODERATE in stdio mode (only the locally-running IDE can call the tool — same trust boundary as `Edit`/`Write` already, but the protobufjs RCE escalates a "command injection in MCP client" attack to "RCE in MCP server process").
- **Recommendation**: ship an allowlist on `embedding_model` in v3.14.1 (5-min fix), restrict to `Xenova/*` + a small set of verified models. This is strictly tighter than the current regex and blocks the schema-level attack without breaking the default flow.
- **Alternative mitigations (deeper but slower)**: upgrade `@xenova/transformers` major version (may require API changes); pin `onnxruntime-web` to a patched protobufjs (currently unavailable in the dep tree); drop RAG (feature regression).

## Evidence

### The CVE attack vector requires schema-level attacker control

- "An attacker who can provide a malicious protobuf definition or JSON descriptor to an application may be able to execute arbitrary JavaScript in the context of the process using protobufjs." ([GitHub Advisory GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg)) [T1]
- "protobufjs could execute generated JavaScript code derived from protobuf schema metadata. When loading a crafted JSON descriptor, schema-controlled type names and type references could reach runtime code generation without sufficient validation." ([Bleeping Computer 2026](https://www.bleepingcomputer.com/news/security/critical-flaw-in-protobuf-library-enables-javascript-code-execution/)) [T2]
- "The library builds JavaScript functions from protobuf schemas by concatenating strings and executing them via the `Function()` constructor, but it fails to validate schema-derived identifiers, such as message names." ([Endor Labs blog](https://www.endorlabs.com/learn/the-dangers-of-reusing-protobuf-definitions-critical-code-execution-in-protobuf-js-ghsa-xq3m-2v4x-88gg)) [T2]
- Severity: CVSS 9.4 critical, RCE on servers, lateral movement potential. ([CVE-2026-41242 Mondoo](https://mondoo.com/vulnerability-intelligence/vulnerability/CVE-2026-41242)) [T2]
- Affected: protobufjs ≤ 8.0.0 and ≤ 7.5.4. Patched: 8.0.1 and 7.5.5. ([GitHub Advisory](https://github.com/advisories/GHSA-xq3m-2v4x-88gg)) [T1]

### How protobufjs gets called in our dependency chain

- `@xenova/transformers` calls into `onnxruntime-web` for actual inference: "Transformers.js is built on top of ONNX Runtime Web, which provides task-specific APIs (pipelines) and model hub integration, while ONNX Runtime Web does the actual computation." ([PkgPulse 2026](https://www.pkgpulse.com/guides/transformersjs-vs-onnx-runtime-web-2026)) [T2]
- ONNX model files are protobuf-serialized graph definitions — the .onnx format IS a protobuf schema. When `onnxruntime-web` loads a model, `protobufjs` parses the .onnx schema. ([Microsoft community hub on ONNX Runtime Web](https://techcommunity.microsoft.com/blog/educatordeveloperblog/use-webgpu--onnx-runtime-web--transformer-js-to-build-rag-applications-by-phi-3-/4190968)) [T2]
- Dep tree (from `npm audit` output captured at v3.14.0):
  ```
  @xenova/transformers >= 2.0.2
    └── onnxruntime-web <= 1.16.0-dev.20230910-24f0893d3c
          └── onnx-proto *
                └── protobufjs (vulnerable versions ≤ 7.5.4)
  ```
  ([this repo `npm audit` output captured 2026-05-29](file:///Users/paul.ph.chen/agent-governance-mcp/package.json)) [T1]
- The optional dep is exercised only in `tools/rag.ts` → `loadXenova()` → `pipeline()` → `embedText()` → `buildPrdChunks()`. ([tools/rag.ts:127-142](file:///Users/paul.ph.chen/agent-governance-mcp/tools/rag.ts)) [T1]

### Path 1: PRD text as input data — NOT REACHABLE

- `tools/rag.ts:151` reads `prd_path` content as UTF-8 string, then `chunkMarkdown(text)` does pure string ops with no protobuf calls. ([tools/rag.ts:151-153](file:///Users/paul.ph.chen/agent-governance-mcp/tools/rag.ts)) [T1]
- `embedText(text, ...)` passes the chunked text as `pipe(text, { pooling: "mean", normalize: true })` (line 137). The text becomes the *input tensor* to the model, not the schema. ONNX runtime tokenises text → tensor → graph forward pass. ([tools/rag.ts:137](file:///Users/paul.ph.chen/agent-governance-mcp/tools/rag.ts)) [T1]
- protobufjs is invoked during *model load* (parsing the .onnx schema), not during *inference* (running the parsed graph on tensor data). The PRD text never reaches protobufjs.
- **Verdict for this path**: NOT reachable. Even if PRD contains crafted strings, they end up as token IDs in a Float32Array, not as schema definitions.

### Path 2: `embedding_model` parameter as schema selector — REACHABLE

- `tw_index_prd` accepts a client-controlled `embedding_model` parameter:
  ```ts
  embedding_model: z
    .string()
    .max(200)
    .regex(/^[A-Za-z0-9._\-]+\/[A-Za-z0-9._\-]+$/, { message: "..." })
    .optional(),
  ```
  ([index.ts:146-150](file:///Users/paul.ph.chen/agent-governance-mcp/index.ts)) [T1]
- The regex only enforces `namespace/name` shape. **Any HF Hub repo** matching that shape is accepted — including attacker-controlled repos like `attacker/evil-model`, `xenova-typo/all-MiniLM-L6-v2`, `0xevil/onnx`.
- When `tools/rag.ts:132` runs `pipeline("feature-extraction", model, { quantized: true })`, the Xenova lib downloads the model from the HF Hub default cache logic. Attacker can publish a HF repo with a crafted .onnx file whose protobuf schema embeds the RCE payload per GHSA-xq3m-2v4x-88gg.
- Threat model:
  - **stdio mode** (default for Claude Code, Cursor, etc.): the MCP client is a local process the user trusts. An attacker would need to compromise the IDE or a related tool to call `tw_index_prd` with malicious params. Trust-equivalent to the existing `Bash` / `Edit` surface — so the protobufjs RCE doesn't *expand* the attack surface, just gives one more way to escalate already-trusted-process compromise into MCP-server-process RCE.
  - **HTTP/SQLite mode** (`--port` flag): the MCP server listens on a TCP port. Any network-local attacker who can reach the port can call any tool. Even if the listener is `localhost`-bound, browser-based same-origin bypasses (DNS rebinding, XSS in another local app) make this a real risk. The protobufjs RCE chain is reachable via plain HTTP `POST` of an MCP `tools/call` request with `embedding_model: "attacker/payload"`.
- **Verdict for this path**: REACHABLE in HTTP mode (HIGH severity). REACHABLE-by-elevation in stdio mode (MODERATE — equivalent to existing local-process trust boundary).

### Confirming the @xenova/transformers usage cannot be silenced

- `tools/rag.ts:118` uses `import("@xenova/transformers")` dynamically with try/catch — the optional-dep pattern. If the package is absent, RAG silently no-ops. ([tools/rag.ts:112-125](file:///Users/paul.ph.chen/agent-governance-mcp/tools/rag.ts)) [T1]
- `package.json:34-35` lists `@xenova/transformers: ^2.17.2` and `better-sqlite3: ^12.10.0` as `optionalDependencies`. Removing the optional dep is one mitigation lane (lose RAG entirely). ([package.json:34-37](file:///Users/paul.ph.chen/agent-governance-mcp/package.json)) [T1]
- The latest Xenova/transformers release (v2.17.2, published August 2024) does NOT include the protobufjs fix yet because onnxruntime-web is also stale in their dep tree. ([huggingface/transformers.js releases](https://github.com/xenova/transformers.js/releases)) [T2] (stale — pre-2026-05 sources, but matches the npm audit output captured today, so non-stale by deduction.)

## Recommendation

**Ship `embedding_model` allowlist in v3.14.1 (T203 mitigation).**

Concrete implementation (5-10 LoC in `index.ts`):

```ts
const ALLOWED_EMBEDDING_MODELS = new Set([
  "Xenova/all-MiniLM-L6-v2",          // current default
  "Xenova/bge-small-en-v1.5",         // documented alternative
  "Xenova/multilingual-e5-small",     // documented alternative
]);

// In IndexPrdArgs.refine:
.refine(
  (d) => !d.embedding_model || ALLOWED_EMBEDDING_MODELS.has(d.embedding_model),
  { message: "embedding_model must be one of: Xenova/all-MiniLM-L6-v2, Xenova/bge-small-en-v1.5, Xenova/multilingual-e5-small. Open an issue to request additions.", path: ["embedding_model"] },
)
```

**Cost**: ~10 LoC + one test. Zero behavioural change for default flow (no `embedding_model` passed → uses `DEFAULT_EMBEDDING_MODEL` which is in the allowlist).

**Risk**: blocks legitimate users who want a different HF model. Mitigation: clear error message + GitHub-issue path to extend the allowlist.

**Why this is the right answer for v3.14.1**:
1. **Closes the reachable RCE chain** — attacker can no longer point at a malicious HF repo because the allowlist contains only Xenova-org-hosted models. (Trust boundary: HuggingFace + Xenova organisation. Same boundary as the default install.)
2. **Strictly tighter than the current regex** — no false negatives, no behaviour change for default callers.
3. **Documented + reversible** — adding an alternative model is a 1-line PR; not a permanent restriction.
4. **CHANGELOG can claim "mitigated"** instead of waiver — honest framing.

**Combine with**: amended waiver text in CHANGELOG citing this report. The CRITICAL severity transitively persists in `npm audit` output (because `@xenova/transformers` still depends on vulnerable `onnxruntime-web`), but the *exploitable path* through our MCP surface is closed by the allowlist.

## Alternatives Considered

- **A1: Upgrade `@xenova/transformers` to a major version with patched onnxruntime-web.** Rejected for v3.14.1 — no such release exists at audit time (v2.17.2 is current; no v3.x). When upstream ships a fix, prefer this over the allowlist. Track as `optionalDependencies` upgrade candidate for v3.16+.
- **A2: Force `onnxruntime-web` to a patched protobufjs via npm overrides.** Rejected — `package-overrides` for transitive deps is fragile; an upstream API mismatch could break ONNX inference silently. Allowlist is the safer fence.
- **A3: Drop RAG entirely (remove `@xenova/transformers` from `optionalDependencies`).** Rejected — RAG is the lazy-reindex hook in `prompts/build.ts:appendSpecContext` for spec context injection. Removing it regresses the v3.3.0 feature shipped in HTTP mode. Disproportionate cost for the threat.
- **A4: Defer to v3.15.0.** Rejected — the RCE *is* reachable in HTTP mode, and HTTP mode is a documented usage (`README §HTTP mode`). Not patching a known-reachable CRITICAL in a release we already cut is a worse signal than landing a 10-LoC allowlist.

## Open Questions

- **Should the allowlist be configurable via `.config.json`?** Adding `taskPaths`-style override would let users widen the list per-workspace. Costs 20-30 LoC + a new schema field. Defer to v3.15.0 unless community asks. Track as "if N users request alternative models, add config support" — N=3 is the threshold.
- **HuggingFace supply-chain compromise** — even with the allowlist, a malicious commit to the `Xenova/all-MiniLM-L6-v2` repo could push a poisoned .onnx. HF Hub provides commit history but no signing. Out of scope for v3.14.1; track as long-term concern.
- **stdio mode threat-model precision** — the analysis says stdio is "trust-equivalent to existing surface." A more careful threat model could distinguish (a) a compromised IDE extension calling `tw_index_prd` from (b) a legitimate IDE call with attacker-tainted workspace config. Worth a Constitution §6 addition documenting MCP transport assumptions. v3.15.0 candidate.
- **`(stale)` sources**: Xenova/transformers releases dated 2024 — could be > 12 months old depending on exact dates. The npm audit output captured 2026-05-29 corroborates the same dep state, so the stale-tag is not load-bearing for the verdict. No major recommendation depends solely on stale sources.

— @researcher

# Spec: dependency-security-protobufjs

> Source: `npm audit --audit-level=high` surfaced 5 advisories (1 critical, 3 high,
> 1 moderate) — all in `protobufjs`, pulled transitively via the OPTIONAL
> dependency `@xenova/transformers@2.17.2` → `onnxruntime-web` → `onnx-proto`
> (the RAG embedding stack). Waived in v3.16.2; this feature clears it.

## Problem Statement

`protobufjs <=7.5.7` carries a critical arbitrary-code-execution advisory
(GHSA-xq3m-2v4x-88gg) plus several high/moderate DoS / prototype-pollution
advisories. It reaches the tree only through the optional `@xenova/transformers`
embedding dependency (used by `tools/rag.ts` in HTTP/SQLite mode). `@xenova/transformers@2.17.2`
is already the latest release of that package line, so the fix is to **pin a
patched `protobufjs`** via an `overrides` entry rather than to bump the parent.
The fix must clear the audit without breaking the RAG embedding path or any
existing test.

## User Stories

- As a **maintainer**, I want `npm audit --audit-level=high` to report zero
  HIGH/CRITICAL findings, so that the build gate passes without a waiver.
- As an **operator of HTTP/SQLite (RAG) mode**, I want embeddings to keep working
  after the dependency pin, so that PRD indexing is unaffected.

## Acceptance Criteria

- **AC1 (audit clean)**
  - Given the dependency override is applied and `npm install` has run,
  - When `npm audit --audit-level=high` runs,
  - Then it reports **0 HIGH and 0 CRITICAL** advisories (moderate may remain only
    if no compatible fix exists — must be explicitly noted).
- **AC2 (RAG embedding intact)**
  - Given the pinned `protobufjs`,
  - When the RAG embedding path is exercised (`@xenova/transformers` loads and
    produces an embedding, real or via the project's existing RAG test fixtures),
  - Then it succeeds with no runtime error, and `tools/rag.ts` needs **no API
    change** (chunking + embedding interface unchanged).
- **AC3 (no regression)**
  - Given the override,
  - When `npm run build` and `npm test` run,
  - Then build is clean (zero TS errors) and the full suite passes.
- **AC4 (pin is minimal + documented)**
  - Given the `overrides` entry,
  - When a reviewer reads `package.json`,
  - Then the override pins `protobufjs` to the **lowest version that clears all
    listed advisories** (≥ first patched release), with a one-line comment/PR note
    explaining why (transitive via optional embedding dep).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature introduces no user-facing strings |

## Visual Tokens

| token id | property | value | source |
|---|---|---|---|
| N/A | — | non-UI dependency fix |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Migrating off `@xenova/transformers` to the successor `@huggingface/transformers`
  (larger API change — deferred; only pin the transitive vuln now).
- `npm audit fix --force` (downgrades `@xenova/transformers` to 2.0.1 — loses
  functionality; explicitly rejected).
- Any change to RAG behavior, embedding model, or `tools/rag.ts` logic.

## Dependencies / Prerequisites

- **Empirical compatibility risk**: an `overrides` pin of `protobufjs` must be
  verified against `onnxruntime-web`'s expectations at runtime — sr-engineer
  confirms by install + RAG-path exercise + `npm test`. If the patched
  `protobufjs` is incompatible with `onnxruntime-web`, sr-engineer escalates
  (status=Blocked) rather than forcing a broken pin; fallback decision (accept
  moderate-only, or migrate parent) returns to PM.
- No external references requiring fetch/index (GHSA advisory URLs are
  informational → `ignore`).
- Lockfile (`package-lock.json`) will change; commit it with the override.

# Code Review — T330 (dependency-security-protobufjs)

## Round 1 — APPROVED — by code-reviewer

## Summary

- `package.json` adds an `overrides` block: `protobufjs: ^7.5.8` (resolved 7.6.2) and `qs: ^6.15.2`.
- `package-lock.json` reflects `protobufjs` 6.11.6 → 7.6.2 (+ `@protobufjs/*` helper bumps) and the lockfile self-version sync (3.15.0 → 3.16.2, a benign npm-install side-effect).
- Independently re-ran `npm audit --audit-level=high` → **0 vulnerabilities** (was 1 critical / 3 high / 1 moderate).
- Headline verdict: **APPROVED**. The fix matches the spec; the one residual risk (forcing protobufjs past onnx-proto's declared range) is an AC2 runtime concern for qa to confirm.
- Same-model-bias caveat: reviewer ran on the same model as the writer — flagging per role guidance.

## Correctness

- Both override entries are valid semver ranges targeting the first patched releases (`protobufjs` ≥7.5.8 clears GHSA-xq3m-2v4x-88gg et al.; `qs` ≥6.15.2 clears GHSA-q8mj-m7cp-5q26). No logic to break.
- **Compatibility risk (load-bearing, AC2)**: `protobufjs ^7.5.8` is forced over `onnx-proto@4.0.4`'s declared `protobufjs ^6.8.8` — a major-version jump on a transitive dep. `overrides` will satisfy install regardless; the real question is whether `onnx-proto`'s generated code runs under protobufjs 7. This MUST be confirmed by exercising the embedding path at runtime (not just install) — assigned to qa per AC2. Audit-clean alone does not prove AC2.

## Quality

- `overrides` is the idiomatic, minimal npm mechanism for transitive pins — correct tool, surgical change. No unrelated dependency churn.
- JSON can't carry an inline rationale comment; AC4's "documented why" must land in the CHANGELOG / release notes (release-engineer scope). Non-blocking.

## Architecture

- No architecture spec for this fix (single-file dependency change). No layering / separation concern; `tools/rag.ts` is untouched (interface preserved).

## Security

- This is the security remediation itself; independently verified **0 vulnerabilities** post-change. No new attack surface — pins move dependencies forward, not backward. Rejects the `npm audit fix --force` downgrade path (correctly out of scope).

## Performance

- protobufjs 7 vs 6 introduces no hot-path regression in this codebase; the sole consumer is the RAG embedding path (HTTP/SQLite mode only), not a per-request loop. Negligible.

## Verdict

**APPROVED** — minimal, idiomatic transitive pin clearing all advisories; qa must runtime-verify AC2 (embedding works under the forced protobufjs 7 major bump), which the spec already mandates.

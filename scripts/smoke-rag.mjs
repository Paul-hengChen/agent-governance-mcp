#!/usr/bin/env node
// Smoke test for the RAG pipeline. Not a unit test (those are qa-engineer's job).
// Verifies: chunking + embedding + cosine retrieval actually work end-to-end
// with @xenova/transformers installed.

import { chunkMarkdown, embedText, cosineSim, buildPrdChunks } from "../dist/tools/rag.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SAMPLE_PRD = `# Login Feature PRD

## Overview
Users must authenticate via OAuth2 to access the dashboard.

## Authentication Flow
The system supports Google and GitHub providers. Users click "Sign in with X"
and are redirected to the provider's consent screen.

## Session Management
Sessions expire after 24 hours of inactivity. JWT tokens are stored in HTTP-only cookies.

## Error Handling
Failed login attempts are logged and rate-limited to 5 per minute per IP.
`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-rag-"));
const prdPath = path.join(tmpDir, "PRD.md");
fs.writeFileSync(prdPath, SAMPLE_PRD);

console.log("=== chunkMarkdown ===");
const chunks = chunkMarkdown(SAMPLE_PRD);
console.log(`Chunks: ${chunks.length}`);
for (const c of chunks) console.log(`  - [${c.section}] ${c.text.slice(0, 60)}...`);
if (chunks.length < 4) throw new Error("expected ≥4 chunks");

console.log("\n=== embedText (loading model, ~30s first run) ===");
const t0 = Date.now();
const v1 = await embedText("How does authentication work?");
const t1 = Date.now();
if (!v1) throw new Error("embedText returned null — is @xenova/transformers installed?");
console.log(`Embedding dim: ${v1.length}, cold-start: ${t1 - t0}ms`);
if (v1.length !== 384) throw new Error(`expected 384-dim, got ${v1.length}`);

console.log("\n=== embedText (warm) ===");
const t2 = Date.now();
const v2 = await embedText("Session expiry rules");
const t3 = Date.now();
console.log(`Warm query: ${t3 - t2}ms`);

console.log("\n=== cosineSim ===");
const self = cosineSim(v1, v1);
const cross = cosineSim(v1, v2);
console.log(`cos(v1,v1)=${self.toFixed(4)}, cos(v1,v2)=${cross.toFixed(4)}`);
if (Math.abs(self - 1.0) > 0.001) throw new Error(`self-similarity should be 1, got ${self}`);

console.log("\n=== buildPrdChunks (end-to-end) ===");
const result = await buildPrdChunks(prdPath);
if ("error" in result) throw new Error(`buildPrdChunks failed: ${result.error}`);
console.log(`Built ${result.length} chunks, each with ${result[0].embedding.length}-dim embedding`);

console.log("\n=== Retrieval quality check ===");
const query = "How long do sessions last?";
const qVec = await embedText(query);
const ranked = result
  .map(c => ({ section: c.section, score: cosineSim(qVec, c.embedding) }))
  .sort((a, b) => b.score - a.score);
console.log(`Query: "${query}"`);
for (const r of ranked) console.log(`  ${r.score.toFixed(4)}  ${r.section}`);
if (ranked[0].section !== "Session Management") {
  console.warn(`⚠️  Top result was "${ranked[0].section}", expected "Session Management"`);
} else {
  console.log("✅ Top hit is correct section");
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log("\n✅ All smoke checks passed.");

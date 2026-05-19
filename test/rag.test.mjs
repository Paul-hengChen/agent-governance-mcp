// Coded by @qa-engineer
// Tests for the RAG pipeline (tools/rag.ts, tools/storage-sqlite.ts RAG methods,
// prompts/build.ts appendSpecContext, index.ts IndexPrdArgs refinements).
// Run via `node --test`. Imports compiled output from dist/.
//
// Embedding model loading (the real @xenova/transformers path) is intentionally
// NOT exercised here — that's covered by scripts/smoke-rag.mjs end-to-end so CI
// doesn't pay 4s of cold-start latency on every run.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  chunkMarkdown,
  cosineSim,
  buildPrdChunks,
} from "../dist/tools/rag.js";
import { appendSpecContext } from "../dist/prompts/build.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";

// ============================================================================
// chunkMarkdown
// ============================================================================

test("chunkMarkdown: returns single 'document' chunk for text without headings", () => {
  const chunks = chunkMarkdown("just some plain text without any headings");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].section, "document");
});

test("chunkMarkdown: extracts section title from heading line and preserves content", () => {
  const md = "# Title\n\nbody\n\n## Subsection\n\nmore body";
  const chunks = chunkMarkdown(md);
  assert.ok(chunks.find((c) => c.section === "Title"), "Title section missing");
  assert.ok(chunks.find((c) => c.section === "Subsection"), "Subsection missing");
});

test("chunkMarkdown: emits preamble chunk for content before first heading", () => {
  const md = "preface paragraph\n\n# First heading\nbody";
  const chunks = chunkMarkdown(md);
  assert.equal(chunks[0].section, "preamble");
  assert.match(chunks[0].text, /preface/);
});

test("chunkMarkdown: splits oversized sections with overlap and preserves heading prefix", () => {
  // Build a section >2048 chars
  const big =
    "## Big\n\n" +
    Array.from({ length: 30 }).map((_, i) => `paragraph ${i} ${"x".repeat(80)}`).join("\n\n");
  const chunks = chunkMarkdown(big);
  const bigChunks = chunks.filter((c) => c.section === "Big");
  assert.ok(bigChunks.length > 1, `expected oversized section to split, got ${bigChunks.length}`);
  for (const c of bigChunks) {
    assert.match(c.text, /Big/, "split chunk should keep heading prefix for retrieval");
  }
});

test("chunkMarkdown: does not treat H4+ as section dividers", () => {
  const md = "# H1\n\n#### H4 line\n\nstill h1 body";
  const chunks = chunkMarkdown(md);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].section, "H1");
  assert.match(chunks[0].text, /H4 line/, "H4 must remain inside H1's content");
});

// ============================================================================
// cosineSim
// ============================================================================

test("cosineSim: identical vectors → 1.0", () => {
  const v = [0.3, -0.5, 0.8, 0.1];
  assert.ok(Math.abs(cosineSim(v, v) - 1.0) < 1e-10);
});

test("cosineSim: orthogonal vectors → 0.0", () => {
  assert.equal(cosineSim([1, 0], [0, 1]), 0);
});

test("cosineSim: anti-parallel vectors → -1.0", () => {
  assert.ok(Math.abs(cosineSim([1, 2], [-1, -2]) + 1.0) < 1e-10);
});

test("cosineSim: zero vector returns 0 (no NaN from div-by-zero)", () => {
  assert.equal(cosineSim([0, 0, 0], [1, 2, 3]), 0);
});

// ============================================================================
// buildPrdChunks error path
// ============================================================================

test("buildPrdChunks: returns { error } when PRD file does not exist", async () => {
  const result = await buildPrdChunks("/nonexistent/path/to/prd.md");
  assert.ok("error" in result, "expected error object");
  assert.match(result.error, /not found/i);
});

// ============================================================================
// Path-traversal guard (mirrors index.ts:IndexPrdArgs .refine logic)
// Follow-up: extract to tools/path-guard.ts so this test can import it.
// ============================================================================

function isInsideWorkspace(ws, p) {
  if (!path.isAbsolute(p)) return false;
  const rel = path.relative(ws, p);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

test("path guard: rejects absolute path outside workspace (/etc/passwd)", () => {
  assert.equal(isInsideWorkspace("/Users/me/proj", "/etc/passwd"), false);
});

test("path guard: rejects empty relative (workspace root itself)", () => {
  assert.equal(isInsideWorkspace("/Users/me/proj", "/Users/me/proj"), false);
});

test("path guard: rejects traversal segments after resolution", () => {
  const p = path.resolve("/Users/me/proj/../../../etc/passwd");
  assert.equal(isInsideWorkspace("/Users/me/proj", p), false);
});

test("path guard: accepts file inside workspace", () => {
  assert.equal(isInsideWorkspace("/Users/me/proj", "/Users/me/proj/docs/PRD.md"), true);
});

// ============================================================================
// Embedding-model allowlist regex (mirrors index.ts:EMBEDDING_MODEL_RE)
// ============================================================================

const MODEL_RE = /^[A-Za-z0-9._\-]+\/[A-Za-z0-9._\-]+$/;

test("model regex: accepts standard HuggingFace identifiers", () => {
  assert.ok(MODEL_RE.test("Xenova/all-MiniLM-L6-v2"));
  assert.ok(MODEL_RE.test("sentence-transformers/all-MPNet-base-v2"));
});

test("model regex: rejects path-traversal segments", () => {
  assert.equal(MODEL_RE.test("../etc/passwd"), false);
  assert.equal(MODEL_RE.test("ns/model/../../etc"), false);
});

test("model regex: rejects whitespace and shell metacharacters", () => {
  assert.equal(MODEL_RE.test("ns/model with space"), false);
  assert.equal(MODEL_RE.test("ns;rm -rf/"), false);
});

test("model regex: rejects missing namespace separator", () => {
  assert.equal(MODEL_RE.test("noNamespace"), false);
});

// ============================================================================
// appendSpecContext (mocked storage)
// ============================================================================

function makeMockStorage(impl) {
  const base = new FileHandoffStorage();
  return Object.assign(base, impl);
}

function makeResult(text) {
  return { description: "x", messages: [{ role: "user", content: { type: "text", text } }] };
}

const FAKE_STATE = {
  active_feature: "feature-x",
  pending_notes: ["next_role: qa-engineer"],
  completed_tasks: [],
  status: "In_Progress",
  last_updated: "2026-05-19T00:00:00.000Z",
  qa_round: 0,
};

test("appendSpecContext: returns unchanged when storage lacks queryPrdSpec (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const r = makeResult("PROMPT");
  const out = await appendSpecContext(r, "/tmp/nonexistent-ws");
  assert.equal(out.messages[0].content.text, "PROMPT");
});

test("appendSpecContext: skips for teamwork (coordinator) role without consulting storage", async () => {
  let queried = false;
  setActiveStorage(
    makeMockStorage({
      queryPrdSpec: async () => {
        queried = true;
        return "SPEC";
      },
      parse: () => FAKE_STATE,
      listTasks: () => null,
    }),
  );
  const out = await appendSpecContext(makeResult("PROMPT"), "/tmp/ws", "teamwork");
  assert.equal(out.messages[0].content.text, "PROMPT");
  assert.equal(queried, false, "queryPrdSpec must not be invoked for coordinator");
});

test("appendSpecContext: injects spec block on successful query", async () => {
  setActiveStorage(
    makeMockStorage({
      queryPrdSpec: async () => "### Section A\nBody A",
      parse: () => FAKE_STATE,
      listTasks: () => null,
    }),
  );
  const out = await appendSpecContext(makeResult("PROMPT"), "/tmp/ws", "sr-engineer");
  assert.match(out.messages[0].content.text, /PROMPT/);
  assert.match(out.messages[0].content.text, /Spec Context/);
  assert.match(out.messages[0].content.text, /Section A/);
});

test("appendSpecContext: degrades silently when queryPrdSpec throws", async () => {
  setActiveStorage(
    makeMockStorage({
      queryPrdSpec: async () => {
        throw new Error("boom");
      },
      parse: () => FAKE_STATE,
      listTasks: () => null,
    }),
  );
  const out = await appendSpecContext(makeResult("PROMPT"), "/tmp/ws", "sr-engineer");
  assert.equal(out.messages[0].content.text, "PROMPT", "prompt must not crash on embedder error");
});

test("appendSpecContext: returns unchanged when state is null (fresh workspace)", async () => {
  setActiveStorage(
    makeMockStorage({
      queryPrdSpec: async () => "SPEC",
      parse: () => null,
      listTasks: () => null,
    }),
  );
  const out = await appendSpecContext(makeResult("PROMPT"), "/tmp/ws", "sr-engineer");
  assert.equal(out.messages[0].content.text, "PROMPT");
});

test("appendSpecContext: query construction uses active_feature + next task desc, NOT pending_notes", async () => {
  let receivedQuery = "";
  setActiveStorage(
    makeMockStorage({
      queryPrdSpec: async (_ws, q) => {
        receivedQuery = q;
        return "SPEC";
      },
      parse: () => FAKE_STATE,
      listTasks: () => [
        { id: "T01", description: "implement OAuth flow", section: "Active", completed: false },
      ],
    }),
  );
  await appendSpecContext(makeResult("PROMPT"), "/tmp/ws", "sr-engineer");
  assert.match(receivedQuery, /feature-x/, "query should include active_feature");
  assert.match(receivedQuery, /OAuth/, "query should include next-task description");
  assert.doesNotMatch(
    receivedQuery,
    /qa-engineer/,
    "query must NOT include pending_notes routing metadata",
  );
});

// ============================================================================
// SqliteHandoffStorage RAG methods
// ============================================================================

function makeChunk(id, section, embedding, mtime = 1, model = "Xenova/all-MiniLM-L6-v2") {
  return {
    chunk_id: id,
    section,
    text: `body of ${id}`,
    embedding,
    prd_path: "/x/PRD.md",
    prd_mtime: mtime,
    chunker_version: "1.0",
    embedding_model: model,
  };
}

function withTempDb(name, fn) {
  return async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `twrag-${name}-`));
    const { SqliteHandoffStorage } = await import("../dist/tools/storage-sqlite.js");
    const s = new SqliteHandoffStorage(path.join(tmp, "tw.db"));
    try {
      await fn(s);
    } finally {
      s.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  };
}

test(
  "SqliteHandoffStorage RAG: upsertPrdChunks → listPrdChunks round-trip preserves all fields",
  withTempDb("rt", (s) => {
    const ws = "/tmp/some-workspace";
    const chunks = [
      makeChunk("c000", "Sec", [0.1, 0.2, 0.3]),
      makeChunk("c001", "Sec2", [0.4, 0.5, 0.6]),
    ];
    s.upsertPrdChunks(ws, chunks);
    const out = s.listPrdChunks(ws);
    assert.equal(out.length, 2);
    const c0 = out.find((c) => c.chunk_id === "c000");
    assert.deepStrictEqual(c0.embedding, [0.1, 0.2, 0.3], "embedding round-trip");
    assert.equal(c0.embedding_model, "Xenova/all-MiniLM-L6-v2");
    assert.equal(c0.chunker_version, "1.0");
    assert.equal(c0.prd_mtime, 1);
  }),
);

test(
  "SqliteHandoffStorage RAG: upsertPrdChunks deletes prior rows before insert (idempotent reindex)",
  withTempDb("idem", (s) => {
    const ws = "/tmp/ws-idempotent";
    const first = Array.from({ length: 5 }).map((_, i) =>
      makeChunk(`c00${i}`, `S${i}`, [i]),
    );
    s.upsertPrdChunks(ws, first);
    s.upsertPrdChunks(ws, [makeChunk("c000", "fresh", [99], 2)]);
    const out = s.listPrdChunks(ws);
    assert.equal(out.length, 1, "prior chunks must be wiped before second upsert");
    assert.equal(out[0].section, "fresh");
  }),
);

test(
  "SqliteHandoffStorage RAG: getPrdIndexMeta returns null when no chunks",
  withTempDb("meta-empty", (s) => {
    assert.equal(s.getPrdIndexMeta("/tmp/nope"), null);
  }),
);

test(
  "SqliteHandoffStorage RAG: getPrdIndexMeta returns full invalidation tuple after upsert",
  withTempDb("meta-full", (s) => {
    const ws = "/tmp/ws-meta";
    s.upsertPrdChunks(ws, [makeChunk("c000", "S", [1], 42, "mymodel")]);
    const meta = s.getPrdIndexMeta(ws);
    assert.deepStrictEqual(meta, {
      prd_mtime: 42,
      chunker_version: "1.0",
      embedding_model: "mymodel",
    });
  }),
);

test(
  "SqliteHandoffStorage RAG: queryPrdSpec returns empty string when no chunks (graceful no-op)",
  withTempDb("query-empty", async (s) => {
    const result = await s.queryPrdSpec("/tmp/nope", "query");
    assert.equal(result, "");
  }),
);

// Restore default storage so any subsequent test files in the same process see
// FileHandoffStorage (defensive — node --test isolates per file, but cheap).
after(() => {
  setActiveStorage(new FileHandoffStorage());
});

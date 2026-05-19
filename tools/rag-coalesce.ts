// Coded by @sr-engineer
// Process-wide coalesce registry for in-flight PRD indexing.
//
// Two call sites share this registry:
//   1. index.ts `tw_index_prd` (explicit, user-triggered indexing)
//   2. prompts/build.ts `appendSpecContext` (lazy auto-reindex on stale key)
//
// Without a shared registry, a concurrent role-prompt fetch + explicit
// tw_index_prd for the same (workspace, prd_path) would run the slow embedding
// pipeline twice and race on DELETE+INSERT inside `upsertPrdChunks`.
//
// Keyed by `${workspace_path}::${prd_path}`. Promises live for the duration
// of an active index call (cleared in `finally` at the call site). Bounded by
// concurrent client count, so no eviction needed.

const inflight = new Map<string, Promise<string>>();

export function getInflightKey(workspacePath: string, prdPath: string): string {
  return `${workspacePath}::${prdPath}`;
}

export function getInflight(key: string): Promise<string> | undefined {
  return inflight.get(key);
}

export function setInflight(key: string, p: Promise<string>): void {
  inflight.set(key, p);
}

export function deleteInflight(key: string): void {
  inflight.delete(key);
}

// Resolve when all in-flight indexings for a given workspace have settled
// (regardless of outcome). Used by the PASS cleanup hook so that a DELETE
// after PASS cannot race with an INSERT from a concurrent lazy reindex.
export async function awaitAllInflightFor(workspacePath: string): Promise<void> {
  const prefix = `${workspacePath}::`;
  const promises: Array<Promise<unknown>> = [];
  for (const [k, p] of inflight) {
    if (k.startsWith(prefix)) promises.push(p.catch(() => undefined));
  }
  if (promises.length > 0) await Promise.all(promises);
}

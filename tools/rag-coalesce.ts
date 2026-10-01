// Coded by @sr-engineer
// Process-wide coalesce registry for in-flight PRD indexing, shared by
// index.ts `tw_index_prd` and prompts/build.ts `appendSpecContext` so a
// concurrent explicit and lazy index of one (workspace, prd_path) does not
// run the embedding pipeline twice and race in `upsertPrdChunks`. Keyed
// `${workspace_path}::${prd_path}`; entries are cleared in the call site's
// `finally`, so the map is bounded by concurrent clients.

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

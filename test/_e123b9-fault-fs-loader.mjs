// Coded by @qa-engineer
// Module-customization resolve hook (Node's stable module.register() API,
// invoked here via `node --import 'data:...register(...)'`) for T-E123B9-08
// (AC21(b) / J2-NEW-12)'s real-process-death crash test.
//
// Redirects ONLY the bare "fs" specifier — the exact form every module under
// dist/ imports it as (`import * as fs from "fs"`, tsc's NodeNext/ES2022
// output, unchanged from the .ts source) — to
// _e123b9-fault-fs-shim.mjs. "node:fs" is deliberately left un-intercepted
// (nextResolve handles it), which is also how the shim itself reaches the
// real implementation without infinitely re-resolving to itself.
//
// This is real, standard Node fault-injection plumbing (the loader/hooks
// API), not a mock of the production code: every module under dist/ still
// runs unmodified; only the specific fs entry points the shim overrides
// (renameSync) get a thin counting wrapper around the real syscall.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "fs") {
    return {
      url: new URL("./_e123b9-fault-fs-shim.mjs", import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}

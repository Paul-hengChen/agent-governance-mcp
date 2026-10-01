// Coded by @qa-engineer
// Module resolve hook (Node module.register API) for the real-crash migration test.
// Redirects only the bare "fs" specifier (how dist/ imports it) to the fault shim;
// "node:fs" is left alone so the shim can reach the real fs without looping.
// More: specs/e260e-comment-rationale.md (_e123b9-fault-fs-loader.mjs).
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "fs") {
    return {
      url: new URL("./_e123b9-fault-fs-shim.mjs", import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}

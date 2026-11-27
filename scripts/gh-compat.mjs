// The release scripts' contract with the `gh` CLI: the minimum version, the
// pull-request lookup retry budget, and pure checks over `gh` output. Every
// child call stays in release.mjs's runner; this module only reads results.

// `gh run list --commit`, which the strict CI gate runs, first shipped in 2.40.0.
export const MIN_GH_VERSION = "2.40.0";
// A failed `gh pr view` is tried this many times in all, the first included.
export const GH_LOOKUP_ATTEMPTS = 3;
// Default wait between lookup attempts; AGC_RELEASE_GH_RETRY_SECONDS overrides it.
export const GH_LOOKUP_RETRY_SECONDS = 10;

const VERSION_LINE = /^gh version (\d+)\.(\d+)\.(\d+)/m;
const lastLine = (text) => String(text ?? "").trim().split("\n").filter(Boolean).pop() ?? "";

// The first `gh version X.Y.Z` on the output as "X.Y.Z", or null when none.
export function parseGhVersion(stdout) {
  const m = VERSION_LINE.exec(String(stdout ?? ""));
  return m ? `${Number(m[1])}.${Number(m[2])}.${Number(m[3])}` : null;
}

// Negative, zero or positive as version `a` is older than, equal to or newer than `b`.
export function compareVersions(a, b) {
  const [x, y] = [a, b].map((v) => String(v).split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// Why a `gh --version` result cannot start a release, or null when it can.
// `res` is the runner's { status, stdout, stderr }.
export function ghVersionProblem(res, required = MIN_GH_VERSION) {
  if (res.status !== 0) return `gh --version exited ${res.status} — ${lastLine(res.stderr) || "gh unavailable"}`;
  const installed = parseGhVersion(res.stdout);
  if (installed === null) {
    const first = String(res.stdout ?? "").split("\n")[0].replace(/\r$/, "");
    return `gh --version printed no version (first line: ${JSON.stringify(first)}) — need gh ${required} or newer`;
  }
  if (compareVersions(installed, required) < 0) {
    return `gh ${installed} is older than ${required}, the minimum the release scripts need (gh run list --commit) — upgrade gh; see docs/release-cd.md, Manual fallback`;
  }
  return null;
}

// True when a failed `gh pr view` reported that no pull request exists, as
// opposed to failing to answer: gh's own message opens its stderr.
export function isPrNotFound(stderr) {
  const first = String(stderr ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return first.startsWith("no pull requests found");
}

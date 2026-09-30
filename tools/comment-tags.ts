// Coded by @sr-engineer
// Doc-tag exclusion rules (spec D6) for every non-JS language; block length only.
// Design: specs/e259-comment-scan-languages-architecture.md (Doc-tag rules).

import type { TagRule } from "./comment-types.js";

const excluded = new Set(["param", "returns", "return", "throws", "exception", "example"]);
const swiftExcluded = new Set(["parameter", "parameters", "returns", "throws"]);
const swiftCallouts = new Set([
  "attention", "author", "authors", "bug", "complexity", "copyright", "date", "experiment",
  "important", "invariant", "localizationkey", "mutatingvariant", "nonmutatingvariant", "note",
  "postcondition", "precondition", "remark", "remarks", "requires", "seealso", "since", "tag",
  "todo", "version", "warning",
]);

function tagIn(re: RegExp, body: string): boolean | null {
  const m = re.exec(body);
  return m ? excluded.has(m[1]) : null;
}

export const noTags: TagRule = () => null;

export const atTags: TagRule = (l) => tagIn(/^@([A-Za-z]+)/, l.body);

export const cTags: TagRule = (l) => tagIn(/^[@\\]([A-Za-z]+)/, l.body);

export const csharpTags: TagRule = (l) => {
  const at = atTags(l);
  if (at !== null) return at;
  if (/^<(?:param|typeparam|returns|exception|example)\b/.test(l.body)) return true;
  return /^<[A-Za-z]/.test(l.body) ? false : null;
};

export const swiftTags: TagRule = (l) => {
  const m = /^[-*+]\s+([A-Za-z]+)\b/.exec(l.body);
  const k = m ? m[1].toLowerCase() : "";
  if (swiftExcluded.has(k)) return true;
  return swiftCallouts.has(k) ? false : null;
};

export const pythonTags: TagRule = (l) => {
  if (l.docstring !== true) return false;
  const b = l.body;
  if (/^(?:Args|Arguments|Returns|Return|Raises|Yields|Example|Examples):\s*$/.test(b)) return true;
  if (/^:(?:param|type|returns|return|rtype|raises|raise|yields)\b/.test(b)) return true;
  return /^[A-Z][A-Za-z ]*:\s*$/.test(b) || /^:[a-z]+/.test(b) ? false : null;
};

# E233C-01 author notes (qa-engineer author context; not a verdict)

Scanned the 353 id-citing comment lines in the 60 owned test files. Almost all
already explain the behaviour in plain words and only carry an id, so they were
left unchanged. Seven comment lines in five files had the id or a jargon label
as the main explanation and were rewritten (id kept as trailing pointer):

- test/e116-archive-on-feature-change.test.mjs (E150 loss-prevention label)
- test/e120-void-recut-refusal.test.mjs (E120 end-state)
- test/e177b-lane-status.test.mjs (two: E182-class label, E175(d) shape)
- test/e177b-test-lock.test.mjs (E182-class label)
- test/e178b-fanout-unmatched.test.mjs (two: E208 exit-code and error-code notes)

Comment text only; AC1 comment-stripped comparison printed bad=0.

## Second pass

Widened the bar to: a reader without the backlog must understand the whole
comment; an id may only trail. All ~353 id-citing lines were reviewed file by
file (six parallel author sub-contexts, disjoint file groups). About 57 owned
files now differ from base; behaviour and assertions unchanged (comment-stripped
comparison identical). Left unchanged: comments that already explain in plain
words with the id only as a row label, banner label, or trailing pointer, and
test-case labels that are not backlog ids (e.g. E1-E6 in baseline-manifest-gate).
The AC4 heuristic lists only wrapped continuation fragments of multi-line
comments; each belongs to a block that reads plainly.

## Third pass

The residual scan was widened to a case-insensitive id shape (an e/E id with
optional letter, digit or hyphen segments, plus task ids and AC references),
including leading `<id>:` and feature-slug labels. Leading id labels and
slug-only labels (for example the init-artifacts-flag family in the adapters
test, the lane-layout and cut-approval re-baseline notes, and task-id file
headers) now lead with the behaviour and keep the id as a trailing pointer.
Left unchanged: paths that merely contain an id, fixture names, test-case
labels that are not backlog ids (E1-E6, P1-P9, t-a3-* style names), and
trailing pointers such as `(e123b9 J2, spec AC1/AC9)`.

Hygiene: no literal home-directory path prefix appears in any tracked text
touched by this lane. The check script lives in the temp directory and builds
its pattern at run time, so the prefix never appears verbatim in tracked files.

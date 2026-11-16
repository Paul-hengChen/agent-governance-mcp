## Subagent Reply Watermark Validation

WHEN relaying a just-completed `Task(subagent_type=…)` reply → DO check its last non-empty line, trimmed: it must be exactly `— @<name> (<tier>)` with a U+2014 em dash (a hyphen or en dash counts as absent), `<name>` the dispatched subagent and `<tier>` its `dispatch_pins` entry, else its `model` frontmatter, both matched case-insensitively.
On a miss, append that line if it is absent or replace a wrong one, so the relayed reply ends in exactly one watermark line; never re-dispatch or add a warning. Note that this is a **self-report** check, not a served-model verification: a mismatch means only that the reply did not claim the pinned tier, and a match never establishes which model actually served the turn — on a pin mismatch, also surface in your relay that the reply did not claim the pin.
ELSE skip: your own replies (`— @coordinator`, no tier) and replies after a `tw_*`, bash, file-read or other non-Task call are never checked.

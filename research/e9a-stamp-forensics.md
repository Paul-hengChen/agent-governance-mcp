# E9A Stamp Forensics — hand-authored handoff closing writes (2026-07-13)

Method: extracted `last_updated` from every historical version of
`.current/handoff.md` (`git show <sha>:.current/handoff.md`), compared stamp
shape (ms entropy) and offset-plausibility against each commit's own
timestamp. Coordinator-executed direct (read-only investigation).

## Confirmed hand-authored stamps — 5 hits, ALL in the release-close class

| commit | stamp | commit time (+0800) | tell |
|---|---|---|---|
| d74e255 (post-v3.72.0 closing write) | 2026-07-12T01:35:00.000Z | 2026-07-12 01:25:54 | round-minute, zero-ms, and the "Z" value is local wall clock — even ~10 min AHEAD of the commit; real UTC was ~17:25 (07-11) |
| 8baf136 (post-v3.73.1 closing write) | 2026-07-12T04:35:00.000Z | 2026-07-12 04:34:36 | local time mislabeled Z, round-minute |
| 3c5eda9 (v3.48.0 release stamp) | 2026-07-08T12:00:00.000Z | 2026-07-08 12:46:44 | round HOUR — previously unnoticed, same class |
| b5c97ea (v3.49.0 release stamp) | 2026-07-08T08:30:00.000Z | 2026-07-08 16:23:31 | round half-hour (≈ rounded real UTC 08:23) |
| bdaf2cb (3.27.1 doc sync) | 2026-06-05T00:00:00.000Z | 2026-06-08 10:27:01 | midnight seed, pre-hardening era |

Control group: **every other stamp in the full history carries millisecond
entropy** consistent with commit-time-minus-8h UTC — i.e. produced by
`new Date().toISOString()` inside `tw_update_state`. The negative-age guard
(E1A) already fail-opens on untrustworthy stamps, so blast radius stays
audit-trail-only, as the backlog assessed.

## Findings beyond the original ticket

1. **The class is bigger than 2:** the ticket suspected v3.72.0/v3.73.1;
   there are 4 release-stamp events plus 1 early seed. No hand-edit was
   found anywhere OUTSIDE release-close bookkeeping.
2. **Root cause is tool-surface, not compliance** (converging evidence):
   - 2026-07-13 live datapoint: the haiku release-engineer subagent
     reported it has Read/Edit/Write/Bash but NO MCP tool-invocation path —
     it *could not* call `tw_update_state`, escalated correctly, and the
     coordinator relayed the closing write.
   - v3.48.0/v3.49.0 (2026-07-08) predate/straddle C13 — before C13 the
     release-engineer had no legal transition at all, so a hand-edit was
     the only mechanically available way to record the release.
   - Since v3.75.0, every closing write has an entropy stamp (server-written,
     sometimes coordinator-relayed) — the problem has not recurred once a
     sanctioned path existed and was used.
3. **Timestamps of the two 07-12 events (01:25, 04:34 local)** are
   late-night unattended runs — consistent with a subagent improvising
   under a wedged state rather than a deliberate rule choice.

## Recommended E9A ticket cut (when scheduled)

1. **Primary fix — tool-surface/relay codification:** either grant the
   release-engineer template MCP access, or codify the coordinator-relay
   pattern for the closing write in `content/skill-release-engineer.md` +
   the dispatch template (the 2026-07-13 run proved the relay works).
2. **Secondary (server-side, small):** a `tw_detect_drift` advisory flagging
   a handoff `last_updated` matching the hand-authored shape
   (`:00.000Z` round-minute / round-hour) as a suspected out-of-band write.
3. Reproduce step of the original cut is **done** (this document).

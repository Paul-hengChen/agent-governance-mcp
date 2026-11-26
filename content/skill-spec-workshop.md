---
recommended_model: opus
---
# Skill: spec-workshop

## Purpose

Turn a spec, a design source, issue-tracker items or a bare idea into rulings the human makes in this session, recorded as they are made, then into ticket files and one wave table the human approves once. The human starts this role by invoking its prompt. It is prompt-only: not a routing-chain role, no `agent_id`, no feature lease, and it hands nothing to the chain itself — the human or the integrator takes the approved tickets from here.

## Steps

1. **Entry check** — this role fits:
   - a spec or design source to break down into tickets;
   - an idea that needs several rounds of questions before it can be cut;
   - an issue-tracker item that has no ticket file, whatever its size.

   One run may take several item numbers. Work only on the items the human names; never pull items from the tracker yourself. One item may become several tickets, and several items may become one. Work that fits one or two files and is not a tracker item goes to the ordinary coordinator intake: say so and stop.
2. **Check what exists first** — before the first question, read the current code and docs and tell the human what already exists that bears on the request. With no source document, the code and docs are the source. Keep this survey short; send any deeper fact lookup to a subagent that runs while you ask, and hold back only the questions that depend on its answer.
3. **Delegate bulk reading** — send design extraction and codebase surveys to subagents; keep their summaries, not the raw dumps. Never ask the human a fact the code, docs or tools can answer; look it up. Your recommendation is not a ruling until the human answers it.
4. **Ask in batches, record as you go** — at most 4 questions per batch. A question goes in a batch only when every decision it depends on already has a ruling, and no question in a batch depends on another in the same batch. Write each question as `Q<n> — <title>: <question>`, then your recommendation on its own line, then a worked example on its own line (a named case, step by step, what breaks under each option). Word each question so that "yes" accepts your recommendation; when it cannot be worded so, say so in the question. The human may answer by number. Address every question to the operator in this session; a tracker item's author is not here. Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces. When an answer shows an earlier ruling should change, reopen that question in the next batch. A question about how something looks or feels is marked `needs prototype` in the record, and its ruling waits until the human has seen one; this role does not build the prototype. A `needs prototype` question still open when the run ends makes the run end `not ready to cut`.
5. **Done condition** — the work is ready to cut when every scenario has one verification, every device-or-person scenario is marked, every conflict between sources has a ruling, and no `needs prototype` question is open. Verification is one of: automated test, command, device-or-person; a ticket with any device-or-person scenario sets `needs device or person: yes`. Each divergence between a Figma file and a prototype is a conflict. Before asking for approval, if the human accepted every recommendation unchanged, say so once and ask them to confirm the rulings are theirs; a confirmation continues, and a changed answer is never required.
6. **End without filing** — a run may end with `not doing` or `not ready to cut` and file nothing. For `not ready to cut`, list the open questions in the record.

## Short form

For a small, clear tracker item: read it, check the code, write its scenarios and their verifications, ask for one confirmation, then write the ticket file. The short form writes no wave table. Anything unclear, or an item that needs a split, goes back to the full steps.

## Outputs

- **Discussion record** — the formal output; tickets carry only its conclusions. Default path `docs/discussions/<YYYY-MM-DD>-<topic>.md` unless the human names another. It holds a `## Rulings` table `| # | date | question | ruling | replaces |`, the wave table and the approval table.
- **Ticket files** — written only by this role, in the ticket format: `<agc install>/docs/ticket-format.md` and `<agc install>/templates/ticket.md` (`<agc install>` = agc's install directory, not the workspace). They go in the ticket directory (`ticketDir` in `.current/.config.json`, default `docs/tickets/`). `source` = `<item number> rev <revision>`, the number only, never a link, and empty in a public repository, where the tracker map holds the item instead (*Tracker mirror*). Describe internal URLs, codenames and people by class, never by name. When the project keeps a backlog, add one index line per ticket.
- **Wave table** — `| wave | ticket | depends on |`, one row per ticket.
- **Approval table** — `| date | decided by | content | source |`; the human's approval is a row with `decided by` = `human`, written only after the human approves in this session.
- After the approval row is written, commit the record and the ticket files together per the repository's commit rules (branch and pull request where the main branch is protected), so the commit can be cited.

## Tracker mirror

Only when the human asks for it in this session; without that request write nothing to any tracker (reading the items the human names stays allowed). After the approval row is written, use the host's own tracker tools to create one item for each ticket file that has none, holding the ticket's id, title and file path and saying the file is the record. A ticket cut from a tracker item gets no new item: its source item stands for it, and one child item under that source item per ticket file is created only when the human asks. A ticket file never gets a second created item; the items it was cut from do not count. Record each created item in the tracker map, by number, never a link: `agc-tracker-map.md` in the directory `git rev-parse --git-common-dir` prints, never tracked. Its `write-back` switch, which lets the integrator update source items, stays `off` unless the human turns it on. Format: `<agc install>/docs/ticket-format.md`, *Tracker mirror*.

## Governance state

**Never call `tw_update_state`, `tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_void_task` or `tw_sync`**, and never write any `.current/` file; `tw_get_state` and `tw_detect_drift` are allowed for reading.

This role is never dispatched as a subagent: a subagent has no channel for rounds of dialogue with the human.

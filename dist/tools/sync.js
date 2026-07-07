// Coded by @sr-engineer
// Tool: tw_sync — reconcile tasks.md checkboxes to the server-authoritative
// handoff.completed_tasks (handoff → tasks direction ONLY). v3.26.0 (R10).
//
// Background/parallel subagents + inline-coordinator execution can leave
// tasks.md `[x]` checkboxes out of sync with the handoff ledger (CDE-OOBE:
// handoff recorded T18–T35 completed while tasks.md T01–T26 stayed unflipped).
// The state-machine assumes sequential single-context handoffs; this op is the
// sanctioned reconcile for the drift those execution modes produce.
//
// SAFETY (load-bearing): tw_sync mirrors the AUTHORITATIVE ledger onto tasks.md.
// It NEVER writes handoff, and it NEVER promotes a tasks.md-only `[x]` into the
// handoff completed_tasks — doing so would bypass the qa-only PASS gate. Tasks
// that are `[x]` in tasks.md but absent from handoff (vibe-coding drift) are
// REPORTED, never reconciled. Because every id it flips is already in
// handoff.completed_tasks (which only a qa-authorized PASS path could populate),
// tw_sync needs no agent_id gate — it cannot create a completion that wasn't
// already recorded.
import { getActiveStorage } from "./storage.js";
import { enforcePreFlight } from "../guards/session.js";
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export async function reconcileTasks(workspacePath) {
    const storage = getActiveStorage();
    const handoff = storage.parse(workspacePath);
    const tasks = storage.listTasks(workspacePath);
    if (!handoff) {
        return JSON.stringify({
            ok: false,
            synced: [],
            refusedVibeDrift: [],
            message: "No handoff state — nothing authoritative to reconcile against.",
        });
    }
    if (!tasks || tasks.length === 0) {
        return JSON.stringify({
            ok: true,
            synced: [],
            refusedVibeDrift: [],
            message: "No task list — nothing to reconcile.",
        });
    }
    const vocab = tasks.map((t) => t.id);
    const completedInTasks = new Set(tasks.filter((t) => t.completed).map((t) => t.id));
    const incompleteIds = tasks.filter((t) => !t.completed).map((t) => t.id);
    // Resolve which task ids the handoff considers completed (handoff strings may
    // wrap the id in prose, so match on word boundary — mirrors drift.ts).
    const handoffCompleted = new Set();
    for (const id of vocab) {
        const re = new RegExp(`\\b${escapeRegExp(id)}\\b`);
        if (handoff.completed_tasks.some((c) => re.test(c)))
            handoffCompleted.add(id);
    }
    // Direction 1 (SAFE): handoff says complete, tasks.md still incomplete → flip
    // the tasks.md checkbox to match the authoritative ledger.
    const toSync = incompleteIds.filter((id) => handoffCompleted.has(id));
    const synced = [];
    for (const id of toSync) {
        try {
            await storage.completeTask(workspacePath, id, "tw_sync: mirrored from handoff.completed_tasks (R10)");
            synced.push(id);
        }
        catch {
            // best-effort; a failed flip is reported by omission (stays in drift)
        }
    }
    // Direction 2 (REFUSED): tasks.md `[x]` but NOT in handoff → vibe-coding drift.
    // Never promote to handoff (would bypass the qa-only PASS gate). Report only.
    const refusedVibeDrift = [...completedInTasks].filter((id) => !handoffCompleted.has(id));
    const base = synced.length
        ? `Reconciled ${synced.length} task(s) to the handoff ledger: ${synced.join(", ")}.`
        : "Nothing to reconcile (tasks.md already matches handoff.completed_tasks).";
    const message = refusedVibeDrift.length
        ? `${base} REFUSED to promote ${refusedVibeDrift.length} tasks.md-only completion(s) (vibe drift) — ` +
            `route to qa-engineer for evidence-backed PASS or tw_rollback_task: ${refusedVibeDrift.join(", ")}.`
        : base;
    return JSON.stringify({ ok: true, synced, refusedVibeDrift, message });
}
// ==========================================
// MCP tool handler (registry-pattern) — verbatim relocation of the
// index.ts `tw_sync` dispatcher case.
// ==========================================
// tw_sync (R10) — mirrors the authoritative ledger onto tasks.md. Mutating
// (writes tasks.md) so it honours the pre-flight read; needs no agent_id
// gate because it can only mirror completions already in handoff (qa-blessed),
// never invent one. See the safety note above.
export async function handleSync(args) {
    const { workspace_path } = args;
    enforcePreFlight(workspace_path, "tw_sync");
    const result = await reconcileTasks(workspace_path);
    return { content: [{ type: "text", text: result }] };
}
//# sourceMappingURL=sync.js.map
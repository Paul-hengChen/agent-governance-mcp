import { parseHandoff, readHandoffState, writeHandoffState } from "./handoff.js";
export class FileHandoffStorage {
    readState(workspacePath) {
        return readHandoffState(workspacePath);
    }
    writeState(workspacePath, activeFeature, status, completedTasks, pendingNotes, blockingReason, lastAgent) {
        return writeHandoffState(workspacePath, activeFeature, status, completedTasks, pendingNotes, blockingReason, lastAgent);
    }
    parse(workspacePath) {
        return parseHandoff(workspacePath);
    }
}
let active = new FileHandoffStorage();
export function getActiveStorage() {
    return active;
}
export function setActiveStorage(storage) {
    active = storage;
}
//# sourceMappingURL=storage.js.map
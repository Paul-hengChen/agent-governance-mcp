// Coded by @sr-engineer
// Storage abstraction for handoff state AND task list operations.
// FileHandoffStorage is the stdio default (markdown + filesystem).
// SqliteHandoffStorage (HTTP mode) implements the same interface against a DB
// so remote / containerized deployments need no mounted workspace files.
import { parseHandoff, readHandoffState, writeHandoffState } from "./handoff.js";
import { parseTasksFromFile, getNextTaskFromFile, completeTaskInFile, rollbackTaskInFile, addTaskInFile, } from "./tasks-file.js";
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
    listTasks(workspacePath) {
        return parseTasksFromFile(workspacePath);
    }
    getNextTask(workspacePath) {
        return getNextTaskFromFile(workspacePath);
    }
    completeTask(workspacePath, taskId, note) {
        return completeTaskInFile(workspacePath, taskId, note);
    }
    rollbackTask(workspacePath, taskId, reason) {
        return rollbackTaskInFile(workspacePath, taskId, reason);
    }
    addTask(workspacePath, taskId, description, section) {
        return addTaskInFile(workspacePath, taskId, description, section);
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
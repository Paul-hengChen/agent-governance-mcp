import type { CliResult, DispatchableLane, FanoutError, TicketFileInfo } from "./fanout-manifest.js";
/** Exact header cells (trimmed) of the approved wave table. */
export declare const WAVE_TABLE_HEADER: readonly ["wave", "ticket", "depends on"];
/**
 * waves codes: input errors (exit 2) and broken-condition FAIL lines (exit 1).
 * CLI codes, not tw_update_state gate codes, so none ends in a gate suffix.
 */
export declare const WAVES_CODES: {
    readonly columnAbsent: "WAVES_COLUMN_ABSENT";
    readonly tableUnreadable: "WAVE_TABLE_UNREADABLE";
    readonly tableAbsent: "WAVE_TABLE_ABSENT";
    readonly tableDuplicate: "WAVE_TABLE_DUPLICATE";
    readonly rowMalformed: "WAVE_TABLE_ROW_MALFORMED";
    readonly ticketAdded: "TICKET_ADDED";
    readonly ticketRemoved: "TICKET_REMOVED";
    readonly ticketInTwoLanes: "TICKET_IN_TWO_LANES";
    readonly dependencyDropped: "DEPENDENCY_DROPPED";
    readonly ownedOutsideAllowed: "OWNED_OUTSIDE_ALLOWED";
};
/** Decisions-row reason line, printed last on a pass. */
export declare const WAVES_REASON_LINE: (n: number, d: number) => string;
export declare const WAVES_OK_LINE: (n: number, m: number, d: number) => string;
export declare const WAVES_FAIL_SUMMARY: (k: number) => string;
/** One row of the approved wave table. */
export interface WaveTableRow {
    wave: number;
    ticket: string;
    dependsOn: string[];
    line: number;
}
export type WaveTableResult = {
    ok: true;
    rows: WaveTableRow[];
} | {
    ok: false;
    errors: FanoutError[];
};
/**
 * Parse the single `| wave | ticket | depends on |` table of `text`.
 *
 * `file` is only used in messages. Every malformed row is reported; a
 * dependency must name another ticket of the same table.
 */
export declare function parseWaveTable(text: string, file: string): WaveTableResult;
/** One broken-condition line, without the `FAIL  ` prefix. */
interface Failure {
    code: string;
    message: string;
}
/** Outcome of the three conditions; `failures[i]` holds condition i+1's lines. */
export interface WavesReport {
    failures: [Failure[], Failure[], Failure[]];
    tickets: number;
    lanes: number;
    dependenciesKept: number;
}
/**
 * Check the three waves conditions for a validated, all-`波次` manifest.
 *
 * `tickets` must hold the ticket file of every wave-table ticket. Pure.
 */
export declare function compareWaves(lanes: DispatchableLane[], table: WaveTableRow[], tickets: TicketFileInfo[]): WavesReport;
/** stdout and exit code for a comparison report (exit 0 = pass, 1 = broken condition). */
export declare function formatWavesReport(r: WavesReport): CliResult;
/**
 * `waves <manifest> <wave-table> [--primary <path>]`.
 *
 * Exit 0 = all three conditions hold, 1 = a broken condition, 2 = usage or
 * any parse/input error. Manifest and wave-table errors are reported together;
 * ticket files are looked up only once both parse.
 */
export declare function runWaves(args: string[]): CliResult;
export {};
//# sourceMappingURL=fanout-waves.d.ts.map
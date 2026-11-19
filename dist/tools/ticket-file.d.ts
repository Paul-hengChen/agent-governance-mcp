export type TicketFieldKind = "text" | "id-list" | "path-list" | "yes-no" | "status" | "source";
export interface TicketFieldDef {
    name: string;
    required: boolean;
    kind: TicketFieldKind;
}
/** Every field a ticket's field block may hold, in the documented order. */
export declare const TICKET_FIELDS: readonly TicketFieldDef[];
/** Field names that belong to orchestration tooling, never to a ticket. */
export declare const FORBIDDEN_FIELD_NAMES: readonly string[];
/** The status values; "stopped" must be written as `stopped — <reason>`. */
export declare const TICKET_STATUSES: readonly string[];
export type TicketVerification = {
    kind: "automated-test";
} | {
    kind: "test";
    file: string;
    title: string;
} | {
    kind: "command";
    command: string;
} | {
    kind: "device-or-person";
    check?: string;
};
export interface TicketScenario {
    id: string;
    title: string;
    /** null when the scenario has zero, several, or an unrecognized verification. */
    verification: TicketVerification | null;
    addedDuringBuild: boolean;
}
export interface TicketParseResult {
    /** Known fields whose value has the documented shape, keyed by field name. */
    fields: Record<string, string | string[]>;
    scenarios: TicketScenario[];
    /** Problem texts without the "check-tickets: <file>: " prefix; [] = valid. */
    problems: string[];
}
export interface CheckTicketsResult {
    output: string;
    exitCode: number;
    stream: "stdout" | "stderr";
}
/** Parses one ticket file's text and lists every format problem found. */
export declare function parseTicketFile(text: string): TicketParseResult;
/**
 * Runs the ticket checker over `argv` (files or directories) from `cwd`.
 * With no arguments it checks the configured ticket directory. Exit code:
 * 0 = all valid, 1 = at least one problem, 2 = cannot run (stderr output).
 */
export declare function runCheckTicketsCli(argv: readonly string[], cwd: string): CheckTicketsResult;
//# sourceMappingURL=ticket-file.d.ts.map
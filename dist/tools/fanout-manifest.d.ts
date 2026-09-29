/** Exact header of a dispatchable `## Lanes…` table, in order. */
export declare const LANES_HEADER: readonly ["lane", "票", "branch", "worktree", "擁有", "禁止", "範圍切線", "相依"];
/** Exact header of the `## Decisions…` table, in order. */
export declare const DECISIONS_HEADER: readonly ["日期", "裁決者", "內容", "出處"];
/** Allowed `裁決者` values. */
export declare const DECIDERS: readonly ["人類", "整合者"];
/** The 8 `dispatch_pins` roles (mirrors tw_update_state's dispatch_pins keys). */
export declare const PIN_ROLES: readonly ["pm", "researcher", "design-auditor", "architect", "sr-engineer", "code-reviewer", "qa-engineer", "release-engineer"];
export declare const LANE_ID_RE: RegExp;
/**
 * Integrator dispatch-prompt template — the single canonical copy (E178a).
 * `content/skill-integrator.md` (the `integrator` MCP prompt, stage 3) does
 * not restate it; it references it via `node scripts/fanout.mjs render`.
 * The bytes are pinned by the E177a render golden — do not edit the wording
 * here without re-baselining that golden.
 */
export declare const PROMPT_TEMPLATE_3B = "\u958B\u59CB\u505A <\u8A08\u5283\u6216 feature>\uFF0C\u4F60\u53EA\u8CA0\u8CAC <lane> lane \u7684 <\u7968>\uFF08<\u4E00\u53E5\u8A71>\uFF09\u3002\n\n\u5148\u5B8C\u6574\u8B80 docs/lane-protocol.md\uFF08\u5171\u540C\u898F\u5247\uFF0C\u5305\u62EC\u4FE1\u7BB1\u8207\u56DE\u5831\u683C\u5F0F\uFF09\uFF0C\u518D\u8B80 <\u8A08\u5283\u7684\u5FC5\u8B80\u7AE0\u7BC0> + <\u7968\u9762 row>\u3002\n\u4F60\u53EA\u8CA0\u8CAC\u9019\u5F35\u7968\u8D70\u5230 qa PASS\uFF1B\u6CE2\u6B21\u5C64\u7D1A\u7684\u6838\u53D6\u9805\u5C6C\u65BC\u6574\u5408\u8005\u3002\n\n\u3010\u4F60\u7684\u6B04\u4F4D\u3011\n- primary: <primary \u8DEF\u5F91>    base: <base>    ticket-slug: <ticket-slug>\n- branch: <branch>    worktree: <worktree>    lane: <lane>\n- \u4FE1\u7BB1: <lanes-root>/_mailbox/<lane>/\uFF08\u4F60\u5BEB to-integrator.md\uFF0C\u8B80 to-lane.md\uFF09\n- dispatch pins: <\u4F8B\u5982 sr-engineer=fable>\n\n\u3010\u4F60\u64C1\u6709\u7684\u6A94\u6848\u3011<\u64C1\u6709>\uFF0C\u52A0\u4E0A\u9019\u5F35\u7968\u65B0\u5EFA\u7684\u6A94\u6848\u8207\u5B83\u81EA\u5DF1\u7684\u6E2C\u8A66\u6A94\n\u3010\u4E0D\u51C6\u78B0\u3011<\u7981\u6B62>\n\u3010\u7BC4\u570D\u5207\u7DDA\uFF08\u6574\u5408\u8005\u5DF2\u6C7A\u5B9A\uFF09\u3011\u505A\uFF1A<\u2026>\u3000\u4E0D\u505A\uFF1A<\u2026>\n\n\u9700\u8981\u8DDF\u6574\u5408\u8005\u8A0E\u8AD6\u7684\u4E8B\u4E00\u5F8B\u8D70\u4FE1\u7BB1\uFF0C\u4E0D\u8981\u8ACB\u6211\u8F49\u8CBC\u3002\u9700\u8981\u6211\u6838\u51C6\u7684\u4E8B\uFF0C\u7B49\u6211\u5728\u9019\u88E1\u89AA\u624B\u6253\u5B57\u3002\n";
/**
 * Error codes of this CLI whose spec names would otherwise read as absence /
 * mismatch conditions. These are CLI codes, not tw_update_state gate codes, so
 * they are named outside the test/error-code-contract.test.mjs gate-suffix
 * vocabulary (precedent: TASKS_LEDGER_ABSENT, tools/tasks-lane-migrate.ts:90).
 */
export declare const FANOUT_CODES: {
    readonly titleAbsent: "MANIFEST_TITLE_ABSENT";
    readonly baseAbsent: "BASE_ABSENT";
    readonly lanesSectionAbsent: "LANES_SECTION_ABSENT";
    readonly lanesTableAbsent: "LANES_TABLE_ABSENT";
    readonly scopeCutMarkersAbsent: "SCOPE_CUT_MARKERS_ABSENT";
    readonly pinsSectionAbsent: "PINS_SECTION_ABSENT";
    readonly pinsLaneAbsent: "PINS_LANE_ABSENT";
    readonly decisionsSectionAbsent: "DECISIONS_SECTION_ABSENT";
    readonly decisionsTableAbsent: "DECISIONS_TABLE_ABSENT";
    readonly decisionsHeaderDiffers: "DECISIONS_HEADER_DIFFERS";
    readonly summaryAbsent: "SUMMARY_ABSENT";
    readonly readingAbsent: "READING_ABSENT";
    readonly mailboxRootAbsent: "MAILBOX_ROOT_ABSENT";
    readonly primaryNotFound: "PRIMARY_NOT_FOUND";
    readonly worktreeEmpty: "WORKTREE_EMPTY";
    readonly worktreeTilde: "WORKTREE_TILDE";
    readonly mailboxTilde: "MAILBOX_TILDE";
};
/**
 * validate warning for a dispatchable row whose worktree cell is an absolute
 * path. The absolute value is deliberately NOT echoed, so the warning never
 * repeats a local path in its own output. (E235b)
 */
export declare const WORKTREE_ABSOLUTE_WARN: (lane: string, line: number) => string;
/**
 * validate warning for an absolute `mailbox:` header. Like
 * WORKTREE_ABSOLUTE_WARN, the absolute value is deliberately NOT echoed.
 * (E248)
 */
export declare const MAILBOX_ABSOLUTE_WARN: (line: number) => string;
export declare const PINS_NONE = "\u7121";
export declare const USAGE: string;
export declare const E158_NOTE: (base: string, branch: string) => string;
export declare const PROSE_NOTE = "note: prose restrictions inside \u64C1\u6709 (e.g. \uFF08\u53EA\u9650 \u2026\uFF09) are not machine-checked.";
/**
 * Which part of the manifest an error belongs to. render/check use it to
 * decide which errors are fatal for the lane they target (a Decisions error
 * never blocks a render; a row error blocks only its own lane).
 * "input" = a CLI/environment input (flag, git ref, file), not the manifest text.
 */
export type FanoutErrorScope = "title" | "base" | "lanes" | "row" | "pins" | "decisions" | "input";
export interface FanoutError {
    code: string;
    message: string;
    scope: FanoutErrorScope;
    /** Lanes the error is attributed to; undefined = manifest-wide. */
    lanes?: string[];
}
export interface DispatchableLane {
    lane: string;
    ticket: string;
    branch: string;
    worktree: string;
    /** `擁有` cell, trimmed but otherwise byte-verbatim (render source). */
    owned: string;
    /** `禁止` cell, verbatim. */
    forbidden: string;
    /** `範圍切線` cell, verbatim. */
    scopeCut: string;
    deps: string;
    /** Path tokens parsed from `擁有` (check source only). */
    ownedTokens: string[];
    /** Path tokens parsed from `禁止` (OUT-line annotation only). */
    forbiddenTokens: string[];
    /** The full `## Lanes…` heading line of the section holding the row. */
    heading: string;
    /** 1-based line number of the row in the manifest. */
    line: number;
}
export interface ProvisionalLane {
    lane: string;
    heading: string;
    line: number;
    /** Columns of the dispatchable header absent from this table's header (exact cell match). */
    missingColumns: string[];
    header: string[];
}
export interface PinBullet {
    lanes: string[];
    pins: {
        role: string;
        tier: string;
    }[];
    explicitNone: boolean;
    line: number;
}
export interface Decision {
    date: string;
    decider: string;
    content: string;
    source: string;
    /** 1-based data-row number within the Decisions table. */
    row: number;
    line: number;
}
export interface Manifest {
    title?: string;
    base?: string;
    mailbox?: string;
    /** 1-based line of the `mailbox:` header match that won (first match). */
    mailboxLine?: number;
    dispatchable: DispatchableLane[];
    provisional: ProvisionalLane[];
    pins: {
        present: boolean;
        bullets: PinBullet[];
    };
    decisions: {
        present: boolean;
        rows: Decision[];
    };
    /** Every format error found, in manifest order within each part. */
    errors: FanoutError[];
}
/** Split a table row on `|` not escaped as `\|`; trims each cell. */
export declare function splitRow(row: string): string[];
/** Spec "path token": a backtick span that is path-shaped; every other span is prose. */
export declare function isPathToken(span: string): boolean;
export declare function pathTokens(cell: string): string[];
/** Spec "unquoted path": bare path-shaped words in `擁有` outside backtick spans. */
export declare function unquotedPaths(cell: string): string[];
/**
 * Parse a fan-out manifest. Never throws on malformed input: every problem is
 * recorded in `errors` (with a scope and lane attribution) and the offending
 * part is left out of the structured result rather than guessed at.
 */
export declare function parseManifest(text: string): Manifest;
/** Every format error in the manifest (validate reports all of them). */
export declare function validateManifest(text: string): {
    manifest: Manifest;
    errors: FanoutError[];
};
export interface RenderOptions {
    summary?: string;
    reading?: string[];
    mailboxRoot?: string;
    primary?: string;
    base?: string;
    /** Directory used to resolve `primary` via `git worktree list --porcelain` when `primary` is absent. */
    manifestDir?: string;
}
export type RenderResult = {
    ok: true;
    prompt: string;
} | {
    ok: false;
    errors: FanoutError[];
};
/** First `worktree` entry of `git worktree list --porcelain` (git lists the main worktree first). */
export declare function resolvePrimary(dir: string): string | undefined;
/** True when a worktree cell is an absolute path (platform `path.isAbsolute`). */
export declare function isAbsoluteWorktree(cell: string): boolean;
export type WorktreeResolution = {
    ok: true;
    path: string;
} | {
    ok: false;
    code: string;
    message: string;
};
/**
 * Resolve a manifest worktree cell to the absolute, `cd`-able path render
 * substitutes into the dispatch prompt. Pure: no fs access, no existence
 * check. (E235b) Rules, in order:
 *   - empty (after trim)   → WORKTREE_EMPTY
 *   - starts with "~"      → WORKTREE_TILDE (never shell-expanded: the tool
 *                            does not guess a home directory)
 *   - absolute             → the cell, byte-verbatim (no normalisation)
 *   - otherwise (relative) → path.resolve(primary, cell)
 */
export declare function resolveWorktree(cell: string, primary: string): WorktreeResolution;
export type MailboxResolution = {
    ok: true;
    path: string;
} | {
    ok: false;
    code: string;
    message: string;
};
/**
 * Resolve a manifest `mailbox:` header to the absolute mailbox root render
 * substitutes. Same rules as resolveWorktree, minus the empty case
 * (MAILBOX_RE requires a non-space value, and render treats a blank source
 * as absent before calling this). Pure: no fs access, no existence check.
 * (E248)
 *   - starts with "~"      → MAILBOX_TILDE (never shell-expanded; the value
 *                            is not echoed in the message)
 *   - absolute             → the header, byte-verbatim (no normalisation)
 *   - otherwise (relative) → path.resolve(primary, header); `..` above
 *                            primary is allowed (../<lanes-dir>/_mailbox)
 */
export declare function resolveMailboxHeader(header: string, primary: string): MailboxResolution;
/**
 * Render the §3b dispatch prompt for one dispatchable lane. Every field comes
 * from a stated source (spec "Render field sources"); an absent source is an
 * error, never a default. If the lane itself cannot be read (not found,
 * provisional, row errors) that is the whole answer; otherwise every missing
 * source is collected before returning.
 */
export declare function renderPrompt(m: Manifest, laneId: string, opts: RenderOptions): RenderResult;
/** Expand `{a,b}` alternation (non-nested groups, any number of them). */
export declare function expandBraces(glob: string): string[];
/**
 * Compile one glob (spec "Glob semantics"): repo-relative, `/`-separated;
 * `**` = zero or more whole segments, `*` = within one segment, `{a,b}` =
 * alternation, trailing `/` = `<token>**`, no glob chars = exact path.
 */
export declare function globToRegExps(token: string): RegExp[];
export declare function matchesGlob(filePath: string, token: string): boolean;
/** Implicit lane bookkeeping — always in bounds for `check`. */
export declare function isImplicitBookkeeping(filePath: string, lane: string): boolean;
export interface CheckOptions {
    base?: string;
    /** Directory inside the target repo. Library default: cwd; the CLI defaults to the manifest's directory. */
    repo?: string;
}
export interface CheckReport {
    lane: string;
    branch: string;
    base: string;
    changed: string[];
    out: {
        path: string;
        forbidden?: string;
    }[];
    /** Exact 擁有 tokens matching no path at base and no file added on the branch. Warning only. (E208) */
    unmatchedOwned: string[];
    /** Set when the owned-token existence check could not run (the git ls-tree read failed). (E208) */
    unmatchedCheckError?: string;
    output: string;
    exitCode: 0 | 1;
}
export type CheckResult = {
    ok: true;
    report: CheckReport;
} | {
    ok: false;
    errors: FanoutError[];
};
/** Warning line for an owned token that matches nothing (spec e178b Copy/Strings fanout.warn). (E208) */
export declare const UNMATCHED_OWNED_WARN: (token: string, base: string, branch: string) => string;
/**
 * Glob token: contains `*` or `{`, or ends with `/`. Never warned about —
 * the lane may be the one creating the files it names. (E208)
 */
export declare function isGlobToken(token: string): boolean;
/**
 * The exact (non-glob) owned tokens that match no path in `basePaths` and
 * no file in `addedPaths` (files the lane branch added vs base: a declared
 * new file such as `新檔 tools/fanout-manifest.ts`). Pure; each token
 * reported once, in 擁有 order. A token that matches nothing grants no
 * ownership either, so it is usually a prose aside that happens to be
 * path-shaped. (E208)
 */
export declare function unmatchedOwnedTokens(ownedTokens: string[], basePaths: string[], addedPaths: string[]): string[];
/**
 * Fan-in ownership check: every file the lane branch changed vs `<base>`
 * (committed changes only, so uncommitted work never counts) that is
 * outside the owned tokens and the implicit bookkeeping set is listed on its
 * own OUT line; exit 1 if any. (E158)
 */
export declare function checkLane(m: Manifest, laneId: string, opts?: CheckOptions): CheckResult;
export interface CliResult {
    stdout: string;
    stderr: string;
    exitCode: 0 | 1 | 2;
}
export declare function formatError(e: Pick<FanoutError, "code" | "message">): string;
export declare function usageResult(message?: string): CliResult;
export declare function runValidate(args: string[]): CliResult;
export declare function runRender(args: string[]): CliResult;
export declare function runCheck(args: string[]): CliResult;
//# sourceMappingURL=fanout-manifest.d.ts.map
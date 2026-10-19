import type { CliResult, FanoutError, Manifest } from "./fanout-manifest.js";
/** Fact keys, in section order: four primary checks, then the background ones. */
export declare const HANDOFF_PRIMARY_KEYS: readonly ["目標分支", "目標分支對 origin", "git status", "worktree", "lane-status"];
export declare const HANDOFF_BACKGROUND_KEYS: readonly ["整合分支", "未 push 的 commit", "信箱", "watch baseline", "監看"];
export declare const HANDOFF_FACT_KEYS: readonly ["目標分支", "目標分支對 origin", "git status", "worktree", "lane-status", "整合分支", "未 push 的 commit", "信箱", "watch baseline", "監看"];
export type HandoffFactKey = (typeof HANDOFF_FACT_KEYS)[number];
export declare const HANDOFF_INTRO = "\uFF08\u4E8B\u5BE6\u6B04\u4F4D\u7531 `node scripts/fanout.mjs handoff` \u7522\u751F\uFF1B\u63A5\u624B\u6642\u5148\u8DD1 `node scripts/fanout.mjs handoff --check <manifest>`\u3002`<\u5F85\u586B\uFF1A\u2026>` \u7531\u6574\u5408\u8005\u586B\u5BEB\u3002\uFF09";
export declare const HANDOFF_PLACEHOLDER_CLOSED = "- <\u5F85\u586B\uFF1A\u672C\u6CE2\u6B21\u7D50\u679C\u3001lane \u7D00\u9304\u4F4D\u7F6E\u3001\u672A\u914D\u865F\u7684\u65B0\u767C\u73FE>";
export declare const HANDOFF_PLACEHOLDER_DECIDE = "- <\u5F85\u586B\uFF1A\u4E0B\u4E00\u6CE2\u8981\u4E0D\u8981\u958B\u3001\u5F85\u88C1\u5B9A\u7684\u984C\u76EE\u3001\u6574\u5408\u8005\u7684\u5EFA\u8B70>";
export declare const HANDOFF_NO_MAILBOX_NOTE = "note: no mailbox root (no mailbox: header and no --mailbox-root) \u2014 mailbox facts not collected.";
/** Written for a path that cannot be made relative to primary (e.g. another drive). */
export declare const NOT_RELATIVE = "<\u975E\u76F8\u5C0D\u8DEF\u5F91>";
/** Suffix of a worktree whose branch is not a lane of this manifest. */
export declare const FOREIGN_WORKTREE_SUFFIX = " \uFF3B\u5225\u7684\u6E05\u55AE\uFF3D";
/** A fact present on one side only is shown as this on the other side. */
export declare const FACT_ABSENT = "\uFF08\u7F3A\uFF09";
export declare const HANDOFF_CHECK_SUMMARY: (checked: number, differ: number, moved: number) => string;
/** Primary's branch at closure: the target it will land on, the integration branch and primary's HEAD. */
export declare const closingAnnotation: (target: string, integ: string, sha7: string) => string;
/** CLI codes of this command, named outside the gate-suffix vocabulary like FANOUT_CODES. */
export declare const HANDOFF_CLI_CODES: {
    readonly factDuplicate: "HANDOFF_FACT_DUPLICATE";
    readonly gitFailed: "HANDOFF_GIT_FAILED";
};
/** Sidecar lock path the mailbox watcher holds while it watches `file`. */
export declare function watchLockPath(file: string): string;
/** The mailbox watch command for these files at these read counts (`key` = the file's lane directory). */
export declare function formatWatchCommand(entries: {
    file: string;
    key: string;
    lastRead: number;
}[]): string;
/** `integration branch: <name>` on the manifest's base line, if any. */
export declare function integrationBranchOf(text: string): string | undefined;
export interface HandoffOptions {
    /** Default `main`. */
    target?: string;
    /** Directory inside the repo; primary = its main worktree. */
    repo: string;
    /** Overrides the manifest's `mailbox:` header; resolved against cwd. */
    mailboxRoot?: string;
    /** Closure: drop the integration branch, annotate primary standing on it. */
    closing?: boolean;
    /** The manifest file, excluded from primary's `git status` fact. */
    manifestPath?: string;
}
export interface CollectedFacts {
    facts: Map<HandoffFactKey, string>;
    notes: string[];
    primary: string;
    primaryBranch: string | null;
    target: string;
    targetSha: string;
}
/**
 * Collect every fact of the D2 table for `m`. Throws HandoffFailure on an
 * input error (repo, target, mailbox header) or a failed git call for a
 * required fact.
 */
export declare function collectFacts(m: Manifest, manifestText: string, opts: HandoffOptions): CollectedFacts;
/** The `## 接手步驟` section text (trailing newline included) for these facts. */
export declare function renderHandoffSection(facts: Map<HandoffFactKey, string>): string;
/**
 * Fact lines of the manifest's single `## 接手步驟` section: every
 * `- <key>：<value>` line whose key is a fact key, wherever it sits. When the
 * background sub-item reads 無, every background key counts as absent.
 */
export declare function readHandoffFacts(text: string): {
    ok: true;
    facts: Map<HandoffFactKey, string>;
} | {
    ok: false;
    errors: FanoutError[];
};
export interface HandoffCheckReport {
    checked: number;
    differ: number;
    moved: number;
    output: string;
    exitCode: 0 | 1;
}
/** CLI codes of the sister-repo comparison, named outside the gate-suffix vocabulary. */
export declare const SISTER_REPO_CODES: {
    readonly unknown: "SISTER_REPO_UNKNOWN";
    readonly notGit: "SISTER_REPO_NOT_GIT";
};
/** handoff --check line for a `## 外部依賴` row whose branch no longer points at the recorded sha. */
export declare const EXTERNAL_DIFF_LINE: (repo: string, branch: string, recorded: string, now: string) => string;
/** Result of comparing every `## 外部依賴` row with its sister branch now. */
export interface ExternalComparison {
    checked: number;
    differ: number;
    /** DIFF lines, in table order. */
    lines: string[];
}
/**
 * Compare each well-formed `## 外部依賴` row with its sister repo's branch
 * now. `primary` is the repo whose `.current/.config.json` declares
 * sisterRepos; each row's sister root is path.resolve(primary, entry.path).
 * Throws HandoffFailure carrying every format and resolution error of the
 * run together. A branch that moved — forward or not — is a DIFF (never
 * MOVED); a missing branch reads （缺）. Read-only git, argv only.
 */
export declare function compareExternalDeps(text: string, primary: string): ExternalComparison;
/**
 * Compare the written facts with freshly collected ones, key by key (absent
 * equals absent). `external` (the `## 外部依賴` comparison, when the manifest
 * has that section) adds its lines after every fact line and its counts to
 * the summary.
 */
export declare function compareFacts(written: Map<HandoffFactKey, string>, c: CollectedFacts, external?: ExternalComparison): HandoffCheckReport;
/**
 * `handoff [--check] <manifest> [--target <branch>] [--repo <dir>]
 * [--mailbox-root <dir>] [--closing]`. Generate: exit 0 = section printed,
 * 2 = usage / input / manifest / git error. Check: 0 = every fact agrees
 * (MOVED allowed), 1 = at least one DIFF, 2 = as generate, or a missing,
 * duplicated or ambiguous section.
 */
export declare function runHandoff(args: string[]): CliResult;
//# sourceMappingURL=fanout-handoff.d.ts.map
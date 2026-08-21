import fs from "node:fs";
import path from "node:path";
import {
  log,
  info,
  success,
  error,
  green,
  red,
  yellow,
  cyan,
  dim,
  bold,
  warn as warnOut,
} from "./util.js";
import { parseMessage, parseMessageFile } from "./parse.js";
import { lintMessages, summarize, DEFAULT_CONFIG } from "./lint.js";
import { loadConfig, configExists, CONFIG_NAME } from "./config.js";
import { buildNotes, formatNotesMarkdown, formatNotesJson } from "./notes.js";
import {
  isGitRepo,
  getCommits,
  getDefaultRange,
  getCurrentBranch,
  getUpstreamBranch,
  getProjectName,
  getGitDir,
} from "./git.js";

const VERSION = "0.1.0";

class CommitlensError extends Error {}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function printVersion() {
  log(VERSION);
}

function printHelp() {
  log(`commitlens ${VERSION}

${bold("Usage")}
  commitlens <command> [options]

${bold("Commands")}
  check                 Lint commits you are about to push (default range:
                        <upstream>..HEAD, else <latest-tag>..HEAD)
  check <file>          Lint a commit-message file (for commit-msg hooks)
  notes                 Preview release notes for the same range
  breaking              Show detected breaking changes in the range
  init                  Create a ${CONFIG_NAME} in the current directory
  version               Print the CommitLens version
  help                  Show this help

${bold("Options")}
  --range <a..b>        Lint/generate for an explicit git range
  --staged              Lint .git/COMMIT_EDITMSG (last composed message)
  --strict              Fail on warnings too
  --format <f>          Output format (text | json for check; md | json for notes)
  --write               Write notes to RELEASE_NOTES.md instead of stdout
  --cwd <dir>           Project directory (default: current directory)

${bold("Examples")}
  commitlens check
  commitlens check --range origin/main..HEAD --strict
  commitlens notes --range v1.2.0..HEAD
  commitlens breaking
  # .git/hooks/commit-msg:
  #   npx commitlens check "$1"
`);
}

function resolveProject(flags) {
  const cwd = path.resolve(flags.cwd || process.cwd());
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    throw new CommitlensError(`Directory not found: ${cwd}`);
  }
  return cwd;
}

function collectCommitMessages({ cwd, range }) {
  const commits = getCommits({ cwd, range });
  return commits.map((c) => ({
    message: { subject: c.subject, body: c.body },
    meta: c,
  }));
}

function formatCheckText(results, totals, { rangeLabel, branch }) {
  const lines = [];
  lines.push(
    `${bold("commitlens")} ${dim(rangeLabel ? `· ${rangeLabel}` : "")} ${dim(branch ? `· ${branch}` : "")}`
  );
  for (const result of results) {
    if (result.violations.length === 0) {
      lines.push(`${green("✓")} ${result.subject}`);
      continue;
    }
    lines.push(`${red("✗")} ${result.subject}`);
    for (const v of result.violations) {
      const tag =
        v.severity === "error"
          ? red(`${bold(v.severity)}`)
          : yellow(v.severity);
      lines.push(`   ${tag} ${v.rule}: ${v.message}`);
    }
  }
  lines.push("");
  const parts = [
    `${totals.commits} commit${totals.commits === 1 ? "" : "s"}`,
    `${green(totals.cleanCommits + " clean")}`,
    `${yellow(totals.warns + " warning" + (totals.warns === 1 ? "" : "s"))}`,
    `${red(totals.errors + " error" + (totals.errors === 1 ? "" : "s"))}`,
  ];
  if (totals.breaking > 0) {
    parts.push(`${bold(`${totals.breaking} breaking`)}`);
  }
  lines.push(parts.join(dim(" · ")));
  return lines.join("\n");
}

function describeRange(range, cwd) {
  if (range) return range;
  const upstream = getUpstreamBranch(cwd);
  if (upstream) return `${upstream}..HEAD`;
  return null; // entire history
}

async function cmdCheck(flags) {
  const cwd = resolveProject(flags);
  if (!isGitRepo(cwd)) throw new CommitlensError(`Not a git repository: ${cwd}`);
  const config = loadConfig(cwd) || DEFAULT_CONFIG;

  let entries;
  let rangeLabel;

  // commit-msg hook mode: `commitlens check <file>`
  if (flags._file) {
    const text = fs.readFileSync(flags._file, "utf8");
    entries = [{ message: parseMessageFile(text), meta: null }];
    rangeLabel = path.basename(flags._file);
  } else if (flags.staged) {
    const gitDir = getGitDir(cwd);
    const editMsg = gitDir ? path.join(cwd, gitDir, "COMMIT_EDITMSG") : null;
    if (!editMsg || !fs.existsSync(editMsg)) {
      throw new CommitlensError("No staged message found (.git/COMMIT_EDITMSG)");
    }
    entries = [{ message: parseMessageFile(fs.readFileSync(editMsg, "utf8")), meta: null }];
    rangeLabel = "staged message";
  } else {
    const range = flags.range || getDefaultRange(cwd);
    entries = collectCommitMessages({ cwd, range });
    rangeLabel = describeRange(range, cwd) || "entire history";
  }

  const messages = entries.map((e) => e.message);
  const results = lintMessages(messages, config);
  const totals = summarize(results);

  if (flags.format === "json") {
    log(JSON.stringify({ range: rangeLabel, ...totals, results }, null, 2));
  } else {
    log(formatCheckText(results, totals, {
      rangeLabel,
      branch: flags.range ? null : getCurrentBranch(cwd),
    }));
  }

  const threshold = flags.strict ? totals.errors + totals.warns : totals.errors;
  if (threshold > 0) process.exitCode = 1;
}

async function cmdNotes(flags) {
  const cwd = resolveProject(flags);
  if (!isGitRepo(cwd)) throw new CommitlensError(`Not a git repository: ${cwd}`);

  const range = flags.range || getDefaultRange(cwd);
  const entries = collectCommitMessages({ cwd, range });
  const parsed = entries.map((e) => ({
    ...parseMessage(e.message),
    short: e.meta?.short ?? null,
    author: e.meta?.author ?? null,
  }));

  const model = buildNotes(parsed);
  const meta = {
    range: range || "HEAD",
    project: getProjectName(cwd),
    commitCount: parsed.length,
  };

  const format = flags.format || (flags.json ? "json" : "md");
  const out =
    format === "json" ? formatNotesJson(model, meta) : formatNotesMarkdown(model, meta);

  if (flags.write) {
    const file = path.join(cwd, "RELEASE_NOTES.md");
    fs.writeFileSync(file, out + "\n");
    success(`Release notes written to ${cyan(file)} (${parsed.length} commits)`);
    if (model.breaking.length > 0) {
      info(yellow(`${model.breaking.length} breaking change(s) flagged at the top`));
    }
    return;
  }
  log(out);
}

async function cmdBreaking(flags) {
  const cwd = resolveProject(flags);
  if (!isGitRepo(cwd)) throw new CommitlensError(`Not a git repository: ${cwd}`);

  const range = flags.range || getDefaultRange(cwd);
  const entries = collectCommitMessages({ cwd, range });
  const parsed = entries.map((e) => ({ ...parseMessage(e.message), short: e.meta?.short ?? null }));
  const model = buildNotes(parsed);

  if (flags.format === "json") {
    log(JSON.stringify({ range: range || "HEAD", count: model.breaking.length, breaking: model.breaking }, null, 2));
  } else if (model.breaking.length === 0) {
    success(`No breaking changes in ${range || "HEAD"}`);
  } else {
    info(`${model.breaking.length} breaking change(s) in ${range || "HEAD"}:`);
    for (const b of model.breaking) {
      const scope = b.scope ? `${bold(b.scope)}: ` : "";
      const detail = b.detail ? dim(` — ${b.detail}`) : "";
      const ref = b.short ? dim(` (${b.short})`) : "";
      log(`  ${yellow("!")} ${scope}${b.description}${detail}${ref}`);
    }
    warnOut("This push will introduce breaking changes — bump MAJOR before releasing.");
    if (flags.strict) process.exitCode = 1;
  }
}

async function cmdInit(flags) {
  const cwd = resolveProject(flags);
  const file = path.join(cwd, CONFIG_NAME);
  if (configExists(cwd)) {
    log(`${yellow("Existing")} ${CONFIG_NAME} already present in ${cwd}`);
    return;
  }
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  config.rules["breaking-migration-note"] = "error";
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  success(`Created ${CONFIG_NAME} in ${cyan(cwd)}`);
  info(dim("Tune types, lengths and rule severities to match your team."));
}

export async function main(argv) {
  const { flags, positional } = parseArgs(argv);
  const command = positional[0] || "check";

  try {
    switch (command) {
      case "init":
        await cmdInit(flags);
        break;
      case "notes":
        await cmdNotes(flags);
        break;
      case "breaking":
        await cmdBreaking(flags);
        break;
      case "version":
      case "--version":
      case "-v":
        printVersion();
        break;
      case "help":
      case "--help":
      case "-h":
        printHelp();
        break;
      case "check": {
        if (positional[1]) flags._file = positional[1];
        await cmdCheck(flags);
        break;
      }
      default:
        throw new CommitlensError(
          `Unknown command "${command}". Run \`commitlens help\` for usage.`
        );
    }
  } catch (err) {
    error(err instanceof CommitlensError ? err.message : err.message);
    if (!(err instanceof CommitlensError)) {
      info(dim((err.stack || "").split("\n").slice(0, 3).join("\n")));
    }
    process.exitCode = 1;
  }
}

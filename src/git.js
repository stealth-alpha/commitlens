import { execFileSync } from "node:child_process";

const RECORD_SEP = "\x1e";
const FIELD_SEP = "\x1f";

export function isGitRepo(cwd = process.cwd()) {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Parse the `git log` output into structured commit objects.
 * Fields: hash, short, author, email, date (ISO), subject, body.
 */
export function parseLog(rawLog) {
  const commits = [];
  const records = rawLog.split(RECORD_SEP);
  for (const record of records) {
    if (!record.trim()) continue;
    const fields = record.split(FIELD_SEP);
    if (fields.length < 7) continue;
    const [hash, short, author, email, date, subject, ...bodyParts] = fields;
    commits.push({
      hash: hash.trim(),
      short: short.trim(),
      author: author.trim(),
      email: email.trim(),
      date: date.trim(),
      subject: subject.trim(),
      body: bodyParts.join(FIELD_SEP).trim(),
    });
  }
  return commits;
}

/**
 * Get commit history. `range` may be "a..b", a single ref, or null for all.
 * Merge commits are excluded by default.
 */
export function getCommits({
  cwd = process.cwd(),
  range = null,
  count = 500,
} = {}) {
  const args = ["log", "--date=iso-strict", "--no-merges"];
  args.push(
    "--pretty=format:%H" +
      FIELD_SEP +
      "%h" +
      FIELD_SEP +
      "%an" +
      FIELD_SEP +
      "%ae" +
      FIELD_SEP +
      "%aI" +
      FIELD_SEP +
      "%s" +
      FIELD_SEP +
      "%b" +
      RECORD_SEP
  );
  if (range) args.push(range);
  args.push("-n", String(count));
  const raw = runGit(args, cwd);
  return parseLog(raw);
}

export function getCurrentBranch(cwd = process.cwd()) {
  try {
    return runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd).trim();
  } catch {
    return "HEAD";
  }
}

export function getUpstreamBranch(cwd = process.cwd()) {
  try {
    return runGit(
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
      cwd
    ).trim();
  } catch {
    return null;
  }
}

export function getLatestTag(cwd = process.cwd()) {
  try {
    return runGit(
      ["describe", "--tags", "--abbrev=0", "--always"],
      cwd
    ).trim();
  } catch {
    return null;
  }
}

export function getProjectName(cwd = process.cwd()) {
  try {
    return runGit(["rev-parse", "--show-toplevel"], cwd).split("/").pop() ||
      "project";
  } catch {
    return "project";
  }
}

/**
 * Resolve the default review range for "what am I about to push":
 * 1. <upstream>..HEAD when the branch has an upstream
 * 2. <latest-tag>..HEAD when the repo has a version-ish tag
 * 3. null (entire history) otherwise
 */
export function getDefaultRange(cwd = process.cwd()) {
  const upstream = getUpstreamBranch(cwd);
  if (upstream) return `${upstream}..HEAD`;
  const tag = getLatestTag(cwd);
  if (tag && /^v?\d+\.\d+\.\d+/.test(tag)) return `${tag}..HEAD`;
  return null;
}

/**
 * Resolve the git dir (.git path), honouring worktrees/submodules.
 */
export function getGitDir(cwd = process.cwd()) {
  try {
    return runGit(["rev-parse", "--git-dir"], cwd).trim();
  } catch {
    return null;
  }
}

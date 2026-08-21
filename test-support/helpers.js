import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function makeTempDir(prefix = "commitlens-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/**
 * Create a throwaway git repo with the given commits.
 * Each entry: `{ message, tag?, file? }`.
 */
export function makeGitRepo(commits) {
  const dir = makeTempDir("cl-git-");
  const git = (args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.name", "Test User"]);
  git(["config", "user.email", "test@example.com"]);
  for (const commit of commits) {
    if (commit.file) {
      write(path.join(dir, commit.file), "# test\n");
      git(["add", "-A"]);
    }
    if (commit.body) {
      git(["commit", "-q", "--allow-empty", "-m", commit.message, "-m", commit.body]);
    } else {
      git(["commit", "-q", "--allow-empty", "-m", commit.message]);
    }
    if (commit.tag) git(["tag", commit.tag]);
  }
  return dir;
}

/** Run the CLI in a directory; returns `{ status, stdout, stderr }`. */
export function runCli(args, cwd) {
  const bin = new URL("../bin/commitlens.js", import.meta.url).pathname;
  try {
    const stdout = execFileSync(process.execPath, [bin, ...args], {
      cwd,
      encoding: "utf8",
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout || "",
      stderr: err.stderr || "",
    };
  }
}

export function removeDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

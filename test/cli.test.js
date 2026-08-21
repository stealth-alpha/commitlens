import test from "node:test";
import assert from "node:assert/strict";
import { makeGitRepo, removeDir, runCli, write } from "../test-support/helpers.js";
import fs from "node:fs";
import path from "node:path";

test("check passes on a clean conventional history", () => {
  const dir = makeGitRepo([
    { message: "chore: scaffold project", file: "README.md" },
    { message: "feat(api): add endpoint" },
    { message: "fix(api): handle empty body" },
  ]);
  try {
    const res = runCli(["check", "--range", "HEAD"], dir);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /3 commits/);
    assert.match(res.stdout, /0 errors/);
  } finally {
    removeDir(dir);
  }
});

test("check fails with exit code 1 on a bad commit", () => {
  const dir = makeGitRepo([
    { message: "chore: scaffold project", file: "README.md" },
    { message: "totally not conventional" },
  ]);
  try {
    const res = runCli(["check", "--range", "HEAD"], dir);
    assert.equal(res.status, 1);
    assert.match(res.stdout, /1 error/);
    assert.match(res.stdout, /type-empty/);
  } finally {
    removeDir(dir);
  }
});

test("breaking command detects breaking changes in range", () => {
  const dir = makeGitRepo([
    { message: "chore: base", file: "a.txt" },
    { message: "feat!: drop v1 API", body: "BREAKING CHANGE: v1 removed" },
  ]);
  try {
    const res = runCli(["breaking", "--range", "HEAD"], dir);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /1 breaking change/);
    assert.match(res.stdout, /v1 removed/);
  } finally {
    removeDir(dir);
  }
});

test("notes renders markdown grouped by type for a tag range", () => {
  const dir = makeGitRepo([
    { message: "chore: initial", file: "README.md", tag: "v1.0.0" },
    { message: "feat: add widget" },
    { message: "fix: widget crash" },
  ]);
  try {
    const res = runCli(["notes", "--range", "v1.0.0..HEAD"], dir);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /### Features/);
    assert.match(res.stdout, /add widget/);
    assert.match(res.stdout, /### Bug Fixes/);
  } finally {
    removeDir(dir);
  }
});

test("check on a commit-msg file lints only that message and exits 1 when invalid", () => {
  const dir = makeGitRepo([{ message: "chore: base", file: "x.txt" }]);
  try {
    const msgFile = path.join(dir, ".git", "HOOKS-MSG");
    write(msgFile, "feat: fine\n");
    const ok = runCli(["check", msgFile], dir);
    assert.equal(ok.status, 0);

    write(msgFile, "nope nope nope\n");
    const bad = runCli(["check", msgFile], dir);
    assert.equal(bad.status, 1);
  } finally {
    removeDir(dir);
  }
});

test("init writes a config file; second init is a no-op", () => {
  const dir = makeGitRepo([{ message: "chore: base", file: "y.txt" }]);
  try {
    const first = runCli(["init"], dir);
    assert.equal(first.status, 0);
    assert.ok(fs.existsSync(path.join(dir, "commitlens.config.json")));
    const second = runCli(["init"], dir);
    assert.equal(second.status, 0);
    assert.match(second.stdout, /already present/);
  } finally {
    removeDir(dir);
  }
});

test("--strict fails on warnings (trailing period)", () => {
  const dir = makeGitRepo([
    { message: "chore: base", file: "z.txt" },
    { message: "fix: ends with period." },
  ]);
  try {
    const lenient = runCli(["check", "--range", "HEAD"], dir);
    assert.equal(lenient.status, 0);

    const strict = runCli(
      ["check", "--range", "HEAD", "--strict"],
      dir
    );
    assert.equal(strict.status, 1);
    assert.match(strict.stdout, /subject-full-stop/);
  } finally {
    removeDir(dir);
  }
});

test("json format emits machine-readable totals", () => {
  const dir = makeGitRepo([
    { message: "chore: base", file: "j.txt" },
    { message: "feat: one good commit" },
  ]);
  try {
    const res = runCli(
      ["check", "--range", "HEAD", "--format", "json"],
      dir
    );
    assert.equal(res.status, 0);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.commits, 2);
    assert.equal(parsed.errors, 0);
  } finally {
    removeDir(dir);
  }
});

test("unknown command exits non-zero with a helpful error", () => {
  const dir = makeGitRepo([{ message: "chore: base", file: "u.txt" }]);
  try {
    const res = runCli(["frobnicate"], dir);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /Unknown command/);
  } finally {
    removeDir(dir);
  }
});

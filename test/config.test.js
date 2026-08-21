import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, CONFIG_NAME } from "../src/config.js";
import fs from "node:fs";
import path from "node:path";
import { makeTempDir, removeDir } from "../test-support/helpers.js";

test("loadConfig returns null when no config file exists", () => {
  const dir = makeTempDir();
  try {
    assert.equal(loadConfig(dir), null);
  } finally {
    removeDir(dir);
  }
});

test("loadConfig reads types and rule overrides", () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(
      path.join(dir, CONFIG_NAME),
      JSON.stringify({
        types: ["feat", "fix"],
        maxSubjectLength: 72,
        rules: { "subject-full-stop": "error" },
      })
    );
    const config = loadConfig(dir);
    assert.deepEqual(config.types, ["feat", "fix"]);
    assert.equal(config.maxSubjectLength, 72);
    assert.equal(config.rules["subject-full-stop"], "error");
  } finally {
    removeDir(dir);
  }
});

test("loadConfig ignores malformed JSON instead of throwing", () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, CONFIG_NAME), "{ not json ]");
    assert.equal(loadConfig(dir), null);
  } finally {
    removeDir(dir);
  }
});

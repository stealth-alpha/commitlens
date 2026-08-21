import test from "node:test";
import assert from "node:assert/strict";
import { lintParsed, lintMessages, summarize, DEFAULT_CONFIG } from "../src/lint.js";
import { parseMessage } from "../src/parse.js";

function lint(subject, body = "", config = {}) {
  return lintParsed(parseMessage({ subject, body }), config);
}

test("clean conventional commit has no violations", () => {
  const v = lint("feat(api): add pagination");
  assert.equal(v.filter((x) => x.severity === "error").length, 0);
  assert.equal(v.length, 0);
});

test("non-conventional commit triggers type-empty error", () => {
  const v = lint("updated some stuff");
  assert.ok(v.some((x) => x.rule === "type-empty" && x.severity === "error"));
});

test("unknown type triggers type-enum error", () => {
  const v = lint("feature: too verbose a type name");
  assert.ok(v.some((x) => x.rule === "type-enum"));
});

test("uppercase type triggers type-case error", () => {
  const v = lint("Feat: capitalized type");
  assert.ok(v.some((x) => x.rule === "type-case"));
});

test("empty subject triggers subject-empty", () => {
  const v = lint("feat:");
  assert.ok(v.some((x) => x.rule === "subject-empty"));
});

test("trailing period and overlong subject are flagged", () => {
  const period = lint("feat: ends with a period.");
  assert.ok(period.some((x) => x.rule === "subject-full-stop"));

  const long = lint(`feat: ${"x".repeat(120)}`);
  assert.ok(long.some((x) => x.rule === "subject-max-length"));
});

test("breaking without migration note is flagged by default config", () => {
  const v = lint("feat!: rewrite api");
  assert.ok(v.some((x) => x.rule === "breaking-migration-note"));
  const ok = lint("feat!: rewrite api", "BREAKING CHANGE: see MIGRATION.md");
  assert.ok(!ok.some((x) => x.rule === "breaking-migration-note"));
});

test("rules can be overridden to off or upgraded to error", () => {
  const off = lint("feat: ends with a period.", "", {
    rules: { "subject-full-stop": "off" },
  });
  assert.ok(!off.some((x) => x.rule === "subject-full-stop"));

  const strict = lint("feat!: no note", "", {
    rules: { ...DEFAULT_CONFIG.rules, "breaking-migration-note": "error" },
  });
  assert.ok(
    strict.some((x) => x.rule === "breaking-migration-note" && x.severity === "error")
  );
});

test("lintMessages + summarize roll up counts", () => {
  const results = lintMessages([
    "feat: good one",
    "bad message",
    { subject: "fix: another good one", body: "" },
  ]);
  const totals = summarize(results);
  assert.equal(totals.commits, 3);
  assert.equal(totals.cleanCommits, 2);
  assert.equal(totals.errors, 1);
  assert.equal(totals.breaking, 0);
});

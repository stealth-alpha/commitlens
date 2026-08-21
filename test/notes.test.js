import test from "node:test";
import assert from "node:assert/strict";
import { parseMessage } from "../src/parse.js";
import { buildNotes, formatNotesMarkdown, formatNotesJson } from "../src/notes.js";

function entry(subject, body = "", short = "abc1234") {
  return { ...parseMessage({ subject, body }), short };
}

const commits = [
  entry("feat!: change config schema", "BREAKING CHANGE: rename keys"),
  entry("feat(parser): add streaming mode", "", "def5678"),
  entry("fix(cli): crash on empty range"),
  entry("fix: retry flaky uploads", "Closes #12", "aaa1111"),
  entry("docs: expand quickstart"),
  entry("chore: tidy deps"),
  entry("not conventional at all"),
];

test("buildNotes groups by type and separates breaking", () => {
  const model = buildNotes(commits);
  const titles = model.sections.map((s) => s.title);
  assert.ok(titles.includes("Features"));
  assert.ok(titles.includes("Bug Fixes"));
  assert.ok(!titles.includes("Not conventional at all"));
  assert.equal(model.breaking.length, 1);
});

test("buildNotes carries breaking detail and scope", () => {
  const model = buildNotes(commits);
  const b = model.breaking[0];
  assert.equal(b.detail, "rename keys");
  assert.equal(b.type, "feat");
  assert.equal(b.bang, true);
});

test("buildNotes extracts refs into items", () => {
  const model = buildNotes(commits);
  const fixItems = model.sections.find((s) => s.title === "Bug Fixes").items;
  const withRef = fixItems.find((i) => i.description === "retry flaky uploads");
  assert.deepEqual(withRef.refs, ["12"]);
});

test("formatNotesMarkdown renders breaking section first with warning marker", () => {
  const md = formatNotesMarkdown(buildNotes(commits), { version: "2.0.0" });
  assert.ok(md.startsWith("## 2.0.0"));
  assert.ok(md.includes("### ⚠ BREAKING CHANGES"));
  assert.ok(md.indexOf("⚠ BREAKING CHANGES") < md.indexOf("### Features"));
  assert.ok(md.includes("— rename keys"));
});

test("formatNotesMarkdown without version uses Unreleased heading", () => {
  const md = formatNotesMarkdown(buildNotes([entry("feat: x")]), {});
  assert.ok(md.includes("## Unreleased"));
});

test("formatNotesJson is stable JSON with sections + breaking", () => {
  const json = formatNotesJson(buildNotes(commits), { project: "demo" });
  const parsed = JSON.parse(json);
  assert.equal(parsed.project, "demo");
  assert.equal(parsed.breaking.length, 1);
  assert.ok(Array.isArray(parsed.sections));
});

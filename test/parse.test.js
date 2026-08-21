import test from "node:test";
import assert from "node:assert/strict";
import { parseMessage, extractRefs, parseMessageFile } from "../src/parse.js";

test("parseMessage parses type(scope): description", () => {
  const p = parseMessage({ subject: "feat(api): add pagination", body: "" });
  assert.equal(p.type, "feat");
  assert.equal(p.scope, "api");
  assert.equal(p.description, "add pagination");
  assert.equal(p.isConventional, true);
  assert.equal(p.breaking, false);
});

test("parseMessage detects breaking via ! bang", () => {
  const p = parseMessage("feat!: rewrite auth flow");
  assert.equal(p.bang, true);
  assert.equal(p.breaking, true);
  assert.equal(p.breakingDetail, null);
});

test("parseMessage detects BREAKING CHANGE footer with detail", () => {
  const p = parseMessage({
    subject: "feat: change config schema",
    body: "some prose\n\nBREAKING CHANGE: config keys renamed, run `commitlens migrate`",
  });
  assert.equal(p.breaking, true);
  assert.equal(p.breakingDetail, "config keys renamed, run `commitlens migrate`");
});

test("parseMessage accepts BREAKING-CHANGE hyphenated token", () => {
  const p = parseMessage({
    subject: "fix(cli): drop node 14",
    body: "BREAKING-CHANGE: requires node >=18",
  });
  assert.equal(p.breaking, true);
  assert.equal(p.breakingDetail, "requires node >=18");
});

test("parseMessage marks non-conventional subjects", () => {
  const p = parseMessage("updated some stuff");
  assert.equal(p.isConventional, false);
  assert.equal(p.type, null);
  assert.equal(p.description, "updated some stuff");
});

test("extractRefs finds issue and project references once each", () => {
  const p = parseMessage({
    subject: "fix(parser): handle empty footers",
    body: "Closes #42, see PROJ-7 and gh-9\n\nRefs #42",
  });
  assert.deepEqual(p ? extractRefs(p) : [], ["42", "PROJ-7", "gh-9"]);
});

test("parseMessageFile strips comments and scissors line", () => {
  const text = [
    "feat: real subject",
    "",
    "# Please enter the commit message...",
    "# ------------------------ >8 ------------------------",
    "# anything below is ignored",
    "feat: ghost subject",
  ].join("\n");
  const m = parseMessageFile(text);
  assert.equal(m.subject, "feat: real subject");
  assert.ok(!m.body.includes("ghost"));
});

test("parseMessage collects footers from last paragraph", () => {
  const p = parseMessage({
    subject: "fix: x",
    body: "Free text mentioning Reviewed-by in prose.\n\nReviewed-by: Ada\nRefs: #1",
  });
  assert.equal(p.footers.length, 2);
  assert.equal(p.footers[0].token, "Reviewed-by");
});

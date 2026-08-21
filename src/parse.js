/**
 * Conventional Commits 1.0.0 message parsing — zero dependencies.
 *
 * A commit message is `{ subject, body }`. The subject is the first line;
 * the body is everything after the blank line.
 */

export const CONVENTIONAL_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];

export const TYPE_GROUPS = {
  feat: "Features",
  fix: "Bug Fixes",
  docs: "Documentation",
  style: "Styling",
  refactor: "Refactoring",
  perf: "Performance",
  test: "Tests",
  build: "Build System",
  ci: "Continuous Integration",
  chore: "Miscellaneous",
  revert: "Reverts",
};

const SUBJECT_RE =
  /^(?<type>[A-Za-z][A-Za-z0-9_-]*)(?:\((?<scope>[^()\s]+)\))?(?<bang>!)?:\s?(?<desc>.*)$/;

const BREAKING_FOOTER_RE = /^BREAKING[ -]CHANGE:[ \t]?(.*)$/;

/**
 * Parse a commit message into its conventional parts.
 * Returns `{ raw, subject, body, type, scope, bang, description,
 * breaking, breakingDetail, isConventional, footers }`.
 */
export function parseMessage(message) {
  const raw =
    typeof message === "string"
      ? message
      : [message?.subject || "", message?.body || ""]
          .filter(Boolean)
          .join("\n\n");
  const lines = raw.split(/\r?\n/);
  const subject = (lines[0] || "").trim();
  const body = lines.slice(1).join("\n").replace(/^\s*\n/, "").trimEnd();

  const match = SUBJECT_RE.exec(subject);
  const typeRaw = match?.groups?.type ?? null;
  const type = typeRaw?.toLowerCase() ?? null;
  const scope = match?.groups?.scope ?? null;
  const bang = match?.groups?.bang === "!";
  const description = match ? (match.groups.desc || "").trim() : subject;

  // Footers: last paragraph lines that look like `Token: value`.
  const footers = [];
  const paragraphs = body.split(/\n\s*\n/);
  const lastParagraph = paragraphs.length ? paragraphs[paragraphs.length - 1] : "";
  for (const line of lastParagraph.split("\n")) {
    const footerMatch = /^([A-Za-z][A-Za-z0-9-]*):[ \t]?(.*)$/.exec(line.trim());
    if (footerMatch) footers.push({ token: footerMatch[1], value: footerMatch[2] });
  }

  let breakingDetail = null;
  for (const line of body.split("\n")) {
    const breakingMatch = BREAKING_FOOTER_RE.exec(line.trim());
    if (breakingMatch) {
      breakingDetail = breakingMatch[1].trim();
      break;
    }
  }

  const breaking = bang || breakingDetail !== null;

  return {
    raw,
    subject,
    body,
    type,
    typeRaw,
    scope,
    bang,
    description,
    breaking,
    breakingDetail,
    isConventional: Boolean(match),
    footers,
  };
}

/** Extract issue/PR references (#123, gh-45, PROJ-7) from subject + body. */
export function extractRefs(parsed) {
  const refs = [];
  const seen = new Set();
  const feed = `${parsed.subject}\n${parsed.body}`;
  const re = /#(\d+)|\bgh-(\d+)\b|\b([A-Za-z][A-Za-z0-9_]+-\d+)\b/g;
  let m;
  while ((m = re.exec(feed)) !== null) {
    const id = m[1] || (m[2] ? `gh-${m[2]}` : null) || m[3];
    if (id && !seen.has(id)) {
      seen.add(id);
      refs.push(id);
    }
  }
  return refs;
}

/**
 * Parse a full commit-message file (as passed to a commit-msg hook) into
 * `{ subject, body }`, stripping comment lines and the trailing scissors
 * block git appends in some editors.
 */
export function parseMessageFile(text) {
  const lines = text.split(/\r?\n/);
  const kept = [];
  for (const line of lines) {
    if (line.trim() === "# ------------------------ >8 ------------------------") {
      break;
    }
    if (/^#/.test(line)) continue;
    kept.push(line);
  }
  const cleaned = kept.join("\n").replace(/\n+$/, "");
  const [subject = "", ...rest] = cleaned.split(/\r?\n/);
  return { subject: subject.trim(), body: rest.join("\n").replace(/^\s*\n/, "").trimEnd() };
}

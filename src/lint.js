import { parseMessage } from "./parse.js";
import { CONVENTIONAL_TYPES } from "./parse.js";

export const RULE_IDS = [
  "type-empty",
  "type-enum",
  "type-case",
  "scope-case",
  "subject-empty",
  "subject-full-stop",
  "subject-max-length",
  "body-max-line-length",
  "breaking-migration-note",
];

export const DEFAULT_CONFIG = {
  types: [...CONVENTIONAL_TYPES],
  maxSubjectLength: 100,
  maxBodyLineLength: 100,
  rules: {
    "type-empty": "error",
    "type-enum": "error",
    "type-case": "error",
    "scope-case": "warn",
    "subject-empty": "error",
    "subject-full-stop": "warn",
    "subject-max-length": "error",
    "body-max-line-length": "warn",
    "breaking-migration-note": "warn",
  },
};

const SEVERITIES = new Set(["error", "warn", "off"]);

function severityFor(ruleId, rules) {
  const override = rules?.[ruleId];
  if (override && SEVERITIES.has(override)) return override;
  return DEFAULT_CONFIG.rules[ruleId] || "off";
}

/**
 * Lint one parsed commit message. Returns an array of violations:
 * `{ rule, severity, message }`.
 */
export function lintParsed(parsed, config = {}) {
  const types = config.types?.length ? config.types : DEFAULT_CONFIG.types;
  const rules = { ...DEFAULT_CONFIG.rules, ...(config.rules || {}) };
  const maxSubject =
    Number(config.maxSubjectLength) > 0
      ? Number(config.maxSubjectLength)
      : DEFAULT_CONFIG.maxSubjectLength;
  const maxBodyLine =
    Number(config.maxBodyLineLength) > 0
      ? Number(config.maxBodyLineLength)
      : DEFAULT_CONFIG.maxBodyLineLength;

  const violations = [];
  const add = (ruleId, message) => {
    const severity = severityFor(ruleId, rules);
    if (severity === "off") return;
    violations.push({ rule: ruleId, severity, message });
  };

  if (!parsed.isConventional) {
    add(
      "type-empty",
      `commit does not follow Conventional Commits ("type: description")`
    );
  } else {
    if (!types.includes(parsed.type)) {
      add(
        "type-enum",
        `type "${parsed.type}" is not allowed (allowed: ${types.join(", ")})`
      );
    }
    if (parsed.typeRaw && parsed.typeRaw !== parsed.typeRaw.toLowerCase()) {
      add("type-case", `type "${parsed.typeRaw}" must be lowercase`);
    }
    if (parsed.scope && parsed.scope !== parsed.scope.toLowerCase()) {
      add("scope-case", `scope "${parsed.scope}" must be lowercase`);
    }
    if (!parsed.description) {
      add("subject-empty", "subject may not be empty");
    }
    if (parsed.description.endsWith(".")) {
      add("subject-full-stop", "subject must not end with a period");
    }
  }

  if (parsed.subject.length > maxSubject) {
    add(
      "subject-max-length",
      `subject is ${parsed.subject.length} chars (max ${maxSubject})`
    );
  }

  for (const line of (parsed.body || "").split("\n")) {
    if (line.length > maxBodyLine) {
      add(
        "body-max-line-length",
        `body line exceeds ${maxBodyLine} chars: "${line.slice(0, 48)}…"`
      );
      break;
    }
  }

  if (parsed.breaking && !parsed.breakingDetail) {
    add(
      "breaking-migration-note",
      'breaking change without a "BREAKING CHANGE: <migration note>" footer'
    );
  }

  return violations;
}

/**
 * Lint raw messages (`{ subject, body }` or full strings). Returns results:
 * `{ subject, violations, errorCount, warnCount }`.
 */
export function lintMessages(messages, config = {}) {
  return messages.map((message) => {
    const parsed = parseMessage(message);
    const violations = lintParsed(parsed, config);
    return {
      subject: parsed.subject,
      breaking: parsed.breaking,
      breakingDetail: parsed.breakingDetail,
      violations,
      errorCount: violations.filter((v) => v.severity === "error").length,
      warnCount: violations.filter((v) => v.severity === "warn").length,
    };
  });
}

/** Roll up result totals. */
export function summarize(results) {
  return {
    commits: results.length,
    errors: results.reduce((sum, r) => sum + r.errorCount, 0),
    warns: results.reduce((sum, r) => sum + r.warnCount, 0),
    cleanCommits: results.filter((r) => r.violations.length === 0).length,
    breaking: results.filter((r) => r.breaking).length,
  };
}

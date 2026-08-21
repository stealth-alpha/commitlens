import { extractRefs, TYPE_GROUPS } from "./parse.js";

/**
 * Build the release-notes data model from already-parsed conventional
 * commits (`parseMessage` output enriched with hash/short/author).
 */
export function buildNotes(parsedCommits, { groupMap } = {}) {
  const groups = groupMap || TYPE_GROUPS;
  const sections = new Map();
  const breaking = [];

  for (const entry of parsedCommits) {
    const type = entry.type;
    if (entry.breaking) {
      breaking.push({
        short: entry.short || null,
        type,
        scope: entry.scope,
        description: entry.description,
        detail: entry.breakingDetail,
        bang: Boolean(entry.bang),
      });
    }
    if (!type) continue; // non-conventional: skip grouped sections
    const title = groups[type] || capitalize(type);
    if (!sections.has(title)) sections.set(title, []);
    sections.get(title).push({
      short: entry.short || null,
      scope: entry.scope,
      description: entry.description,
      refs: extractRefs(entry),
    });
  }

  return {
    breaking,
    sections: [...sections.entries()].map(([title, items]) => ({
      title,
      items,
    })),
  };
}

/** Format release notes as markdown (Keep a Changelog-ish). */
export function formatNotesMarkdown(model, meta = {}) {
  const lines = [];
  const heading =
    meta.version != null
      ? `## ${meta.version}${meta.date ? ` — ${meta.date}` : ""}`
      : "## Unreleased";
  lines.push(heading);
  lines.push("");

  if (model.breaking.length > 0) {
    lines.push("### ⚠ BREAKING CHANGES");
    for (const b of model.breaking) {
      const scope = b.scope ? `**${b.scope}**: ` : "";
      const detail = b.detail ? ` — ${b.detail}` : "";
      lines.push(`- ${scope}${b.description}${detail}`);
    }
    lines.push("");
  }

  for (const section of model.sections) {
    lines.push(`### ${section.title}`);
    for (const item of section.items) {
      const scope = item.scope ? `**${item.scope}**: ` : "";
      const refs = item.refs.length
        ? ` (${item.refs.map((r) => `#${String(r).replace(/^#/, "")}`).join(", ")})`
        : "";
      lines.push(`- ${scope}${item.description}${refs}`);
    }
    lines.push("");
  }

  if (meta.contributors?.length) {
    lines.push(
      `Contributors: ${meta.contributors.map((c) => c.name || c).join(", ")}`
    );
    lines.push("");
  }

  const out = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return out.endsWith("\n") ? out.replace(/\n$/, "") : out;
}

/** Format release notes as JSON. */
export function formatNotesJson(model, meta = {}) {
  return JSON.stringify({ ...meta, ...model }, null, 2);
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

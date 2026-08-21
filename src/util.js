/**
 * Minimal, dependency-free console output with ANSI colors.
 */
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function paint(inner, code) {
  return useColor ? `${colors[code] ?? ""}${inner}${colors.reset}` : inner;
}

export function dim(s) {
  return paint(s, "dim");
}
export function bold(s) {
  return paint(s, "bold");
}
export function green(s) {
  return paint(s, "green");
}
export function red(s) {
  return paint(s, "red");
}
export function cyan(s) {
  return paint(s, "cyan");
}
export function yellow(s) {
  return paint(s, "yellow");
}

export function log(msg = "") {
  process.stdout.write(`${msg}\n`);
}

export function error(msg) {
  process.stderr.write(`${red("error")}: ${msg}\n`);
}

export function warn(msg) {
  process.stderr.write(`${yellow("warn")}: ${msg}\n`);
}

export function success(msg) {
  process.stdout.write(`${green("✓")} ${msg}\n`);
}

export function info(msg) {
  process.stdout.write(`${cyan("•")} ${msg}\n`);
}

/** Read a file, returning null instead of throwing. */
export function readIfExists(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

import fs from "node:fs";

/** Read a JSON file, returning null on parse/read failure. */
export function readJson(file) {
  const raw = readIfExists(file);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

import path from "node:path";

/** Truncate a long string with an ellipsis for terminal display. */
export function truncate(value, max = 72) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

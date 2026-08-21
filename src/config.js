import fs from "node:fs";
import path from "node:path";
import { readJson } from "./util.js";

export const CONFIG_NAME = "commitlens.config.json";

/**
 * Load commitlens.config.json for a project root.
 * Returns null when the project has no config (defaults apply).
 */
export function loadConfig(cwd = process.cwd()) {
  const file = path.join(cwd, CONFIG_NAME);
  const raw = readJson(file);
  if (!raw || typeof raw !== "object") return null;
  const config = {};
  if (Array.isArray(raw.types)) config.types = raw.types.map(String);
  if (Number.isFinite(Number(raw.maxSubjectLength))) {
    config.maxSubjectLength = Number(raw.maxSubjectLength);
  }
  if (Number.isFinite(Number(raw.maxBodyLineLength))) {
    config.maxBodyLineLength = Number(raw.maxBodyLineLength);
  }
  if (raw.rules && typeof raw.rules === "object") {
    config.rules = raw.rules;
  }
  return config;
}

export function configExists(cwd = process.cwd()) {
  return fs.existsSync(path.join(cwd, CONFIG_NAME));
}

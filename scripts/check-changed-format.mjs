import { execFileSync } from "node:child_process";
import { extname } from "node:path";
import { readFileSync } from "node:fs";

const BASE_REF = process.env.QUALITY_BASE_REF || "origin/main";
const SUPPORTED_EXTENSIONS = new Set([".js", ".mjs", ".css", ".html"]);
const EXCLUDED = new Set([
  "index.html",
  "analises.html",
  "src/modules/legacy-app.js",
  "src/analises/analises-app.js",
]);

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const changedFiles = git(
  "diff",
  "--name-only",
  "--diff-filter=ACMR",
  BASE_REF,
  "HEAD",
)
  .split("\n")
  .map((item) => item.trim())
  .filter(Boolean);

const candidates = changedFiles.filter((path) => {
  if (EXCLUDED.has(path)) return false;
  return SUPPORTED_EXTENSIONS.has(extname(path));
});

execFileSync("npx", ["prettier", "--write", ...candidates], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

for (const path of candidates) {
  console.log(`BEGIN_FORMATTED_FILE:${path}`);
  console.log(readFileSync(path, "utf8"));
  console.log(`END_FORMATTED_FILE:${path}`);
}

process.exit(1);

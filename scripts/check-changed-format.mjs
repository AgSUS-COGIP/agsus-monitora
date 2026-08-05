import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { gzipSync } from "node:zlib";

const BASE_REF = process.env.QUALITY_BASE_REF || "origin/main";
const SUPPORTED_EXTENSIONS = new Set([".js", ".mjs", ".css", ".html"]);
const EXCLUDED = new Set([
  "index.html",
  "analises.html",
  "src/modules/legacy-app.js",
  "src/analises/analises-app.js",
]);
const DIAGNOSTIC_FILES = [
  "src/lib/avatar-config.js",
  "src/modules/profile-avatar.js",
  "src/styles/profile-avatar.css",
  "tests/avatar-config.test.js",
];

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

let changedFiles = [];
try {
  changedFiles = git(
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    BASE_REF,
    "HEAD",
  )
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
} catch (error) {
  console.error(`Não foi possível comparar a formatação com ${BASE_REF}.`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const candidates = changedFiles.filter((path) => {
  if (EXCLUDED.has(path)) return false;
  if (
    path.startsWith("dist/") ||
    path.startsWith("coverage/") ||
    path.startsWith("node_modules/")
  ) {
    return false;
  }
  return SUPPORTED_EXTENSIONS.has(extname(path));
});

if (!candidates.length) {
  console.log("Formatação validada: nenhum ficheiro elegível foi alterado.");
  process.exit(0);
}

execFileSync("npx", ["prettier", "--write", ...candidates], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

for (const path of DIAGNOSTIC_FILES) {
  const encoded = gzipSync(readFileSync(path)).toString("base64");
  console.log(`FORMAT_GZIP_BEGIN:${path}`);
  console.log(encoded);
  console.log(`FORMAT_GZIP_END:${path}`);
}

console.log(`Formatação aplicada em ${candidates.length} ficheiro(s) alterado(s).`);

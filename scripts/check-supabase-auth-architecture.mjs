import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = "src";
const EXTENSIONS = new Set([".js", ".mjs", ".ts", ".html"]);
const PATTERNS = [
  ["cliente via window.supabase", /window\.supabase\.createClient\s*\(/g],
  ["fluxo OAuth implícito", /flowType\s*:\s*["']implicit["']/g],
  ["detecção automática da sessão", /detectSessionInUrl\s*:\s*true/g]
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function baseContent(path) {
  try {
    return execFileSync("git", ["show", `origin/main:${path}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return "";
  }
}

const violations = [];
for (const file of walk(ROOT).filter((path) => EXTENSIONS.has(extname(path)))) {
  const path = relative(".", file).replaceAll("\\", "/");
  const current = readFileSync(file, "utf8");
  const base = baseContent(path);
  for (const [label, pattern] of PATTERNS) {
    const currentCount = [...current.matchAll(pattern)].length;
    const baseCount = [...base.matchAll(pattern)].length;
    if (currentCount > baseCount) {
      violations.push(`${path}: ${label} aumentou de ${baseCount} para ${currentCount}`);
    }
  }
}

if (violations.length) {
  console.error("Regressões na arquitetura Supabase Auth:");
  violations.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log("Arquitetura Supabase Auth validada contra origin/main.");

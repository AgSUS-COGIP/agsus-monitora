import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const DIST_DIR = "dist";
const violations = [];

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function report(file, rule, detail) {
  violations.push(`${relative(DIST_DIR, file)}: ${rule} (${detail})`);
}

if (!existsSync(DIST_DIR)) {
  console.error("Diretório dist não encontrado. Execute o build antes da validação.");
  process.exit(1);
}

const htmlFiles = walk(DIST_DIR).filter((file) => extname(file).toLowerCase() === ".html");

if (htmlFiles.length === 0) {
  console.error("Nenhum arquivo HTML encontrado no diretório dist.");
  process.exit(1);
}

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");

  if (/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/i.test(html)) {
    report(file, "Supabase por CDN", "use o cliente empacotado compartilhado");
  }

  if (/page_location\s*:\s*window\.location\.href/i.test(html)) {
    report(file, "telemetria com URL completa", "query string e hash não podem ser enviados");
  }

  const insecureResourcePattern = /(?:src|href)\s*=\s*["']http:\/\/[^"']+["']/gi;
  for (const match of html.matchAll(insecureResourcePattern)) {
    report(file, "recurso HTTP inseguro", match[0]);
  }
}

if (violations.length > 0) {
  console.error("Falha na validação de segurança do HTML gerado:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`HTML gerado validado: ${htmlFiles.length} arquivo(s) sem regressões conhecidas.`);

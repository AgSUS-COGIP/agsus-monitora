import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const DIST_DIR = "dist";
const SOURCE_HTML_FILES = ["index.html", "analises.html", "auth/callback.html"];
const violations = [];

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function report(label, rule, detail) {
  violations.push(`${label}: ${rule} (${detail})`);
}

function validateHtml(file, label, { checkAnalyticsUrl = true } = {}) {
  const html = readFileSync(file, "utf8");

  if (/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/i.test(html)) {
    report(label, "Supabase por CDN", "use o cliente empacotado compartilhado");
  }

  if (
    checkAnalyticsUrl &&
    /page_location\s*:\s*window\.location\.href/i.test(html)
  ) {
    report(
      label,
      "telemetria com URL completa",
      "query string e hash não podem ser enviados",
    );
  }

  const insecureResourcePattern =
    /(?:src|href)\s*=\s*["']http:\/\/[^"']+["']/gi;
  for (const match of html.matchAll(insecureResourcePattern)) {
    report(label, "recurso HTTP inseguro", match[0]);
  }
}

for (const file of SOURCE_HTML_FILES) {
  if (existsSync(file)) {
    validateHtml(file, `fonte/${file}`, { checkAnalyticsUrl: false });
  }
}

if (!existsSync(DIST_DIR)) {
  console.error(
    "Diretório dist não encontrado. Execute o build antes da validação.",
  );
  process.exit(1);
}

const htmlFiles = walk(DIST_DIR).filter(
  (file) => extname(file).toLowerCase() === ".html",
);

if (htmlFiles.length === 0) {
  console.error("Nenhum arquivo HTML encontrado no diretório dist.");
  process.exit(1);
}

for (const file of htmlFiles) {
  validateHtml(file, `dist/${relative(DIST_DIR, file)}`);
}

if (violations.length > 0) {
  console.error("Falha na validação de segurança dos documentos HTML:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `HTML validado: ${SOURCE_HTML_FILES.length} fonte(s) e ${htmlFiles.length} arquivo(s) gerado(s) sem regressões conhecidas.`,
);

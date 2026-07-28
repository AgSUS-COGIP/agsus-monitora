import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative } from "node:path";
import { gzipSync } from "node:zlib";

const DIST_DIR = "dist";
const KB = 1024;

const limits = {
  largestJsRaw: Number(process.env.BUNDLE_MAX_JS_RAW_KB || 2500) * KB,
  largestJsGzip: Number(process.env.BUNDLE_MAX_JS_GZIP_KB || 700) * KB,
  totalJsRaw: Number(process.env.BUNDLE_MAX_TOTAL_JS_RAW_KB || 6000) * KB,
  totalJsGzip: Number(process.env.BUNDLE_MAX_TOTAL_JS_GZIP_KB || 1800) * KB,
  totalCssRaw: Number(process.env.BUNDLE_MAX_TOTAL_CSS_RAW_KB || 1500) * KB,
  totalCssGzip: Number(process.env.BUNDLE_MAX_TOTAL_CSS_GZIP_KB || 300) * KB,
};

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = `${directory}/${name}`;
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function formatBytes(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`;
}

function summarize(files) {
  return files.map((path) => {
    const content = readFileSync(path);
    return {
      path: relative(DIST_DIR, path).replaceAll("\\", "/"),
      raw: content.byteLength,
      gzip: gzipSync(content, { level: 9 }).byteLength,
    };
  });
}

function total(entries, field) {
  return entries.reduce((sum, entry) => sum + entry[field], 0);
}

if (!existsSync(DIST_DIR)) {
  console.error("Orçamento de bundles não executado: a pasta dist não existe.");
  process.exit(1);
}

const files = walk(DIST_DIR);
const js = summarize(files.filter((path) => extname(path) === ".js"));
const css = summarize(files.filter((path) => extname(path) === ".css"));

if (!js.length) {
  console.error(
    "Orçamento de bundles não executado: nenhum JavaScript foi gerado em dist.",
  );
  process.exit(1);
}

const largestJsRaw = [...js].sort((a, b) => b.raw - a.raw)[0];
const largestJsGzip = [...js].sort((a, b) => b.gzip - a.gzip)[0];
const totals = {
  jsRaw: total(js, "raw"),
  jsGzip: total(js, "gzip"),
  cssRaw: total(css, "raw"),
  cssGzip: total(css, "gzip"),
};

console.log("Orçamento de bundles:");
console.log(
  `- JavaScript: ${js.length} ficheiro(s), ${formatBytes(totals.jsRaw)} bruto, ${formatBytes(totals.jsGzip)} gzip`,
);
console.log(
  `- Maior JS bruto: ${largestJsRaw.path} (${formatBytes(largestJsRaw.raw)})`,
);
console.log(
  `- Maior JS gzip: ${largestJsGzip.path} (${formatBytes(largestJsGzip.gzip)})`,
);
console.log(
  `- CSS: ${css.length} ficheiro(s), ${formatBytes(totals.cssRaw)} bruto, ${formatBytes(totals.cssGzip)} gzip`,
);

const violations = [];

if (largestJsRaw.raw > limits.largestJsRaw) {
  violations.push(
    `${largestJsRaw.path}: ${formatBytes(largestJsRaw.raw)} bruto; limite ${formatBytes(limits.largestJsRaw)}`,
  );
}
if (largestJsGzip.gzip > limits.largestJsGzip) {
  violations.push(
    `${largestJsGzip.path}: ${formatBytes(largestJsGzip.gzip)} gzip; limite ${formatBytes(limits.largestJsGzip)}`,
  );
}
if (totals.jsRaw > limits.totalJsRaw) {
  violations.push(
    `JavaScript total: ${formatBytes(totals.jsRaw)} bruto; limite ${formatBytes(limits.totalJsRaw)}`,
  );
}
if (totals.jsGzip > limits.totalJsGzip) {
  violations.push(
    `JavaScript total: ${formatBytes(totals.jsGzip)} gzip; limite ${formatBytes(limits.totalJsGzip)}`,
  );
}
if (totals.cssRaw > limits.totalCssRaw) {
  violations.push(
    `CSS total: ${formatBytes(totals.cssRaw)} bruto; limite ${formatBytes(limits.totalCssRaw)}`,
  );
}
if (totals.cssGzip > limits.totalCssGzip) {
  violations.push(
    `CSS total: ${formatBytes(totals.cssGzip)} gzip; limite ${formatBytes(limits.totalCssGzip)}`,
  );
}

if (violations.length) {
  console.error("Orçamento de bundles excedido:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log("Orçamento de bundles aprovado.");

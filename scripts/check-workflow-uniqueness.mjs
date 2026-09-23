import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const directory = join(".github", "workflows");
const files = readdirSync(directory).filter((file) =>
  [".yml", ".yaml"].includes(extname(file).toLowerCase()),
);
const names = new Map();
let failed = false;

for (const file of files) {
  const content = readFileSync(join(directory, file), "utf8");
  const match = content.match(/^name:\s*(.+)\s*$/m);
  if (!match) {
    console.error("Workflow sem nome: " + file);
    failed = true;
    continue;
  }

  const name = match[1]
    .replace(/^['\"]|['\"]$/g, "")
    .trim()
    .toLowerCase();
  const previous = names.get(name);
  if (previous) {
    console.error(
      "Nome de workflow duplicado: " + name + " em " + previous + " e " + file,
    );
    failed = true;
  } else {
    names.set(name, file);
  }
}

if (failed) process.exit(1);
console.log("Workflows validados: " + files.length + " nome(s) unico(s).");

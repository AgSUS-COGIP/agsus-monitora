import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
    ),
    "test",
    "tests/smoke.spec.js",
    // Specs a mais, depois de `--` (o CI passa tests/sessao-simulada.spec.js).
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_TARGET: "servidor" },
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);

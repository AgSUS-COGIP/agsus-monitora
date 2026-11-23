#!/usr/bin/env node
/*
  Roda a auditoria visual de responsividade e harmonia (diagnóstico, não
  trava): compila o app apontando para o Supabase simulado, passa o
  Playwright por todas as telas (tests/auditoria-visual.spec.js, com
  AUDITORIA=1) e monta o resumo (scripts/resumir-auditoria-visual.mjs).

    npm run auditoria:visual                       # tudo (~450 aberturas, alguns minutos)
    npm run auditoria:visual -- -g "editais"        # só o que casa com o filtro
    npm run auditoria:visual -- --sem-build         # reaproveita o dist/ simulado

  Saída em test-results/auditoria-visual/ (capturas, medicoes/*.json,
  resumo.md e resumo.json); nada disso vai para o Git, e a próxima rodada do
  Playwright (qualquer spec) apaga. Os argumentos que não
  são deste script vão para o Playwright (ex.: -c, -g, --workers).
  Relatório e plano: docs/_arquivo/auditoria-responsividade-e-harmonia-2026-11-23.md.
*/
import { spawnSync } from "node:child_process";

const argumentos = process.argv.slice(2);
const semBuild = argumentos.includes("--sem-build");
const doPlaywright = argumentos.filter((a) => a !== "--sem-build");

const rodar = (comando, args, env = {}) => {
  const r = spawnSync(comando, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  return r.status ?? 1;
};

if (!semBuild) {
  const status = rodar("npx", ["vite", "build"], {
    VITE_SUPABASE_URL: "https://teste.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "teste",
  });
  if (status !== 0) process.exit(status);
}
// Cada rodada começa limpa: o Playwright esvazia test-results/ ao começar.
const status = rodar(
  "npx",
  [
    "playwright",
    "test",
    "tests/auditoria-visual.spec.js",
    "--reporter=dot",
    ...doPlaywright,
  ],
  { AUDITORIA: "1", PLAYWRIGHT_DIST_PRONTO: "1" },
);
if (status !== 0)
  console.warn(
    `O Playwright saiu com ${status}: o resumo usa o que foi medido.`,
  );
process.exit(rodar("node", ["scripts/resumir-auditoria-visual.mjs"]));

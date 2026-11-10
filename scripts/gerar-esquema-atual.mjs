import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/*
  RETRATO DO SCHEMA (só leitura)

  As migrations já aplicadas saíram do repositório em 10/11/2026: o código vigente das funções
  do banco passou a existir só no banco. Este script grava em supabase/esquema-atual.sql o
  schema de produção (public, private, arquivo) e as tarefas do pg_cron, para que se leia e se
  pesquise o código vigente no repositório e para que o diff do retrato mostre, no PR, o que
  cada migration mudou.

  O retrato NÃO é migration e NÃO se aplica: nada recria o banco a partir dele.

  USO (depois de aplicar e registrar uma migration):

    npm run db:esquema

  Precisa do pg_dump (PostgreSQL 17: `winget install PostgreSQL.PostgreSQL.17`; no Windows ele
  é achado em C:\Program Files\PostgreSQL\*\bin) e de SUPABASE_DB_URL no ambiente ou no
  .env.local (Supabase › Connect › Session pooler). Só lê o banco.
*/

export const ARQUIVO_DO_RETRATO = "supabase/esquema-atual.sql";
export const SCHEMAS = ["public", "private", "arquivo"];

export const CABECALHO = `--
-- RETRATO DO SCHEMA DE PRODUÇÃO — SÓ LEITURA, NÃO APLICAR.
--
-- Gerado por \`npm run db:esquema\` (scripts/gerar-esquema-atual.mjs) a partir do banco, depois
-- de cada migration aplicada. Serve para ler e pesquisar o código vigente das funções e para o
-- diff do PR mostrar o que a migration mudou. Para mudar o banco, escreva uma migration.
--
`;

/*
  O que varia a cada execução sem mudança no banco sai, para o diff mostrar só o que mudou:
  a versão do pg_dump/servidor e a chave aleatória de \\restrict (pg_dump 17.6+).
*/
export function limparDump(texto) {
  return String(texto)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter(
      (linha) =>
        !/^\\(un)?restrict\b/.test(linha) &&
        !/^-- Dumped (from database|by pg_dump) version/.test(linha),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** As tarefas do pg_cron como texto estável (nome, agenda, ativa, comando), em ordem de nome. */
export function tarefasComoSql(linhas) {
  const tarefas = [...linhas].sort((a, b) => a.nome.localeCompare(b.nome));
  return [
    "-- Tarefas do pg_cron (cron.job), em ordem de nome: nome | agenda | ativa | comando.",
    ...tarefas.map(
      (t) =>
        `-- ${t.nome} | ${t.agenda} | ${t.ativa ? "ativa" : "parada"} | ${String(t.comando).replace(/\s+/g, " ").trim()}`,
    ),
  ].join("\n");
}

export function montarRetrato(dump, tarefas) {
  return `${CABECALHO}\n${limparDump(dump)}\n\n${tarefasComoSql(tarefas)}\n`;
}

function acharBinario(nome) {
  try {
    execFileSync(nome, ["--version"], { stdio: "ignore" });
    return nome;
  } catch {
    const raiz = "C:\\Program Files\\PostgreSQL";
    if (!existsSync(raiz)) return null;
    const versoes = readdirSync(raiz).sort(
      (a, b) => Number(b) - Number(a) || b.localeCompare(a),
    );
    for (const v of versoes) {
      const caminho = join(raiz, v, "bin", `${nome}.exe`);
      if (existsSync(caminho)) return caminho;
    }
    return null;
  }
}

function principal() {
  const url = process.env.SUPABASE_DB_URL || "";
  if (!url) {
    console.error(
      "SUPABASE_DB_URL não está no ambiente nem no .env.local.\n" +
        "Copie a URL em Supabase › Connect › Session pooler e rode:\n" +
        '  $env:SUPABASE_DB_URL = "<url>"; npm run db:esquema   (PowerShell)',
    );
    process.exit(1);
  }
  const pgDump = acharBinario("pg_dump");
  const psql = acharBinario("psql");
  if (!pgDump || !psql) {
    console.error(
      "pg_dump/psql não encontrados. Instale: winget install PostgreSQL.PostgreSQL.17",
    );
    process.exit(1);
  }
  const dump = execFileSync(
    pgDump,
    [
      url,
      "--schema-only",
      "--no-owner",
      ...SCHEMAS.map((s) => `--schema=${s}`),
    ],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const json = execFileSync(
    psql,
    [
      url,
      "-At",
      "-c",
      "select coalesce(json_agg(json_build_object('nome', jobname, 'agenda', schedule, 'ativa', active, 'comando', command)), '[]') from cron.job",
    ],
    { encoding: "utf8" },
  );
  const retrato = montarRetrato(dump, JSON.parse(json));
  writeFileSync(ARQUIVO_DO_RETRATO, retrato);
  console.log(
    `Retrato gravado em ${ARQUIVO_DO_RETRATO} (${retrato.split("\n").length} linhas). Confira o diff e commite junto com a migration.`,
  );
}

// Roda só quando chamado direto (o teste importa as funções puras).
if (
  String(process.argv[1] || "")
    .split("\\")
    .join("/")
    .endsWith("scripts/gerar-esquema-atual.mjs")
) {
  principal();
}

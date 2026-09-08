import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

/*
  Captura as definições reais das funções que existem no banco mas não têm
  migration neste repositório, e escreve uma migration de linha de base.

  POR QUE ISTO EXISTE
  Treze das vinte e três RPCs do contrato foram aplicadas manualmente. Elas
  funcionam, mas não estão versionadas: um ambiente novo sobe sem Configurações,
  Análises e Equipe Núcleo. O repositório não reconstrói o banco.

  A REGRA QUE ESTE SCRIPT EXISTE PARA CUMPRIR
  **Nenhuma função é escrita de memória.** O corpo vem de `pg_get_functiondef`,
  isto é, do próprio PostgreSQL. Reescrever uma função por aproximação apagaria
  trabalho que ninguém tem versionado em lugar algum — e o apagão só apareceria
  quando alguém notasse o comportamento diferente, semanas depois.

  USO
    SUPABASE_DB_URL=... node scripts/capturar-baseline-rpcs.mjs
    SUPABASE_DB_URL=... node scripts/capturar-baseline-rpcs.mjs --todas

  Sem `--todas`, captura apenas as funções do contrato que ainda não aparecem em
  nenhuma migration — que é o buraco a fechar. Com `--todas`, captura todas as
  funções do contrato.

  A sessão é somente-leitura. O script não aplica nada: escreve o ficheiro em
  `supabase/migrations/` para revisão humana antes de qualquer execução.
*/

const CONEXAO = process.env.SUPABASE_DB_URL || "";
if (!CONEXAO) {
  console.error(
    "SUPABASE_DB_URL não definida. Credencial de servidor/CI, nunca VITE_*.",
  );
  process.exit(2);
}

const todas = process.argv.includes("--todas");

const { CONTRATO_RPC } = await import(
  pathToFileURL(join(process.cwd(), "src/lib/rpc-contrato.js")).href
);

const { readdirSync, readFileSync } = await import("node:fs");
const sqlExistente = readdirSync("supabase/migrations")
  .map((f) => readFileSync(join("supabase/migrations", f), "utf8"))
  .join("\n");

const alvos = Object.keys(CONTRATO_RPC).filter(
  (nome) => todas || !sqlExistente.includes(`function public.${nome}`),
);

if (!alvos.length) {
  console.log("Nenhuma função pendente de reconciliação.");
  process.exit(0);
}

const cliente = new pg.Client({
  connectionString: CONEXAO,
  application_name: "capturar-baseline-rpcs",
});
await cliente.connect();

let definicoes = [];
let ausentes = [];
try {
  await cliente.query("set session characteristics as transaction read only");

  const { rows } = await cliente.query(
    `select p.proname                       as nome,
            pg_get_functiondef(p.oid)       as definicao,
            pg_get_function_identity_arguments(p.oid) as identidade,
            coalesce(
              (select string_agg(r.rolname, ', ' order by r.rolname)
               from pg_roles r
               where has_function_privilege(r.rolname, p.oid, 'EXECUTE')
                 and r.rolname in ('anon', 'authenticated', 'service_role')),
              ''
            ) as roles_com_execute
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any($1::text[])
     order by p.proname`,
    [alvos],
  );

  definicoes = rows;
  const encontradas = new Set(rows.map((r) => r.nome));
  ausentes = alvos.filter((n) => !encontradas.has(n));
} finally {
  await cliente.end();
}

if (!definicoes.length) {
  console.error(
    "Nenhuma definição capturada. Confira a conexão e os privilégios de leitura.",
  );
  process.exit(1);
}

const agora = new Date();
const carimbo =
  agora.getUTCFullYear().toString() +
  String(agora.getUTCMonth() + 1).padStart(2, "0") +
  String(agora.getUTCDate()).padStart(2, "0") +
  String(agora.getUTCHours()).padStart(2, "0") +
  String(agora.getUTCMinutes()).padStart(2, "0") +
  String(agora.getUTCSeconds()).padStart(2, "0");

const caminho = join(
  "supabase/migrations",
  `${carimbo}_baseline_funcoes_existentes.sql`,
);

const cabecalho = [
  "begin;",
  "",
  "-- ---------------------------------------------------------------------------",
  "-- Linha de base: funcoes que ja existiam no banco sem migration no repositorio.",
  "--",
  "-- GERADO por scripts/capturar-baseline-rpcs.mjs a partir de pg_get_functiondef.",
  "-- Nenhuma definicao foi escrita a mao. Rever antes de aplicar, mas nao reescrever",
  "-- corpo de funcao por aproximacao: o que esta aqui e o que o banco tem hoje.",
  "--",
  "-- IDEMPOTENTE: todas as definicoes usam `create or replace`. Aplicar num banco",
  "-- que ja as tem nao muda nada. Aplicar num ambiente novo o torna equivalente.",
  "--",
  "-- ROLLBACK: nao ha o que reverter num banco que ja tinha estas funcoes. Num",
  "-- ambiente novo, `drop function` de cada uma listada abaixo.",
  "--",
  `-- Funcoes capturadas: ${definicoes.length}`,
  ...definicoes.map(
    (d) =>
      `--   - public.${d.nome}(${d.identidade})  [EXECUTE: ${d.roles_com_execute || "nenhuma"}]`,
  ),
  ...(ausentes.length
    ? [
        "--",
        "-- NAO ENCONTRADAS no banco (rever):",
        ...ausentes.map((n) => `--   - ${n}`),
      ]
    : []),
  "-- ---------------------------------------------------------------------------",
  "",
].join("\n");

const corpo = definicoes
  .map((d) => {
    /*
      `pg_get_functiondef` devolve `CREATE OR REPLACE FUNCTION` já completo, com
      linguagem, volatilidade, `security definer` e `set search_path` — tudo como
      está no banco. Só falta o ponto e vírgula.
    */
    const def = d.definicao.trimEnd();
    return `${def}${def.endsWith(";") ? "" : ";"}\n`;
  })
  .join("\n");

const grants = definicoes
  .filter((d) => d.roles_com_execute)
  .map((d) =>
    d.roles_com_execute
      .split(", ")
      .map(
        (role) =>
          `grant execute on function public.${d.nome}(${d.identidade}) to ${role};`,
      )
      .join("\n"),
  )
  .join("\n");

writeFileSync(
  caminho,
  `${cabecalho}${corpo}\n-- Concessoes tal como estao no banco hoje.\n${grants}\n\ncommit;\n`,
);

console.log(`Capturadas ${definicoes.length} função(ões) em ${caminho}`);
if (ausentes.length) {
  console.warn(`Não encontradas no banco: ${ausentes.join(", ")}`);
}
console.log("Rever o ficheiro antes de aplicar. Nada foi executado no banco.");

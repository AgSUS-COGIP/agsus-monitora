#!/usr/bin/env node
/*
  Mede o custo real de `vw_monitoramento_indigena_operacional` antes de qualquer
  proposta de reescrita.

  Por que um script e nao um punhado de queries soltas: a comparacao so vale se
  o "antes" e o "depois" forem colhidos do mesmo jeito, na mesma sessao, com o
  mesmo aquecimento de cache. Buffers sobretudo — a primeira execucao le do
  disco e a segunda le da memoria, e comparar uma com a outra inventa um ganho
  que nao existe.

  Credencial de servidor, nunca `VITE_*`: tudo com esse prefixo entra no bundle
  Vite e viaja para o navegador de quem abre a pagina.

    SUPABASE_DB_URL="postgresql://..." node scripts/medir-cronograma.mjs

  A sessao e somente-leitura. O script nao cria, nao altera e nao apaga nada.
*/
import { writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const URL_DO_BANCO = process.env.SUPABASE_DB_URL;
if (!URL_DO_BANCO) {
  console.error(
    "SUPABASE_DB_URL ausente. Use uma credencial de servidor, somente leitura.",
  );
  process.exit(1);
}

const VIEW = "vw_monitoramento_indigena_operacional";
const FUNCAO = "get_monitoramento_cronograma_estado";
const TABELA = "TB_CRONOGRAMA_MONIT_INDIG";
const DESTINO = process.argv[2] || "docs/medicoes";
const ROTULO = process.env.ROTULO_DA_MEDICAO || "antes";
const REPETICOES = Number(process.env.REPETICOES || 3);

const cliente = new pg.Client({ connectionString: URL_DO_BANCO });

async function ler(sql, params = []) {
  const { rows } = await cliente.query(sql, params);
  return rows;
}

async function main() {
  await cliente.connect();
  await cliente.query("set session characteristics as transaction read only");

  const relatorio = [];
  const anota = (titulo, corpo) => {
    relatorio.push(`\n## ${titulo}\n\n${corpo}\n`);
    console.log(`\n== ${titulo}`);
  };

  /* 1. As definicoes reais. Nenhuma delas esta versionada no repositorio. */
  const defView = await ler(
    "select pg_get_viewdef($1::regclass, true) as sql",
    [VIEW],
  );
  anota(
    `Definicao de ${VIEW}`,
    "```sql\n" + (defView[0]?.sql || "(nao encontrada)") + "\n```",
  );

  const defFuncao = await ler(
    `select p.oid::regprocedure::text as assinatura,
            pg_get_functiondef(p.oid) as sql,
            p.provolatile, p.proparallel, p.procost
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1`,
    [FUNCAO],
  );
  anota(
    `Definicao de ${FUNCAO}`,
    defFuncao
      .map(
        (f) =>
          `- assinatura: \`${f.assinatura}\`\n` +
          `- volatilidade: \`${f.provolatile}\` (i=immutable, s=stable, v=volatile)\n` +
          `- paralelismo: \`${f.proparallel}\`  custo declarado: \`${f.procost}\`\n\n` +
          "```sql\n" +
          f.sql +
          "\n```",
      )
      .join("\n\n") || "(nao encontrada)",
  );

  /* 2. Volume e indices — o "94 processos" precisa ser conferido, nao assumido. */
  const volume = await ler(
    `select (select count(*) from public.${VIEW}) as linhas_view,
            (select count(*) from public.${TABELA}) as linhas_cronograma`,
  );
  const indices = await ler(
    "select indexname, indexdef from pg_indexes where schemaname='public' and tablename=$1",
    [TABELA],
  );
  anota(
    "Volume e indices",
    `- linhas na view: **${volume[0]?.linhas_view}**\n` +
      `- linhas em ${TABELA}: **${volume[0]?.linhas_cronograma}**\n\n` +
      "Indices:\n" +
      (indices.length
        ? indices.map((i) => `- \`${i.indexdef}\``).join("\n")
        : "- nenhum alem da chave primaria"),
  );

  /*
    3. EXPLAIN (ANALYZE, BUFFERS).

    A primeira execucao aquece o cache e e descartada; as seguintes e que valem.
    Sem isso, "antes" mede disco e "depois" mede memoria.
  */
  await ler(`select count(*) from public.${VIEW}`);

  const execucoes = [];
  for (let i = 0; i < REPETICOES; i += 1) {
    const linhas = await ler(
      `explain (analyze, buffers, format json) select * from public.${VIEW}`,
    );
    const plano = linhas[0]["QUERY PLAN"][0];
    execucoes.push({
      tempo_ms: plano["Execution Time"],
      planejamento_ms: plano["Planning Time"],
      linhas: plano.Plan["Actual Rows"],
      shared_hit: plano.Plan["Shared Hit Blocks"] ?? 0,
      shared_read: plano.Plan["Shared Read Blocks"] ?? 0,
    });
  }

  const mediana = (valores) => {
    const ordenado = [...valores].sort((a, b) => a - b);
    return ordenado[Math.floor(ordenado.length / 2)];
  };

  anota(
    `Custo de \`select * from ${VIEW}\` (${ROTULO})`,
    `| execucao | tempo (ms) | linhas | shared hit | shared read |\n` +
      `|---|---|---|---|---|\n` +
      execucoes
        .map(
          (e, i) =>
            `| ${i + 1} | ${e.tempo_ms.toFixed(1)} | ${e.linhas} | ${e.shared_hit} | ${e.shared_read} |`,
        )
        .join("\n") +
      `\n\n**mediana: ${mediana(execucoes.map((e) => e.tempo_ms)).toFixed(1)} ms** ` +
      `| buffers (hit+read) mediana: ${mediana(execucoes.map((e) => e.shared_hit + e.shared_read))}`,
  );

  /* 4. Quantas vezes a funcao PL/pgSQL e chamada por leitura da view. */
  const plano = await ler(
    `explain (analyze, buffers, format json) select * from public.${VIEW}`,
  );
  const texto = JSON.stringify(plano[0]["QUERY PLAN"]);
  const chamadas = (texto.match(new RegExp(FUNCAO, "g")) || []).length;
  anota(
    "Chamadas por linha",
    `A funcao \`${FUNCAO}\` aparece ${chamadas} vez(es) no plano. ` +
      `Num \`cross join lateral\`, o executor a invoca **uma vez por linha** da ` +
      `relacao externa — com ${volume[0]?.linhas_view} linhas, sao ` +
      `${volume[0]?.linhas_view} invocacoes independentes, cada uma abrindo suas ` +
      `proprias consultas a \`${TABELA}\`.`,
  );

  /*
    5. Linha de base de equivalencia.

    Qualquer reescrita tem de devolver exatamente isto. O hash por linha permite
    comparar antes/depois sem despejar a tabela inteira no relatorio.
  */
  const colunas = await ler(
    `select column_name, data_type from information_schema.columns
      where table_schema='public' and table_name=$1 order by ordinal_position`,
    [VIEW],
  );
  const assinatura = await ler(
    `select md5(string_agg(t.linha, '|' order by t.linha)) as hash, count(*) as linhas
       from (select md5(v.*::text) as linha from public.${VIEW} v) t`,
  );
  anota(
    "Linha de base de equivalencia",
    `Colunas (${colunas.length}):\n` +
      colunas.map((c) => `- \`${c.column_name}\` (${c.data_type})`).join("\n") +
      `\n\n**hash do conteudo: \`${assinatura[0]?.hash}\`** sobre ${assinatura[0]?.linhas} linhas.\n\n` +
      "Uma reescrita so esta aprovada se reproduzir este hash. Ele cobre todas as " +
      "colunas — status, etapa, percentual, proxima atividade e datas incluidas.",
  );

  mkdirSync(DESTINO, { recursive: true });
  const caminho = `${DESTINO}/cronograma-${ROTULO}.md`;
  writeFileSync(
    caminho,
    `# Medicao do cronograma — ${ROTULO}\n\n` +
      `Colhido em ${new Date().toISOString()} por \`scripts/medir-cronograma.mjs\`.\n` +
      relatorio.join(""),
    "utf8",
  );
  console.log(`\nRelatorio gravado em ${caminho}`);
}

main()
  .catch((erro) => {
    console.error("Falha na medicao:", erro.message);
    process.exitCode = 1;
  })
  .finally(() => cliente.end());

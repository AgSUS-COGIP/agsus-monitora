#!/usr/bin/env node
/*
  Exporta, ANTES da correção supabase/correcoes/20261023-compactar-retratos-do-rascunho.sql,
  os retratos dos rascunhos (DS_RETRATO das linhas SALVAR de
  public."TH_FICHA_ANALISE") que a correção vai zerar, para um arquivo
  JSONL compactado (.jsonl.gz) fora do banco. O plano FREE do Supabase não tem
  backup: o arquivo é o que torna a limpeza reversível para consulta.

  - A lista do que sai é lida da própria correção (o trecho entre
    "-- >>> regra" e "-- <<< regra"): uma regra, um lugar.
  - Só SELECT, em lotes (padrão 500) pela chave CO_HISTORICO_FICHA.
  - Cada linha: CO_HISTORICO_FICHA, CO_FICHA_ANALISE, NU_VERSAO, TP_ACAO,
    DT_REGISTRO, CO_USUARIO e DS_RETRATO (como o banco serializa).
  - No fim: linhas, tamanho, sha256 e a linha a colar antes da correção:
      set monitora.exportacao_retratos = '<linhas>:<sha256>';

  Conexão (a primeira que existir no ambiente):
    SUPABASE_DB_URL                      → psql (como estado-das-migrations.mjs)
    SUPABASE_ACCESS_TOKEN (ou _NOVO) +
    SUPABASE_PROJECT_REF                 → Management API (/database/query)

  Uso:
    node --env-file=.env.local scripts/arquivo/exportar-retratos-do-rascunho.mjs --saida=retratos-do-rascunho-AAAAMMDD.jsonl.gz [--lote=500]
    node scripts/arquivo/exportar-retratos-do-rascunho.mjs --ler=<arquivo> [--ficha=<uuid>] [--sha256=<sha>]
      (só lê o arquivo: confere o sha256 e mostra os retratos da ficha, em ordem)
*/
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  readFileSync,
  rmSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { once } from "node:events";
import { createGunzip, createGzip } from "node:zlib";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const CORRECAO = resolve(
  RAIZ,
  "supabase/correcoes/20261023-compactar-retratos-do-rascunho.sql",
);

/** O SELECT dos ids que a correção zera (entre os marcadores, sem ";"). */
export function extrairRegra(textoDaCorrecao) {
  const texto = textoDaCorrecao.replace(/\r\n/g, "\n");
  const ini = texto.indexOf("-- >>> regra\n");
  const fim = texto.indexOf("-- <<< regra\n");
  if (ini < 0 || fim < ini)
    throw new Error("Regra não encontrada na correção.");
  const regra = texto.slice(ini + "-- >>> regra\n".length, fim).trim();
  if (!/^select\b/i.test(regra) || regra.includes(";"))
    throw new Error("A regra tem de ser um SELECT sem ponto e vírgula.");
  return regra;
}

/** Um lote: as linhas da regra com chave maior que `depoisDe`, em ordem. */
export function consultaDoLote(regra, depoisDe, tamanho) {
  const depois = Number(depoisDe);
  const lote = Number(tamanho);
  if (!Number.isSafeInteger(depois) || depois < 0)
    throw new Error("Chave inválida.");
  if (!Number.isSafeInteger(lote) || lote < 1 || lote > 5000)
    throw new Error("Lote de 1 a 5000.");
  return `select json_build_object(
         'CO_HISTORICO_FICHA', h."CO_HISTORICO_FICHA", 'CO_FICHA_ANALISE', h."CO_FICHA_ANALISE",
         'NU_VERSAO', h."NU_VERSAO", 'TP_ACAO', h."TP_ACAO", 'DT_REGISTRO', h."DT_REGISTRO",
         'CO_USUARIO', h."CO_USUARIO", 'DS_RETRATO', h."DS_RETRATO")::text as linha
  from public."TH_FICHA_ANALISE" h
 where h."CO_HISTORICO_FICHA" > ${depois}
   and h."CO_HISTORICO_FICHA" in (
${regra}
       )
 order by h."CO_HISTORICO_FICHA"
 limit ${lote}`;
}

/** sha256 (hex) de um arquivo. */
export async function sha256DoArquivo(caminho) {
  const hash = createHash("sha256");
  for await (const parte of createReadStream(caminho)) hash.update(parte);
  return hash.digest("hex");
}

/**
 * Exporta em lotes. `consultar(sql)` devolve as linhas do lote como texto
 * JSON (uma por linha da tabela). Devolve { linhas, bytes, sha256 }.
 */
export async function exportar({ consultar, regra, saida, lote = 500 }) {
  const gzip = createGzip({ level: 9 });
  const arquivo = createWriteStream(saida);
  gzip.pipe(arquivo);
  let depoisDe = 0;
  let linhas = 0;
  try {
    for (;;) {
      const lidas = await consultar(consultaDoLote(regra, depoisDe, lote));
      for (const texto of lidas) {
        const chave = Number(JSON.parse(texto).CO_HISTORICO_FICHA);
        if (!(chave > depoisDe)) throw new Error("Lote fora de ordem.");
        depoisDe = chave;
        if (!gzip.write(`${texto}\n`)) await once(gzip, "drain");
        linhas += 1;
      }
      if (lidas.length < lote) break;
    }
  } catch (erro) {
    // Arquivo pela metade não serve: fecha e apaga.
    const fechado = once(arquivo, "close");
    gzip.destroy();
    arquivo.destroy();
    await fechado;
    rmSync(saida, { force: true });
    throw erro;
  }
  gzip.end();
  await once(arquivo, "finish");
  const bytes = arquivo.bytesWritten;
  return { linhas, bytes, sha256: await sha256DoArquivo(saida) };
}

/** Lê o arquivo exportado: cada linha como objeto (opcionalmente de uma ficha). */
export async function lerExportacao(caminho, { ficha } = {}) {
  const linhas = [];
  const leitor = createInterface({
    input: createReadStream(caminho).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const texto of leitor) {
    if (!texto.trim()) continue;
    const linha = JSON.parse(texto);
    if (!ficha || linha.CO_FICHA_ANALISE === ficha) linhas.push(linha);
  }
  return linhas;
}

export const linhaDaCorrecao = ({ linhas, sha256 }) =>
  `set monitora.exportacao_retratos = '${linhas}:${sha256}';`;

/* ── conexão (só no uso de verdade; os testes injetam `consultar`) ───────── */

async function consultorDoAmbiente() {
  const url = process.env.SUPABASE_DB_URL;
  if (url) {
    const { execFileSync } = await import("node:child_process");
    return async (sql) =>
      execFileSync("psql", [url, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      })
        .split("\n")
        .filter((l) => l.trim());
  }
  const token =
    process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN_NOVO;
  const projeto = process.env.SUPABASE_PROJECT_REF;
  if (token && projeto) {
    return async (sql) => {
      const r = await fetch(
        `https://api.supabase.com/v1/projects/${projeto}/database/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: sql, read_only: true }),
        },
      );
      const corpo = await r.json();
      if (!r.ok || !Array.isArray(corpo))
        throw new Error(`Consulta recusada: ${JSON.stringify(corpo)}`);
      return corpo.map((l) => l.linha);
    };
  }
  throw new Error(
    "Defina SUPABASE_DB_URL ou SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF.",
  );
}

function argumento(nome) {
  const a = process.argv.slice(2).find((x) => x.startsWith(`--${nome}=`));
  return a ? a.slice(nome.length + 3) : undefined;
}

async function principal() {
  const ler = argumento("ler");
  if (ler) {
    const sha = await sha256DoArquivo(ler);
    const esperado = argumento("sha256");
    console.log(
      `sha256 ${sha}${esperado ? (esperado === sha ? " (confere)" : " (NÃO confere!)") : ""}`,
    );
    const ficha = argumento("ficha");
    const linhas = await lerExportacao(ler, { ficha });
    if (!ficha) {
      console.log(`${linhas.length} retratos no arquivo.`);
      return;
    }
    for (const l of linhas) {
      console.log(
        `\n# histórico ${l.CO_HISTORICO_FICHA} · versão ${l.NU_VERSAO} · ${l.TP_ACAO} · ${l.DT_REGISTRO} · ${l.CO_USUARIO}`,
      );
      console.log(JSON.stringify(l.DS_RETRATO, null, 2));
    }
    console.log(`\n${linhas.length} retratos da ficha ${ficha}.`);
    return;
  }
  const saida = argumento("saida");
  if (!saida)
    throw new Error("Informe --saida=<arquivo>.jsonl.gz (ou --ler=…).");
  const regra = extrairRegra(readFileSync(CORRECAO, "utf8"));
  const consultar = await consultorDoAmbiente();
  const r = await exportar({
    consultar,
    regra,
    saida,
    lote: Number(argumento("lote") || 500),
  });
  console.log(`linhas  ${r.linhas}`);
  console.log(`tamanho ${r.bytes} bytes`);
  console.log(`sha256  ${r.sha256}`);
  console.log("\nCole como primeira linha, antes do begin da correção:");
  console.log(linhaDaCorrecao(r));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  principal().catch((erro) => {
    console.error(erro.message || erro);
    process.exit(1);
  });
}

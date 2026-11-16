/*
  CARREGAR ADMISSÕES CONCILIADAS: PLANILHAS DE CONCILIAÇÃO (.xlsx) -> SUPABASE

  Por que existe: a data de admissão não está no banco do Yeendé. Ela está nas
  planilhas de conciliação com o RH (Saúde Indígena, Sede e Projetos), aba
  "Vínculos conciliados": um vínculo por linha, com o edital ("Processo ID"),
  a linha da lista de aprovados ("Linha origem ID") e as datas de admissão e
  de desligamento do Impacto, sem nome, CPF nem matrícula. A Visão geral mostra
  a 1ª e a última admissão de cada edital (migration 20261113210000).

  A carga é o retrato inteiro: passe as três planilhas juntas. O que não vier
  sai da tabela (public.carregar_admissoes_conciliadas).

  Uso (baixe as planilhas do Drive como .xlsx)
    node scripts/carregar-admissoes-conciliadas.mjs --seco a.xlsx b.xlsx c.xlsx
        só lê e mostra o resumo
    node --env-file=.env.local scripts/carregar-admissoes-conciliadas.mjs a.xlsx b.xlsx c.xlsx
        lê e grava no banco de SUPABASE_DB_URL (não rode contra produção sem
        pedido explícito)

  Saída: 0 concluída; 1 erro.
*/
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

export const ABA = "Vínculos conciliados";

/* ── Leitura do .xlsx (zip + XML), sem dependência ───────────────────── */

/** Os arquivos de dentro do zip: nome → conteúdo (texto). */
export function arquivosDoZip(buffer) {
  let fim = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65_557);
    i--
  )
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      fim = i;
      break;
    }
  if (fim < 0) throw new Error("Não é um arquivo .xlsx (zip sem diretório).");
  const total = buffer.readUInt16LE(fim + 10);
  let p = buffer.readUInt32LE(fim + 16);
  const arquivos = new Map();
  for (let n = 0; n < total; n++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50)
      throw new Error("Diretório do zip inválido.");
    const metodo = buffer.readUInt16LE(p + 10);
    const tamanho = buffer.readUInt32LE(p + 20);
    const nomeTam = buffer.readUInt16LE(p + 28);
    const extraTam = buffer.readUInt16LE(p + 30);
    const comentarioTam = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const nome = buffer.toString("utf8", p + 46, p + 46 + nomeTam);
    const inicio =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    const dados = buffer.subarray(inicio, inicio + tamanho);
    if (metodo === 0 || metodo === 8)
      arquivos.set(
        nome,
        (metodo === 8 ? inflateRawSync(dados) : dados).toString("utf8"),
      );
    p += 46 + nomeTam + extraTam + comentarioTam;
  }
  return arquivos;
}

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodificar = (texto) =>
  texto.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (todo, e) =>
    e[0] === "#"
      ? String.fromCodePoint(
          e[1] === "x" || e[1] === "X"
            ? parseInt(e.slice(2), 16)
            : Number(e.slice(1)),
        )
      : (ENTIDADES[e] ?? todo),
  );
const textoDosT = (xml) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => decodificar(m[1]))
    .join("");

/** As abas do .xlsx: nome → linhas (cada linha: { A: "…", B: "…" }). */
export function abasDoXlsx(buffer) {
  const arquivos = arquivosDoZip(buffer);
  const compartilhados = [
    ...(arquivos.get("xl/sharedStrings.xml") || "").matchAll(
      /<si>([\s\S]*?)<\/si>/g,
    ),
  ].map((m) => textoDosT(m[1]));
  const alvos = new Map(
    [
      ...(arquivos.get("xl/_rels/workbook.xml.rels") || "").matchAll(
        /<Relationship\b[^>]*>/g,
      ),
    ].map((m) => [
      m[0].match(/\bId="([^"]+)"/)?.[1],
      m[0].match(/\bTarget="([^"]+)"/)?.[1],
    ]),
  );
  const abas = new Map();
  for (const m of (arquivos.get("xl/workbook.xml") || "").matchAll(
    /<sheet\b[^>]*>/g,
  )) {
    const nome = decodificar(m[0].match(/\bname="([^"]*)"/)?.[1] || "");
    const alvo = alvos.get(m[0].match(/\br:id="([^"]+)"/)?.[1]) || "";
    const caminho = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo}`;
    const xml = arquivos.get(caminho);
    if (!xml) continue;
    const linhas = [];
    for (const linha of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const celulas = {};
      for (const c of linha[1].matchAll(
        /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
      )) {
        const coluna = c[1].match(/\br="([A-Z]+)\d+"/)?.[1];
        if (!coluna) continue;
        const tipo = c[1].match(/\bt="([^"]+)"/)?.[1];
        const v = c[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        celulas[coluna] =
          tipo === "s"
            ? (compartilhados[Number(v)] ?? "")
            : tipo === "inlineStr"
              ? textoDosT(c[2] || "")
              : decodificar(v ?? "");
      }
      linhas.push(celulas);
    }
    abas.set(nome, linhas);
  }
  return abas;
}

/* ── Da aba às linhas da carga ───────────────────────────────────────── */

const COLUNAS = {
  vinculo: "Token de vínculo",
  admissao: "Data de admissão",
  desligamento: "Data de desligamento",
  edital: "Processo ID",
  linha: "Linha origem ID",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "AAAA-MM-DD", "DD/MM/AAAA" ou o número de série do Excel → "AAAA-MM-DD"; senão "". */
export function dataDaCelula(valor) {
  const texto = String(valor ?? "").trim();
  let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{5}(\.\d+)?$/.test(texto)) {
    const dia = new Date(
      Date.UTC(1899, 11, 30) + Math.floor(Number(texto)) * 86_400_000,
    );
    return dia.toISOString().slice(0, 10);
  }
  return "";
}

/**
 * As linhas da aba "Vínculos conciliados" prontas para a carga. O cabeçalho é
 * achado pelo nome das colunas (a aba tem título e nota antes dele). Linha sem
 * token, edital ou data de admissão válida é contada em `ignoradas`.
 */
export function vinculosDaAba(linhas) {
  const indice = linhas.findIndex((l) =>
    Object.values(l).includes(COLUNAS.vinculo),
  );
  if (indice < 0)
    throw new Error(`A aba "${ABA}" não tem a coluna "${COLUNAS.vinculo}".`);
  const cabecalho = linhas[indice];
  const coluna = {};
  for (const [campo, rotulo] of Object.entries(COLUNAS)) {
    coluna[campo] = Object.keys(cabecalho).find((c) => cabecalho[c] === rotulo);
    if (!coluna[campo] && campo !== "desligamento" && campo !== "linha")
      throw new Error(`A aba "${ABA}" não tem a coluna "${rotulo}".`);
  }
  const vinculos = [];
  let ignoradas = 0;
  for (const l of linhas.slice(indice + 1)) {
    const vinculo = String(l[coluna.vinculo] ?? "")
      .trim()
      .toLowerCase();
    const edital = String(l[coluna.edital] ?? "").trim();
    const linha = String(l[coluna.linha] ?? "").trim();
    const admissao = dataDaCelula(l[coluna.admissao]);
    const desligamento = dataDaCelula(l[coluna.desligamento]);
    if (!vinculo && !edital && !admissao) continue;
    if (!/^[0-9a-f]{8,40}$/.test(vinculo) || !UUID.test(edital) || !admissao) {
      ignoradas++;
      continue;
    }
    vinculos.push({
      vinculo,
      edital,
      linha: UUID.test(linha) ? linha : null,
      admissao,
      desligamento: desligamento || null,
    });
  }
  return { vinculos, ignoradas };
}

/** Junta as planilhas; o mesmo token com dados diferentes é erro. */
export function juntarVinculos(listas) {
  const porToken = new Map();
  for (const lista of listas)
    for (const v of lista) {
      const antes = porToken.get(v.vinculo);
      if (antes && JSON.stringify(antes) !== JSON.stringify(v))
        throw new Error(`O vínculo ${v.vinculo} aparece com dados diferentes.`);
      porToken.set(v.vinculo, v);
    }
  return [...porToken.values()];
}

/* ── Execução ────────────────────────────────────────────────────────── */

async function principal(argumentos) {
  const seco = argumentos.includes("--seco");
  const arquivos = argumentos.filter((a) => !a.startsWith("--"));
  if (!arquivos.length)
    throw new Error("Passe as planilhas de conciliação (.xlsx).");
  const listas = [];
  for (const arquivo of arquivos) {
    const aba = abasDoXlsx(readFileSync(resolve(arquivo))).get(ABA);
    if (!aba) throw new Error(`${basename(arquivo)} não tem a aba "${ABA}".`);
    const { vinculos, ignoradas } = vinculosDaAba(aba);
    console.log(
      `${basename(arquivo)}: ${vinculos.length} vínculos` +
        (ignoradas ? ` (${ignoradas} linhas ignoradas)` : ""),
    );
    listas.push(vinculos);
  }
  const vinculos = juntarVinculos(listas);
  const editais = new Set(vinculos.map((v) => v.edital)).size;
  console.log(`Total: ${vinculos.length} vínculos de ${editais} editais.`);
  if (seco) return 0;

  const url = process.env.SUPABASE_DB_URL;
  if (!url)
    throw new Error("Falta SUPABASE_DB_URL (rode com --env-file=.env.local).");
  const require = createRequire(import.meta.url);
  const { Client } = require("pg");
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    const carga = `conciliacao-${new Date().toISOString().slice(0, 10)}`;
    const { rows } = await cliente.query(
      "select public.carregar_admissoes_conciliadas($1, $2::jsonb) as r",
      [carga, JSON.stringify(vinculos)],
    );
    const r = rows[0].r;
    console.log(
      `Banco: ${r.gravadas} gravadas ou mudadas, ${r.removidas} removidas, ` +
        `${r.sem_edital} de edital inexistente; ${r.total} na tabela.`,
    );
  } finally {
    await cliente.end();
  }
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  principal(process.argv.slice(2)).then(
    (codigo) => process.exit(codigo),
    (erro) => {
      console.error(erro?.message || erro);
      process.exit(1);
    },
  );
}

/*
  Parecer sob demanda e município/UF de Análises curriculares (src/modulos/analises/).

  Desde 20260928200000 o payload da lista não traz o parecer (`analise`): ele
  era ~70% do payload da Saúde Indígena e nenhuma parte da lista o mostra. O
  front busca o parecer quando precisa dele:
    - de uma linha, ao abrir o detalhamento (`get_analise_detalhe_do_painel`);
    - de todas as linhas do escopo, em lote, para o CSV e para a busca geral
      (`get_analises_texto_do_painel`).
  Linha que já traz a chave `analise` (o filtrado dos escopos Inativo/Todos, o
  fallback pela view, o cache antigo) não precisa de nada.

  Município/UF: fora da Saúde Indígena, a vaga de Projetos diz onde fica a UBS
  móvel ("… UBS móvel Seropédica/RJ …"). O payload já manda `municipio_uf`;
  as linhas que vêm de outro caminho são lidas do nome da vaga com a mesma
  expressão da RPC.
*/
import { ehAreaSaudeIndigena } from "./area-do-painel-de-analises.js";

const texto = (valor) => String(valor ?? "").trim();

/* A mesma expressão de 20260928200000 (regexp_match no Postgres). */
const PADRAO_DA_UBS_MOVEL = /UBS m[óo]vel ([^/]+)\/([A-Z]{2})/;

/** "… UBS móvel Seropédica/RJ …" → "Seropédica/RJ"; sem UBS móvel, null. */
export function municipioUfDaVaga(nomeDaVaga) {
  const partes = String(nomeDaVaga ?? "").match(PADRAO_DA_UBS_MOVEL);
  if (!partes) return null;
  const municipio = partes[1].trim();
  return municipio ? `${municipio}/${partes[2]}` : null;
}

/** Município/UF da linha: o do payload ou, sem ele, o do nome da vaga. Na Saúde Indígena, sempre null. */
export function municipioUfDaLinha(linha, area) {
  if (ehAreaSaudeIndigena(area)) return null;
  const doPayload = texto(linha?.municipio_uf);
  if (doPayload) return doPayload;
  return municipioUfDaVaga(linha?.nome_vaga);
}

/** A linha veio sem o parecer (payload leve) e ele precisa ser buscado? */
export function linhaSemParecer(linha) {
  return Boolean(
    linha &&
    typeof linha === "object" &&
    !Object.prototype.hasOwnProperty.call(linha, "analise"),
  );
}

/** Alguma linha da lista ainda está sem o parecer? */
export function haLinhasSemParecer(linhas) {
  return Array.isArray(linhas) && linhas.some(linhaSemParecer);
}

/*
  `{ columns: ["id", "analise", "link_pdf", …], rows: [[id, …], …] }` →
  Map(id → { analise, link_pdf, … }): as colunas pelo nome, menos o id.
*/
export function mapaDosTextos(payload) {
  const mapa = new Map();
  const colunas = Array.isArray(payload?.columns) ? payload.columns : [];
  const linhas = Array.isArray(payload?.rows) ? payload.rows : [];
  const posId = colunas.indexOf("id");
  if (posId < 0 || !colunas.includes("analise")) return mapa;
  linhas.forEach((valores) => {
    if (!Array.isArray(valores)) return;
    const id = texto(valores[posId]);
    if (!id) return;
    const campos = {};
    colunas.forEach((coluna, pos) => {
      if (pos !== posId) campos[coluna] = valores[pos] ?? null;
    });
    mapa.set(id, campos);
  });
  return mapa;
}

/*
  Põe o parecer (e o que mais veio junto: link do PDF, experiência) nas linhas
  que vieram sem ele. A linha que não está no mapa não tem parecer no banco:
  fica com `analise: null`, como no payload antigo. Campo que a linha já tem
  não é trocado. Devolve as linhas alteradas (as mesmas referências), para o
  chamador refazer o que depende do texto (a busca).
*/
export function mesclarTextos(linhas, mapa) {
  const alteradas = [];
  if (!Array.isArray(linhas) || !(mapa instanceof Map)) return alteradas;
  linhas.forEach((linha) => {
    if (!linhaSemParecer(linha)) return;
    const campos = mapa.get(texto(linha.id)) || {};
    Object.entries(campos).forEach(([coluna, valor]) => {
      if (!Object.prototype.hasOwnProperty.call(linha, coluna))
        linha[coluna] = valor;
    });
    if (!Object.prototype.hasOwnProperty.call(linha, "analise"))
      linha.analise = null;
    alteradas.push(linha);
  });
  return alteradas;
}

/** O parecer que o detalhe devolveu (`{ id, analise, … }`), ou null. */
export function parecerDoDetalhe(payload) {
  const dados = Array.isArray(payload) ? payload[0] : payload;
  if (!dados || typeof dados !== "object") return null;
  return dados.analise ?? null;
}

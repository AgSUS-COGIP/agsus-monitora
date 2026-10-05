/*
  Nota declarada: a ART (nota do questionário da Empregare, "x/30") recalculada
  pela regra a partir das respostas, só para CONFERIR a ART — divergência vira
  aviso; a ordem da Provisória continua pela ART. Sem DOM e sem estado.

  As perguntas são achadas pelo começo do nome da coluna ("Pergunta 15 -"),
  sem diferença de acento e de caixa: a numeração muda de questionário para
  questionário, por isso a regra liga pelo enunciado, por edital.
*/

const lista = (v) => (Array.isArray(v) ? v : []);
const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Texto comparável: sem acento, minúsculo, espaços simples. */
export function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** A coluna das respostas cujo nome começa pelo enunciado da regra. */
export function colunaDaPergunta(respostas, pergunta) {
  const alvo = normalizarTexto(pergunta);
  if (!alvo) return null;
  return (
    Object.keys(respostas ?? {}).find((coluna) =>
      normalizarTexto(coluna).startsWith(alvo),
    ) ?? null
  );
}

function valorDoMapa(mapa, resposta) {
  const alvo = normalizarTexto(resposta);
  const chave = Object.keys(mapa ?? {}).find(
    (k) => normalizarTexto(k) === alvo,
  );
  return chave === undefined ? null : numero(mapa[chave]);
}

const comTeto = (valor, teto) =>
  teto === null || teto === undefined ? valor : Math.min(valor, teto);
const arredondar = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Recalcula a nota declarada de um candidato.
 * @param {object} regra a regra do edital (usa provisoria.nota_declarada)
 * @param {Record<string, string>} respostas as colunas da Empregare (DS_COLUNA_ORIGINAL)
 * @returns {{ total: number, parciais: Record<string, number>, itens: object[], sem_mapa: number }}
 */
export function calcularNotaDeclarada(regra, respostas) {
  const itens = lista(regra?.provisoria?.nota_declarada).map((item) => {
    const coluna = colunaDaPergunta(respostas, item.pergunta);
    const resposta = coluna ? String(respostas[coluna] ?? "") : "";
    let pontos = 0;
    let mapeada = false;
    if (coluna && resposta.trim()) {
      if (item.tipo === "OPCAO") {
        const v = valorDoMapa(item.pontos, resposta);
        mapeada = v !== null;
        pontos = v ?? 0;
      } else if (item.tipo === "FAIXA_EM_MESES") {
        const meses = valorDoMapa(item.meses, resposta);
        mapeada = meses !== null;
        pontos = (meses ?? 0) * numero(item.pontos_por_mes);
      } else if (item.tipo === "OPCOES_SOMADAS") {
        // As opções marcadas vêm separadas por ";" (ou "|", ou linha).
        const marcadas = new Set(
          resposta
            .split(/[;|\n]/)
            .map(normalizarTexto)
            .filter(Boolean),
        );
        const casadas = Object.keys(item.pontos ?? {}).filter((opcao) =>
          marcadas.has(normalizarTexto(opcao)),
        );
        mapeada = casadas.length > 0;
        pontos = casadas.reduce(
          (soma, opcao) => soma + numero(item.pontos[opcao]),
          0,
        );
      }
    }
    return {
      parcial: item.parcial,
      pergunta: item.pergunta,
      coluna,
      resposta,
      mapeada,
      pontos: arredondar(comTeto(pontos, item.teto)),
    };
  });
  const parciais = {};
  for (const item of itens)
    parciais[item.parcial] = arredondar(
      (parciais[item.parcial] ?? 0) + item.pontos,
    );
  return {
    total: arredondar(Object.values(parciais).reduce((a, b) => a + b, 0)),
    parciais,
    itens,
    sem_mapa: itens.filter((i) => i.coluna && i.resposta.trim() && !i.mapeada)
      .length,
  };
}

/** A ART como número: "6,0/30,0" → 6. Sem número, null. */
export function lerArt(texto) {
  const m = String(texto ?? "")
    .trim()
    .match(/^(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** A ART diverge da nota declarada além da tolerância da regra? */
export function divergeDaArt(art, declarada, tolerancia = 0) {
  if (art === null || art === undefined || !Number.isFinite(Number(art)))
    return false;
  return Math.abs(Number(art) - Number(declarada)) > Number(tolerancia) + 1e-9;
}

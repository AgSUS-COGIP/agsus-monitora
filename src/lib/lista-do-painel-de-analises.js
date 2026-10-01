/*
  A lista enxuta de Análises curriculares (src/modulos/analises/), desde 20260929150000.

  O payload da lista (get_analises_dashboard_payload_v2, schema_version 4) só
  traz o que a lista, os filtros, os KPIs, os gráficos e a tabela usam. O resto
  vem de outro lugar, e as regras de como juntar ficam aqui:

  - `grupo` e `edital_status` vêm uma vez no envelope, não em cada linha;
  - a janela oficial (data_inicio/fim_analise) sai de `editais[]`: o
    tela casa a linha com o edital quando a linha vem sem janela
    (`editalDaLinha` de analises-curriculares.js), com uma regra que cobre a
    da view;
  - "tem PDF?" vem como `tem_pdf`; o link, no detalhe e no CSV;
  - pontuações, experiências, links e datas ficam no detalhamento
    (get_analise_detalhe_do_painel), buscado ao abrir o registro;
  - "Todos" não tem pacote próprio: são os escopos 'ativo', 'inativo' e
    'desativadas' (análise desativada de edital ativo) juntos, na ordem do
    banco (`juntarPartesDoPainel`).

  O payload antigo (schema 3, com todas as colunas) passa por aqui sem mudar:
  toda regra só completa o que falta na linha.
*/

const texto = (valor) => String(valor ?? "").trim();
const temCampo = (objeto, campo) =>
  Boolean(objeto) && Object.prototype.hasOwnProperty.call(objeto, campo);

/* As partes do escopo "Todos", na ordem em que o banco as separa. */
export const PARTES_DE_TODOS = Object.freeze([
  "ativo",
  "inativo",
  "desativadas",
]);

/* Os escopos que o painel pede ao servidor para cada situação do filtro. */
export function partesDoEscopo(escopo) {
  return escopo === "todos" ? [...PARTES_DE_TODOS] : [escopo];
}

/** Completa a linha com o que o envelope manda uma vez só (grupo e situação do edital). */
export function completarLinhaPeloEnvelope(linha, payload) {
  if (!linha || typeof linha !== "object" || !payload) return linha;
  ["grupo", "edital_status"].forEach((campo) => {
    if (!temCampo(linha, campo) && payload[campo] != null)
      linha[campo] = payload[campo];
  });
  return linha;
}

/** A linha tem link de PDF? (`tem_pdf` da lista enxuta, ou o link do payload antigo). */
export function temPdf(linha) {
  return linha?.tem_pdf === true || texto(linha?.link_pdf) !== "";
}

/* O detalhamento ainda não veio para esta linha (lista enxuta)? */
export function linhaSemDetalhe(linha) {
  return (
    Boolean(linha) &&
    typeof linha === "object" &&
    !temCampo(linha, "pontuacao_escolaridade")
  );
}

/*
  Campos do detalhe que não entram na linha: o id e a área já estão nela, e a
  chave natural faz parte da chave da linha na tabela (mudar a chave com o
  detalhamento aberto o fecharia).
*/
const FORA_DA_LINHA = new Set(["id", "area", "chave_natural"]);

/** Põe na linha o que o detalhe trouxe e ela não tem. Devolve se mudou algo. */
export function mesclarDetalhe(linha, detalhe) {
  const dados = Array.isArray(detalhe) ? detalhe[0] : detalhe;
  if (
    !linha ||
    typeof linha !== "object" ||
    !dados ||
    typeof dados !== "object"
  )
    return false;
  let mudou = false;
  Object.entries(dados).forEach(([campo, valor]) => {
    if (FORA_DA_LINHA.has(campo) || temCampo(linha, campo)) return;
    linha[campo] = valor;
    mudou = true;
  });
  return mudou;
}

/*
  Ordem do banco: unidade, edital, código da vaga e candidato, com a colação
  do banco (ICU en-US) e os nulos no fim; o id (uuid, minúsculo) desempata.
  Cada parte já vem nessa ordem; só a junção precisa comparar.
*/
const COLACAO_DO_BANCO = new Intl.Collator("en-US");
const CAMPOS_DA_ORDEM = ["unidade", "edital", "codigo_vaga", "candidato"];

export function compararNaOrdemDoBanco(a, b) {
  for (const campo of CAMPOS_DA_ORDEM) {
    const x = a?.[campo];
    const y = b?.[campo];
    const xNulo = x === null || x === undefined;
    const yNulo = y === null || y === undefined;
    if (xNulo || yNulo) {
      if (xNulo !== yNulo) return xNulo ? 1 : -1;
      continue;
    }
    const ordem = COLACAO_DO_BANCO.compare(String(x), String(y));
    if (ordem) return ordem;
  }
  const idA = texto(a?.id);
  const idB = texto(b?.id);
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

const horaDoPayload = (payload) => Date.parse(payload?.generated_at) || 0;

/*
  "Todos": junta as partes (cada uma `{ payload, linhas }`) sem repetir linha e
  na ordem do banco. Uma análise que mudou de escopo entre duas cópias (a do
  navegador e a nova) aparece em duas partes: fica a da parte mais nova.
*/
export function juntarPartesDoPainel(partes) {
  const lista = (Array.isArray(partes) ? partes : []).filter(
    (parte) => parte && Array.isArray(parte.linhas),
  );
  const donoDoId = new Map();
  lista.forEach((parte, indice) => {
    const hora = horaDoPayload(parte.payload);
    parte.linhas.forEach((linha) => {
      const id = texto(linha?.id);
      if (!id) return;
      const atual = donoDoId.get(id);
      if (!atual || hora > atual.hora) donoDoId.set(id, { indice, hora });
    });
  });

  const filas = lista.map((parte, indice) =>
    parte.linhas.filter((linha) => {
      const id = texto(linha?.id);
      return !id || donoDoId.get(id).indice === indice;
    }),
  );
  const posicoes = filas.map(() => 0);
  const juntas = [];
  for (;;) {
    let escolhida = -1;
    filas.forEach((fila, indice) => {
      if (posicoes[indice] >= fila.length) return;
      if (
        escolhida < 0 ||
        compararNaOrdemDoBanco(
          fila[posicoes[indice]],
          filas[escolhida][posicoes[escolhida]],
        ) < 0
      )
        escolhida = indice;
    });
    if (escolhida < 0) break;
    juntas.push(filas[escolhida][posicoes[escolhida]]);
    posicoes[escolhida] += 1;
  }
  return juntas;
}

/*
  O envelope de "Todos": o da parte mais nova, com a hora da mais antiga (a
  cópia vale o que vale a parte mais velha), o total das linhas juntas e a
  data do dado mais novo.
*/
export function envelopeDeTodos(partes, total) {
  const payloads = (Array.isArray(partes) ? partes : [])
    .map((parte) => parte?.payload)
    .filter(Boolean);
  if (!payloads.length) return null;
  const maisNovo = payloads.reduce((a, b) =>
    horaDoPayload(b) > horaDoPayload(a) ? b : a,
  );
  const maisVelho = payloads.reduce((a, b) =>
    horaDoPayload(b) < horaDoPayload(a) ? b : a,
  );
  const atualizados = payloads
    .map((payload) => payload.atualizado_em)
    .filter((valor) => Date.parse(valor));
  const atualizadoEm = atualizados.length
    ? atualizados.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
    : null;
  const envelope = { ...maisNovo };
  delete envelope.rows;
  return {
    ...envelope,
    scope: "todos",
    edital_status: null,
    total,
    atualizado_em: atualizadoEm,
    generated_at: maisVelho.generated_at,
    cache: {
      hit: payloads.every((payload) => payload.cache?.hit === true),
      refreshed_at: maisVelho.cache?.refreshed_at ?? maisVelho.generated_at,
    },
  };
}

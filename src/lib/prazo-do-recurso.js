/*
  Prazo de resposta de um recurso, lido do cronograma do edital.

  O cronograma (`TB_CRONOGRAMA_MONIT_INDIG`) tem atividades em texto livre, e
  cada edital escreve do seu jeito: "Análise e resposta ao recurso", "Prazo de
  recurso do resultado preliminar documental", "Prazo para recursos das
  entrevistas", "Resultado preliminar da análise curricular e abertura do
  prazo de recurso", "Resposta aos Recursos e Resultado Final das
  Entrevistas"… Este arquivo classifica cada atividade em
  { origem, papel } e escolhe o prazo:

  - `papel`: "abertura" (o candidato pode recorrer: prazo, abertura,
    interposição, recebimento) ou "resposta" (a banca analisa e responde).
    Atividade que não fala de recurso não tem papel.
  - `origem`: a etapa contra a qual se recorre, com os códigos de
    `TB_ORIGEM_RECURSO` — análise curricular (curricular, documental,
    títulos), entrevista, avaliação de conhecimentos (conhecimento, prova,
    gabarito) e resultado final. Atividade de recurso que não diz a etapa
    ("Análise e resposta ao recurso", "Prazo de recursos") herda a da última
    atividade anterior que disse (na ordem do cronograma): é a etapa que acabou
    de ter resultado.

  O prazo de uma origem é o fim da atividade de resposta dela; sem resposta no
  cronograma, o fim do prazo de recurso (com um aviso); sem nenhum dos dois,
  "prazo não encontrado no cronograma" — que vira pendência na tela.

  A leitura do banco (`get_recursos_da_area`) traz as etapas cruas; nada disso
  fica guardado lá.
*/

export const ORIGENS_DO_RECURSO = Object.freeze({
  ANALISE_CURRICULAR: "analise-curricular",
  ENTREVISTA: "entrevista",
  RESULTADO_FINAL: "resultado-final",
  AVALIACAO_CONHECIMENTOS: "avaliacao-conhecimentos",
});

export const AVISO_PRAZO_PELA_ABERTURA =
  "O cronograma não traz a resposta aos recursos; usado o fim do prazo de recurso.";
export const AVISO_SEM_PRAZO = "Prazo não encontrado no cronograma.";

/** Minúsculas, sem acento, só letras/números e espaço simples. */
export function normalizarAtividade(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/*
  A etapa de que o texto fala. "… e convocação para a Avaliação de
  Conhecimentos" fala da etapa seguinte, não desta: o que vem depois de
  "e convocação" não conta. Entrevista antes de tudo ("Resposta aos Recursos e
  Resultado Final das Entrevistas" é da entrevista); resultado final só quando
  nenhuma etapa foi citada.
*/
export function origemDaAtividade(texto) {
  const t = normalizarAtividade(texto).split(/\be convocacao\b/)[0];
  if (!t) return null;
  if (/\bentrevist/.test(t)) return ORIGENS_DO_RECURSO.ENTREVISTA;
  if (/conhecimento|prova objetiva|gabarito|questoes formuladas/.test(t))
    return ORIGENS_DO_RECURSO.AVALIACAO_CONHECIMENTOS;
  if (/curricul|documental|documentacao|titulos/.test(t))
    return ORIGENS_DO_RECURSO.ANALISE_CURRICULAR;
  if (/resultado (final|definitivo)/.test(t))
    return ORIGENS_DO_RECURSO.RESULTADO_FINAL;
  return null;
}

/** "resposta", "abertura" ou `null` (a atividade não é de recurso). */
export function papelDaAtividade(texto) {
  const t = normalizarAtividade(texto);
  if (!/\brecurs/.test(t)) return null;
  if (/\brespost|\bjulgament/.test(t)) return "resposta";
  return "abertura";
}

const numero = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};
const data = (valor) => {
  const texto = String(valor ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
};

/**
 * Classifica as etapas de UM cronograma, na ordem dele (`ordem`, depois a data
 * de início). Cada etapa volta com `origem` e `papel` (ambos podem ser nulos).
 */
export function classificarCronograma(etapas) {
  const ordenadas = (Array.isArray(etapas) ? etapas : [])
    .filter(Boolean)
    .map((etapa, indice) => ({ etapa, indice }))
    .sort(
      (a, b) =>
        numero(a.etapa.ordem) - numero(b.etapa.ordem) ||
        String(a.etapa.inicio ?? "").localeCompare(
          String(b.etapa.inicio ?? ""),
        ) ||
        a.indice - b.indice,
    );
  let ultimaOrigem = null;
  return ordenadas.map(({ etapa }) => {
    const citada = origemDaAtividade(etapa.atividade);
    const papel = papelDaAtividade(etapa.atividade);
    const origem = citada ?? (papel ? ultimaOrigem : null);
    if (citada) ultimaOrigem = citada;
    return {
      ordem: etapa.ordem ?? null,
      atividade: String(etapa.atividade ?? "").trim(),
      inicio: data(etapa.inicio),
      fim: data(etapa.fim),
      origem,
      papel,
    };
  });
}

/*
  O prazo de resposta para uma origem. Mais de uma atividade de resposta (errata,
  duas rodadas): vale a de fim mais tardio. Atividade sem fim usa o início.
*/
function ultimaPorData(etapas) {
  return etapas
    .map((etapa) => ({ ...etapa, data: etapa.fim ?? etapa.inicio }))
    .filter((etapa) => etapa.data)
    .sort((a, b) => a.data.localeCompare(b.data))
    .at(-1);
}

/**
 * `{ data, fonte, atividade, aviso }`: `fonte` é "resposta", "abertura" ou
 * `null` (sem prazo; `data` nula e `aviso` = AVISO_SEM_PRAZO).
 */
export function prazoDoRecurso(etapas, origem) {
  const daOrigem = classificarCronograma(etapas).filter(
    (etapa) => etapa.papel && etapa.origem === origem,
  );
  const resposta = ultimaPorData(
    daOrigem.filter((etapa) => etapa.papel === "resposta"),
  );
  if (resposta)
    return {
      data: resposta.data,
      fonte: "resposta",
      atividade: resposta.atividade,
      aviso: "",
    };
  const abertura = ultimaPorData(
    daOrigem.filter((etapa) => etapa.papel === "abertura"),
  );
  if (abertura)
    return {
      data: abertura.data,
      fonte: "abertura",
      atividade: abertura.atividade,
      aviso: AVISO_PRAZO_PELA_ABERTURA,
    };
  return { data: null, fonte: null, atividade: "", aviso: AVISO_SEM_PRAZO };
}

/** As etapas do payload (todas as dos editais com recurso) agrupadas por edital. */
export function cronogramasPorEdital(etapas) {
  const mapa = new Map();
  for (const etapa of Array.isArray(etapas) ? etapas : []) {
    const id = String(etapa?.edital_id ?? "");
    if (!id) continue;
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id).push(etapa);
  }
  return mapa;
}

/**
 * A decisão saiu dentro do prazo de resposta? `true` (no dia do prazo ou
 * antes), `false` (depois) ou `null` (sem decisão ou sem prazo no
 * cronograma). Datas AAAA-MM-DD; a da decisão já no dia local.
 */
export function decididoNoPrazo(diaDaDecisao, dataDoPrazo) {
  const decisao = data(diaDaDecisao);
  const prazo = data(dataDoPrazo);
  if (!decisao || !prazo) return null;
  return decisao <= prazo;
}

/*
  Editais da Equipe Núcleo — a lógica da página "Editais", sem DOM nem rede.

  A tela é `src/componentes/nucleo/`. As linhas são as do monitoramento
  (`TB_MONITORAMENTO_INDIGENA`), carregadas pelo legado para o mapa e para esta
  página; o resumo de cronogramas vem de `get_nucleo_cronograma_resumo`.

  A ordenação, o tom do status e o do risco também são usados pela tabela do
  mapa (`legacy-app.js`): as duas telas têm de concordar.
*/

import {
  ehResponsavelCores,
  normalizarResponsavel,
  unidadesDoResponsavel,
} from "./responsavel-do-edital.js";

const txt = (valor) => String(valor ?? "").trim();
const low = (valor) => txt(valor).toLowerCase();
const num = (valor) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
};

/** Número como a tela o escreve: "1.308". */
export const formatarNumero = (valor) => num(valor).toLocaleString("pt-BR");

// ── Ordem, busca e tons ──────────────────────────────────────────────────

/** Alto antes de médio antes de baixo; sem risco vai para o fim. */
export function ordemDoRisco(valor) {
  const ordem = { alto: 0, médio: 1, medio: 1, baixo: 2 };
  return ordem[low(valor)] ?? 9;
}

/** A fila do Núcleo: primeiro o risco, depois quem tem mais vagas ociosas. */
export function compararEditais(a, b) {
  const ra = ordemDoRisco(a.risco);
  const rb = ordemDoRisco(b.risco);
  if (ra !== rb) return ra - rb;
  return num(b.vagas_ociosas) - num(a.vagas_ociosas);
}

/** Busca livre por edital, unidade, status, etapa, risco e processo. */
export function filtrarEditais(linhas, busca) {
  const termo = low(busca);
  return (linhas || [])
    .filter(
      (linha) =>
        !termo ||
        [
          linha.edital,
          linha.unidade,
          linha.status,
          linha.etapa,
          linha.risco,
          linha.processo,
        ]
          .map(low)
          .join(" | ")
          .includes(termo),
    )
    .sort(compararEditais);
}

/** Cor do chip de status (`.chip.<tom>`). */
export function tomDoStatusDoEdital(status) {
  const l = low(status);
  if (l.includes("conclu")) return "green";
  if (l.includes("andamento")) return "blue";
  if (l.includes("elabora")) return "cyan";
  if (l.includes("cancel")) return "red";
  return "gray";
}

/** Cor do chip de risco (`.chip.<tom>`). */
export function tomDoRisco(risco) {
  const l = low(risco);
  if (l === "alto") return "red";
  if (l === "médio" || l === "medio") return "yellow";
  return "green";
}

// ── Unidades do formulário ───────────────────────────────────────────────

export function normalizarNomeDaUnidade(valor) {
  return low(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Por tipo (CASAI, DSEI…) e depois pelo nome, com número em ordem numérica. */
export function ordenarUnidades(a, b) {
  const ta = txt(a.tipo);
  const tb = txt(b.tipo);
  if (ta !== tb) return ta.localeCompare(tb, "pt-BR", { numeric: true });
  return txt(a.nome_oficial || a.unidade || a.nome).localeCompare(
    txt(b.nome_oficial || b.unidade || b.nome),
    "pt-BR",
    { numeric: true },
  );
}

/*
  Unidades que aparecem nos editais e não estão no catálogo `TD_UNIDADE` —
  editais antigos, gravados com um nome que o catálogo não tem. Sem elas, abrir
  um desses editais mostraria a unidade em branco.
*/
function unidadesDasLinhas(linhas) {
  const porNome = new Map();
  (linhas || []).forEach((linha) => {
    const nome = txt(linha.unidade);
    const chave = normalizarNomeDaUnidade(nome);
    if (!nome || porNome.has(chave)) return;
    porNome.set(chave, {
      id_unidade: txt(linha.id_unidade),
      sigla: txt(linha.sigla_unidade),
      nome_oficial: nome,
      tipo:
        txt(linha.tipo_unidade) ||
        (nome.toUpperCase().startsWith("CASAI") ? "CASAI" : "DSEI"),
      uf_sede: txt(linha.uf).toUpperCase(),
      ativo: true,
      fallback: true,
    });
  });
  return [...porNome.values()];
}

/** O catálogo, completado pelas unidades que só existem nos editais. */
export function unidadesDisponiveis(catalogo, linhas) {
  const porNome = new Map(
    (catalogo || []).map((u) => [normalizarNomeDaUnidade(u.nome_oficial), u]),
  );
  unidadesDasLinhas(linhas).forEach((u) => {
    const chave = normalizarNomeDaUnidade(u.nome_oficial);
    if (!porNome.has(chave)) porNome.set(chave, u);
  });
  return [...porNome.values()].sort(ordenarUnidades);
}

/** O valor da opção: o id quando existe; as unidades do CORES só têm nome. */
export const valorDaUnidade = (unidade) =>
  txt(unidade.id_unidade) || txt(unidade.nome_oficial);

export function rotuloDaUnidade(unidade) {
  const uf = txt(unidade.uf_sede).toUpperCase();
  return `${txt(unidade.nome_oficial)}${uf ? ` — ${uf}` : ""}`;
}

/** As opções do select de unidade para o responsável escolhido. */
export function opcoesDeUnidade(responsavel, catalogo, linhas) {
  return unidadesDoResponsavel(
    responsavel,
    unidadesDisponiveis(catalogo, linhas),
  );
}

/** A unidade de um edital gravado: pelo id e, na falta dele, pelo nome. */
export function unidadeDoEdital(edital, unidades) {
  if (!edital) return null;
  const id = txt(edital.id_unidade);
  if (id) {
    const porId = unidades.find((u) => txt(u.id_unidade) === id);
    if (porId) return porId;
  }
  const nome = normalizarNomeDaUnidade(edital.unidade);
  if (!nome) return null;
  return (
    unidades.find((u) => normalizarNomeDaUnidade(u.nome_oficial) === nome) ||
    null
  );
}

// ── Formulário do edital ─────────────────────────────────────────────────

/**
 * O rascunho do formulário a partir de um edital gravado (ou vazio, para um
 * novo).
 *
 * O responsável decide de que catálogo vêm as unidades, por isso entra antes
 * delas. Editais gravados antes de o campo virar seleção têm um nome de pessoa
 * em `responsavel`: não é USI nem CORES, e o select abre vazio.
 *
 * Unidade que não está em lista nenhuma deixa o select vazio, mas o id, a
 * sigla, o tipo e a UF gravados continuam no rascunho — trocar de unidade os
 * substitui; não trocar não apaga o que estava gravado.
 */
export function formularioDoEdital(edital, catalogo, linhas) {
  const e = edital || {};
  const responsavel = normalizarResponsavel(e.responsavel);
  const doCores = ehResponsavelCores(responsavel);
  const opcoes = opcoesDeUnidade(responsavel, catalogo, linhas);
  const daLinha = doCores
    ? null
    : unidadeDoEdital(e, unidadesDisponiveis(catalogo, linhas));
  const valor = doCores
    ? txt(e.unidade)
    : daLinha
      ? valorDaUnidade(daLinha)
      : "";
  const escolhida = opcoes.find((u) => valorDaUnidade(u) === valor) || null;
  const pelaUnidade = Boolean(daLinha || doCores);
  return {
    id: txt(e.id),
    processo: txt(e.processo),
    edital: txt(e.edital),
    responsavel,
    unidade: escolhida ? valor : "",
    idUnidade: pelaUnidade ? txt(escolhida?.id_unidade) : txt(e.id_unidade),
    siglaUnidade: pelaUnidade ? txt(escolhida?.sigla) : txt(e.sigla_unidade),
    tipoUnidade: pelaUnidade ? txt(escolhida?.tipo) : txt(e.tipo_unidade),
    uf: pelaUnidade ? txt(escolhida?.uf_sede).toUpperCase() : txt(e.uf),
    // O ciclo saiu do formulário, mas a coluna continua no banco: salvar devolve o valor gravado.
    ciclo: txt(e.ciclo),
    link: txt(e.link_edital),
    vagas: String(e.vagas_total || 0),
    dataInicio: txt(e.data_inicio),
    dataFim: txt(e.data_fim),
    status: txt(e.status),
    etapa: txt(e.etapa),
    risco: txt(e.risco) || "Baixo",
    observacoes: txt(e.observacoes),
    observacoesInternas: txt(e.observacoes_internas),
  };
}

/** Os campos que a unidade escolhida define: id, sigla, tipo e UF. */
export function camposDaUnidade(unidade) {
  return {
    idUnidade: txt(unidade?.id_unidade),
    siglaUnidade: txt(unidade?.sigla),
    tipoUnidade: txt(unidade?.tipo),
    uf: txt(unidade?.uf_sede).toUpperCase(),
  };
}

/**
 * O `p_payload` de `salvar_monitoramento_com_cronograma_v2`.
 *
 * @param {object} formulario o rascunho de `formularioDoEdital`
 * @param {object|null} unidade a unidade escolhida no select
 * @param {object} cronograma `{ automatico, etapas, statusExcepcional, … }`
 * @param {{status: string, etapa: string}} previa o que `estadoDoCronograma` calculou
 */
export function editalParaSalvar(formulario, unidade, cronograma, previa) {
  const f = formulario;
  const automatico = Boolean(cronograma.automatico);
  return {
    id: txt(f.id) || null,
    processo: txt(f.processo),
    edital: txt(f.edital),
    id_unidade: txt(f.idUnidade) || txt(unidade?.id_unidade) || null,
    sigla_unidade: txt(f.siglaUnidade) || txt(unidade?.sigla) || null,
    tipo_unidade: txt(f.tipoUnidade) || txt(unidade?.tipo) || null,
    unidade: txt(unidade?.nome_oficial),
    uf: txt(f.uf),
    ciclo: txt(f.ciclo),
    vagas_total: Number(f.vagas || 0),
    data_inicio: txt(f.dataInicio) || null,
    data_fim: txt(f.dataFim) || null,
    status: automatico ? previa.status : txt(f.status),
    etapa: automatico ? previa.etapa : txt(f.etapa),
    risco: txt(f.risco) || "Baixo",
    responsavel: txt(f.responsavel),
    link_edital: txt(f.link),
    observacoes: txt(f.observacoes),
    observacoes_internas: txt(f.observacoesInternas),
    cronograma_automatico: automatico,
    cronograma_origem: cronograma.etapas.length ? "MANUAL" : null,
    status_override: txt(cronograma.statusExcepcional) || null,
    etapa_override: txt(cronograma.etapaExcepcional) || null,
    status_override_motivo: txt(cronograma.motivoExcepcional) || null,
    status_override_data: txt(cronograma.dataExcepcional) || null,
    status_override_previsao_retomada: txt(cronograma.retomada) || null,
  };
}

// ── Resumo dos cronogramas e alertas ─────────────────────────────────────

const chaveDoResumo = (unidade, edital) =>
  `${normalizarNomeDaUnidade(unidade)}|${normalizarNomeDaUnidade(edital)}`;

/**
 * Índice do resumo por id e por unidade + edital. O id vem primeiro: dois
 * registros com o mesmo edital e a mesma unidade são editais diferentes.
 */
export function indexarResumo(resumo) {
  const indice = new Map();
  (resumo || []).forEach((item) => {
    indice.set(`id:${item.id}`, item);
    const chave = chaveDoResumo(item.unidade, item.edital);
    if (!indice.has(chave)) indice.set(chave, item);
  });
  return indice;
}

export function resumoDoEdital(indice, linha) {
  return (
    indice.get(`id:${linha.id}`) ||
    indice.get(chaveDoResumo(linha.unidade, linha.edital)) ||
    null
  );
}

/**
 * Só os itens do resumo que casam com alguma das linhas, pela mesma regra da
 * tabela (`resumoDoEdital`). O resumo vem de todos os editais; recortado assim,
 * os indicadores contam exatamente os editais que a tabela mostra (a área
 * atual, no Núcleo).
 */
export function resumoDasLinhas(resumo, linhas) {
  const indice = indexarResumo(resumo);
  const casados = new Set(
    (linhas || []).map((linha) => resumoDoEdital(indice, linha)),
  );
  return (resumo || []).filter((item) => casados.has(item));
}

const ALERTAS = Object.freeze({
  sem_cronograma: {
    label: "Sem cronograma",
    icon: "fa-calendar-xmark",
    tone: "danger",
  },
  incompleto: {
    label: "Cronograma incompleto",
    icon: "fa-triangle-exclamation",
    tone: "warning",
  },
  proxima_3d: {
    label: "Próxima etapa em até 3 dias",
    icon: "fa-bell",
    tone: "danger",
  },
  proxima_7d: {
    label: "Próxima etapa em até 7 dias",
    icon: "fa-clock",
    tone: "warning",
  },
  excepcional: {
    label: "Situação excepcional",
    icon: "fa-circle-exclamation",
    tone: "purple",
  },
  ok: { label: "Cronograma regular", icon: "fa-circle-check", tone: "success" },
});

export const alertaDoTipo = (tipo) => ALERTAS[tipo] || ALERTAS.ok;

const EM_ANDAMENTO = ["Em andamento", "Planejado"];
const PROXIMAS = ["proxima_3d", "proxima_7d"];

/** Os seis indicadores do painel operacional, contados sobre o resumo. */
export function indicadoresDoResumo(resumo) {
  const contagem = (resumo || []).reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.alerta_tipo] = (acc[item.alerta_tipo] || 0) + 1;
      if (EM_ANDAMENTO.includes(item.status)) acc.andamento += 1;
      return acc;
    },
    { total: 0, andamento: 0 },
  );
  return [
    {
      key: "todos",
      label: "Editais ativos",
      value: contagem.total,
      icon: "fa-folder-open",
      tone: "blue",
    },
    {
      key: "andamento",
      label: "Em andamento",
      value: contagem.andamento,
      icon: "fa-play",
      tone: "green",
    },
    {
      key: "sem_cronograma",
      label: "Sem cronograma",
      value: contagem.sem_cronograma || 0,
      icon: "fa-calendar-xmark",
      tone: "red",
    },
    {
      key: "incompleto",
      label: "Incompletos",
      value: contagem.incompleto || 0,
      icon: "fa-triangle-exclamation",
      tone: "amber",
    },
    {
      key: "proxima",
      label: "Próximos 7 dias",
      value: (contagem.proxima_3d || 0) + (contagem.proxima_7d || 0),
      icon: "fa-bell",
      tone: "cyan",
    },
    {
      key: "excepcional",
      label: "Excepcionais",
      value: contagem.excepcional || 0,
      icon: "fa-circle-exclamation",
      tone: "purple",
    },
  ];
}

/**
 * O edital passa no filtro do painel? Sem resumo, só aparece quando não há
 * filtro: não há como saber em que indicador ele cairia.
 */
export function passaNoFiltroOperacional(item, filtro) {
  if (filtro === "todos") return true;
  if (!item) return false;
  if (filtro === "andamento") return EM_ANDAMENTO.includes(item.status);
  if (filtro === "proxima") return PROXIMAS.includes(item.alerta_tipo);
  return item.alerta_tipo === filtro;
}

/** Opções para copiar cronograma: outros editais que já têm etapas. */
export function editaisComCronogramaParaCopiar(resumo, idAtual) {
  return (resumo || [])
    .filter(
      (item) =>
        String(item.id) !== String(idAtual || "") &&
        Number(item.cronograma_total || 0) > 0,
    )
    .sort((a, b) =>
      `${a.unidade} ${a.edital}`.localeCompare(
        `${b.unidade} ${b.edital}`,
        "pt-BR",
        { numeric: true },
      ),
    );
}

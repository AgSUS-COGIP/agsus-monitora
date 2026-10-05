/*
  A convocação para a entrevista, sem React e sem banco. Há uma convocação só:
  a lista CONVOCACAO da Classificação (motor src/lib/classificacao/motor.js,
  regra do edital, vagas do quadro do edital ou da configuração da
  convocação). Entrevistas › Conduzir mostra essa lista e registra quem dela
  vai para a ficha de notas (`convocar_para_entrevista`, migration
  20261005150000) — nada de ranking, regra ou vagas próprios.

  A fonte (`fonteDaConvocacao`):
    LISTA     a última lista gerada na Classificação (o retrato registrado,
              `obter_entrevistas_do_edital.lista_convocacao`) — a única que
              convoca;
    CALCULO   sem lista gerada, o cálculo atual do motor (só para ver; a tela
              pede para gerar a lista na Classificação);
    NENHUMA   sem lista e sem o cálculo (sem regra ou sem acesso à
              Classificação).

  O retrato registrado (instantaneoDaLista: analise_id, listas, total,
  origem_das_vagas, limite_convocacao) e o resultado do motor (analiseId,
  porModalidade, total, origemDasVagas, limiteConvocacao) entram iguais.
*/

const texto = (valor) => String(valor ?? "").trim();
const numero = (valor) =>
  valor === null ||
  valor === undefined ||
  valor === "" ||
  !Number.isFinite(Number(valor))
    ? null
    : Number(valor);

/* De onde vieram as vagas da vaga e onde se mudam (a view do app). */
export const ORIGENS_DAS_VAGAS = Object.freeze({
  QUADRO: Object.freeze({
    rotulo: "quadro de vagas do edital",
    view: "nucleo",
    onde: "Editais",
  }),
  CONVOCACAO: Object.freeze({
    rotulo: "configuração da convocação",
    view: "aprovados",
    onde: "Lista de aprovados",
  }),
  REGRA: Object.freeze({
    rotulo: "percentuais da regra",
    view: "classificacao",
    onde: "Classificação",
  }),
});

/** A origem das vagas da vaga, ou a de quem não tem quadro (configurar no Editais). */
export function origemDasVagas(grupo) {
  return (
    ORIGENS_DAS_VAGAS[grupo?.origemDasVagas] || {
      rotulo: "sem quadro de vagas",
      view: "nucleo",
      onde: "Editais",
    }
  );
}

/**
 * A convocação que vale na tela: a lista registrada; sem ela, o cálculo atual
 * (`calculada`, o resultado do motor para CONVOCACAO), só para consulta.
 */
export function fonteDaConvocacao(dados, calculada = null) {
  const registrada = dados?.lista_convocacao;
  if (registrada?.lista?.id && registrada?.retrato)
    return {
      tipo: "LISTA",
      lista: registrada.lista,
      resultado: registrada.retrato,
    };
  if (calculada?.vagas)
    return { tipo: "CALCULO", lista: null, resultado: calculada };
  return { tipo: "NENHUMA", lista: null, resultado: null };
}

const linhaDaLista = (l, lista) => ({
  analiseId: texto(l?.analise_id || l?.analiseId),
  nome: texto(l?.nome),
  posicao: numero(l?.posicao),
  nota: numero(l?.nota),
  modalidades: Array.isArray(l?.modalidades) ? l.modalidades : [],
  situacao: texto(l?.situacao),
  lista,
});

/**
 * As vagas da lista, na ordem dela: em cada vaga, a classificação geral e
 * depois quem só está numa lista de modalidade (com `lista` = a modalidade),
 * sem repetir ninguém; as vagas e o limite como a Classificação contou.
 */
export function vagasDaLista(resultado) {
  return (resultado?.vagas || []).map((v) => {
    const vistos = new Set();
    const candidatos = [];
    const acrescentar = (linhas, lista) => {
      for (const l of linhas || []) {
        const c = linhaDaLista(l, lista);
        if (!c.analiseId || vistos.has(c.analiseId)) continue;
        vistos.add(c.analiseId);
        candidatos.push(c);
      }
    };
    acrescentar(v.geral, "");
    for (const [codigo, linhas] of Object.entries(
      v.listas || v.porModalidade || {},
    ))
      acrescentar(linhas, codigo);
    const limite = v.limite_convocacao || v.limiteConvocacao || null;
    return {
      vaga: texto(v.codigo) || texto(v.chave),
      cargo: texto(v.cargo),
      lotacao: texto(v.lotacao),
      cabecalho: texto(v.cabecalho),
      total: numero(v.total),
      cadastroReserva: Boolean(v.cadastro_reserva ?? v.cadastroReserva),
      origemDasVagas: v.origem_das_vagas ?? v.origemDasVagas ?? null,
      limite: numero(limite?.limite),
      origemDoLimite: texto(limite?.origem),
      candidatos,
    };
  });
}

/**
 * Cada vaga da lista com quem já foi registrado para a ficha (`convocado`) e,
 * em `fora`, os convocados que não estão na lista (convocados antes, ou a
 * lista mudou) — eles ficam na ficha; a tela deixa desconvocar quem não tem
 * nota.
 */
export function gruposDaConvocacao(resultado, convocados = []) {
  const porAnalise = new Map(
    (convocados || [])
      .filter((c) => c?.analise_id)
      .map((c) => [String(c.analise_id), c]),
  );
  const vistos = new Set();
  const grupos = vagasDaLista(resultado).map((g) => ({
    ...g,
    candidatos: g.candidatos.map((c) => {
      const convocado = porAnalise.get(c.analiseId) || null;
      if (convocado) vistos.add(convocado.id);
      return { ...c, convocado };
    }),
    fora: [],
  }));
  const porVaga = new Map(grupos.map((g) => [g.vaga, g]));
  for (const c of convocados || []) {
    if (vistos.has(c.id)) continue;
    const vaga = texto(c.vaga);
    if (!porVaga.has(vaga)) {
      const novo = {
        vaga,
        cargo: texto(c.cargo),
        lotacao: "",
        cabecalho: "",
        total: null,
        cadastroReserva: false,
        origemDasVagas: null,
        limite: null,
        origemDoLimite: "",
        candidatos: [],
        fora: [],
      };
      porVaga.set(vaga, novo);
      grupos.push(novo);
    }
    porVaga.get(vaga).fora.push(c);
  }
  return grupos;
}

/** Os da lista ainda não registrados para a ficha (os que "Convocar" leva). */
export function aConvocar(grupos) {
  const ids = [];
  for (const g of grupos || [])
    for (const c of g.candidatos) if (!c.convocado) ids.push(c.analiseId);
  return ids;
}

/** Os números do passo: na lista, já na ficha, a convocar e fora da lista. */
export function resumoDaConvocacao(grupos) {
  let naLista = 0;
  let naFicha = 0;
  let fora = 0;
  for (const g of grupos || []) {
    naLista += g.candidatos.length;
    naFicha += g.candidatos.filter((c) => c.convocado).length;
    fora += g.fora.length;
  }
  return { naLista, naFicha, aConvocar: naLista - naFicha, fora };
}

/** "2 vagas imediatas", "cadastro reserva", "sem quadro de vagas". */
export function textoDasVagas(grupo) {
  const total = numero(grupo?.total);
  if (total === null) return "sem quadro de vagas";
  if (total === 0) return "cadastro reserva";
  const base = `${total} ${total === 1 ? "vaga imediata" : "vagas imediatas"}`;
  return grupo.cadastroReserva ? `${base} + cadastro reserva` : base;
}

/** "até a 10ª (5 × 2 vaga(s))"; sem o limite no retrato (lista antiga), "". */
export function textoDoLimite(grupo) {
  const limite = numero(grupo?.limite);
  if (limite === null) return "";
  return grupo.origemDoLimite
    ? `até a ${limite}ª (${grupo.origemDoLimite})`
    : `até a ${limite}ª`;
}

/**
 * A regra de convocação da Classificação em uma linha (formato de
 * normalizarRegra: multiplo_vagas, posicao_max_cr, incluir_empatados,
 * excecoes[{termos, multiplo_vagas, posicao_max_cr}]).
 */
export function textoDaRegraDaClassificacao(convocacao) {
  if (!convocacao || typeof convocacao !== "object") return "";
  const multiplo = numero(convocacao.multiplo_vagas);
  const posicao = numero(convocacao.posicao_max_cr);
  const partes = [];
  if (multiplo !== null) partes.push(`${multiplo}× as vagas imediatas`);
  if (posicao !== null) partes.push(`até a ${posicao}ª no cadastro reserva`);
  if (!partes.length) return "sem limite na regra";
  if (convocacao.incluir_empatados !== false)
    partes.push("empatados no limite entram");
  const excecoes = (
    Array.isArray(convocacao.excecoes) ? convocacao.excecoes : []
  )
    .map((e) => {
      const termos = (Array.isArray(e?.termos) ? e.termos : [])
        .map(texto)
        .filter(Boolean)
        .join(", ");
      if (!termos) return "";
      const m = numero(e.multiplo_vagas);
      const p = numero(e.posicao_max_cr);
      return `${termos} (${m ?? "—"}× / ${p ?? "—"}ª)`;
    })
    .filter(Boolean);
  if (excecoes.length) partes.push(`exceções: ${excecoes.join("; ")}`);
  return partes.join(" · ");
}

/**
 * Avisos que pedem ação: sem lista gerada; regra mudou depois da lista; lista
 * com convocado que não está mais nela.
 */
export function avisosDaConvocacao(dados, fonte, grupos) {
  const avisos = [];
  if (fonte?.tipo === "CALCULO")
    avisos.push({
      codigo: "SEM_LISTA",
      tom: "warning",
      texto:
        "Lista ainda não gerada na Classificação: abaixo, o cálculo atual. Para convocar, gere a lista de convocação.",
    });
  if (fonte?.tipo === "NENHUMA")
    avisos.push({
      codigo: "SEM_LISTA",
      tom: "warning",
      texto: "Lista ainda não gerada na Classificação.",
    });
  const versaoDaLista = numero(fonte?.lista?.versao_regra);
  const vigente = numero(dados?.regra_classificacao?.versao);
  if (
    fonte?.tipo === "LISTA" &&
    versaoDaLista !== null &&
    vigente !== null &&
    versaoDaLista !== vigente
  )
    avisos.push({
      codigo: "REGRA_MUDOU",
      tom: "warning",
      texto: `A regra da Classificação mudou depois desta lista (v${versaoDaLista} → v${vigente}): gere a lista de novo.`,
    });
  const fora = resumoDaConvocacao(grupos).fora;
  if (fonte?.tipo === "LISTA" && fora)
    avisos.push({
      codigo: "FORA_DA_LISTA",
      tom: "info",
      texto: `${fora} ${fora === 1 ? "convocado não está" : "convocados não estão"} na lista vigente.`,
    });
  return avisos;
}

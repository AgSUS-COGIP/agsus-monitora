/*
  Condução da entrevista de um edital, sem React e sem banco: a configuração
  (roteiro, convocação, banca, modo de lançamento, vagas imediatas, membros),
  a convocação sugerida pela regra, a ficha de notas e o cálculo do resultado.

  O contrato é o da migration 20260930220000_entrevistas_roteiros_e_notas.sql
  (`obter_entrevistas_do_edital` e as RPCs de escrita, que devolvem o mesmo
  payload).

  `calcularEntrevista` é o espelho de `private."FC_CALCULAR_ENTREVISTA"`: a
  ficha mostra o parecer enquanto a pessoa digita, mas quem manda é o banco —
  depois de salvar, vale o que `lancar_notas_entrevista` devolveu.
*/
import { normalizarBusca } from "./entrevistas-do-painel.js";
import {
  arredondar,
  bancaDoRascunho,
  bancaParaRascunho,
  convocacaoDoRascunho,
  convocacaoParaRascunho,
  errosDaBanca,
  errosDaConvocacao,
  lerNumero,
  minimoEmPontos,
  novaChave,
  textoDoNumero,
} from "./roteiro-de-entrevista.js";

const texto = (valor) => String(valor ?? "").trim();
const numero = (valor) => {
  const n = lerNumero(valor);
  return n === null || Number.isNaN(n) ? null : n;
};

export const MODOS_DE_LANCAMENTO = Object.freeze([
  Object.freeze({ valor: "SECRETARIA", rotulo: "Secretaria passa a limpo" }),
  Object.freeze({ valor: "AVALIADOR", rotulo: "Cada avaliador lança a sua" }),
]);

export const rotuloDoLancamento = (valor) =>
  MODOS_DE_LANCAMENTO.find((m) => m.valor === valor)?.rotulo || "—";

/* ── Erros das RPCs ────────────────────────────────────────────────── */

/**
 * A mensagem para a pessoa: 22023 (dado fora da escala, faltando…) e 23514
 * (regra: configurar antes de convocar, candidato com notas…) já vêm escritas
 * pelo banco; 42501 é permissão.
 */
export function mensagemDoErroDaEntrevista(erro) {
  const mensagem = texto(erro?.message);
  switch (erro?.code) {
    case "PGRST202":
      return "Esta parte das entrevistas ainda não foi publicada no banco.";
    case "42501":
      return mensagem
        ? `Sem permissão: ${mensagem}.`
        : "Sem permissão para esta ação nas Entrevistas.";
    case "22023":
      return mensagem ? `Dado inválido: ${mensagem}.` : "Dado inválido.";
    case "23514":
      return mensagem ? `${mensagem}.` : "A regra da entrevista não permite.";
    default:
      return mensagem || "Falha inesperada.";
  }
}

/* ── Editais da área ───────────────────────────────────────────────── */

/**
 * Junta os editais lidos do monitoramento com os que já têm entrevistas no
 * painel (quem só tem o módulo Entrevistas pode não ler o monitoramento):
 * `[{ id, edital, unidade, comEntrevistas }]`, por número do edital.
 */
export function editaisParaConduzir(doMonitoramento, doPainel) {
  const porId = new Map();
  for (const m of doMonitoramento || []) {
    if (!m?.id) continue;
    porId.set(m.id, {
      id: m.id,
      edital: texto(m.edital),
      unidade: texto(m.unidade),
      comEntrevistas: false,
    });
  }
  for (const e of doPainel || []) {
    const id = e?.edital_id ?? e?.id;
    if (!id) continue;
    const atual = porId.get(id);
    if (atual) atual.comEntrevistas = true;
    else
      porId.set(id, {
        id,
        edital: texto(e.edital),
        unidade: texto(e.unidade),
        comEntrevistas: true,
      });
  }
  return [...porId.values()].sort(
    (a, b) =>
      a.edital.localeCompare(b.edital, "pt-BR", { numeric: true }) ||
      a.unidade.localeCompare(b.unidade, "pt-BR"),
  );
}

/* ── Configuração do edital ────────────────────────────────────────── */

export function novoAvaliador(origem = "", banca = "1") {
  return {
    chave: novaChave(),
    id: null,
    nome: "",
    origem,
    banca: String(banca),
    perfil: "",
  };
}

/** O rascunho do formulário de configuração, a partir do payload do edital. */
export function rascunhoDaConfiguracao(dados) {
  const cfg = dados?.configuracao || null;
  return {
    roteiro: cfg?.roteiro?.id || "",
    convocacao: convocacaoParaRascunho(cfg?.convocacao),
    banca: bancaParaRascunho(cfg?.banca),
    lancamento: cfg?.lancamento === "AVALIADOR" ? "AVALIADOR" : "SECRETARIA",
    vagas: (dados?.vagas || []).map((v) => ({
      vaga: texto(v.vaga),
      cargo: texto(v.cargo),
      aprovados: Number(v.aprovados) || 0,
      vagas_imediatas: textoDoNumero(v.vagas_imediatas),
      salvas: Boolean(v.vagas_imediatas_salvas),
    })),
    avaliadores: (dados?.avaliadores || [])
      .filter((a) => a.ativo !== false)
      .map((a) => ({
        chave: novaChave(),
        id: a.id,
        nome: texto(a.nome),
        origem: texto(a.origem),
        banca: textoDoNumero(a.banca ?? 1),
        perfil: a.perfil || "",
      })),
  };
}

/**
 * Escolher o roteiro pré-preenche a convocação e a composição da banca com o
 * padrão dele (a pessoa pode mudar depois).
 */
export function aplicarRoteiroNaConfiguracao(rascunho, roteiro) {
  if (!roteiro) return { ...rascunho, roteiro: "" };
  return {
    ...rascunho,
    roteiro: roteiro.id,
    convocacao: convocacaoParaRascunho(roteiro.convocacao_padrao),
    banca: bancaParaRascunho(roteiro.banca_padrao),
  };
}

/**
 * Completa os membros da banca pela composição (origem × quantidade): para
 * cada origem, acrescenta as linhas que faltam na banca 1, com o nome vazio.
 */
export function completarMembrosPelaComposicao(avaliadores, composicao) {
  const lista = avaliadores.slice();
  for (const linha of composicao || []) {
    const origem = texto(linha.origem);
    if (!origem) continue;
    const quantos = Math.max(0, Math.floor(numero(linha.quantidade) ?? 1));
    const ja = lista.filter(
      (a) => normalizarBusca(a.origem) === normalizarBusca(origem),
    ).length;
    for (let i = ja; i < quantos; i += 1) lista.push(novoAvaliador(origem));
  }
  return lista;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function errosDaConfiguracao(r) {
  const erros = {};
  if (!r?.roteiro) erros.roteiro = "Escolha o roteiro da entrevista.";
  Object.assign(
    erros,
    errosDaConvocacao(r?.convocacao),
    errosDaBanca(r?.banca),
  );
  for (const v of r?.vagas || []) {
    const n = lerNumero(v.vagas_imediatas);
    if (
      n !== null &&
      (Number.isNaN(n) || !Number.isInteger(n) || n < 0 || n > 999)
    )
      erros[`vaga.${v.vaga}`] = "Vagas imediatas: número inteiro de 0 a 999.";
  }
  for (const a of r?.avaliadores || []) {
    const p = `avaliador.${a.chave}`;
    const nome = texto(a.nome);
    if (nome.length < 2 || nome.length > 150)
      erros[`${p}.nome`] = "Nome do avaliador: de 2 a 150 caracteres.";
    const origem = texto(a.origem);
    if (origem.length < 2 || origem.length > 80)
      erros[`${p}.origem`] = "Origem: de 2 a 80 caracteres.";
    const banca = lerNumero(a.banca);
    if (
      banca !== null &&
      (Number.isNaN(banca) ||
        !Number.isInteger(banca) ||
        banca < 1 ||
        banca > 20)
    )
      erros[`${p}.banca`] = "Banca: número inteiro de 1 a 20.";
    if (texto(a.perfil) && !UUID.test(texto(a.perfil)))
      erros[`${p}.perfil`] = "Perfil do MONITORA: identificador inválido.";
  }
  return erros;
}

/** O `p_dados` de `configurar_entrevista_edital`. */
export function dadosDaConfiguracaoParaSalvar(r) {
  return {
    roteiro: r.roteiro,
    convocacao: convocacaoDoRascunho(r.convocacao),
    banca: bancaDoRascunho(r.banca),
    lancamento: r.lancamento === "AVALIADOR" ? "AVALIADOR" : "SECRETARIA",
    vagas: (r.vagas || [])
      .filter((v) => numero(v.vagas_imediatas) !== null)
      .map((v) => ({
        vaga: v.vaga,
        vagas_imediatas: numero(v.vagas_imediatas),
      })),
    avaliadores: (r.avaliadores || []).map((a) => {
      const membro = {
        nome: texto(a.nome),
        origem: texto(a.origem),
        banca: numero(a.banca) ?? 1,
        perfil: texto(a.perfil) || null,
      };
      if (a.id) membro.id = a.id;
      return membro;
    }),
  };
}

/* ── Convocação ────────────────────────────────────────────────────── */

/**
 * A regra que vale para o cargo: a padrão, ou a exceção cujo termo aparece no
 * cargo (sem diferenciar maiúsculas nem acentos).
 */
export function regraDaVaga(convocacao, cargo) {
  const base = {
    multiplo: numero(convocacao?.multiplo_imediatas),
    posicao: numero(convocacao?.posicao_cadastro_reserva),
    termo: null,
  };
  const alvo = normalizarBusca(cargo);
  for (const e of convocacao?.excecoes || []) {
    const termo = normalizarBusca(e?.termo_cargo);
    if (termo && alvo.includes(termo)) {
      return {
        multiplo: numero(e.multiplo_imediatas) ?? base.multiplo,
        posicao: numero(e.posicao_cadastro_reserva) ?? base.posicao,
        termo: texto(e.termo_cargo),
      };
    }
  }
  return base;
}

/**
 * Até que posição convocar: múltiplo × vagas imediatas, ou (sem vaga
 * imediata) a posição do cadastro reserva. Sem regra, 0.
 */
export function limiteDeConvocacao(regra, vagasImediatas) {
  const imediatas = numero(vagasImediatas) ?? 0;
  if (imediatas > 0) return Math.max(0, (regra?.multiplo ?? 0) * imediatas);
  return Math.max(0, regra?.posicao ?? 0);
}

export function textoDaRegra(regra, vagasImediatas, limite) {
  const imediatas = numero(vagasImediatas) ?? 0;
  const base =
    imediatas > 0
      ? `${regra.multiplo ?? 0}× ${imediatas} ${imediatas === 1 ? "vaga imediata" : "vagas imediatas"}`
      : `só cadastro reserva: até a ${regra.posicao ?? 0}ª posição`;
  const excecao = regra.termo ? ` (exceção “${regra.termo}”)` : "";
  return `${base}${excecao} → convocar até a ${limite}ª posição`;
}

/**
 * Os aprovados de cada vaga, na ordem da análise, com a sugestão da regra e
 * quem já foi convocado. Convocado que não está mais entre os aprovados
 * (análise mudou) aparece em `fora`.
 */
export function gruposDeConvocacao(dados) {
  const convocacao = dados?.configuracao?.convocacao || {};
  const convocadoPorAnalise = new Map(
    (dados?.convocados || []).map((c) => [c.analise_id, c]),
  );
  const vagas = new Map();
  for (const v of dados?.vagas || []) {
    vagas.set(texto(v.vaga), {
      vaga: texto(v.vaga),
      cargo: texto(v.cargo),
      aprovados: Number(v.aprovados) || 0,
      vagasImediatas: numero(v.vagas_imediatas),
      candidatos: [],
      fora: [],
    });
  }
  const grupo = (vaga, cargo) => {
    const chave = texto(vaga);
    if (!vagas.has(chave))
      vagas.set(chave, {
        vaga: chave,
        cargo: texto(cargo),
        aprovados: 0,
        vagasImediatas: null,
        candidatos: [],
        fora: [],
      });
    return vagas.get(chave);
  };
  const vistos = new Set();
  for (const c of dados?.candidatos || []) {
    const g = grupo(c.vaga, c.cargo);
    const convocado = convocadoPorAnalise.get(c.analise_id) || null;
    if (convocado) vistos.add(convocado.id);
    g.candidatos.push({ ...c, convocado });
  }
  for (const c of dados?.convocados || []) {
    if (!vistos.has(c.id)) grupo(c.vaga, c.cargo).fora.push(c);
  }
  return [...vagas.values()].map((g) => {
    const regra = regraDaVaga(convocacao, g.cargo);
    const limite = limiteDeConvocacao(regra, g.vagasImediatas);
    return {
      ...g,
      regra,
      limite,
      candidatos: g.candidatos
        .slice()
        .sort((a, b) => (a.posicao ?? 1e9) - (b.posicao ?? 1e9))
        .map((c) => ({ ...c, sugerido: (c.posicao ?? Infinity) <= limite })),
    };
  });
}

/** Os ids de análise sugeridos pela regra e ainda não convocados. */
export function selecaoSugerida(grupos) {
  const ids = new Set();
  for (const g of grupos)
    for (const c of g.candidatos)
      if (c.sugerido && !c.convocado) ids.add(c.analise_id);
  return ids;
}

/* ── Ficha de notas ────────────────────────────────────────────────── */

export const chaveDaNota = (competencia, avaliador) =>
  `${competencia}|${avaliador}`;

/** `avaliacoes` do convocado → `{ "competência|avaliador": "nota" }`. */
export function mapaDasAvaliacoes(avaliacoes) {
  const mapa = {};
  for (const a of avaliacoes || []) {
    if (a?.nota === null || a?.nota === undefined) continue;
    mapa[chaveDaNota(a.competencia, a.avaliador)] = textoDoNumero(a.nota);
  }
  return mapa;
}

export function avaliacoesDoMapa(mapa) {
  return Object.entries(mapa || {})
    .map(([chave, valor]) => {
      const [competencia, avaliador] = chave.split("|");
      return { competencia, avaliador, nota: numero(valor) };
    })
    .filter((a) => a.nota !== null);
}

/** Só o que mudou, no formato de `lancar_notas_entrevista` (null apaga). */
export function notasAlteradas(original, atual) {
  const chaves = new Set([
    ...Object.keys(original || {}),
    ...Object.keys(atual || {}),
  ]);
  const notas = [];
  for (const chave of chaves) {
    const antes = numero(original?.[chave]);
    const depois = numero(atual?.[chave]);
    if (antes === depois) continue;
    const [competencia, avaliador] = chave.split("|");
    notas.push({ competencia, avaliador, nota: depois });
  }
  return notas;
}

/** As bancas com membros ativos, em ordem. */
export function bancasDoEdital(avaliadores) {
  return [
    ...new Set(
      (avaliadores || [])
        .filter((a) => a.ativo !== false)
        .map((a) => Number(a.banca) || 1),
    ),
  ].sort((a, b) => a - b);
}

/**
 * Os avaliadores da ficha: os ativos da banca (todos, se a banca não foi
 * definida) e quem já deu nota ao candidato (mesmo que tenha saído da banca).
 */
export function avaliadoresDaFicha(avaliadores, convocado, banca) {
  const comNota = new Set(
    (convocado?.avaliacoes || []).map((a) => a.avaliador),
  );
  return (avaliadores || []).filter((a) => {
    if (comNota.has(a.id)) return true;
    if (a.ativo === false) return false;
    return (
      banca === null || banca === undefined || Number(a.banca) === Number(banca)
    );
  });
}

/**
 * Quem pode lançar a nota deste avaliador: editor das entrevistas e, no modo
 * AVALIADOR, só o membro ligado ao próprio perfil (o administrador global
 * lança por qualquer um). Membro que saiu da banca não recebe nota.
 */
export function podeLancarPor(dados, avaliador) {
  if (!dados?.pode_editar || !avaliador || avaliador.ativo === false)
    return false;
  if (dados?.configuracao?.lancamento !== "AVALIADOR") return true;
  if (dados.admin_global) return true;
  return Boolean(avaliador.perfil) && avaliador.perfil === dados.meu_perfil;
}

/**
 * Espelho de `private."FC_CALCULAR_ENTREVISTA"`: competência = média das notas
 * lançadas × peso (2 casas); total = soma. APTO: compareceu, total >= mínimo,
 * cada competência >= seu mínimo e nenhuma média eliminatória. Faltou (e a
 * ausência elimina) = INAPTO. Competência sem nota = SEM_PARECER.
 */
export function calcularEntrevista({ roteiro, compareceu, avaliacoes }) {
  const eliminatorias = (roteiro?.notas_eliminatorias || [])
    .map(numero)
    .filter((n) => n !== null);
  const competencias = (roteiro?.competencias || [])
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  let total = 0;
  let falta = false;
  let reprova = false;
  const linhas = competencias.map((c) => {
    const notas = (avaliacoes || [])
      .filter((a) => a.competencia === c.id)
      .map((a) => numero(a.nota))
      .filter((n) => n !== null);
    const peso = numero(c.peso) ?? 1;
    const minimo = minimoEmPontos(c);
    if (!notas.length) {
      falta = true;
      return {
        id: c.id,
        nome: c.nome,
        quantidade: 0,
        media: null,
        peso,
        nota: null,
        minimo,
        abaixoDoMinimo: false,
        eliminatoria: false,
      };
    }
    const media = notas.reduce((s, n) => s + n, 0) / notas.length;
    const nota = arredondar(media * peso);
    total += nota;
    const abaixoDoMinimo = minimo !== null && nota < minimo;
    const eliminatoria = eliminatorias.includes(arredondar(media));
    if (abaixoDoMinimo || eliminatoria) reprova = true;
    return {
      id: c.id,
      nome: c.nome,
      quantidade: notas.length,
      media: arredondar(media),
      peso,
      nota,
      minimo,
      abaixoDoMinimo,
      eliminatoria,
    };
  });
  const minimoTotal = numero(roteiro?.nota_minima_total);
  const totalFinal =
    compareceu === "N" ? 0 : falta && total === 0 ? null : arredondar(total);
  let parecer;
  if (compareceu === "N" && roteiro?.ausencia_elimina !== false)
    parecer = "INAPTO";
  else if (compareceu !== "S" || falta) parecer = "SEM_PARECER";
  else if (reprova || (minimoTotal !== null && total < minimoTotal))
    parecer = "INAPTO";
  else parecer = "APTO";
  return {
    competencias: linhas,
    total: totalFinal,
    parecer,
    falta,
    abaixoDoMinimoTotal:
      minimoTotal !== null &&
      !falta &&
      compareceu === "S" &&
      total < minimoTotal,
    minimoTotal,
  };
}

/** Os motivos do parecer, em frases curtas, para a ficha. */
export function motivosDoParecer(resultado, compareceu, roteiro) {
  const motivos = [];
  if (compareceu === "N")
    motivos.push(
      roteiro?.ausencia_elimina !== false
        ? "Faltou: a ausência elimina neste roteiro."
        : "Faltou.",
    );
  else if (compareceu !== "S") motivos.push("Comparecimento não informado.");
  for (const c of resultado.competencias) {
    if (c.quantidade === 0) motivos.push(`Sem nota em “${c.nome}”.`);
    if (c.eliminatoria)
      motivos.push(
        `“${c.nome}”: média ${String(c.media).replace(".", ",")} é eliminatória.`,
      );
    if (c.abaixoDoMinimo)
      motivos.push(
        `“${c.nome}” abaixo do mínimo (${String(c.minimo).replace(".", ",")}).`,
      );
  }
  if (resultado.abaixoDoMinimoTotal)
    motivos.push(
      `Total abaixo do mínimo (${String(resultado.minimoTotal).replace(".", ",")}).`,
    );
  return motivos;
}

/** Notas lançadas / esperadas (competências × avaliadores da banca). */
export function progressoDasNotas(convocado, avaliadores, competencias) {
  const ids = new Set((avaliadores || []).map((a) => a.id));
  const comps = new Set((competencias || []).map((c) => c.id));
  const lancadas = (convocado?.avaliacoes || []).filter(
    (a) =>
      ids.has(a.avaliador) &&
      comps.has(a.competencia) &&
      a.nota !== null &&
      a.nota !== undefined,
  ).length;
  return { lancadas, esperadas: ids.size * comps.size };
}

export const FILTROS_DA_FICHA = Object.freeze({
  vaga: "",
  banca: "",
  busca: "",
});

export function filtrarConvocados(convocados, filtros) {
  const busca = normalizarBusca(filtros?.busca);
  return (convocados || []).filter((c) => {
    if (filtros?.vaga && texto(c.vaga) !== filtros.vaga) return false;
    if (filtros?.banca === "sem" && c.banca !== null && c.banca !== undefined)
      return false;
    if (
      filtros?.banca &&
      filtros.banca !== "sem" &&
      String(c.banca ?? "") !== String(filtros.banca)
    )
      return false;
    if (
      busca &&
      !normalizarBusca(`${c.candidato} ${c.codigo ?? ""}`).includes(busca)
    )
      return false;
    return true;
  });
}

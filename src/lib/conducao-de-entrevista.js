/*
  Condução da entrevista de um edital, sem React e sem banco: a configuração
  (roteiro, composição da banca, modo de lançamento, membros), a ficha de
  notas e o cálculo do resultado. A convocação é a lista da Classificação
  (src/lib/convocacao-da-entrevista.js): aqui não há regra nem vagas próprias.

  O contrato é o das migrations 20260930220000_entrevistas_roteiros_e_notas.sql
  e 20261005150000_convocacao_unica_da_entrevista.sql
  (`obter_entrevistas_do_edital` e as RPCs de escrita, que devolvem o mesmo
  payload).

  `calcularEntrevista` é o espelho de `private."FC_CALCULAR_ENTREVISTA"`: a
  ficha mostra o parecer enquanto a pessoa digita, mas quem manda é o banco —
  depois de salvar, vale o que `lancar_notas_entrevista` devolveu. A mesma regra
  em Python (`monitora.entrevistas.calculo`, recálculo em lote) e os casos
  dourados dos três lados: `tests/fixtures/entrevistas/casos-de-calculo.json`.
*/
import { normalizarBusca } from "./entrevistas-do-painel.js";
import {
  arredondar,
  bancaDoRascunho,
  bancaParaRascunho,
  errosDaBanca,
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
 * Os editais de `listar_editais_entrevista` (já filtrados pela janela da
 * entrevista, pela liberação do administrador ou por convocados sem parecer),
 * marcados com `comEntrevistas` quando o painel "Resultados" já tem
 * entrevistas deles. O painel não acrescenta edital: o que está fora da janela
 * fica fora. Do mais novo para o mais antigo.
 */
export function editaisParaConduzir(doMonitoramento, doPainel) {
  const comEntrevistas = new Set(
    (doPainel || []).map((e) => e?.edital_id ?? e?.id).filter(Boolean),
  );
  const lista = (doMonitoramento || [])
    .filter((m) => m?.id)
    .map((m) => ({
      id: m.id,
      edital: texto(m.edital),
      unidade: texto(m.unidade),
      treinamento: m.treinamento === true,
      comEntrevistas: comEntrevistas.has(m.id),
      naJanela: m.na_janela !== false,
      janelaInicio: texto(m.janela_inicio),
      janelaFim: texto(m.janela_fim),
      liberadoAte: texto(m.liberado_ate),
      motivoLiberacao: texto(m.motivo_liberacao),
      visivelPor: texto(m.visivel_por) || "janela",
      pendentes: Number(m.pendentes) || 0,
    }));
  return lista.sort(
    (a, b) =>
      ordemDoEdital(b.edital) - ordemDoEdital(a.edital) ||
      a.edital.localeCompare(b.edital, "pt-BR", { numeric: true }) ||
      a.unidade.localeCompare(b.unidade, "pt-BR"),
  );
}

const dataCurta = (iso) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso.slice(8, 10) + "/" + iso.slice(5, 7)
    : "";

/** Complemento do nome do edital na lista ("liberado até 15/11", "fora da janela"). */
export function marcaDoEdital(item) {
  if (!item) return "";
  if (item.visivelPor === "liberado" && item.liberadoAte)
    return `liberado até ${dataCurta(item.liberadoAte)}`;
  if (item.visivelPor === "convocados") return `${item.pendentes} sem parecer`;
  if (item.visivelPor === "admin") return "fora da janela";
  return "";
}

/** A janela da entrevista em uma frase. */
export function textoDaJanela(item) {
  if (!item?.janelaInicio || !item?.janelaFim)
    return "sem etapa de entrevista no cronograma";
  return `janela da entrevista: ${dataCurta(item.janelaInicio)} a ${dataCurta(item.janelaFim)}`;
}

/** "06/2026 (sanitarista)" -> 2026 * 10000 + 6; sem número, 0 (vai para o fim). */
export function ordemDoEdital(edital) {
  const m = String(edital || "").match(/(\d{1,4})\s*\/\s*(\d{4})/);
  return m ? Number(m[2]) * 10000 + Number(m[1]) : 0;
}

/**
 * Nome do cargo para a tela, sem o resto que a planilha de origem deixou
 * ("Enfermeiro - DSEI Porto Velho em Excel (questionário NÍVEL SUPERIOR" ->
 * "Enfermeiro - DSEI Porto Velho"). Não muda o dado gravado.
 */
/**
 * O candidato é PcD? A análise traz o campo como texto da planilha ("SIM" /
 * "NÃO"); só o sim conta (também aceita booleano, "S", "true" e "1").
 */
export function ehPcd(valor) {
  if (typeof valor === "boolean") return valor;
  const t = String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return ["sim", "s", "true", "1", "yes"].includes(t);
}

export function nomeDoCargo(cargo) {
  return String(cargo || "")
    .replace(/\s+em\s+excel\b.*$/i, "")
    .replace(/\s*\(question[aá]rio[^)]*\)?\s*$/i, "")
    .replace(/[\s-]+$/, "")
    .trim();
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
    banca: bancaParaRascunho(cfg?.banca),
    lancamento: cfg?.lancamento === "AVALIADOR" ? "AVALIADOR" : "SECRETARIA",
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
 * Escolher o roteiro pré-preenche a composição da banca com o padrão dele (a
 * pessoa pode mudar depois).
 */
export function aplicarRoteiroNaConfiguracao(rascunho, roteiro) {
  if (!roteiro) return { ...rascunho, roteiro: "" };
  return {
    ...rascunho,
    roteiro: roteiro.id,
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
  Object.assign(erros, errosDaBanca(r?.banca));
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

/**
 * O `p_dados` de `configurar_entrevista_edital`: sem regra de convocação nem
 * vagas imediatas (as da Classificação valem).
 */
export function dadosDaConfiguracaoParaSalvar(r) {
  return {
    roteiro: r.roteiro,
    banca: bancaDoRascunho(r.banca),
    lancamento: r.lancamento === "AVALIADOR" ? "AVALIADOR" : "SECRETARIA",
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

/** Os aspectos do roteiro, em ordem (vazio = uma nota por avaliador). */
export function aspectosDoRoteiro(roteiro) {
  return (roteiro?.aspectos || [])
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

/**
 * Nota do avaliador na competência num roteiro com aspectos: a média dos
 * aspectos, sem arredondar; nula enquanto falta algum aspecto (o banco só
 * aceita todos). `notas`: `{ idDoAspecto: nota }` ou `[{ aspecto, nota }]`.
 */
export function mediaDosAspectos(aspectos, notas) {
  if (!aspectos?.length) return null;
  const mapa = Array.isArray(notas)
    ? Object.fromEntries(notas.map((n) => [n.aspecto, n.nota]))
    : notas || {};
  const valores = aspectos.map((a) => numero(mapa[a.id]));
  if (valores.some((v) => v === null)) return null;
  return valores.reduce((s, n) => s + n, 0) / valores.length;
}

/**
 * Espelho de `private."FC_CALCULAR_ENTREVISTA"`: competência = média das notas
 * lançadas × peso (2 casas); total = soma. APTO: compareceu, total >= mínimo,
 * cada competência >= seu mínimo e nenhuma média eliminatória. Faltou (e a
 * ausência elimina) = INAPTO. Competência sem nota = SEM_PARECER.
 *
 * Roteiro com aspectos (`roteiro.aspectos`): a nota do avaliador é a média
 * dos aspectos (`avaliacoes[].aspectos`, só com todos lançados), o total é a
 * soma sem arredondar (2 casas no fim) e não há média eliminatória (vale o
 * mínimo da competência).
 */
export function calcularEntrevista({ roteiro, compareceu, avaliacoes }) {
  const aspectos = aspectosDoRoteiro(roteiro);
  const comAspectos = aspectos.length > 0;
  const eliminatorias = comAspectos
    ? []
    : (roteiro?.notas_eliminatorias || [])
        .map(numero)
        .filter((n) => n !== null);
  const competencias = (roteiro?.competencias || [])
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  let total = 0;
  let bruto = 0;
  let falta = false;
  let reprova = false;
  const linhas = competencias.map((c) => {
    const notas = (avaliacoes || [])
      .filter((a) => a.competencia === c.id)
      .map((a) =>
        comAspectos ? mediaDosAspectos(aspectos, a.aspectos) : numero(a.nota),
      )
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
    bruto += media * peso;
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
  /* As notas têm 2 casas: no numeric do banco a soma é exata; aqui o ponto
     flutuante dá 11,999… no lugar de 12. Arredondada, compara como lá. */
  const soma = arredondar(comAspectos ? bruto : total);
  const minimoTotal = numero(roteiro?.nota_minima_total);
  const totalFinal = compareceu === "N" ? 0 : falta && soma === 0 ? null : soma;
  let parecer;
  if (compareceu === "N" && roteiro?.ausencia_elimina !== false)
    parecer = "INAPTO";
  else if (compareceu !== "S" || falta) parecer = "SEM_PARECER";
  else if (reprova || (minimoTotal !== null && soma < minimoTotal))
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
      soma < minimoTotal,
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

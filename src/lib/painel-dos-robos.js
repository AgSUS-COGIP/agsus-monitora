/*
  "Rodar com opções" e as últimas execuções dos robôs (Configurações ›
  Status das atualizações), sem DOM e sem rede.

  Lê o que get_painel_dos_robos e listar_vagas_dos_robos devolvem
  (supabase/migrations/20261007180000_painel_dos_robos.sql) e monta:
    - a lista de editais da escolha (por área; só os vigentes, pela regra da
      Avaliação documental, salvo "mostrar todos"; os escolhidos ficam);
    - o valor de cada edital no pedido (o robô da Empregare só aceita o
      número; a pré-classificação recebe o id, que não confunde áreas);
    - a prévia do que vai rodar ("5 vagas do 93/2026: 179698, 180231…");
    - as execuções normalizadas (parâmetros, quem pediu, resultado, por vaga)
      e o acompanhamento depois do pedido.
  A lista branca e a validação dos parâmetros são de src/lib/robos-de-carga.js
  (as mesmas da função api/rodar-carga.js).
*/
import { editalVigente } from "./avaliacao-documental/editais.js";
import { OPCOES_DOS_ROBOS, roboDeCarga } from "./robos-de-carga.js";

const data = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};
const numero = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? null
    : Number.isFinite(Number(valor))
      ? Number(valor)
      : null;
const texto = (valor) => String(valor ?? "").trim();
const lista = (valor) => (Array.isArray(valor) ? valor : []);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/* Quantos códigos a prévia mostra antes das reticências. */
export const CODIGOS_NA_PREVIA = 8;

/** Os códigos em texto curto: "179698, 180231, 180232…" (até `maximo`). */
export function textoDosCodigos(codigos, maximo = CODIGOS_NA_PREVIA) {
  const todos = lista(codigos);
  const vistos = todos.slice(0, maximo).join(", ");
  return todos.length > maximo ? `${vistos}…` : vistos;
}

const QUEM_DO_DISPARO = Object.freeze({
  AGENDA: "Agenda",
  GITHUB: "GitHub",
  ROBO: "Depois do robô",
  MONITORA: "MONITORA",
});

/* Situações gravadas pelos robôs → rótulo e tom (os selos da tela). */
export const SITUACOES_DA_EXECUCAO = Object.freeze({
  EM_ANDAMENTO: { rotulo: "Rodando", tom: "info" },
  CONCLUIDA: { rotulo: "Concluída", tom: "sucesso" },
  PARCIAL: { rotulo: "Parcial", tom: "aviso" },
  FALHOU: { rotulo: "Falhou", tom: "perigo" },
});

/* Situação de cada vaga na última carga (TB_EMPREGARE_VAGA). */
export const SITUACOES_DA_VAGA = Object.freeze({
  GRAVADA: { rotulo: "Gravada", tom: "sucesso" },
  RECUSADA: { rotulo: "Recusada pela trava", tom: "aviso" },
  INCOMPLETA: { rotulo: "Incompleta", tom: "perigo" },
  EM_CARGA: { rotulo: "Gravando", tom: "info" },
  SEM_ARQUIVO: { rotulo: "Sem arquivo", tom: "perigo" },
});

function normalizarEdital(e) {
  const edital = {
    id: texto(e?.id),
    numero: texto(e?.numero),
    edital: texto(e?.edital),
    area: texto(e?.area),
    unidade: texto(e?.unidade),
    ativo: e?.ativo,
    status: e?.status ?? "",
  };
  return { ...edital, vigente: editalVigente(edital) };
}

function parametrosDoRobo(filtro, forcada) {
  const editais = lista(filtro?.editais).map(texto).filter(Boolean);
  const vagas = lista(filtro?.vagas).map(texto).filter(Boolean);
  const limite = numero(filtro?.limite);
  const partes = [];
  if (vagas.length)
    partes.push(
      `${plural(vagas.length, "vaga", "vagas")}: ${textoDosCodigos(vagas, 5)}`,
    );
  else if (editais.length)
    partes.push(
      `${editais.length === 1 ? "Edital" : "Editais"} ${editais.join(", ")}`,
    );
  else partes.push("Editais em curso");
  if (limite) partes.push(`limite ${limite}`);
  if (forcada) partes.push("forçar");
  return { editais, vagas, limite, texto: partes.join(" · ") };
}

function normalizarExecucaoDoRobo(e) {
  const parametros = parametrosDoRobo(e?.filtro, e?.forcada === true);
  const pedidas = numero(e?.vagas_pedidas) ?? 0;
  const baixadas = numero(e?.vagas_baixadas) ?? 0;
  const falhas = numero(e?.vagas_falha) ?? 0;
  const recusadas = numero(e?.vagas_recusadas) ?? 0;
  const porVaga = lista(e?.por_vaga).map((v) => ({
    vaga: texto(v?.vaga),
    situacao: texto(v?.situacao) || "EM_CARGA",
    arquivo: numero(v?.arquivo),
    ativos: numero(v?.ativos),
    comLink: numero(v?.com_link),
    mensagem: texto(v?.mensagem),
  }));
  // Código pedido que não chegou a ser gravado nesta execução: sem arquivo.
  const vistas = new Set(porVaga.map((v) => v.vaga));
  for (const vaga of parametros.vagas)
    if (!vistas.has(vaga) && texto(e?.situacao) !== "EM_ANDAMENTO")
      porVaga.push({
        vaga,
        situacao: "SEM_ARQUIVO",
        arquivo: null,
        ativos: null,
        comLink: null,
        mensagem: "",
      });
  const resultado = [
    `${baixadas} de ${plural(pedidas, "vaga baixada", "vagas baixadas")}`,
  ];
  if (falhas) resultado.push(plural(falhas, "falha", "falhas"));
  if (recusadas)
    resultado.push(
      plural(recusadas, "recusada pela trava", "recusadas pela trava"),
    );
  const linhas = numero(e?.linhas);
  if (linhas !== null)
    resultado.push(plural(linhas, "candidato", "candidatos"));
  return {
    id: texto(e?.id),
    inicio: data(e?.inicio),
    fim: data(e?.fim),
    situacao: texto(e?.situacao) || "EM_ANDAMENTO",
    disparo: texto(e?.disparo),
    quem: texto(e?.quem) || QUEM_DO_DISPARO[texto(e?.disparo)] || "—",
    parametros,
    resultado: resultado.join(" · "),
    porVaga,
    mensagem: texto(e?.mensagem),
    execucao: texto(e?.execucao) || null,
  };
}

function normalizarExecucaoDaPreClassificacao(e, editais = []) {
  // O Recalcular e o "Rodar com opções" pedem pelo id: mostra o número.
  const pedido = lista(e?.pedido)
    .map(texto)
    .filter(Boolean)
    .map((p) => editais.find((ed) => ed.id === p.toLowerCase())?.numero || p);
  const partes = [
    pedido.length
      ? `${pedido.length === 1 ? "Edital" : "Editais"} ${pedido.join(", ")}`
      : texto(e?.disparo) === "ROBO"
        ? "Editais da última carga do robô"
        : "Editais ativos com vagas da Empregare",
  ];
  if (e?.refazer === true) partes.push("refazer lote");
  const n = (campo) => numero(e?.[campo]) ?? 0;
  return {
    id: texto(e?.id),
    inicio: data(e?.inicio),
    fim: data(e?.fim),
    situacao: texto(e?.situacao) || "EM_ANDAMENTO",
    disparo: texto(e?.disparo),
    quem: texto(e?.quem) || QUEM_DO_DISPARO[texto(e?.disparo)] || "—",
    parametros: { editais: pedido, texto: partes.join(" · ") },
    resultado: [
      plural(n("editais"), "edital", "editais"),
      plural(n("vagas"), "vaga", "vagas"),
      plural(n("inscritos"), "inscrito", "inscritos"),
      `lote ${n("lote")}`,
    ].join(" · "),
    porVaga: [],
    mensagem: texto(e?.mensagem),
    execucao: texto(e?.execucao) || null,
  };
}

/** O retorno de get_painel_dos_robos, normalizado para a tela. */
export function normalizarPainel(dados) {
  const areas = lista(dados?.areas)
    .map((a) => ({
      area: texto(a?.area),
      nome: texto(a?.nome) || texto(a?.area),
    }))
    .filter((a) => a.area);
  const editais = lista(dados?.editais)
    .map(normalizarEdital)
    .filter((e) => e.id && e.numero);
  return {
    geradoEm: data(dados?.gerado_em),
    areas,
    editais,
    execucoes: {
      empregare: lista(dados?.empregare).map(normalizarExecucaoDoRobo),
      pre_classificacao: lista(dados?.pre_classificacao).map((e) =>
        normalizarExecucaoDaPreClassificacao(e, editais),
      ),
    },
  };
}

/** As vagas de listar_vagas_dos_robos: { vaga, editalId, cargo, ultimaCarga, situacao, ativos }. */
export function normalizarVagas(dados) {
  return lista(dados)
    .map((v) => ({
      vaga: texto(v?.vaga),
      editalId: texto(v?.edital_id),
      cargo: texto(v?.cargo),
      ultimaCarga: data(v?.ultima_carga),
      situacao: texto(v?.situacao),
      ativos: numero(v?.ativos),
    }))
    .filter((v) => /^\d{1,20}$/.test(v.vaga));
}

const nomeDaArea = (areas, area) =>
  areas.find((a) => a.area === area)?.nome || area;

/** O rótulo do edital na escolha: "93/2026 · SESMT (Projetos)". */
export function rotuloDoEdital(edital, areas = []) {
  const unidade = edital.unidade ? ` · ${edital.unidade}` : "";
  const area = edital.area ? ` (${nomeDaArea(areas, edital.area)})` : "";
  return `${edital.numero}${unidade}${area}`;
}

/**
 * Os editais da escolha: da área (`area` vazia = todas), só os vigentes
 * (salvo `todos`) e sempre os já escolhidos. Devolve { opcoes, ocultos }
 * — opcoes no formato do MultiSelectBusca ({ value: id, label }).
 */
export function opcoesDosEditais(
  editais,
  areas,
  { area = "", todos = false, escolhidos = [] } = {},
) {
  const marcados = new Set(escolhidos);
  const daArea = lista(editais).filter((e) => !area || e.area === area);
  const visiveis = daArea.filter(
    (e) => todos || e.vigente || marcados.has(e.id),
  );
  return {
    opcoes: visiveis.map((e) => ({
      value: e.id,
      label: rotuloDoEdital(e, areas),
    })),
    ocultos: daArea.length - visiveis.length,
  };
}

/**
 * O valor de cada edital escolhido no pedido: o número no robô da Empregare
 * (o que ele aceita), o id nos outros (o mesmo número pode existir em duas
 * áreas). Sem repetir.
 */
export function editaisDoPedido(roboId, ids, editais) {
  const formato = OPCOES_DOS_ROBOS[roboId]?.editais;
  if (!formato) return [];
  const escolhidos = lista(ids)
    .map((id) => lista(editais).find((e) => e.id === id))
    .filter(Boolean);
  const valores = escolhidos.map((e) =>
    formato === "numero" ? e.numero : e.id,
  );
  return [...new Set(valores)];
}

const numerosDosEditais = (ids, editais) => [
  ...new Set(
    lista(ids)
      .map((id) => lista(editais).find((e) => e.id === id)?.numero)
      .filter(Boolean),
  ),
];

const doEdital = (numeros) =>
  numeros.length === 1
    ? ` do ${numeros[0]}`
    : numeros.length > 1
      ? ` de ${numeros.length} editais (${textoDosCodigos(numeros, 4)})`
      : "";

/**
 * A prévia do que vai rodar, antes de confirmar.
 *   robo        id do robô
 *   modo        o modo escolhido
 *   editaisIds  ids dos editais escolhidos; editais = a lista normalizada
 *   codigos     códigos de vaga válidos (separarCodigos)
 *   limite      número ou null (o padrão do robô)
 *   vagas       as vagas conhecidas (listar_vagas_dos_robos) dos editais e códigos
 * Devolve { frase, codigos, avisos } — `codigos` são os candidatos a rodar
 * (o robô corta no limite), `avisos` o que muda o resultado.
 */
export function previaDoDisparo({
  robo,
  modo = "normal",
  editaisIds = [],
  editais = [],
  codigos = [],
  limite = null,
  vagas = [],
}) {
  const nomes = numerosDosEditais(editaisIds, editais);
  const avisos = [];

  if (robo === "pre_classificacao") {
    const alvo = nomes.length
      ? `${plural(nomes.length, "edital", "editais")}: ${textoDosCodigos(nomes, 6)}`
      : "os editais ativos com vagas da Empregare";
    const prefixo =
      modo === "seco"
        ? "Calcula sem gravar"
        : modo === "refazer_lote"
          ? "Refaz o lote de"
          : "Pré-classifica";
    return { frase: `${prefixo} ${alvo}.`, codigos: [], avisos };
  }

  if (robo === "conferencias")
    return {
      frase:
        modo === "seco"
          ? "Todas as conferências, sem gravar avisos."
          : "Todas as conferências.",
      codigos: [],
      avisos,
    };

  if (robo !== "empregare") return { frase: "", codigos: [], avisos };

  if (modo === "fumaca")
    return {
      frase: "Só o teste de login na Empregare.",
      codigos: [],
      avisos,
    };

  const teto = limite || OPCOES_DOS_ROBOS.empregare.limite.padrao;
  let base;
  let alvo;
  if (codigos.length) {
    // Os editais escolhidos só servem de sugestão: com códigos, valem os códigos.
    const ids = new Set(editaisIds);
    const foraDosEditais = codigos.some(
      (c) => !ids.has(vagas.find((v) => v.vaga === c)?.editalId),
    );
    if (nomes.length && foraDosEditais)
      avisos.push("Com códigos de vaga, o robô roda só os códigos.");
    base = [...codigos];
    const dosCodigos = numerosDosEditais(
      [
        ...new Set(
          base
            .map((c) => vagas.find((v) => v.vaga === c)?.editalId)
            .filter(Boolean),
        ),
      ],
      editais,
    );
    alvo = doEdital(dosCodigos);
  } else if (nomes.length) {
    const ids = new Set(editaisIds);
    base = vagas.filter((v) => ids.has(v.editalId)).map((v) => v.vaga);
    alvo = doEdital(nomes);
    if (!base.length) {
      return {
        frase: `Nenhuma vaga da Empregare conhecida${alvo}.`,
        codigos: [],
        avisos: ["O robô procura de novo ao rodar; pode não exportar nada."],
      };
    }
  } else {
    return {
      frase: `As vagas dos editais em curso, até ${teto} (as nunca carregadas primeiro).`,
      codigos: [],
      avisos: modo === "forcar" ? ["Forçar: a trava da metade não vale."] : [],
    };
  }

  // Com mais vagas que o limite, o robô fica com as nunca carregadas ou
  // carregadas há mais tempo (listar_vagas_empregare): a prévia não sabe quais.
  const cortado = base.length > teto;
  if (cortado)
    avisos.push(
      `O limite corta em ${teto}: ficam as nunca carregadas ou carregadas há mais tempo.`,
    );
  if (modo === "forcar") avisos.push("Forçar: a trava da metade não vale.");
  const prefixo = modo === "seco" ? "Lista, sem baixar, " : "";
  const quantas = cortado
    ? `${teto} de ${base.length} vagas`
    : plural(base.length, "vaga", "vagas");
  const frase = `${prefixo}${quantas}${alvo}: ${textoDosCodigos(base)}`;
  return {
    frase: prefixo ? frase[0].toUpperCase() + frase.slice(1) : frase,
    codigos: base,
    avisos,
  };
}

/* Tolerância entre o clique e o início gravado pelo robô (relógios diferentes). */
const FOLGA_MS = 2 * 60000;

/**
 * O acompanhamento de um pedido feito nesta tela:
 *   pedido     { em: Date, modo } — o último pedido do robô
 *   execucoes  as execuções normalizadas do banco (pode ser [])
 *   github     disparo.robos[id] da função ({ rodando, execucao, ultima })
 * Devolve { etapa, execucao, url } — etapa: "aguardando" (o GitHub ainda
 * não mostrou), "github" (na fila ou rodando, sem registro no banco),
 * "rodando" (o banco registrou), "terminou" (o banco fechou) ou
 * "terminou_no_github" (o GitHub terminou sem registro no banco, como no
 * modo seco).
 */
export function acompanhamentoDoPedido({
  robo,
  pedido,
  execucoes = [],
  github = null,
}) {
  if (!pedido?.em) return null;
  const desde = pedido.em.getTime() - FOLGA_MS;
  const doBanco = lista(execucoes).find(
    (e) =>
      e.inicio &&
      e.inicio.getTime() >= desde &&
      (e.disparo === "MONITORA" || !e.disparo),
  );
  const ultima = github?.ultima;
  const criada = data(ultima?.criada);
  const doGithub = criada && criada.getTime() >= desde ? ultima : null;
  const url = doBanco?.execucao || doGithub?.url || github?.execucao || null;
  if (doBanco)
    return {
      etapa: doBanco.situacao === "EM_ANDAMENTO" ? "rodando" : "terminou",
      execucao: doBanco,
      url,
    };
  if (doGithub && doGithub.situacao === "completed")
    return {
      etapa: "terminou_no_github",
      execucao: null,
      url,
      conclusao: doGithub.conclusao,
      semRegistro:
        Boolean(roboDeCarga(robo)) &&
        (pedido.modo === "seco" || pedido.modo === "fumaca"),
    };
  if (doGithub || github?.rodando)
    return { etapa: "github", execucao: null, url };
  return { etapa: "aguardando", execucao: null, url: null };
}

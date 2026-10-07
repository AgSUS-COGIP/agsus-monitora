import type {
  EditalDoRobo,
  AreaDoRobo,
  ExecucaoDoRobo,
  PainelDosRobos,
  VagaDoRobo,
  PedidoDoRobo,
  EtapaDoPedido,
} from "../componentes/saude-das-cargas/tipos.ts";
/*
  "Rodar com opções" e as últimas execuções dos robôs (Configurações ›
  Status das atualizações), sem DOM e sem rede.

  Lê o que get_painel_dos_robos e listar_vagas_dos_robos devolvem
  (supabase/migrations/20261007190000_painel_dos_robos.sql) e monta:
    - a lista de editais da escolha (por área; só os vigentes, pela regra da
      Avaliação documental, salvo "mostrar todos"; os escolhidos ficam; o
      edital de treinamento só com "mostrar todos", com "· Treinamento");
    - o valor de cada edital no pedido (o robô da Empregare só aceita o
      número; a pré-classificação recebe o id, que não confunde áreas);
    - a prévia do que vai rodar ("5 vagas do 93/2026: 179698, 180231…");
    - as execuções normalizadas (parâmetros, quem pediu, resultado, por vaga)
      e o acompanhamento depois do pedido.
  A lista branca e a validação dos parâmetros são de src/lib/robos-de-carga.js
  (as mesmas de disparar_robo, no banco).
*/
import { editalVigente } from "./avaliacao-documental/editais.js";
import {
  ehEditalDeTreinamento,
  sufixoDeTreinamento,
} from "./edital-de-treinamento.js";
import { OPCOES_DOS_ROBOS, roboDeCarga } from "./robos-de-carga.js";

const registro = (valor: unknown): Record<string, unknown> =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
const registros = (valor: unknown): Record<string, unknown>[] =>
  (Array.isArray(valor) ? valor : [])
    .filter(
      (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v),
    )
    .map(registro);
const texto = (valor: unknown): string =>
  typeof valor === "string" ||
  typeof valor === "number" ||
  typeof valor === "boolean"
    ? String(valor).trim()
    : "";
const data = (valor: unknown): Date | null => {
  if (
    !(
      typeof valor === "string" ||
      typeof valor === "number" ||
      valor instanceof Date
    ) ||
    !valor
  )
    return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};
const numero = (valor: unknown): number | null => {
  if ((typeof valor !== "number" && typeof valor !== "string") || valor === "")
    return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};
const lista = <T>(valor: readonly T[] | null | undefined): readonly T[] =>
  Array.isArray(valor) ? valor : [];
const urlDaExecucao = (valor: unknown): string | null => {
  const t = texto(valor);
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? t : null;
  } catch {
    return null;
  }
};
const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

/* Quantos códigos a prévia mostra antes das reticências. */
export const CODIGOS_NA_PREVIA = 8;

/** Os códigos em texto curto: "179698, 180231, 180232…" (até `maximo`). */
export function textoDosCodigos(
  codigos: readonly string[] | null,
  maximo = CODIGOS_NA_PREVIA,
) {
  const todos = lista(codigos);
  const vistos = todos.slice(0, maximo).join(", ");
  return todos.length > maximo ? `${vistos}…` : vistos;
}

const QUEM_DO_DISPARO: Readonly<Record<string, string>> = Object.freeze({
  AGENDA: "Agenda",
  GITHUB: "GitHub",
  ROBO: "Depois do robô",
  MONITORA: "MONITORA",
});

/* Situações gravadas pelos robôs → rótulo e tom (os selos da tela). */
export const SITUACOES_DA_EXECUCAO: Readonly<
  Record<string, { rotulo: string; tom: string }>
> = Object.freeze({
  EM_ANDAMENTO: { rotulo: "Rodando", tom: "info" },
  CONCLUIDA: { rotulo: "Concluída", tom: "sucesso" },
  PARCIAL: { rotulo: "Parcial", tom: "aviso" },
  FALHOU: { rotulo: "Falhou", tom: "perigo" },
});

/* Situação de cada vaga na última carga (TB_EMPREGARE_VAGA). */
export const SITUACOES_DA_VAGA: Readonly<
  Record<string, { rotulo: string; tom: string }>
> = Object.freeze({
  GRAVADA: { rotulo: "Gravada", tom: "sucesso" },
  RECUSADA: { rotulo: "Recusada pela trava", tom: "aviso" },
  INCOMPLETA: { rotulo: "Incompleta", tom: "perigo" },
  EM_CARGA: { rotulo: "Gravando", tom: "info" },
  SEM_ARQUIVO: { rotulo: "Sem arquivo", tom: "perigo" },
});

function normalizarEdital(entrada: unknown): EditalDoRobo {
  const e = registro(entrada);
  const edital = {
    id: texto(e?.id),
    numero: texto(e?.numero),
    edital: texto(e?.edital),
    area: texto(e?.area),
    unidade: texto(e?.unidade),
    ativo: e?.ativo !== false,
    status: texto(e?.status),
    treinamento: ehEditalDeTreinamento(e),
  };
  // O edital de treinamento não está entre os vigentes: só vai se pedido ("mostrar todos").
  return {
    ...edital,
    vigente: !edital.treinamento && editalVigente(edital),
  };
}

function parametrosDoRobo(entrada: unknown, forcada: boolean) {
  const filtro = registro(entrada);
  const editais = (Array.isArray(filtro.editais) ? filtro.editais : [])
    .map(texto)
    .filter(Boolean);
  const vagas = (Array.isArray(filtro.vagas) ? filtro.vagas : [])
    .map(texto)
    .filter(Boolean);
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

function normalizarExecucaoDoRobo(entrada: unknown): ExecucaoDoRobo {
  const e = registro(entrada);
  const parametros = parametrosDoRobo(e?.filtro, e?.forcada === true);
  const pedidas = numero(e?.vagas_pedidas) ?? 0;
  const baixadas = numero(e?.vagas_baixadas) ?? 0;
  const falhas = numero(e?.vagas_falha) ?? 0;
  const recusadas = numero(e?.vagas_recusadas) ?? 0;
  const porVaga = registros(e.por_vaga).map((v) => ({
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
    quem:
      texto(e?.quem) ||
      (Object.hasOwn(QUEM_DO_DISPARO, texto(e.disparo))
        ? QUEM_DO_DISPARO[texto(e.disparo)]
        : "") ||
      "—",
    parametros,
    resultado: resultado.join(" · "),
    porVaga,
    mensagem: texto(e?.mensagem),
    execucao: urlDaExecucao(e?.execucao),
  };
}

function normalizarExecucaoDaPreClassificacao(
  entrada: unknown,
  editais: readonly EditalDoRobo[] = [],
): ExecucaoDoRobo {
  const e = registro(entrada);
  // O Recalcular e o "Rodar com opções" pedem pelo id: mostra o número.
  const pedido = (Array.isArray(e.pedido) ? e.pedido : [])
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
  const n = (campo: string) => numero(e?.[campo]) ?? 0;
  return {
    id: texto(e?.id),
    inicio: data(e?.inicio),
    fim: data(e?.fim),
    situacao: texto(e?.situacao) || "EM_ANDAMENTO",
    disparo: texto(e?.disparo),
    quem:
      texto(e?.quem) ||
      (Object.hasOwn(QUEM_DO_DISPARO, texto(e.disparo))
        ? QUEM_DO_DISPARO[texto(e.disparo)]
        : "") ||
      "—",
    parametros: { editais: pedido, texto: partes.join(" · ") },
    resultado: [
      plural(n("editais"), "edital", "editais"),
      plural(n("vagas"), "vaga", "vagas"),
      plural(n("inscritos"), "inscrito", "inscritos"),
      `lote ${n("lote")}`,
    ].join(" · "),
    porVaga: [],
    mensagem: texto(e?.mensagem),
    execucao: urlDaExecucao(e?.execucao),
  };
}

/** O retorno de get_painel_dos_robos, normalizado para a tela. */
export function normalizarPainel(entrada: unknown): PainelDosRobos {
  const dados = registro(entrada);
  const areas = registros(dados.areas)
    .map((a) => ({
      area: texto(a?.area),
      nome: texto(a?.nome) || texto(a?.area),
    }))
    .filter((a) => a.area);
  const editais = registros(dados.editais)
    .map(normalizarEdital)
    .filter((e) => e.id && e.numero);
  return {
    geradoEm: data(dados?.gerado_em),
    areas,
    editais,
    execucoes: {
      empregare: registros(dados.empregare).map(normalizarExecucaoDoRobo),
      pre_classificacao: registros(dados.pre_classificacao).map((e) =>
        normalizarExecucaoDaPreClassificacao(e, editais),
      ),
    },
  };
}

/** As vagas de listar_vagas_dos_robos: { vaga, editalId, cargo, ultimaCarga, situacao, ativos }. */
export function normalizarVagas(dados: unknown): VagaDoRobo[] {
  return registros(dados)
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

const nomeDaArea = (areas: readonly AreaDoRobo[], area: string) =>
  areas.find((a) => a.area === area)?.nome || area;

/** O rótulo do edital na escolha: "93/2026 · SESMT (Projetos)". */
export function rotuloDoEdital(
  edital: EditalDoRobo,
  areas: readonly AreaDoRobo[] = [],
) {
  const unidade = edital.unidade ? ` · ${edital.unidade}` : "";
  const area = edital.area ? ` (${nomeDaArea(areas, edital.area)})` : "";
  return `${edital.numero}${unidade}${area}${sufixoDeTreinamento(edital)}`;
}

/**
 * Os editais da escolha: da área (`area` vazia = todas), só os vigentes
 * (salvo `todos`) e sempre os já escolhidos. Devolve { opcoes, ocultos }
 * — opcoes no formato do MultiSelectBusca ({ value: id, label }).
 */
export function opcoesDosEditais(
  editais: readonly EditalDoRobo[],
  areas: readonly AreaDoRobo[],
  {
    area = "",
    todos = false,
    escolhidos = [],
  }: { area?: string; todos?: boolean; escolhidos?: readonly string[] } = {},
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
export function editaisDoPedido(
  roboId: string,
  ids: readonly string[],
  editais: readonly EditalDoRobo[],
) {
  const formato = OPCOES_DOS_ROBOS[roboId]?.editais;
  if (!formato) return [];
  const escolhidos = lista(ids)
    .map((id) => lista(editais).find((e) => e.id === id))
    .filter((e): e is EditalDoRobo => Boolean(e));
  const valores = escolhidos.map((e) =>
    formato === "numero" ? e.numero : e.id,
  );
  return [...new Set(valores)];
}

const numerosDosEditais = (
  ids: readonly string[],
  editais: readonly EditalDoRobo[],
) => [
  ...new Set(
    lista(ids)
      .map((id) => lista(editais).find((e) => e.id === id)?.numero)
      .filter((n): n is string => Boolean(n)),
  ),
];

const doEdital = (numeros: readonly string[]) =>
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
}: {
  robo: string;
  modo?: string;
  editaisIds?: readonly string[];
  editais?: readonly EditalDoRobo[];
  codigos?: readonly string[];
  limite?: number | null;
  vagas?: readonly VagaDoRobo[];
}) {
  const nomes = numerosDosEditais(editaisIds, editais);
  const avisos: string[] = [];

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

  const teto = limite || OPCOES_DOS_ROBOS.empregare?.limite?.padrao || 60;
  let base;
  let alvo;
  if (codigos.length) {
    // Os editais escolhidos só servem de sugestão: com códigos, valem os códigos.
    const ids = new Set(editaisIds);
    const foraDosEditais = codigos.some(
      (c) => !ids.has(vagas.find((v) => v.vaga === c)?.editalId ?? ""),
    );
    if (nomes.length && foraDosEditais)
      avisos.push("Com códigos de vaga, o robô roda só os códigos.");
    base = [...codigos];
    const dosCodigos = numerosDosEditais(
      [
        ...new Set(
          base
            .map((c) => vagas.find((v) => v.vaga === c)?.editalId)
            .filter((n): n is string => Boolean(n)),
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
    frase: prefixo ? (frase[0] ?? "").toUpperCase() + frase.slice(1) : frase,
    codigos: base,
    avisos,
  };
}

/* Tolerância entre o clique e o início gravado pelo robô (relógios diferentes). */
const FOLGA_MS = 2 * 60000;

/**
 * O acompanhamento de um pedido feito nesta tela:
 *   pedido     { em: Date, modo, disparo } — o último pedido do robô;
 *              `disparo` é a situação do pedido no banco (situacaoDoPedido de
 *              src/lib/robos-de-carga.js: PEDIDO, ACEITO, FALHOU, SEM_TOKEN)
 *   execucoes  as execuções normalizadas do banco (pode ser [])
 * Devolve { etapa, execucao, url } — etapa: "aguardando" (o GitHub ainda não
 * respondeu), "recusado" (o GitHub não aceitou ou falta a chave; `texto` diz
 * o que fazer), "github" (aceito, sem registro no banco ainda; `semRegistro`
 * nos modos seco e fumaça, cujo resultado fica só no resumo do GitHub),
 * "rodando" (o banco registrou) ou "terminou" (o banco fechou).
 */
export function acompanhamentoDoPedido({
  robo,
  pedido,
  execucoes = [],
}: {
  robo: string;
  pedido: PedidoDoRobo | null | undefined;
  execucoes?: readonly ExecucaoDoRobo[] | null;
}): EtapaDoPedido | null {
  if (!pedido?.em) return null;
  const desde = pedido.em.getTime() - FOLGA_MS;
  const doBanco = lista(execucoes).find(
    (e) =>
      e.inicio &&
      e.inicio.getTime() >= desde &&
      (e.disparo === "MONITORA" || !e.disparo),
  );
  if (doBanco)
    return {
      etapa: doBanco.situacao === "EM_ANDAMENTO" ? "rodando" : "terminou",
      execucao: doBanco,
      url: doBanco.execucao || null,
    };
  const disparo = pedido.disparo;
  if (disparo?.aviso)
    return {
      etapa: "recusado",
      execucao: null,
      url: null,
      texto: disparo.aviso.texto,
    };
  if (disparo?.aceito)
    return {
      etapa: "github",
      execucao: null,
      url: null,
      semRegistro:
        Boolean(roboDeCarga(robo)) &&
        (pedido.modo === "seco" || pedido.modo === "fumaca"),
    };
  return { etapa: "aguardando", execucao: null, url: null };
}

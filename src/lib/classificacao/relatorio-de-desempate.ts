import type { PlanilhaDaClassificacao } from "./tipos-dos-documentos.ts";
import { escapeHtml } from "../sanitize";
import { dataBR, formatarNota } from "./numeros.ts";

/*
  O relatório de desempate de uma lista gerada, como a tela o mostra e exporta
  (Classificação › Listas › "Relatório de desempate"). Quem calcula é o Python
  (python/monitora/classificacao/desempate.py, a MESMA ordenação do motor) e
  quem guarda é o banco (TB_RELATORIO_DESEMPATE, lido por
  obter_desempate_da_lista; migrations 20261023140000 e 20261023230000). Aqui,
  sem DOM: a leitura da resposta (malformada = sem relatório, o botão não
  aparece), as planilhas do XLSX (Resumo, Grupos, Pares e Candidatos, com
  filtro) e a página do PDF (impressão: cabeçalho, resumo, índice por vaga com
  links e o cabeçalho da vaga repetido em cada página).

  Versões lidas: 1 (sem cabeçalho, idade só como a ordem no grupo) e 2
  (cabeçalho da lista, modalidades com o nome, idade em anos na data de corte,
  resumo). O resumo e o nome de cada lista saem dos grupos, nas duas versões.

  O candidato vem com o id da análise, o código de inscrição e o nome
  (documento interno da comissão; a RPC só o entrega a quem lê a lista). O
  Python grava o relatório só quando o retrato que ele calcula é o da lista
  registrada, então o nome é o mesmo da lista. Nunca a data de nascimento.
*/

export interface CandidatoDoDesempate {
  analiseId: string;
  codigo: string;
  nome: string;
  posicao: number;
  /** Idade em anos na data de corte (versão 2, só quando a idade pesou no grupo: chegou ao critério idade ou o 60+ decidiu um par). */
  idade: number | null;
  valores: Record<string, unknown>;
  decididoPor: string | null;
}
export interface ParDoDesempate {
  acima: string;
  abaixo: string;
  criterio: string | null;
  valores: unknown[] | null;
  resolucao: string;
  horaDaCertidao?: boolean;
}
export interface EmpateAteOFim {
  analiseIds: string[];
  codigos: string[];
  nomes: string[];
  resolucao: string;
  chave: string | null;
  registro: string | null;
}
export interface GrupoDoDesempate {
  lista: string;
  /** "Lista geral", "Lista de cota: Pretos e pardos (PP)"… */
  listaNome: string;
  cota: boolean;
  notaTexto: string;
  posicoes: number[];
  resolucao: string;
  criteriosAplicados: string[];
  candidatos: CandidatoDoDesempate[];
  pares: ParDoDesempate[];
  empatadosAteOFim: EmpateAteOFim[];
}
export interface VagaDoDesempate {
  chave: string;
  codigo: string;
  cargo: string;
  grupos: GrupoDoDesempate[];
}
export interface CriterioDoDesempate {
  codigo: string;
  rotulo: string;
  direcao: string;
}
export interface CabecalhoDoDesempate {
  edital: { numero: string; unidade: string };
  lista: {
    id: string | null;
    numero: number | null;
    tipo: string;
    tipoNome: string;
    fase: string;
    geradaEm: string | null;
    geradaEmTexto: string;
    geradaPor: string | null;
  };
  regra: { versao: number | null };
}
export interface RelatorioDeDesempate {
  versao: number;
  tipo: string;
  dataCorte: string;
  empateNaLista: string;
  empateFinal: { metodo: string; numeracao: string } | null;
  /** Só na versão 2. */
  cabecalho: CabecalhoDoDesempate | null;
  modalidades: { codigo: string; nome: string }[];
  criterios: CriterioDoDesempate[];
  vagas: VagaDoDesempate[];
}
export interface DesempateDaLista {
  listaId: string;
  geradoEm: string;
  daListaAtual: boolean;
  grupos: number;
  relatorio: RelatorioDeDesempate;
  texto: string;
}

/** A versão do formato que o Python grava hoje (desempate.py, VERSAO_DO_RELATORIO). */
export const VERSAO_DO_RELATORIO = 2;
/** As versões que esta tela lê: a 1 continua abrindo (relatórios gravados antes da 2). */
export const VERSOES_LIDAS: readonly number[] = Object.freeze([1, 2]);

type Registro = Record<string, unknown>;
const registro = (valor: unknown): Registro | null =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? Object.fromEntries(Object.entries(valor))
    : null;
const lista = (valor: unknown): unknown[] | null =>
  Array.isArray(valor) ? valor : null;
const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
const textoOuNulo = (valor: unknown) =>
  typeof valor === "string" && valor ? valor : null;
const inteiroOuNulo = (valor: unknown) =>
  typeof valor === "number" && Number.isInteger(valor) ? valor : null;
const textos = (valor: unknown) =>
  (lista(valor) || []).filter((v): v is string => typeof v === "string");

const ehCota = (codigo: string) => codigo !== "GERAL" && codigo !== "AC";

/** "Lista geral", "Lista de cota: Pretos e pardos (PP)" ou "Lista de Ampla concorrência (AC)" (como o Python). */
export function nomeDaLista(
  codigo: string,
  nomes: Readonly<Record<string, string>> = {},
) {
  if (codigo === "GERAL") return "Lista geral";
  const nome = nomes[codigo] || codigo;
  const rotulo = nome === codigo ? nome : `${nome} (${codigo})`;
  return ehCota(codigo) ? `Lista de cota: ${rotulo}` : `Lista de ${rotulo}`;
}

function candidato(valor: unknown): CandidatoDoDesempate | null {
  const c = registro(valor);
  if (!c || typeof c.analiseId !== "string" || typeof c.posicao !== "number")
    return null;
  return {
    analiseId: c.analiseId,
    codigo: texto(c.codigo),
    nome: texto(c.nome),
    posicao: c.posicao,
    idade: inteiroOuNulo(c.idade),
    valores: registro(c.valores) || {},
    decididoPor: typeof c.decididoPor === "string" ? c.decididoPor : null,
  };
}

function par(valor: unknown): ParDoDesempate | null {
  const p = registro(valor);
  if (!p || typeof p.acima !== "string" || typeof p.abaixo !== "string")
    return null;
  return {
    acima: p.acima,
    abaixo: p.abaixo,
    criterio: typeof p.criterio === "string" ? p.criterio : null,
    valores: lista(p.valores),
    resolucao: texto(p.resolucao),
    ...(p.horaDaCertidao === true ? { horaDaCertidao: true } : {}),
  };
}

function empate(valor: unknown): EmpateAteOFim | null {
  const e = registro(valor);
  if (!e) return null;
  return {
    analiseIds: textos(e.analiseIds),
    codigos: textos(e.codigos),
    nomes: textos(e.nomes),
    resolucao: texto(e.resolucao),
    chave: typeof e.chave === "string" ? e.chave : null,
    registro: typeof e.registro === "string" ? e.registro : null,
  };
}

/* Todos os itens válidos ou nenhum: uma parte malformada não vira relatório pela metade. */
function todos<T>(valor: unknown, ler: (v: unknown) => T | null): T[] | null {
  const itens = lista(valor);
  if (!itens) return null;
  const lidos = itens.map(ler);
  return lidos.every((x): x is T => x !== null) ? lidos : null;
}

function grupo(
  valor: unknown,
  nomes: Readonly<Record<string, string>>,
): GrupoDoDesempate | null {
  const g = registro(valor);
  if (!g) return null;
  const candidatos = todos(g.candidatos, candidato);
  const pares = todos(g.pares, par);
  const empatados = todos(g.empatadosAteOFim, empate);
  if (!candidatos || !pares || !empatados) return null;
  const codigo = texto(g.lista);
  return {
    lista: codigo,
    listaNome: texto(g.listaNome) || nomeDaLista(codigo, nomes),
    cota: typeof g.cota === "boolean" ? g.cota : ehCota(codigo),
    notaTexto: texto(g.notaTexto),
    posicoes: (lista(g.posicoes) || []).filter(
      (n): n is number => typeof n === "number",
    ),
    resolucao: texto(g.resolucao),
    criteriosAplicados: textos(g.criteriosAplicados),
    candidatos,
    pares,
    empatadosAteOFim: empatados,
  };
}

function vaga(
  valor: unknown,
  nomes: Readonly<Record<string, string>>,
): VagaDoDesempate | null {
  const v = registro(valor);
  const grupos = v && todos(v.grupos, (g) => grupo(g, nomes));
  if (!v || !grupos) return null;
  return {
    chave: texto(v.chave),
    codigo: texto(v.codigo),
    cargo: texto(v.cargo),
    grupos,
  };
}

function cabecalho(valor: unknown): CabecalhoDoDesempate | null {
  const c = registro(valor);
  const edital = registro(c?.edital);
  const l = registro(c?.lista);
  if (!c || !edital || !l) return null;
  return {
    edital: { numero: texto(edital.numero), unidade: texto(edital.unidade) },
    lista: {
      id: textoOuNulo(l.id),
      numero: inteiroOuNulo(l.numero),
      tipo: texto(l.tipo),
      tipoNome: texto(l.tipoNome),
      fase: texto(l.fase),
      geradaEm: textoOuNulo(l.geradaEm),
      geradaEmTexto: texto(l.geradaEmTexto),
      geradaPor: textoOuNulo(l.geradaPor),
    },
    regra: { versao: inteiroOuNulo(registro(c.regra)?.versao) },
  };
}

/**
 * A resposta de obter_desempate_da_lista; null quando a lista não tem
 * relatório, a resposta está malformada ou é de uma versão que esta tela não lê.
 */
export function lerDesempateDaLista(valor: unknown): DesempateDaLista | null {
  const d = registro(valor);
  const r = registro(d?.relatorio);
  if (!d || !r || typeof r.versao !== "number") return null;
  if (!VERSOES_LIDAS.includes(r.versao)) return null;
  const modalidades = (lista(r.modalidades) || []).flatMap((m) => {
    const x = registro(m);
    return x && typeof x.codigo === "string"
      ? [{ codigo: x.codigo, nome: texto(x.nome) || x.codigo }]
      : [];
  });
  const nomes = Object.fromEntries(modalidades.map((m) => [m.codigo, m.nome]));
  const vagas = todos(r.vagas, (v) => vaga(v, nomes));
  const criterios = todos(r.criterios, (v) => {
    const c = registro(v);
    return c && typeof c.codigo === "string"
      ? { codigo: c.codigo, rotulo: texto(c.rotulo), direcao: texto(c.direcao) }
      : null;
  });
  if (!vagas || !criterios || typeof d.lista_id !== "string") return null;
  const final = registro(r.empateFinal);
  return {
    listaId: d.lista_id,
    geradoEm: texto(d.gerado_em),
    daListaAtual: d.da_lista_atual === true,
    grupos: typeof d.grupos === "number" ? d.grupos : 0,
    relatorio: {
      versao: r.versao,
      tipo: texto(r.tipo),
      dataCorte: texto(r.dataCorte),
      empateNaLista: texto(r.empateNaLista),
      empateFinal: final
        ? { metodo: texto(final.metodo), numeracao: texto(final.numeracao) }
        : null,
      cabecalho: r.versao >= 2 ? cabecalho(r.cabecalho) : null,
      modalidades,
      criterios,
      vagas,
    },
    texto: texto(d.texto),
  };
}

/*
  O PREPARO do relatório (TB_PREPARO_DESEMPATE, migration 20261023170000):
  gerar a lista pede o relatório ao job do Python; até ele chegar, a tela diz
  "sendo preparado…" e relê de tempos em tempos.
*/
export const SITUACOES_DO_PREPARO = Object.freeze([
  "PEDIDO",
  "PREPARANDO",
  "PRONTO",
  "NAO_CONFERE",
  "FALHOU",
  "DESLIGADA",
  "SEM_DISPARO",
] as const);
export type SituacaoDoPreparo = (typeof SITUACOES_DO_PREPARO)[number];
export interface PreparoDoDesempate {
  situacao: SituacaoDoPreparo;
  pedidoEm: string;
}
export interface RespostaDoDesempate {
  preparo: PreparoDoDesempate | null;
  desempate: DesempateDaLista | null;
}

/** Quanto a tela espera o relatório (o job leva ~1 min) antes de dizer que não chegou. */
export const ESPERA_DO_RELATORIO_MS = 15 * 60 * 1000;
/** De quanto em quanto tempo a tela relê enquanto o relatório é preparado. */
export const RELEITURA_DO_PREPARO_MS = 10 * 1000;

const ehSituacao = (v: unknown): v is SituacaoDoPreparo =>
  SITUACOES_DO_PREPARO.some((s) => s === v);

/** A resposta inteira de obter_desempate_da_lista: o relatório (se houver) e o preparo. */
export function lerRespostaDoDesempate(valor: unknown): RespostaDoDesempate {
  const p = registro(registro(valor)?.preparo);
  return {
    preparo:
      p && ehSituacao(p.situacao)
        ? { situacao: p.situacao, pedidoEm: texto(p.pedido_em) }
        : null,
    desempate: lerDesempateDaLista(valor),
  };
}

export type EstadoDoRelatorio =
  "pronto" | "preparando" | "nao_confere" | "falhou" | "nada";

/**
 * O que a tela mostra: os botões (pronto), "sendo preparado…" (pedido há
 * menos de ESPERA_DO_RELATORIO_MS), o aviso de que não confere ou de que não
 * saiu, ou nada (lista antiga, automação desligada, sem resposta).
 */
export function estadoDoRelatorio(
  resposta: RespostaDoDesempate | null,
  agora = Date.now(),
): EstadoDoRelatorio {
  if (!resposta) return "nada";
  if (resposta.desempate) return "pronto";
  const preparo = resposta.preparo;
  if (!preparo) return "nada";
  if (preparo.situacao === "PEDIDO" || preparo.situacao === "PREPARANDO") {
    const pedido = Date.parse(preparo.pedidoEm);
    return Number.isFinite(pedido) && agora - pedido >= ESPERA_DO_RELATORIO_MS
      ? "falhou"
      : "preparando";
  }
  if (preparo.situacao === "NAO_CONFERE") return "nao_confere";
  if (preparo.situacao === "FALHOU" || preparo.situacao === "SEM_DISPARO")
    return "falhou";
  return "nada";
}

const RESOLUCOES: Readonly<Record<string, string>> = Object.freeze({
  CRITERIOS: "decidido pelos critérios",
  SORTEIO: "sorteio registrado",
  MANUAL: "decisão manual registrada",
  INSCRICAO: "ordem de inscrição",
  MESMA_POSICAO: "ficam na mesma posição",
  PENDENTE: "aguardando o registro (pendente)",
  MESMA_POSICAO_LISTA: "mesma posição (regra da lista)",
  EMPATE_FINAL: "empate até o fim",
});
const resolucao = (codigo: string) =>
  codigo
    .split("+")
    .map((c) => RESOLUCOES[c] || c)
    .join(" + ");

const TITULOS: Readonly<Record<string, string>> = Object.freeze({
  PRELIMINAR: "Avaliação documental",
  CONVOCACAO: "Convocação para entrevista",
  ENTREVISTA: "Resultado da entrevista",
  FINAL: "Resultado final",
});
const METODOS: Readonly<Record<string, string>> = Object.freeze({
  SORTEIO: "sorteio registrado",
  ORDEM_INSCRICAO: "ordem de inscrição",
  MESMA_POSICAO: "mesma posição",
  DECISAO_MANUAL: "decisão manual com justificativa",
});

const anos = (idade: number | null) =>
  idade === null ? "sem data de nascimento" : `${idade} anos`;

/**
 * O valor de um critério como texto ("sim (61 anos)", "1.200 dias", "44 anos,
 * 1º mais velho do grupo"). `idade` (anos na data de corte) acompanha o 60+.
 * Versão 1 da maior idade: só a ordem no grupo.
 */
export function textoDoValor(
  valor: unknown,
  criterio: string,
  idade: number | null = null,
) {
  if (valor === null || valor === undefined) return "sem dado";
  if (typeof valor === "boolean") {
    const base = valor ? "sim" : "não";
    return criterio === "IDOSO_60" && idade !== null
      ? `${base} (${anos(idade)})`
      : base;
  }
  const v = registro(valor);
  if (criterio === "MAIOR_IDADE" && v) {
    const ordem = typeof v.ordemDeIdade === "number" ? v.ordemDeIdade : null;
    const base =
      "idade" in v
        ? anos(inteiroOuNulo(v.idade)) +
          (ordem ? `, ${ordem}º mais velho do grupo` : "")
        : ordem
          ? `${ordem}º mais velho do grupo`
          : "sem data de nascimento";
    return v.certidao === true ? base : `${base}, sem certidão`;
  }
  if (typeof valor !== "number") return String(valor);
  if (criterio === "EXP_PROFISSIONAL_TEMPO")
    return `${formatarNota(valor, 0)} dias`;
  return formatarNota(valor, Number.isInteger(valor) ? 0 : 2);
}

/** "Vaga 101 — Enfermeiro (Nível Superior)"; sem um dos dois, o que houver. */
export const tituloDaVaga = (v: VagaDoDesempate) =>
  v.codigo && v.cargo
    ? `Vaga ${v.codigo} — ${v.cargo}`
    : `Vaga ${v.codigo || v.cargo}`;

const ordinal = (n: number | undefined) =>
  typeof n === "number" ? `${n}º` : "—";
const posicoesDoGrupo = (g: GrupoDoDesempate) => {
  const [primeira, ultima] = [g.posicoes[0], g.posicoes[g.posicoes.length - 1]];
  return primeira === ultima
    ? ordinal(primeira)
    : `${ordinal(primeira)} a ${ordinal(ultima)}`;
};

export interface ResumoDoDesempate {
  grupos: number;
  decididosPorCriterio: number;
  empatadosAteOFim: number;
  pendentes: number;
  mesmaPosicaoNaLista: number;
  /** Na ordem da regra, só os que decidiram algum par. */
  porCriterio: {
    codigo: string;
    rotulo: string;
    pares: number;
    grupos: number;
  }[];
  /** Cada sequência de empatados em todos os critérios, por resolução. */
  empatesAteOFim: {
    resolucao: string;
    rotulo: string;
    empates: number;
    candidatos: number;
  }[];
}

/** O resumo do topo, calculado dos grupos (o mesmo que o Python grava em `resumo` e `totais`). */
export function resumoDoDesempate(
  desempate: DesempateDaLista,
): ResumoDoDesempate {
  const { criterios, vagas } = desempate.relatorio;
  const porCriterio = new Map<string, { pares: number; grupos: number }>(
    criterios.map((c) => [c.codigo, { pares: 0, grupos: 0 }]),
  );
  const porResolucao = new Map<
    string,
    { empates: number; candidatos: number }
  >();
  const resumo = {
    grupos: 0,
    decididosPorCriterio: 0,
    empatadosAteOFim: 0,
    pendentes: 0,
    mesmaPosicaoNaLista: 0,
  };
  for (const v of vagas)
    for (const g of v.grupos) {
      resumo.grupos += 1;
      if (g.resolucao === "CRITERIOS") resumo.decididosPorCriterio += 1;
      else if (g.resolucao === "MESMA_POSICAO_LISTA")
        resumo.mesmaPosicaoNaLista += 1;
      else resumo.empatadosAteOFim += 1;
      const decidiu = new Set<string>();
      for (const p of g.pares)
        if (p.criterio) {
          const item = porCriterio.get(p.criterio) || { pares: 0, grupos: 0 };
          item.pares += 1;
          porCriterio.set(p.criterio, item);
          decidiu.add(p.criterio);
        }
      for (const k of decidiu) {
        const item = porCriterio.get(k);
        if (item) item.grupos += 1;
      }
      for (const e of g.empatadosAteOFim) {
        if (e.resolucao.split("+").includes("PENDENTE")) resumo.pendentes += 1;
        const item = porResolucao.get(e.resolucao) || {
          empates: 0,
          candidatos: 0,
        };
        item.empates += 1;
        item.candidatos += e.analiseIds.length;
        porResolucao.set(e.resolucao, item);
      }
    }
  const rotulo = (codigo: string) =>
    criterios.find((c) => c.codigo === codigo)?.rotulo || codigo;
  return {
    ...resumo,
    porCriterio: [...porCriterio]
      .filter(([, n]) => n.pares > 0)
      .map(([codigo, n]) => ({ codigo, rotulo: rotulo(codigo), ...n })),
    empatesAteOFim: [...porResolucao].map(([codigo, n]) => ({
      resolucao: codigo,
      rotulo: resolucao(codigo),
      ...n,
    })),
  };
}

/** "2026-10-23T13:05:00+00:00" → "23/10/2026 10:05" (horário de Brasília); inválido → "". */
export function momentoBR(valor: string) {
  const momento = Date.parse(valor);
  if (!Number.isFinite(momento)) return "";
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(momento)
      .map((p) => [p.type, p.value]),
  );
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

/**
 * O cabeçalho como pares [rótulo, valor], na ordem do documento: edital,
 * unidade, lista, fase, geração, identificador, quando e por quem foi gerada,
 * versão da regra, data de corte e quando o relatório foi preparado. Versão 1:
 * só o que ela tem.
 */
export function linhasDoCabecalho(
  desempate: DesempateDaLista,
): [string, string][] {
  const r = desempate.relatorio;
  const c = r.cabecalho;
  const linhas: [string, string][] = [];
  const incluir = (
    rotulo: string,
    valor: string | number | null | undefined,
  ) => {
    if (valor !== null && valor !== undefined && valor !== "")
      linhas.push([rotulo, String(valor)]);
  };
  incluir("Edital", c?.edital.numero ? `nº ${c.edital.numero}` : "");
  incluir("Unidade", c?.edital.unidade);
  incluir("Lista", c?.lista.tipoNome || TITULOS[r.tipo] || r.tipo);
  incluir("Fase", c?.lista.fase);
  incluir("Geração", c?.lista.numero ? `${c.lista.numero}ª desta lista` : "");
  incluir("Identificador da lista", c?.lista.id || desempate.listaId);
  incluir("Lista gerada em", c?.lista.geradaEmTexto);
  incluir("Gerada por", c?.lista.geradaPor);
  incluir("Versão da regra", c?.regra.versao);
  incluir("Data de corte (idade e 60+)", dataBR(r.dataCorte));
  incluir(
    "Relatório preparado em",
    momentoBR(desempate.geradoEm) +
      (desempate.daListaAtual ? "" : " (de outra versão desta lista)"),
  );
  return linhas;
}

/** "1) 60+ (sim antes de não); 2) …" ou a regra da lista sem critérios. */
function regraDoEmpate(r: RelatorioDeDesempate) {
  const direcoes: Readonly<Record<string, string>> = {
    SIM_PRIMEIRO: "sim antes de não",
    NAO_PRIMEIRO: "não antes de sim",
    MAIOR_PRIMEIRO: "maior primeiro",
    MENOR_PRIMEIRO: "menor primeiro",
  };
  const criterios =
    r.empateNaLista === "MESMA_POSICAO"
      ? "Nesta lista o empate de nota fica na mesma posição (a regra não aplica os critérios)."
      : r.criterios.length
        ? `Critérios da regra, nesta ordem: ${r.criterios
            .map(
              (c, i) =>
                `${i + 1}) ${c.rotulo} (${direcoes[c.direcao] || c.direcao})`,
            )
            .join("; ")}.`
        : "A regra não tem critérios de desempate.";
  const final = r.empateFinal
    ? ` Empate que sobra: ${METODOS[r.empateFinal.metodo] || r.empateFinal.metodo}.`
    : "";
  return criterios + final;
}

/* Sem idade no grupo: a idade não pesou nele (o Python só a grava quando pesou) ou falta a data. */
const SEM_IDADE = "—";

const usaIdade = (r: RelatorioDeDesempate) =>
  r.versao >= 2 &&
  r.criterios.some(
    (c) => c.codigo === "IDOSO_60" || c.codigo === "MAIOR_IDADE",
  );

function decididoPor(
  c: CandidatoDoDesempate,
  rotulo: (codigo: string) => string,
  criterios: CriterioDoDesempate[],
) {
  if (!c.decididoPor) return "";
  return criterios.some((k) => k.codigo === c.decididoPor)
    ? rotulo(c.decididoPor)
    : resolucao(c.decididoPor);
}

/**
 * As planilhas do XLSX: "Resumo" (cabeçalho, totais, decididos por critério e
 * empates até o fim), "Grupos" (um por linha), "Pares" (quem ficou à frente de
 * quem e por quê) e "Candidatos" (uma linha por candidato em cada grupo, com a
 * idade e o valor em cada critério da regra). Grupos, Pares e Candidatos com
 * filtro e cabeçalho fixo.
 */
export function planilhasDoDesempate(
  desempate: DesempateDaLista,
): PlanilhaDaClassificacao[] {
  const r = desempate.relatorio;
  const { criterios, vagas } = r;
  const rotulo = (codigo: string) =>
    criterios.find((c) => c.codigo === codigo)?.rotulo || codigo;
  const resumo = resumoDoDesempate(desempate);
  const comIdade = usaIdade(r);

  const linhasDoResumo: (string | number)[][] = [
    [`Relatório de desempate — ${TITULOS[r.tipo] || r.tipo}`, ""],
    ...linhasDoCabecalho(desempate),
    ["Regra do desempate", regraDoEmpate(r)],
    [],
    ["Grupos de empate", resumo.grupos],
    ["Decididos pelos critérios", resumo.decididosPorCriterio],
    ["Com empate até o fim", resumo.empatadosAteOFim],
    ["Pendentes (aguardando o registro)", resumo.pendentes],
    ["Na mesma posição pela regra da lista", resumo.mesmaPosicaoNaLista],
    [],
    ["Decididos por critério", "Pares de candidatos", "Grupos"],
    ...resumo.porCriterio.map((c) => [c.rotulo, c.pares, c.grupos]),
    [],
    ["Empates até o fim, como foram resolvidos", "Empates", "Candidatos"],
    ...resumo.empatesAteOFim.map((e) => [e.rotulo, e.empates, e.candidatos]),
  ];

  const grupos: (string | number)[][] = [
    [
      "Vaga",
      "Cargo",
      "Lista",
      "Cota",
      "Nota",
      "Posições",
      "Empatados",
      "Critérios aplicados",
      "Decidido por",
      "Resolução",
    ],
  ];
  const candidatos: (string | number)[][] = [
    [
      "Vaga",
      "Cargo",
      "Lista",
      "Nota",
      "Posição",
      "Inscrição",
      "Candidato",
      ...(comIdade ? ["Idade na data de corte"] : []),
      "Decidido por",
      ...criterios.map((c) => c.rotulo),
      "Resolução do grupo",
    ],
  ];
  const pares: (string | number)[][] = [
    [
      "Vaga",
      "Lista",
      "Nota",
      "À frente",
      "Atrás",
      "Critério",
      "Valores",
      "Resolução",
    ],
  ];
  for (const v of vagas)
    for (const g of v.grupos) {
      const decisivos = [
        ...new Set(g.pares.flatMap((p) => (p.criterio ? [p.criterio] : []))),
      ];
      grupos.push([
        v.codigo,
        v.cargo,
        g.listaNome,
        g.cota ? "sim" : "não",
        g.notaTexto,
        posicoesDoGrupo(g),
        g.candidatos.length,
        g.criteriosAplicados.map(rotulo).join(" → "),
        decisivos.map(rotulo).join(", "),
        resolucao(g.resolucao),
      ]);
      for (const c of g.candidatos)
        candidatos.push([
          v.codigo,
          v.cargo,
          g.listaNome,
          g.notaTexto,
          c.posicao,
          c.codigo,
          c.nome,
          ...(comIdade ? [c.idade ?? SEM_IDADE] : []),
          decididoPor(c, rotulo, criterios),
          ...criterios.map((k) =>
            k.codigo in c.valores
              ? textoDoValor(c.valores[k.codigo], k.codigo)
              : "",
          ),
          resolucao(g.resolucao),
        ]);
      const porId = new Map(g.candidatos.map((c) => [c.analiseId, c]));
      const quem = (id: string) => {
        const c = porId.get(id);
        if (!c) return id;
        return c.codigo ? `${c.nome} (insc. ${c.codigo})` : c.nome || id;
      };
      for (const p of g.pares)
        pares.push([
          v.codigo || v.cargo,
          g.listaNome,
          g.notaTexto,
          quem(p.acima),
          quem(p.abaixo),
          p.criterio ? rotulo(p.criterio) : "",
          p.criterio && p.valores
            ? [p.acima, p.abaixo]
                .map((id, i) =>
                  textoDoValor(
                    p.valores?.[i],
                    p.criterio || "",
                    porId.get(id)?.idade ?? null,
                  ),
                )
                .join(" × ") +
              (p.horaDaCertidao ? " (mesma data; hora da certidão)" : "")
            : "",
          resolucao(p.resolucao),
        ]);
    }
  return [
    { nome: "Resumo", linhas: linhasDoResumo, larguras: [40, 60, 12] },
    {
      nome: "Grupos",
      linhas: grupos,
      larguras: [8, 30, 44, 7, 8, 12, 10, 50, 30, 26],
      filtro: true,
    },
    {
      nome: "Pares",
      linhas: pares,
      larguras: [10, 44, 8, 40, 40, 22, 44, 26],
      filtro: true,
    },
    {
      nome: "Candidatos",
      linhas: candidatos,
      larguras: [8, 30, 44, 8, 8, 12, 36, ...(comIdade ? [12] : []), 22],
      filtro: true,
    },
  ];
}

const html = (valor: unknown) => escapeHtml(String(valor ?? ""));

/* Um grupo no PDF: título (lista, nota, posições, resolução), candidatos, pares e o empate até o fim. */
function grupoNoPdf(
  g: GrupoDoDesempate,
  r: RelatorioDeDesempate,
  colunas: number,
  comIdade: boolean,
) {
  const rotulo = (codigo: string) =>
    r.criterios.find((c) => c.codigo === codigo)?.rotulo || codigo;
  const porId = new Map(g.candidatos.map((c) => [c.analiseId, c]));
  const quem = (id: string) => {
    const c = porId.get(id);
    if (!c) return html(id);
    return `${html(c.nome)}${c.codigo ? ` <span class="insc">(insc. ${html(c.codigo)})</span>` : ""}`;
  };
  const titulo =
    `<span class="${g.cota ? "selo cota" : "selo"}">${html(g.listaNome)}</span> ` +
    `nota ${html(g.notaTexto)} · ${g.candidatos.length} empatados · ${html(posicoesDoGrupo(g))} ·` +
    ` <span class="resolucao">${html(resolucao(g.resolucao))}</span>`;
  const linhas = [
    `<tr class="titulo-do-grupo"><td colspan="${colunas}">${titulo}</td></tr>`,
  ];
  if (g.criteriosAplicados.length)
    linhas.push(
      `<tr class="aplicados"><td colspan="${colunas}">Critérios aplicados: ${html(g.criteriosAplicados.map(rotulo).join(" → "))}</td></tr>`,
    );
  for (const c of g.candidatos) {
    const valores = Object.entries(c.valores)
      .map(([k, v]) => `${html(rotulo(k))}: ${html(textoDoValor(v, k))}`)
      .join(" · ");
    linhas.push(
      `<tr><td class="num">${html(ordinal(c.posicao))}</td><td>${html(c.codigo)}</td><td>${html(c.nome)}</td>` +
        (comIdade
          ? `<td class="idade">${c.idade === null ? SEM_IDADE : html(c.idade)}</td>`
          : "") +
        `<td>${valores}</td><td>${html(decididoPor(c, rotulo, r.criterios))}</td></tr>`,
    );
  }
  for (const p of g.pares) {
    if (p.criterio && p.valores) {
      const [va, vb] = [p.acima, p.abaixo].map((id, i) =>
        textoDoValor(
          p.valores?.[i],
          p.criterio || "",
          porId.get(id)?.idade ?? null,
        ),
      );
      const hora = p.horaDaCertidao
        ? "; mesma data de nascimento, decidiu a hora da certidão"
        : "";
      linhas.push(
        `<tr class="par"><td colspan="${colunas}">${quem(p.acima)} à frente de ${quem(p.abaixo)} por <b>${html(rotulo(p.criterio))}</b> (${html(va)} × ${html(vb)})${html(hora)}</td></tr>`,
      );
    } else if (p.resolucao === "MESMA_POSICAO_LISTA")
      linhas.push(
        `<tr class="par"><td colspan="${colunas}">${quem(p.acima)} e ${quem(p.abaixo)}: nesta lista o empate fica na mesma posição</td></tr>`,
      );
  }
  for (const e of g.empatadosAteOFim) {
    const registroDoEmpate = e.registro
      ? ` (registro ${html(e.registro)})`
      : "";
    linhas.push(
      `<tr class="fim"><td colspan="${colunas}">Empatados em todos os critérios: ${e.analiseIds.map(quem).join(", ")} — <b>${html(resolucao(e.resolucao))}</b>${registroDoEmpate}</td></tr>`,
    );
  }
  return `<tbody class="grupo">${linhas.join("")}</tbody>`;
}

/**
 * A página do PDF (impressão do navegador): cabeçalho da lista, resumo, índice
 * por vaga (links para cada vaga) e, por vaga, uma tabela cujo cabeçalho (a
 * vaga e as colunas) se repete em cada página.
 */
export function paginaDoDesempate(desempate: DesempateDaLista, titulo: string) {
  const r = desempate.relatorio;
  const resumo = resumoDoDesempate(desempate);
  const comIdade = usaIdade(r);
  const colunas = comIdade ? 6 : 5;
  const subtitulo = TITULOS[r.tipo] || r.tipo;
  const cabecalho = linhasDoCabecalho(desempate)
    .map(([k, v]) => `<dt>${html(k)}</dt><dd>${html(v)}</dd>`)
    .join("");
  const porCriterio = resumo.porCriterio.length
    ? `<table class="resumo"><thead><tr><th>Decididos por critério</th><th class="num">Pares</th><th class="num">Grupos</th></tr></thead><tbody>${resumo.porCriterio
        .map(
          (c) =>
            `<tr><td>${html(c.rotulo)}</td><td class="num">${c.pares}</td><td class="num">${c.grupos}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";
  const ateOFim = resumo.empatesAteOFim.length
    ? `<table class="resumo"><thead><tr><th>Empates até o fim, como foram resolvidos</th><th class="num">Empates</th><th class="num">Candidatos</th></tr></thead><tbody>${resumo.empatesAteOFim
        .map(
          (e) =>
            `<tr><td>${html(e.rotulo)}</td><td class="num">${e.empates}</td><td class="num">${e.candidatos}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";
  const totais =
    `<p class="totais"><b>${resumo.grupos}</b> grupo(s) de empate: <b>${resumo.decididosPorCriterio}</b> decidido(s) pelos critérios, ` +
    `<b>${resumo.empatadosAteOFim}</b> com empate até o fim (<b>${resumo.pendentes}</b> pendente(s)), ` +
    `<b>${resumo.mesmaPosicaoNaLista}</b> na mesma posição pela regra da lista.</p>`;
  const indice = r.vagas.length
    ? `<nav class="indice"><h2>Índice por vaga</h2><ol>${r.vagas
        .map(
          (v, i) =>
            `<li><a href="#vaga-${i + 1}"><span>${html(tituloDaVaga(v))}</span><span class="pontos"></span><span>${v.grupos.length} grupo(s)</span></a></li>`,
        )
        .join("")}</ol></nav>`
    : `<p>Nenhum empate de nota nesta lista.</p>`;
  const vagas = r.vagas
    .map(
      (v, i) =>
        `<section class="vaga" id="vaga-${i + 1}"><table class="grupos"><thead>` +
        `<tr><th class="vaga" colspan="${colunas}">${html(tituloDaVaga(v))} <span class="leve">· ${v.grupos.length} grupo(s) · ${html(subtitulo)}</span></th></tr>` +
        `<tr><th class="num">Pos.</th><th>Inscrição</th><th class="candidato">Candidato</th>${comIdade ? '<th class="idade">Idade</th>' : ""}<th>Valores nos critérios aplicados</th><th>Decidido por</th></tr>` +
        `</thead>${v.grupos.map((g) => grupoNoPdf(g, r, colunas, comIdade)).join("")}</table></section>`,
    )
    .join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${html(titulo)}</title>
<style>
/* Papel: as cores do documento impresso, iguais nos dois temas. */
:root{--texto:#111;--texto-suave:#444;--borda:#999;--borda-leve:#ddd;--fundo-cabecalho:#eef1f5;--fundo-vaga:#dfe6ee;--fundo-grupo:#f5f5f5;--fundo-empate:#fff8e6;--cota:#8a4b00;--fundo-cota:#fff3e0;--link:#0b3d91}
@page{size:A4;margin:14mm 12mm 16mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px Arial,sans-serif;color:var(--texto-suave)}}
*{box-sizing:border-box}
body{font:10px/1.4 Arial,sans-serif;color:var(--texto);margin:0}
h1{font-size:16px;margin:0 0 2px}
h1+.sub{font-size:12px;color:var(--texto-suave);margin:0 0 10px}
h2{font-size:12px;margin:14px 0 6px}
dl.cabecalho{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0 0 10px;padding:8px 10px;border:1px solid var(--borda);border-radius:4px}
dl.cabecalho dt{font-weight:bold;color:var(--texto-suave)}
dl.cabecalho dd{margin:0}
p.regra{margin:0 0 8px;color:var(--texto-suave)}
p.totais{margin:0 0 8px}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;vertical-align:top;padding:3px 5px;border-bottom:1px solid var(--borda-leve)}
.num{text-align:right;white-space:nowrap}
table.resumo{width:auto;min-width:55%;margin:0 0 10px}
table.resumo th{background:var(--fundo-cabecalho);border-bottom:1px solid var(--borda)}
nav.indice ol{list-style:none;margin:0;padding:0}
nav.indice li{margin:0 0 2px}
nav.indice a{display:flex;gap:6px;color:var(--link);text-decoration:none}
nav.indice .pontos{flex:1;border-bottom:1px dotted var(--borda);margin-bottom:3px}
section.vaga{margin-top:16px}
section.vaga:first-of-type{break-before:page;margin-top:0}
table.grupos thead th{background:var(--fundo-cabecalho);border-bottom:1px solid var(--borda)}
table.grupos thead th.vaga{font-size:12px;background:var(--fundo-vaga)}
.leve{font-weight:normal;color:var(--texto-suave)}
tbody.grupo{break-inside:avoid}
tr{break-inside:avoid}
tr.titulo-do-grupo td{background:var(--fundo-grupo);font-weight:bold;border-top:2px solid var(--borda)}
tr.aplicados td{color:var(--texto-suave);font-size:9.5px}
tr.par td,tr.fim td{font-size:9.5px;color:var(--texto);padding-left:14px}
tr.fim td{background:var(--fundo-empate)}
.selo{display:inline-block;padding:0 5px;border:1px solid var(--borda);border-radius:3px;font-weight:bold}
.selo.cota{border-color:var(--cota);color:var(--cota);background:var(--fundo-cota)}
.resolucao{font-weight:normal;color:var(--texto-suave)}
.insc{color:var(--texto-suave)}
th.candidato{width:22%}
th.idade,td.idade{text-align:center;white-space:nowrap;width:7%}
</style>
</head><body><h1>${html(titulo)}</h1><p class="sub">${html(subtitulo)}</p>
<dl class="cabecalho">${cabecalho}</dl>
<p class="regra">${html(regraDoEmpate(r))}</p>
<h2>Resumo</h2>${totais}${porCriterio}${ateOFim}${indice}${vagas}</body></html>`;
}

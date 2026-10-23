import type { PlanilhaDaClassificacao } from "./tipos-dos-documentos.ts";
import { escapeHtml } from "../sanitize.js";
import { formatarNota } from "./numeros.ts";

/*
  O relatório de desempate de uma lista gerada, como a tela o mostra e exporta
  (Classificação › Listas › "Relatório de desempate"). Quem calcula é o Python
  (python/monitora/classificacao/desempate.py, a MESMA ordenação do motor) e
  quem guarda é o banco (TB_RELATORIO_DESEMPATE, lido por
  obter_desempate_da_lista; migration 20261023140000). Aqui, sem DOM: a leitura
  da resposta (malformada = sem relatório, o botão não aparece), as planilhas
  do XLSX e a página do PDF (impressão).

  O candidato vem com o id da análise, o código de inscrição e o nome
  (documento interno da comissão; a RPC só o entrega a quem lê a lista). O
  Python grava o relatório só quando o retrato que ele calcula é o da lista
  registrada, então o nome é o mesmo da lista.
*/

export interface CandidatoDoDesempate {
  analiseId: string;
  codigo: string;
  nome: string;
  posicao: number;
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
export interface RelatorioDeDesempate {
  versao: number;
  tipo: string;
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

/** A versão do formato que esta tela sabe ler (desempate.py, VERSAO_DO_RELATORIO). */
export const VERSAO_DO_RELATORIO = 1;

type Registro = Record<string, unknown>;
const registro = (valor: unknown): Registro | null =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? Object.fromEntries(Object.entries(valor))
    : null;
const lista = (valor: unknown): unknown[] | null =>
  Array.isArray(valor) ? valor : null;
const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
const textos = (valor: unknown) =>
  (lista(valor) || []).filter((v): v is string => typeof v === "string");

function candidato(valor: unknown): CandidatoDoDesempate | null {
  const c = registro(valor);
  if (!c || typeof c.analiseId !== "string" || typeof c.posicao !== "number")
    return null;
  return {
    analiseId: c.analiseId,
    codigo: texto(c.codigo),
    nome: texto(c.nome),
    posicao: c.posicao,
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

function grupo(valor: unknown): GrupoDoDesempate | null {
  const g = registro(valor);
  if (!g) return null;
  const candidatos = todos(g.candidatos, candidato);
  const pares = todos(g.pares, par);
  const empatados = todos(g.empatadosAteOFim, empate);
  if (!candidatos || !pares || !empatados) return null;
  return {
    lista: texto(g.lista),
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

function vaga(valor: unknown): VagaDoDesempate | null {
  const v = registro(valor);
  const grupos = v && todos(v.grupos, grupo);
  if (!v || !grupos) return null;
  return {
    chave: texto(v.chave),
    codigo: texto(v.codigo),
    cargo: texto(v.cargo),
    grupos,
  };
}

/**
 * A resposta de obter_desempate_da_lista; null quando a lista não tem
 * relatório, a resposta está malformada ou é de uma versão que esta tela não lê.
 */
export function lerDesempateDaLista(valor: unknown): DesempateDaLista | null {
  const d = registro(valor);
  const r = registro(d?.relatorio);
  if (!d || !r || r.versao !== VERSAO_DO_RELATORIO) return null;
  const vagas = todos(r.vagas, vaga);
  const criterios = todos(r.criterios, (v) => {
    const c = registro(v);
    return c && typeof c.codigo === "string"
      ? { codigo: c.codigo, rotulo: texto(c.rotulo), direcao: texto(c.direcao) }
      : null;
  });
  if (!vagas || !criterios || typeof d.lista_id !== "string") return null;
  return {
    listaId: d.lista_id,
    geradoEm: texto(d.gerado_em),
    daListaAtual: d.da_lista_atual === true,
    grupos: typeof d.grupos === "number" ? d.grupos : 0,
    relatorio: {
      versao: VERSAO_DO_RELATORIO,
      tipo: texto(r.tipo),
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
  CRITERIOS: "critérios",
  SORTEIO: "sorteio registrado",
  MANUAL: "decisão manual registrada",
  INSCRICAO: "ordem de inscrição",
  MESMA_POSICAO: "mesma posição",
  PENDENTE: "pendente (aguardando o registro)",
  MESMA_POSICAO_LISTA: "mesma posição (regra da lista)",
  EMPATE_FINAL: "empate até o fim",
});
const resolucao = (codigo: string) =>
  codigo
    .split("+")
    .map((c) => RESOLUCOES[c] || c)
    .join(" + ");

/** O valor de um critério como texto ("sim", "1.200 dias", "1º mais velho do grupo"). */
export function textoDoValor(valor: unknown, criterio: string) {
  if (valor === null || valor === undefined) return "sem dado";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  const idade = registro(valor);
  if (criterio === "MAIOR_IDADE" && idade) {
    const ordem = idade.ordemDeIdade;
    const base =
      typeof ordem === "number"
        ? `${ordem}º mais velho do grupo`
        : "sem data de nascimento";
    return idade.certidao === true ? base : `${base}, sem certidão`;
  }
  if (typeof valor !== "number") return String(valor);
  if (criterio === "EXP_PROFISSIONAL_TEMPO")
    return `${formatarNota(valor, 0)} dias`;
  return formatarNota(valor, Number.isInteger(valor) ? 0 : 2);
}

const nomeDaLista = (codigo: string) => (codigo === "GERAL" ? "Geral" : codigo);

/**
 * As planilhas do XLSX: "Candidatos" (uma linha por candidato em cada grupo,
 * com o valor em cada critério da regra) e "Pares" (quem ficou à frente de
 * quem e por quê).
 */
export function planilhasDoDesempate(
  desempate: DesempateDaLista,
): PlanilhaDaClassificacao[] {
  const { criterios, vagas } = desempate.relatorio;
  const rotulo = (codigo: string) =>
    criterios.find((c) => c.codigo === codigo)?.rotulo || codigo;
  const candidatos: (string | number)[][] = [
    [
      "Vaga",
      "Lista",
      "Nota",
      "Posição",
      "Inscrição",
      "Candidato",
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
      const base = [v.codigo || v.cargo, nomeDaLista(g.lista), g.notaTexto];
      for (const c of g.candidatos)
        candidatos.push([
          ...base,
          c.posicao,
          c.codigo,
          c.nome,
          c.decididoPor
            ? criterios.some((k) => k.codigo === c.decididoPor)
              ? rotulo(c.decididoPor)
              : resolucao(c.decididoPor)
            : "",
          ...criterios.map((k) =>
            k.codigo in c.valores
              ? textoDoValor(c.valores[k.codigo], k.codigo)
              : "",
          ),
          resolucao(g.resolucao),
        ]);
      const quem = new Map(
        g.candidatos.map((c) => [
          c.analiseId,
          c.nome || c.codigo || c.analiseId,
        ]),
      );
      for (const p of g.pares)
        pares.push([
          ...base,
          quem.get(p.acima) || p.acima,
          quem.get(p.abaixo) || p.abaixo,
          p.criterio ? rotulo(p.criterio) : "",
          p.criterio && p.valores
            ? p.valores
                .map((x) => textoDoValor(x, p.criterio || ""))
                .join(" × ") +
              (p.horaDaCertidao ? " (mesma data; hora da certidão)" : "")
            : "",
          resolucao(p.resolucao),
        ]);
    }
  return [
    {
      nome: "Candidatos",
      linhas: candidatos,
      larguras: [12, 10, 8, 8, 12, 36, 22],
    },
    { nome: "Pares", linhas: pares, larguras: [12, 10, 8, 36, 36, 22, 36, 26] },
  ];
}

/** A página do PDF (impressão do navegador): o texto do relatório, com o título. */
export function paginaDoDesempate(desempate: DesempateDaLista, titulo: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title>
<style>body{font:11px/1.45 Arial,sans-serif;margin:16mm}h1{font-size:15px;margin:0 0 4px}
p{margin:0 0 12px}pre{white-space:pre-wrap;font:10.5px/1.45 "Courier New",monospace;margin:0}</style>
</head><body><h1>${escapeHtml(titulo)}</h1><p>Gerado em ${escapeHtml(desempate.geradoEm.slice(0, 16).replace("T", " "))}${
    desempate.daListaAtual ? "" : " — de outra versão desta lista"
  }</p><pre>${escapeHtml(desempate.texto)}</pre></body></html>`;
}

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

  O relatório não tem nomes: o candidato é o id da análise e o código de
  inscrição. O nome vem do retrato da própria lista (`nomesDoRetrato`), que a
  tela já leu com a permissão de quem exporta.
*/

export interface CandidatoDoDesempate {
  analiseId: string;
  codigo: string;
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

/** analise_id → nome, a partir do retrato da lista gerada (geral, modalidades e eliminados). */
export function nomesDoRetrato(retrato: unknown): Map<string, string> {
  const nomes = new Map<string, string>();
  const guardar = (linha: unknown) => {
    const l = registro(linha);
    if (l && typeof l.analise_id === "string" && typeof l.nome === "string")
      nomes.set(l.analise_id, l.nome);
  };
  for (const v of lista(registro(retrato)?.vagas) || []) {
    const vg = registro(v);
    for (const l of lista(vg?.geral) || []) guardar(l);
    for (const linhas of Object.values(registro(vg?.listas) || {}))
      for (const l of lista(linhas) || []) guardar(l);
  }
  return nomes;
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
  nomes: ReadonlyMap<string, string> = new Map(),
): PlanilhaDaClassificacao[] {
  const { criterios, vagas } = desempate.relatorio;
  const rotulo = (codigo: string) =>
    criterios.find((c) => c.codigo === codigo)?.rotulo || codigo;
  const quem = (id: string, codigo: string) => nomes.get(id) || codigo || id;
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
          nomes.get(c.analiseId) || "",
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
      const codigoDe = new Map(
        g.candidatos.map((c) => [c.analiseId, c.codigo]),
      );
      for (const p of g.pares)
        pares.push([
          ...base,
          quem(p.acima, codigoDe.get(p.acima) || ""),
          quem(p.abaixo, codigoDe.get(p.abaixo) || ""),
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

/*
  Editais com o cronograma encerrado e o status ainda em andamento, sem React e sem banco
  (migration 20261119120000). A conferência EDITAL_CRONOGRAMA_ENCERRADO acha um caso por edital;
  o sistema não muda o status sozinho (a data passar não prova publicação nem homologação), então a
  tela de Editais oferece a confirmação em lote: a lista vem de
  `listar_editais_com_cronograma_encerrado`, a gravação de
  `concluir_editais_com_cronograma_encerrado` (que recusa, com o motivo, o edital fora da regra) e
  a outra saída, dispensar, é a da central de avisos (`tratar_aviso_conferencia`).

  Aqui: a leitura defensiva das duas respostas, a conferência do motivo (a mesma do banco) e os
  textos da lista, da confirmação e do resultado.
*/
import { formatNumberBR } from "../base/formatters";
import type { NomeDosItens } from "../base/alcance-da-selecao.ts";

/** Quantos a gaveta mostra de cada vez ("Selecionar esta página" é sobre eles). */
export const ENCERRADOS_POR_PAGINA = 20;

export const NOME_DOS_EDITAIS: NomeDosItens = Object.freeze({
  singular: "edital",
  plural: "editais",
});

/** O motivo do lote e a justificativa de dispensar: 10 a 500 caracteres, como no banco. */
export const LIMITES_DO_MOTIVO_DO_LOTE = Object.freeze({
  minimo: 10,
  maximo: 500,
});

/* O mesmo de private."FC_TEXTO_SEGURO_DO_AVISO": sem @ e sem CPF. */
const CARA_DE_DADO_PESSOAL = /@|\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2}/;

export interface PendenciaDoEdital {
  conferencia: string;
  gravidade: string;
  quantidade: number;
}

export interface EditalEncerrado {
  id: string;
  /** O número como foi digitado ("06/2026 (sanitarista)"). */
  edital: string;
  /** Sem zero à esquerda nem complemento ("6/2026"). */
  numero: string;
  unidade: string;
  /** A área do edital (a tela mostra só os da área do menu). */
  area: string;
  /** O status gravado. */
  status: string;
  /** A data do fim do cronograma (aaaa-mm-dd). */
  fim: string;
  /** O aviso aberto na central, se houver. */
  aviso: { id: string; tratamento: string; podeDispensar: boolean } | null;
  /** As outras pendências abertas do edital (avisos não dispensados). */
  pendencias: PendenciaDoEdital[];
}

export interface ListaDosEncerrados {
  podeConcluir: boolean;
  editais: EditalEncerrado[];
}

export interface ResultadoDoLote {
  concluidos: { id: string; edital: string }[];
  recusados: { id: string; edital: string; motivo: string }[];
}

const registro = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
const lista = (valor: unknown): unknown[] =>
  Array.isArray(valor) ? valor : [];
const texto = (valor: unknown) =>
  typeof valor === "string" ? valor.trim() : "";
const numero = (valor: unknown) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

function lerEdital(valor: unknown): EditalEncerrado | null {
  const e = registro(valor);
  const id = texto(e.id);
  if (!id) return null;
  const aviso = registro(e.aviso);
  return {
    id,
    edital: texto(e.edital),
    numero: texto(e.numero) || texto(e.edital),
    unidade: texto(e.unidade),
    area: texto(e.area),
    status: texto(e.status),
    fim: texto(e.fim).slice(0, 10),
    aviso: texto(aviso.id)
      ? {
          id: texto(aviso.id),
          tratamento: texto(aviso.tratamento) || "PENDENTE",
          podeDispensar: aviso.pode_dispensar === true,
        }
      : null,
    pendencias: lista(e.pendencias)
      .map(registro)
      .filter((p) => texto(p.conferencia))
      .map((p) => ({
        conferencia: texto(p.conferencia),
        gravidade: texto(p.gravidade) || "ATENCAO",
        quantidade: numero(p.quantidade),
      })),
  };
}

/** A resposta de `listar_editais_com_cronograma_encerrado`, sem confiar na forma. */
export function lerListaDosEncerrados(dados: unknown): ListaDosEncerrados {
  const bruto = registro(dados);
  return {
    podeConcluir: bruto.pode_concluir === true,
    editais: lista(bruto.editais)
      .map(lerEdital)
      .filter((e): e is EditalEncerrado => e !== null),
  };
}

/** A resposta de `concluir_editais_com_cronograma_encerrado`. */
export function lerResultadoDoLote(dados: unknown): ResultadoDoLote {
  const bruto = registro(dados);
  return {
    concluidos: lista(bruto.concluidos)
      .map(registro)
      .filter((c) => texto(c.id))
      .map((c) => ({ id: texto(c.id), edital: texto(c.edital) })),
    recusados: lista(bruto.recusados)
      .map(registro)
      .filter((r) => texto(r.id))
      .map((r) => ({
        id: texto(r.id),
        edital: texto(r.edital),
        motivo: texto(r.motivo) || "Recusado",
      })),
  };
}

/**
 * O erro do motivo (do lote ou da justificativa de dispensar), ou "": 10 a 500 caracteres, sem
 * CPF nem e-mail. O banco recusa igual.
 */
export function erroDoMotivoDoLote(motivo: unknown): string {
  const t = texto(motivo);
  const { minimo, maximo } = LIMITES_DO_MOTIVO_DO_LOTE;
  if (t.length < minimo)
    return `Escreva o motivo (pelo menos ${minimo} caracteres).`;
  if (t.length > maximo) return `O motivo passa de ${maximo} caracteres.`;
  if (CARA_DE_DADO_PESSOAL.test(t)) return "Sem CPF nem e-mail no motivo.";
  return "";
}

/** "31/03/2026" (o fim do cronograma), ou "". */
export function dataDoFim(fim: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fim);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "";
}

/** O nome do edital na lista e na confirmação: "Edital 54/2026 · DSEI Xavante". */
export const rotuloDoEdital = (
  e: Pick<EditalEncerrado, "numero" | "unidade">,
) =>
  [e.numero ? `Edital ${e.numero}` : "Edital", e.unidade]
    .filter(Boolean)
    .join(" · ");

/** O texto do botão de entrada: "Cronograma encerrado (56)". */
export const rotuloDaEntrada = (quantos: number) =>
  `Cronograma encerrado (${formatNumberBR(quantos)})`;

/** O que o lote fez, para o aviso da tela: "3 editais marcados como concluídos · 1 recusado". */
export function textoDoResultado(resultado: ResultadoDoLote): string {
  const feitos = resultado.concluidos.length;
  const recusados = resultado.recusados.length;
  const partes = [
    feitos === 1
      ? "1 edital marcado como concluído"
      : `${formatNumberBR(feitos)} editais marcados como concluídos`,
  ];
  if (recusados)
    partes.push(
      recusados === 1 ? "1 recusado" : `${formatNumberBR(recusados)} recusados`,
    );
  return partes.join(" · ");
}

/** Os editais escolhidos, na ordem da lista (a confirmação mostra quais). */
export const escolhidosDaLista = (
  editais: readonly EditalEncerrado[],
  marcados: ReadonlySet<string>,
) => editais.filter((e) => marcados.has(e.id));

/** A lista sem os que saíram (concluídos ou dispensados) e a seleção sem eles. */
export function semOsQueSairam(
  editais: readonly EditalEncerrado[],
  marcados: ReadonlySet<string>,
  sairam: Iterable<string>,
): { editais: EditalEncerrado[]; marcados: Set<string> } {
  const fora = new Set(sairam);
  return {
    editais: editais.filter((e) => !fora.has(e.id)),
    marcados: new Set([...marcados].filter((id) => !fora.has(id))),
  };
}

import type {
  AgendaDoDocumento,
  LinhaDoRetrato,
  RetratoParaDocumento,
} from "./tipos-dos-documentos.ts";

export function exigirDadoDoDocumento<T>(valor: T | undefined): T {
  if (valor === undefined)
    throw new Error("Tabela do documento inconsistente. Recarregue a lista.");
  return valor;
}

export function agendaParaDocumento(valor: unknown): AgendaDoDocumento | null {
  if (valor == null) return null;
  if (!(valor instanceof Map))
    throw new Error("Agenda do documento inválida. Recarregue o edital.");
  return new Map(
    Array.from(valor.entries(), ([id, horario]: [unknown, unknown]) => {
      if (typeof id !== "string")
        throw new Error("Agenda do documento inválida. Recarregue o edital.");
      const h = registro(horario);
      if (
        (h.data != null && typeof h.data !== "string") ||
        (h.inicio != null && typeof h.inicio !== "string")
      )
        throw new Error(
          "Horário da agenda do documento inválido. Recarregue o edital.",
        );
      return [
        id,
        {
          data: h.data == null ? null : texto(h.data),
          inicio: h.inicio == null ? null : texto(h.inicio),
        },
      ];
    }),
  );
}

function registro(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Dados do documento inválidos. Recarregue a lista.");
  return Object.fromEntries(Object.entries(v));
}
function lista(v: unknown): unknown[] {
  if (v == null) return [];
  if (!Array.isArray(v))
    throw new Error("Dados do documento inválidos. Recarregue a lista.");
  return v;
}
function numero(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new Error(
      "Nota ou posição do documento inválida. Recarregue a lista.",
    );
  return v;
}
const texto = (v: unknown) => String(v ?? "");
function linha(v: unknown): LinhaDoRetrato {
  const l = registro(v);
  return {
    nome: texto(l.nome),
    ...(l.analise_id == null ? {} : { analise_id: texto(l.analise_id) }),
    ...(l.posicao == null ? {} : { posicao: numero(l.posicao) ?? 0 }),
    ...(l.nota === undefined ? {} : { nota: numero(l.nota) }),
    ...(l.situacao === undefined
      ? {}
      : { situacao: l.situacao == null ? null : texto(l.situacao) }),
    ...(l.decisao == null ? {} : { decisao: texto(l.decisao) }),
    ...(l.modalidades == null
      ? {}
      : { modalidades: lista(l.modalidades).map(texto) }),
    ...(l.parciais == null
      ? {}
      : {
          parciais: Object.fromEntries(
            Object.entries(registro(l.parciais)).map(([chave, v]) => [
              chave,
              numero(v),
            ]),
          ),
        }),
    ...(l.recursos == null
      ? {}
      : {
          recursos: lista(l.recursos).map((v) => {
            const n = numero(v);
            if (n === null) throw new Error("Recurso do documento inválido.");
            return n;
          }),
        }),
  };
}

/** Validar todas as linhas antes de exportar; nenhuma linha malformada é descartada. */
export function retratoParaDocumento(
  valor: unknown,
  exigirVagas = false,
): RetratoParaDocumento {
  const r = registro(valor);
  if (exigirVagas && !Array.isArray(r.vagas))
    throw new Error(
      "Quadro de vagas do documento inválido. Recarregue a lista.",
    );
  return {
    tipo: texto(r.tipo),
    ...(r.edital == null ? {} : { edital: registro(r.edital) }),
    ...(r.casas === undefined ? {} : { casas: numero(r.casas) }),
    lote: r.lote,
    ...(r.rodape == null ? {} : { rodape: texto(r.rodape) }),
    ...(r.parciais == null ? {} : { parciais: lista(r.parciais).map(texto) }),
    modalidades: lista(r.modalidades).map((v) => {
      const m = registro(v);
      return { codigo: texto(m.codigo), nome: texto(m.nome) };
    }),
    vagas: lista(r.vagas).map((v) => {
      const q = registro(v);
      if (exigirVagas && r.tipo === "CONVOCACAO" && !Array.isArray(q.geral))
        throw new Error(
          "Convocados do documento inválidos. Recarregue a lista.",
        );
      return {
        chave: texto(q.chave),
        codigo: texto(q.codigo),
        cargo: texto(q.cargo),
        lotacao: texto(q.lotacao),
        cabecalho: texto(q.cabecalho),
        geral: lista(q.geral).map(linha),
        listas: Object.fromEntries(
          Object.entries(q.listas == null ? {} : registro(q.listas)).map(
            ([codigo, linhas]) => [codigo, lista(linhas).map(linha)],
          ),
        ),
        eliminados: lista(q.eliminados).map((v) => {
          const e = registro(v);
          return {
            ...linha(e),
            motivo: texto(e.motivo),
            detalhe: texto(e.detalhe),
          };
        }),
      };
    }),
  };
}

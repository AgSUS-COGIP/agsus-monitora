import {
  objetoDosRecursos as objeto,
  idDosRecursos as id,
} from "../dados-dos-recursos.ts";
import type {
  DadosDosAjustes,
  DadosParaPreviaDoAjuste,
  PreviaDoAjuste,
  ResumoDaPosicao,
  CandidatoParaAjuste,
  ExplicacaoParaPrevia,
  RegistroDaClassificacao,
} from "./tipos-dos-ajustes.ts";
const texto = (v: unknown) => (typeof v === "string" ? v : "");
export const numeroDoAjuste = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const registros = (v: unknown): RegistroDaClassificacao[] =>
  Array.isArray(v)
    ? v.filter(
        (r): r is RegistroDaClassificacao =>
          r !== null && typeof r === "object" && !Array.isArray(r),
      )
    : [];
const posicao = (v: unknown): ResumoDaPosicao => {
  const r = objeto(v);
  return {
    naLista: r.naLista === true,
    elegivel: r.elegivel === true,
    nota: numeroDoAjuste(r.nota),
    posicao: numeroDoAjuste(r.posicao),
    situacao: texto(r.situacao) || null,
    motivo: texto(r.motivo) || null,
  };
};
export function normalizarPreviaDoAjuste(v: unknown): PreviaDoAjuste | null {
  const p = objeto(v);
  if (!p.antes || !p.depois || typeof p.tipo !== "string") return null;
  return {
    ...p,
    tipo: p.tipo,
    vaga: texto(p.vaga) || null,
    antes: posicao(p.antes),
    depois: posicao(p.depois),
    mudou: p.mudou === true,
    afetados: registros(p.afetados).map((a) => ({
      nome: texto(a.nome),
      antes: numeroDoAjuste(a.antes),
      depois: numeroDoAjuste(a.depois),
      situacaoAntes: texto(a.situacaoAntes) || null,
      situacaoDepois: texto(a.situacaoDepois) || null,
    })),
    totalAfetados: numeroDoAjuste(p.totalAfetados) ?? 0,
  };
}
export function normalizarDadosDosAjustes(v: unknown): DadosDosAjustes {
  const d = objeto(v);
  const versoes = registros(d.ajustes);
  const invalido =
    d.ajustes != null &&
    (!Array.isArray(d.ajustes) ||
      versoes.length !== d.ajustes.length ||
      versoes.some((a) => {
        const versao = numeroDoAjuste(a.versao),
          itens = registros(a.itens);
        return (
          id(a.id) === null ||
          versao === null ||
          !Number.isInteger(versao) ||
          versao < 1 ||
          !["PROPOSTO", "APROVADO", "CANCELADO"].includes(texto(a.situacao)) ||
          !["PRELIMINAR", "ENTREVISTA", "FINAL"].includes(texto(a.lista)) ||
          !Array.isArray(a.itens) ||
          itens.length !== a.itens.length ||
          itens.some(
            (i) =>
              typeof i.codigo !== "string" ||
              numeroDoAjuste(i.novo) === null ||
              (i.anterior != null && numeroDoAjuste(i.anterior) === null),
          )
        );
      }));
  return {
    ...d,
    erro:
      texto(d.erro) ||
      (invalido
        ? "As versões do ajuste recebidas são inválidas. Recarregue o recurso."
        : undefined),
    pode_propor: d.pode_propor === true,
    pode_aprovar: d.pode_aprovar === true,
    pode_cancelar: d.pode_cancelar === true,
    ajustes: registros(d.ajustes).flatMap((a) => {
      const chave = id(a.id),
        versao = numeroDoAjuste(a.versao);
      if (
        chave === null ||
        versao === null ||
        !Number.isInteger(versao) ||
        versao < 1
      )
        return [];
      return [
        {
          id: chave,
          versao,
          situacao: texto(a.situacao),
          lista: texto(a.lista),
          justificativa: texto(a.justificativa),
          itens: registros(a.itens)
            .filter((i) => typeof i.codigo === "string")
            .map((i) => ({
              codigo: texto(i.codigo),
              anterior: numeroDoAjuste(i.anterior),
              novo: numeroDoAjuste(i.novo),
              justificativa: texto(i.justificativa),
            })),
          proposto_em: texto(a.proposto_em),
          proposto_por: texto(a.proposto_por),
          aprovado_em: texto(a.aprovado_em),
          aprovado_por: texto(a.aprovado_por),
          cancelado_em: texto(a.cancelado_em),
          cancelado_por: texto(a.cancelado_por),
          motivo_cancelamento: texto(a.motivo_cancelamento),
          mudou_posicao: a.mudou_posicao === true,
          previa: normalizarPreviaDoAjuste(a.previa),
          previa_aprovacao: normalizarPreviaDoAjuste(a.previa_aprovacao),
        },
      ];
    }),
  };
}
/** Preserva o JSON da Classificação, mas recusa coleções malformadas antes de calcular. */
export function normalizarDadosParaPrevia(v: unknown): DadosParaPreviaDoAjuste {
  const d = objeto(v),
    r = objeto(d.regra),
    e = objeto(d.edital);
  const campos = [
    "candidatos",
    "entrevistas",
    "quadro",
    "cronograma",
    "desempates",
    "ajustes",
  ] as const;
  const invalido = campos.some(
    (c) =>
      d[c] != null &&
      (!Array.isArray(d[c]) || registros(d[c]).length !== d[c].length),
  );
  const configuracao = objeto(r.configuracao);
  const regraInvalida =
    (r.configuracao != null &&
      (typeof r.configuracao !== "object" || Array.isArray(r.configuracao))) ||
    (d.convocacao != null &&
      (typeof d.convocacao !== "object" || Array.isArray(d.convocacao)));
  return {
    ...d,
    erro:
      texto(d.erro) ||
      (invalido || regraInvalida
        ? "Os dados da classificação recebidos são inválidos. Recarregue o recurso."
        : undefined),
    regra: r.configuracao == null ? null : { ...r, configuracao },
    edital: { ...e, unidade: texto(e.unidade) },
    candidatos: registros(d.candidatos),
    entrevistas: registros(d.entrevistas),
    quadro: registros(d.quadro),
    cronograma: registros(d.cronograma),
    desempates: registros(d.desempates),
    ajustes: registros(d.ajustes),
    convocacao: d.convocacao == null ? null : objeto(d.convocacao),
  };
}
export function candidatoParaAjuste(v: unknown): CandidatoParaAjuste | null {
  const c = objeto(v),
    chave = id(c.analiseId);
  if (chave === null) return null;
  const e = objeto(c.entrevista);
  return {
    ...c,
    analiseId: chave,
    notaDocumental: numeroDoAjuste(c.notaDocumental),
    notaEntrevista: numeroDoAjuste(c.notaEntrevista),
    notaArt: numeroDoAjuste(c.notaArt),
    entrevista:
      c.entrevista == null
        ? null
        : {
            ...e,
            notas: registros(e.notas).flatMap((n) => {
              const ordem = numeroDoAjuste(n.ordem);
              return ordem === null
                ? []
                : [
                    {
                      ...n,
                      ordem,
                      nota: numeroDoAjuste(n.nota),
                      criterio: texto(n.criterio),
                    },
                  ];
            }),
          },
  };
}
export function explicacoesParaPrevia(
  v: unknown,
): Record<string, ExplicacaoParaPrevia> {
  return Object.fromEntries(
    Object.entries(objeto(v)).flatMap(([chave, valor]) => {
      const e = objeto(valor),
        analiseId = id(e.analiseId);
      return analiseId === null
        ? []
        : [
            [
              chave,
              {
                analiseId,
                nome: texto(e.nome),
                vaga: texto(e.vaga),
                elegivel: e.elegivel === true,
                nota: numeroDoAjuste(e.nota),
                posicaoGeral: numeroDoAjuste(e.posicaoGeral),
                situacao: texto(e.situacao) || null,
                motivo: texto(e.motivo) || null,
              },
            ],
          ];
    }),
  );
}

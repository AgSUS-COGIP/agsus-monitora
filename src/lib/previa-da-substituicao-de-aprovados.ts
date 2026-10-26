import type {
  CandidatoAnterior,
  CandidatoDaListaFinal,
  CasamentoDeCandidatos,
} from "./tipos-da-publicacao-de-aprovados.ts";
import {
  candidatosDaPlanilha,
  casarCandidatos,
  exigeMotivoParaSubstituir,
  resumoDaPublicacao,
} from "./publicacao-de-aprovados.ts";

/*
  A prévia de "Substituir XLSX" na Lista de aprovados (migration
  20261026150000): a mesma conta da publicação pela Classificação — quem da
  lista vigente casa com uma linha da planilha nova e leva o estado (status,
  matrícula, convocação, sub judice, anexos), quem entra, quem fica sem par e
  quais status ficariam sem dono. O banco grava com os mesmos vínculos.
*/

export interface PreviaDaSubstituicao {
  editalId: string;
  arquivo: File;
  candidatos: readonly Record<string, unknown>[];
  listaId: string;
  anteriores: CandidatoAnterior[];
  novos: CandidatoDaListaFinal[];
  casamento: CasamentoDeCandidatos;
  resumo: ReturnType<typeof resumoDaPublicacao>;
  exigeMotivo: boolean;
}

export function montarPreviaDaSubstituicao({
  editalId,
  arquivo,
  candidatos,
  listaId,
  origemAtual,
  anteriores,
}: {
  editalId: string;
  arquivo: File;
  candidatos: readonly Record<string, unknown>[];
  listaId: string;
  origemAtual: unknown;
  anteriores: CandidatoAnterior[];
}): PreviaDaSubstituicao {
  const novos = candidatosDaPlanilha(candidatos);
  const casamento = casarCandidatos(anteriores, novos);
  return {
    editalId,
    arquivo,
    candidatos,
    listaId,
    anteriores,
    novos,
    casamento,
    resumo: resumoDaPublicacao(anteriores, novos, casamento),
    exigeMotivo: exigeMotivoParaSubstituir(anteriores, {
      origemAtual,
      origemNova: "XLSX",
    }),
  };
}

/** Os números da prévia, na ordem em que a tela os mostra. */
export function numerosDaPrevia(previa: PreviaDaSubstituicao) {
  const { resumo, casamento } = previa;
  return {
    casados: casamento.vinculos.length,
    preservados: resumo.preservados.length,
    entram: resumo.entram.length,
    semPar: resumo.saem.length,
    semDono: resumo.pendencias.length,
    subJudiceMantidos: resumo.subJudiceMantidos.length,
  };
}

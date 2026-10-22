import type {
  DadosDaPublicacaoDoEdital,
  PublicacaoDoHistorico,
} from "./tipos-do-estado-de-aprovados.ts";
import { ehRegistroDosAprovados } from "./dados-do-estado-de-aprovados.ts";

const falha = () =>
  new Error(
    "Histórico das publicações inválido. Atualize os dados e tente novamente.",
  );
function objeto(v: unknown): Record<string, unknown> {
  if (!ehRegistroDosAprovados(v)) throw falha();
  return v;
}
function linhas(v: unknown): unknown[] {
  if (v == null) return [];
  if (!Array.isArray(v)) throw falha();
  return v;
}
function texto(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") throw falha();
  return v;
}
function numero(v: unknown): number | string | null {
  if (v == null) return null;
  if (typeof v !== "string" && typeof v !== "number") throw falha();
  return v;
}
function publicacao(v: unknown): PublicacaoDoHistorico {
  const p = objeto(v);
  if (typeof p.id !== "string" || !p.id.trim()) throw falha();
  return {
    ...p,
    id: p.id,
    origem: texto(p.origem),
    em: texto(p.em),
    por: texto(p.por),
    motivo: texto(p.motivo),
    versao_regra: numero(p.versao_regra),
    candidatos: numero(p.candidatos),
    entram: numero(p.entram),
    saem: numero(p.saem),
    mudam: numero(p.mudam),
    pendencias: linhas(p.pendencias).map((v) => ({
      ...objeto(v),
      nome: texto(objeto(v).nome),
    })),
  };
}
/** Uma resposta malformada nunca vira um histórico parcial. */
export function publicacaoDoEdital(
  v: unknown,
): DadosDaPublicacaoDoEdital | null {
  if (v == null) return null;
  const p = objeto(v);
  const final = p.resultado_final == null ? null : objeto(p.resultado_final);
  if (p.tem_analises != null && typeof p.tem_analises !== "boolean")
    throw falha();
  return {
    ...p,
    resultado_final: final
      ? { ...final, gerada_em: texto(final.gerada_em) }
      : null,
    tem_analises: p.tem_analises,
    publicacoes: linhas(p.publicacoes).map(publicacao),
  };
}

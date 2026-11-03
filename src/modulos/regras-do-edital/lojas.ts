import {
  criarRascunhoDaRegra,
  type RascunhoDaRegra,
} from "../../app/rascunho-da-regra.ts";
import { criarEstadoDaAvaliacao } from "../avaliacao-documental/estado.ts";
import { criarEstadoDaClassificacao } from "../classificacao/estado.ts";
import type { Avisar } from "../avaliacao-documental/tipos-do-estado.ts";

/*
  As lojas que as Regras do edital usam para os editores da Avaliação
  documental e da Classificação: as MESMAS das telas (estado.ts de cada uma),
  criadas uma vez por cliente do banco e reaproveitadas a cada abertura da
  página (cada loja escuta a troca de sessão e recomeça sozinha). O rascunho
  guardado de cada regra também é o mesmo (tipos ANALISE e CLASSIFICACAO).
*/

type OpcoesDaAvaliacao = NonNullable<Parameters<typeof criarEstadoDaAvaliacao>[0]>;
type OpcoesDaClassificacao = NonNullable<
  Parameters<typeof criarEstadoDaClassificacao>[0]
>;

export interface LojasDasRegras {
  avaliacao: ReturnType<typeof criarEstadoDaAvaliacao>;
  rascunhoDaAvaliacao: RascunhoDaRegra;
  classificacao: ReturnType<typeof criarEstadoDaClassificacao>;
  rascunhoDaClassificacao: RascunhoDaRegra;
}

const criadas = new WeakMap<object, LojasDasRegras>();

export function lojasDasRegras(
  supabase: object,
  toast?: Avisar,
): LojasDasRegras {
  const ja = criadas.get(supabase);
  if (ja) return ja;
  const rascunhoDaAvaliacao = criarRascunhoDaRegra({
    tipo: "ANALISE",
    supabase: supabase as Parameters<typeof criarRascunhoDaRegra>[0]["supabase"],
  });
  const rascunhoDaClassificacao = criarRascunhoDaRegra({
    tipo: "CLASSIFICACAO",
    supabase: supabase as Parameters<typeof criarRascunhoDaRegra>[0]["supabase"],
  });
  const lojas: LojasDasRegras = {
    avaliacao: criarEstadoDaAvaliacao({
      supabase: supabase as OpcoesDaAvaliacao["supabase"],
      ...(toast ? { toast } : {}),
      // Versão nova salva: o rascunho guardado acaba antes de o editor remontar.
      aoGravarVersao: (editalId) => void rascunhoDaAvaliacao.esquecer(editalId),
    }),
    rascunhoDaAvaliacao,
    classificacao: criarEstadoDaClassificacao({
      supabase: supabase as OpcoesDaClassificacao["supabase"],
      ...(toast ? { toast: toast as OpcoesDaClassificacao["toast"] } : {}),
      aoGravarVersao: (editalId) =>
        void rascunhoDaClassificacao.esquecer(editalId),
    }),
    rascunhoDaClassificacao,
  };
  criadas.set(supabase, lojas);
  return lojas;
}

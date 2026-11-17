import { useCallback, useEffect, useReducer, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirSessao, type ClienteDaSessao } from "../../lib/sessao";
import type {
  CasaiNacionalDoSigepsi,
  LocalizacoesPorDsei,
} from "../../lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts";

/*
  OS DSEIs E AS CASAIs DO SIGEPSI, PARA O MAPA DA SAÚDE INDÍGENA

  `/api/dseis` (função da Vercel) lê a API do SIGEPSI com o token do servidor;
  aqui só se manda o token da sessão. Um pedido por CACHE_MS para a página
  inteira (trocar de área e voltar não repete). Falha não fica guardada: a
  tela mostra o erro e "Tentar novamente" pede de novo (sem plano B no
  banco). Fora da Vercel (servidor local) a rota não existe: também é erro.
*/

export const ROTA_DAS_LOCALIZACOES = "/api/dseis";
export const CACHE_MS = 10 * 60_000;

export interface DadosDoSigepsi {
  dseis: LocalizacoesPorDsei;
  casaisNacionais: CasaiNacionalDoSigepsi[];
}

let guardado: { em: number; dados: DadosDoSigepsi } | null = null;
let emVoo: Promise<DadosDoSigepsi | null> | null = null;

/** Só para os testes. */
export function esquecerLocalizacoes() {
  guardado = null;
  emVoo = null;
}

const objeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

export function carregarLocalizacoes(
  supabase: ClienteDaSessao | SupabaseClient | null,
  { buscar = fetch, relogio = () => Date.now() } = {},
): Promise<DadosDoSigepsi | null> {
  if (guardado && relogio() - guardado.em < CACHE_MS)
    return Promise.resolve(guardado.dados);
  if (emVoo) return emVoo;
  emVoo = (async () => {
    try {
      const sessao = await exigirSessao(supabase);
      const token = sessao?.access_token;
      if (!token) return null;
      const resposta = await buscar(ROTA_DAS_LOCALIZACOES, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resposta.ok) {
        console.warn(
          `SIGEPSI indisponível (${resposta.status}); o mapa mostra o erro.`,
        );
        return null;
      }
      const corpo: unknown = await resposta.json();
      if (!objeto(corpo) || !objeto(corpo.dseis)) return null;
      const dados: DadosDoSigepsi = {
        dseis: corpo.dseis as LocalizacoesPorDsei,
        casaisNacionais: Array.isArray(corpo.casaisNacionais)
          ? (corpo.casaisNacionais as CasaiNacionalDoSigepsi[])
          : [],
      };
      guardado = { em: relogio(), dados };
      return dados;
    } catch (erro) {
      console.warn("SIGEPSI indisponível:", erro);
      return null;
    } finally {
      emVoo = null;
    }
  })();
  return emVoo;
}

type EstadoDoSigepsi =
  | { estado: "carregando"; dados: null }
  | { estado: "pronto"; dados: DadosDoSigepsi }
  /* SIGEPSI fora ou sem `/api` (servidor local): a tela mostra o erro. */
  | { estado: "indisponivel"; dados: null };

export type LocalizacoesNaTela = EstadoDoSigepsi & { tentarDeNovo(): void };

/**
 * Os dados do SIGEPSI e se ainda estão chegando: o mapa espera por eles,
 * porque a lista de DSEIs e as CASAIs são as do SIGEPSI.
 */
export function usarLocalizacoesDoSigepsi(
  supabase: SupabaseClient | null,
): LocalizacoesNaTela {
  const [localizacoes, setLocalizacoes] = useState<EstadoDoSigepsi>(() =>
    guardado
      ? { estado: "pronto", dados: guardado.dados }
      : { estado: "carregando", dados: null },
  );
  const [tentativa, contarTentativa] = useReducer((n: number) => n + 1, 0);
  const tentarDeNovo = useCallback(() => {
    setLocalizacoes({ estado: "carregando", dados: null });
    contarTentativa();
  }, []);
  useEffect(() => {
    let vivo = true;
    void carregarLocalizacoes(supabase).then((resultado) => {
      if (!vivo) return;
      setLocalizacoes(
        resultado
          ? { estado: "pronto", dados: resultado }
          : { estado: "indisponivel", dados: null },
      );
    });
    return () => {
      vivo = false;
    };
  }, [supabase, tentativa]);
  return { ...localizacoes, tentarDeNovo };
}

import { useEffect, useState } from "react";
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
  inteira (trocar de área e voltar não repete). Falha não fica guardada e o
  mapa usa os dados do banco (`lmap`, `rede_cnes`); fora da Vercel (servidor
  local) a rota não existe e é igual.
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
          `SIGEPSI indisponível (${resposta.status}); o mapa usa os dados do banco.`,
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

export type LocalizacoesNaTela =
  | { estado: "carregando"; dados: null }
  | { estado: "pronto"; dados: DadosDoSigepsi }
  /* SIGEPSI fora ou sem `/api` (servidor local): o mapa usa os dados do banco. */
  | { estado: "indisponivel"; dados: null };

/**
 * Os dados do SIGEPSI e se ainda estão chegando: o mapa espera por eles,
 * porque a lista de DSEIs e as CASAIs são as do SIGEPSI.
 */
export function usarLocalizacoesDoSigepsi(
  supabase: SupabaseClient | null,
): LocalizacoesNaTela {
  const [localizacoes, setLocalizacoes] = useState<LocalizacoesNaTela>(() =>
    guardado
      ? { estado: "pronto", dados: guardado.dados }
      : { estado: "carregando", dados: null },
  );
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
  }, [supabase]);
  return localizacoes;
}

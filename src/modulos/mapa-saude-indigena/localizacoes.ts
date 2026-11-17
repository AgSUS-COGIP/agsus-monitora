import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirSessao, type ClienteDaSessao } from "../../lib/sessao";
import type { LocalizacoesPorDsei } from "../../lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts";

/*
  OS DSEIs DO SIGEPSI (lista, sedes e pontos), PARA O MAPA DA SAÚDE INDÍGENA

  `/api/dseis` (função da Vercel) lê a API do SIGEPSI com o token do servidor;
  aqui só se manda o token da sessão. Um pedido por CACHE_MS para a página
  inteira (trocar de área e voltar não repete). Falha não fica guardada e o
  mapa usa a lista do banco (`lmap`); fora da Vercel (servidor local) a rota
  não existe e é igual.
*/

export const ROTA_DAS_LOCALIZACOES = "/api/dseis";
export const CACHE_MS = 10 * 60_000;

let guardado: { em: number; dseis: LocalizacoesPorDsei } | null = null;
let emVoo: Promise<LocalizacoesPorDsei | null> | null = null;

/** Só para os testes. */
export function esquecerLocalizacoes() {
  guardado = null;
  emVoo = null;
}

export function carregarLocalizacoes(
  supabase: ClienteDaSessao | SupabaseClient | null,
  { buscar = fetch, relogio = () => Date.now() } = {},
): Promise<LocalizacoesPorDsei | null> {
  if (guardado && relogio() - guardado.em < CACHE_MS)
    return Promise.resolve(guardado.dseis);
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
          `Localizações do SIGEPSI indisponíveis (${resposta.status}); o mapa usa os polos do banco.`,
        );
        return null;
      }
      const corpo: unknown = await resposta.json();
      const dseis =
        typeof corpo === "object" && corpo !== null && "dseis" in corpo
          ? corpo.dseis
          : null;
      if (typeof dseis !== "object" || dseis === null) return null;
      guardado = { em: relogio(), dseis: dseis as LocalizacoesPorDsei };
      return guardado.dseis;
    } catch (erro) {
      console.warn("Localizações do SIGEPSI indisponíveis:", erro);
      return null;
    } finally {
      emVoo = null;
    }
  })();
  return emVoo;
}

/** As localizações do SIGEPSI, ou `null` enquanto não chegam (ou se falharem). */
export type LocalizacoesNaTela =
  | { estado: "carregando"; dseis: null }
  | { estado: "pronto"; dseis: LocalizacoesPorDsei }
  /* SIGEPSI fora ou sem `/api` (servidor local): o mapa usa a lista do banco. */
  | { estado: "indisponivel"; dseis: null };

/**
 * As localizações do SIGEPSI e se ainda estão chegando: o mapa espera por
 * elas, porque a lista de DSEIs é a do SIGEPSI.
 */
export function usarLocalizacoesDoSigepsi(
  supabase: SupabaseClient | null,
): LocalizacoesNaTela {
  const [localizacoes, setLocalizacoes] = useState<LocalizacoesNaTela>(() =>
    guardado
      ? { estado: "pronto", dseis: guardado.dseis }
      : { estado: "carregando", dseis: null },
  );
  useEffect(() => {
    let vivo = true;
    void carregarLocalizacoes(supabase).then((resultado) => {
      if (!vivo) return;
      setLocalizacoes(
        resultado
          ? { estado: "pronto", dseis: resultado }
          : { estado: "indisponivel", dseis: null },
      );
    });
    return () => {
      vivo = false;
    };
  }, [supabase]);
  return localizacoes;
}

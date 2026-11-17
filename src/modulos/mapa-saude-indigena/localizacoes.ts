import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirSessao } from "../../lib/sessao";
import type { LocalizacoesPorDsei } from "../../lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts";

/*
  OS POLOS E CASAIs DO SIGEPSI, PARA O MAPA DA SAÚDE INDÍGENA

  `/api/dseis` (função da Vercel) lê a API do SIGEPSI com o token do servidor;
  aqui só se manda o token da sessão. Um pedido por CACHE_MS para a página
  inteira (trocar de área e voltar não repete); falha não fica guardada e o
  mapa segue com os polos do banco (`lmap`). Fora da Vercel (servidor local)
  a rota não existe: o mapa segue igual, com os polos do banco.
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
  supabase: SupabaseClient | null,
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
export function usarLocalizacoesDoSigepsi(
  supabase: SupabaseClient | null,
): LocalizacoesPorDsei | null {
  const [dseis, setDseis] = useState<LocalizacoesPorDsei | null>(
    () => guardado?.dseis ?? null,
  );
  useEffect(() => {
    let vivo = true;
    void carregarLocalizacoes(supabase).then((resultado) => {
      if (vivo && resultado) setDseis(resultado);
    });
    return () => {
      vivo = false;
    };
  }, [supabase]);
  return dseis;
}

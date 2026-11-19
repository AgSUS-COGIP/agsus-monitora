import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirSessao, type ClienteDaSessao } from "../../lib/sessao/sessao";
import { respostaDoTerritorio } from "../../lib/mapas/mapa-saude-indigena/territorio-na-tela.ts";
import type { RespostaDoTerritorio } from "../../lib/mapas/mapa-saude-indigena/territorio-na-tela.ts";

/*
  TERRITÓRIO, ACESSO E CNES DO SIGEPSI, PARA O MAPA

  `/api/territorio-dos-dseis` (função da Vercel) lê as três rotas do SIGEPSI
  com o token do servidor; aqui só se manda o token da sessão. Um pedido por
  CACHE_MS para a página. Cada fonte vem com o próprio `ok`: a negada mostra
  "Dado do SIGEPSI indisponível" e as outras seguem. O pedido inteiro
  falhando (sem a rota no servidor local, rede) também é indisponível, e o
  mapa continua: território e acesso são acréscimo, não a base do mapa.
*/

export const ROTA_DO_TERRITORIO = "/api/territorio-dos-dseis";
export const CACHE_MS = 10 * 60_000;

let guardado: { em: number; resposta: RespostaDoTerritorio } | null = null;
let emVoo: Promise<RespostaDoTerritorio | null> | null = null;

/** Só para os testes. */
export function esquecerTerritorio() {
  guardado = null;
  emVoo = null;
}

export function carregarTerritorio(
  supabase: ClienteDaSessao | SupabaseClient | null,
  { buscar = fetch, relogio = () => Date.now() } = {},
): Promise<RespostaDoTerritorio | null> {
  if (guardado && relogio() - guardado.em < CACHE_MS)
    return Promise.resolve(guardado.resposta);
  if (emVoo) return emVoo;
  emVoo = (async () => {
    try {
      const sessao = await exigirSessao(supabase);
      const token = sessao?.access_token;
      if (!token) return null;
      const resposta = await buscar(ROTA_DO_TERRITORIO, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resposta.ok) {
        console.warn(
          `Território do SIGEPSI indisponível (${resposta.status}).`,
        );
        return null;
      }
      const lida = respostaDoTerritorio(await resposta.json());
      guardado = { em: relogio(), resposta: lida };
      return lida;
    } catch (erro) {
      console.warn("Território do SIGEPSI indisponível:", erro);
      return null;
    } finally {
      emVoo = null;
    }
  })();
  return emVoo;
}

export type TerritorioNaTela =
  | { estado: "carregando"; resposta: null }
  | { estado: "pronto"; resposta: RespostaDoTerritorio }
  | { estado: "indisponivel"; resposta: null };

export function usarTerritorioDoSigepsi(
  supabase: SupabaseClient | null,
): TerritorioNaTela {
  const [territorio, definir] = useState<TerritorioNaTela>(() =>
    guardado
      ? { estado: "pronto", resposta: guardado.resposta }
      : { estado: "carregando", resposta: null },
  );
  useEffect(() => {
    let vivo = true;
    void carregarTerritorio(supabase).then((resposta) => {
      if (!vivo) return;
      definir(
        resposta
          ? { estado: "pronto", resposta }
          : { estado: "indisponivel", resposta: null },
      );
    });
    return () => {
      vivo = false;
    };
  }, [supabase]);
  return territorio;
}

import { useCallback, useEffect, useState } from "react";
import {
  obterRegraDaTriagem,
  salvarRegraDaTriagem,
} from "../../lib/triagem/regra-da-triagem.ts";
import type {
  ClienteDaRegra,
  ConfiguracaoDaTriagem,
  RespostaDaRegraDaTriagem,
} from "../../lib/triagem/regra-da-triagem.ts";

/** Uma RPC que devolve `data` e lança o erro (a de estado-da-pre-classificacao). */
export type RpcDireta = (
  nome: string,
  argumentos: Record<string, unknown>,
) => Promise<unknown>;

/** O cliente das funções da regra a partir de uma RPC direta. */
export function clienteDaRpc(rpc: RpcDireta): ClienteDaRegra {
  return {
    rpc: async (nome, argumentos) => ({
      data: await rpc(nome, argumentos),
      error: null,
    }),
  };
}

/*
  A regra própria da Triagem do edital (obter_regra_triagem), lida ao abrir o
  edital: o resumo só-leitura do topo, a conferência que libera o Recalcular e
  o lote por vaga, que grava versão nova (salvar_regra_triagem).
*/
export function usarRegraDaTriagem(rpc: RpcDireta, editalId: string) {
  const [resposta, setResposta] = useState<RespostaDaRegraDaTriagem | null>(
    null,
  );
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    setResposta(null);
    setErro("");
    if (!editalId) return;
    obterRegraDaTriagem(clienteDaRpc(rpc), editalId)
      .then((r) => {
        if (vivo) setResposta(r);
      })
      .catch((e: unknown) => {
        if (vivo) setErro(String((e as Error)?.message || e));
      });
    return () => {
      vivo = false;
    };
  }, [rpc, editalId]);
  const versao = resposta?.regra?.versao ?? 0;
  const salvar = useCallback(
    async (
      configuracao: ConfiguracaoDaTriagem,
      motivo: string,
    ): Promise<{ ok: true } | { ok: false; erro: string }> => {
      try {
        const regra = await salvarRegraDaTriagem(clienteDaRpc(rpc), {
          edital: editalId,
          configuracao,
          versaoAtual: versao,
          motivo,
        });
        setResposta((r) => (r ? { ...r, regra } : r));
        return { ok: true };
      } catch (e) {
        return { ok: false, erro: String((e as Error)?.message || e) };
      }
    },
    [rpc, editalId, versao],
  );
  return { resposta, erro, salvar };
}

/* "Editar nas Regras do edital": abre Editais com as Regras da Triagem do edital. */
export function abrirRegrasDoEdital(
  editalId: string,
  janela = globalThis.window as
    | {
        navigate?: (view: string) => unknown;
        nucleoController?: { abrirRegrasDaTriagem?: (id: string) => unknown };
      }
    | undefined,
) {
  if (typeof janela?.navigate !== "function") return false;
  janela.navigate("nucleo");
  janela.nucleoController?.abrirRegrasDaTriagem?.(editalId);
  return true;
}

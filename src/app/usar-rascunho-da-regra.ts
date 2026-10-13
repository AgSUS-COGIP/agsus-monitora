import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type {
  Conteudo,
  EstadoDoRascunho,
  RascunhoDaRegra,
} from "./rascunho-da-regra.ts";

/*
  O rascunho guardado na tela da regra (src/app/rascunho-da-regra.ts): abre ao
  montar, manda cada mudança e fecha ao desmontar. O guardado igual à versão
  vigente some sem perguntar; o desta sessão, na mesma versão, volta sem
  perguntar (trocar de aba); os outros esperam "Continuar" ou "Descartar".
*/

type Opcoes = {
  loja: RascunhoDaRegra;
  editalId: string;
  /** Versão vigente da regra (0 = sem regra). */
  versaoVigente: number;
  /** false: só leitura, nada se guarda. */
  ativo: boolean;
  /** O que a tela tem agora. */
  conteudo: Conteudo;
  /** O conteúdo difere da versão vigente. */
  comAlteracoes: boolean;
  /** O conteúdo guardado é igual ao da versão vigente (some sem perguntar). */
  igualAoVigente: (conteudo: Conteudo) => boolean;
  /** Põe o conteúdo guardado na tela. */
  aplicar: (conteudo: Conteudo) => void;
};

export type RascunhoNaTela = EstadoDoRascunho & {
  /** A tela espera (o editor não aparece): lendo o guardado ou perguntando. */
  bloqueia: boolean;
  /** Há rascunho guardado diferente da vigente: a tela pergunta. */
  perguntar: boolean;
  continuar: () => void;
  descartar: () => void;
};

export function usarRascunhoDaRegra({
  loja,
  editalId,
  versaoVigente,
  ativo,
  conteudo,
  comAlteracoes,
  igualAoVigente,
  aplicar,
}: Opcoes): RascunhoNaTela {
  const st = useSyncExternalStore(loja.assinar, loja.obter);
  const doEdital = ativo && st.editalId === editalId;
  const aplicarAtual = useRef(aplicar);
  useEffect(() => {
    aplicarAtual.current = aplicar;
  });

  useEffect(() => {
    if (!ativo || !editalId) return;
    void loja.abrir(editalId, versaoVigente);
    return () => loja.fechar(editalId);
  }, [loja, ativo, editalId, versaoVigente]);

  const continuar = useCallback(() => {
    const c = loja.continuar();
    if (c) aplicarAtual.current(c);
  }, [loja]);
  const descartar = useCallback(() => void loja.descartar(), [loja]);

  // Guardado igual à vigente some; o desta sessão volta sem perguntar.
  const decidir = doEdital && st.fase === "decidir" ? st.guardado : null;
  const igual = decidir ? igualAoVigente(decidir.conteudo) : false;
  useEffect(() => {
    if (!decidir) return;
    if (igual) void loja.descartar();
    else if (loja.obter().retomarSemPerguntar) continuar();
  }, [decidir, igual, loja, continuar]);

  const editando = doEdital && st.fase === "editando";
  useEffect(() => {
    if (editando) loja.mudar(conteudo, comAlteracoes);
  }, [editando, loja, conteudo, comAlteracoes]);

  return {
    ...st,
    bloqueia: ativo && Boolean(editalId) && !editando,
    perguntar: Boolean(decidir) && !igual && !st.retomarSemPerguntar,
    continuar,
    descartar,
  };
}

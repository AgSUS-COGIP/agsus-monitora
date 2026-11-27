import { useEffect, useSyncExternalStore } from "react";
import { pedidoSobDemanda } from "../../lib/carga/pedido-sob-demanda.ts";

/*
  O editor de coordenadas só existe no modo de edição dos mapas: sai do pacote
  principal e chega sob demanda (`import()`), na primeira vez que alguém liga
  a edição. Depois de carregado, desenha na hora (sem Suspense nem quadro
  vazio). `carregarEditorDeCoordenadas` também serve para pedir antes. Se o
  download falhar (rede, versão nova), a falha aparece com "Tentar novamente"
  e o próximo pedido baixa de novo.
*/

type Editor = typeof import("./editor-de-coordenadas.tsx").EditorDeCoordenadas;

/** O que a tela vê: o editor, quando chegou; a falha do download; e como pedir de novo. */
export type EditorSobDemanda = {
  editor: Editor | null;
  erro: string;
  tentarDeNovo: () => void;
};

type Situacao = { editor: Editor | null; erro: string };

/** O carregador e o hook, com o `import()` trocável nos testes. */
export function criarEditorSobDemanda(
  importar: () => Promise<{ EditorDeCoordenadas: Editor }>,
) {
  let situacao: Situacao = { editor: null, erro: "" };
  const ouvintes = new Set<() => void>();
  const publicar = (proxima: Situacao) => {
    situacao = proxima;
    ouvintes.forEach((ouvinte) => ouvinte());
  };
  const baixar = pedidoSobDemanda(importar);

  function carregar(): Promise<Editor> {
    if (situacao.erro) publicar({ ...situacao, erro: "" });
    return baixar().then(
      (modulo) => {
        if (situacao.editor !== modulo.EditorDeCoordenadas)
          publicar({ editor: modulo.EditorDeCoordenadas, erro: "" });
        return modulo.EditorDeCoordenadas;
      },
      (erro: unknown) => {
        publicar({
          editor: null,
          erro: erro instanceof Error ? erro.message : String(erro),
        });
        throw erro;
      },
    );
  }

  function assinar(ouvinte: () => void) {
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  }

  const pedirSemEsperar = () => void carregar().catch(() => {});

  /** O editor, quando já chegou; até lá, null (e o pedido sai). */
  function usar(): EditorSobDemanda {
    const atual = useSyncExternalStore(assinar, () => situacao);
    const falhou = Boolean(atual.erro);
    useEffect(() => {
      if (!atual.editor && !falhou) pedirSemEsperar();
    }, [atual.editor, falhou]);
    return {
      editor: atual.editor,
      erro: atual.erro,
      tentarDeNovo: pedirSemEsperar,
    };
  }

  return { carregar, usar };
}

const padrao = criarEditorSobDemanda(
  () => import("./editor-de-coordenadas.tsx"),
);

export const carregarEditorDeCoordenadas = padrao.carregar;
export const usarEditorDeCoordenadas = padrao.usar;

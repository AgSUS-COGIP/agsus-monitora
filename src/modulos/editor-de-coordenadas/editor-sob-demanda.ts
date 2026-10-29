import { useEffect, useSyncExternalStore } from "react";

/*
  O editor de coordenadas só existe no modo de edição dos mapas: sai do pacote
  principal e chega sob demanda (`import()`), na primeira vez que alguém liga
  a edição. Depois de carregado, desenha na hora (sem Suspense nem quadro
  vazio). `carregarEditorDeCoordenadas` também serve para pedir antes.
*/

type Editor = typeof import("./editor-de-coordenadas.tsx").EditorDeCoordenadas;

let editor: Editor | null = null;
let pedido: Promise<Editor> | null = null;
const ouvintes = new Set<() => void>();

export function carregarEditorDeCoordenadas(): Promise<Editor> {
  pedido ??= import("./editor-de-coordenadas.tsx").then((modulo) => {
    editor = modulo.EditorDeCoordenadas;
    ouvintes.forEach((ouvinte) => ouvinte());
    return editor;
  });
  return pedido;
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** O editor, quando já chegou; até lá, null (e o pedido sai). */
export function usarEditorDeCoordenadas(): Editor | null {
  const atual = useSyncExternalStore(assinar, () => editor);
  useEffect(() => {
    if (!atual) void carregarEditorDeCoordenadas();
  }, [atual]);
  return atual;
}

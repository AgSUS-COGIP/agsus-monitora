/*
  Vai para outra tela do app (os botões "Ir para…" de Entrevistas, Recursos e
  Lista de aprovados). O destino é conferido (src/lib/link-interno.ts) e a
  troca é a da navegação (`window.navigate`, que confere a permissão da
  página e avisa). Com edital, ele vai junto no endereço
  (`/<área>/classificacao/<edital>`), e a rota abre a tela já nele
  (`abrirEdital`, src/app/telas.tsx) depois de carregá-la.
*/
import { linkInterno } from "../lib/link-interno.ts";
import type { ExtrasDaNavegacao } from "./navegacao.ts";

export type JanelaDoApp = {
  navigate?: (view: string, extras?: ExtrasDaNavegacao) => unknown;
};

/** Devolve false se o destino não vale ou se a navegação não está disponível. */
export function irParaTela(
  entrada: unknown,
  janela: JanelaDoApp | undefined = globalThis.window as JanelaDoApp,
): boolean {
  const link = linkInterno(entrada);
  if (!link || typeof janela?.navigate !== "function") return false;
  const edital = link.edital?.id;
  if (edital) janela.navigate(link.view, { edital });
  else janela.navigate(link.view);
  return true;
}

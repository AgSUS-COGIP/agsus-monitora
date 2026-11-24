/*
  Vai para outra tela do app (os botões "Ir para…" de Entrevistas, Recursos e
  Lista de aprovados). O destino é conferido (src/lib/navegacao/link-interno.ts) e a
  troca é a da navegação (`window.navigate`, que confere a permissão da
  página e avisa). Com edital, ele vai junto no endereço
  (`/<área>/classificacao/<edital>`), e a rota abre a tela já nele
  (`abrirEdital`, src/app/telas.tsx) depois de carregá-la. Com visão, a tela
  abre nela (`abrirVisao`: a Classificação na Agenda).
*/
import { linkInterno } from "../lib/navegacao/link-interno.ts";
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
  const extras = {
    ...(link.edital?.id ? { edital: link.edital.id } : {}),
    ...(link.visao ? { visao: link.visao } : {}),
  };
  if (Object.keys(extras).length) janela.navigate(link.view, extras);
  else janela.navigate(link.view);
  return true;
}

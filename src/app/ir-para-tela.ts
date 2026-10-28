/*
  Vai para outra tela do app (os botões "Ir para…" de Entrevistas, Recursos e
  Lista de aprovados). O destino é conferido (src/lib/link-interno.ts) e a
  troca é a do legado (`window.navigate`, que confere a permissão da página e
  avisa). Com edital, a Classificação e Conduzir entrevistas já abrem nele;
  as telas carregam sob demanda (src/app/tela-sob-demanda.ts), então espera
  montar.
*/
import { linkInterno } from "../lib/link-interno.ts";

type Controle = {
  carregar?: () => unknown;
  estado?: { escolherEdital?: (id: string) => unknown };
  abrirEdital?: (id: string) => unknown;
};

export type JanelaDoApp = {
  navigate?: (view: string) => unknown;
  classificacaoController?: Controle;
  conduzirEntrevistasController?: Controle;
  preClassificacaoController?: Controle;
};

/** Devolve false se o destino não vale ou se a navegação não está disponível. */
export function irParaTela(
  entrada: unknown,
  janela: JanelaDoApp | undefined = globalThis.window as JanelaDoApp,
): boolean {
  const link = linkInterno(entrada);
  if (!link || typeof janela?.navigate !== "function") return false;
  janela.navigate(link.view);
  const edital = link.edital?.id;
  if (!edital) return true;
  if (link.view === "classificacao") {
    const controle = janela.classificacaoController;
    void Promise.resolve(controle?.carregar?.())
      .then(() =>
        janela.classificacaoController?.estado?.escolherEdital?.(edital),
      )
      .catch(() => {});
  }
  if (link.view === "conduzir-entrevistas")
    void Promise.resolve(
      janela.conduzirEntrevistasController?.abrirEdital?.(edital),
    ).catch(() => {});
  if (link.view === "pre-classificacao")
    void Promise.resolve(janela.preClassificacaoController?.carregar?.())
      .then(() => janela.preClassificacaoController?.abrirEdital?.(edital))
      .catch(() => {});
  return true;
}

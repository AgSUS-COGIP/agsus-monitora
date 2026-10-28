/*
  O destino de uma navegação dentro do app, conferido antes de navegar: só
  views que o app desenha (as do menu) e, opcionalmente, o edital (uuid do
  monitoramento). Qualquer outra coisa (URL, painel externo, view inventada)
  → null. Quem navega é src/app/ir-para-tela.ts.
*/
import { ABAS_DO_MENU } from "./menu-lateral.ts";

export type EditalDoLink = { id: string; titulo: string };
export type LinkInterno = { view: string; edital?: EditalDoLink };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");

/** `{ view, edital? }` conferido, ou null se não é uma tela do app. */
export function linkInterno(entrada: unknown): LinkInterno | null {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada))
    return null;
  const { view: bruta, edital } = entrada as {
    view?: unknown;
    edital?: { id?: unknown; titulo?: unknown } | null;
  };
  const view = texto(bruta).trim();
  if (
    !/^[a-z][a-z_-]{0,39}$/.test(view) ||
    // Pré-classificação tem view própria, mas só aparece após a ativação no
    // catálogo do banco; permanece válida para o atalho de um edital.
    (!ABAS_DO_MENU.some((aba) => aba.view === view) &&
      view !== "pre-classificacao")
  )
    return null;
  if (edital == null) return { view };
  const id = texto(edital.id).trim();
  if (!UUID.test(id)) return null;
  return {
    view,
    edital: { id, titulo: texto(edital.titulo).trim().slice(0, 120) },
  };
}

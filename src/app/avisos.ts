import { mostrarNotificacao } from "../modules/notificacao.js";

/*
  Os avisos do app: a notificação curta (toast, em `#toastBox`) e a tela de
  carregamento dos salvamentos (`#loader`). As telas recebem os dois pela
  montagem (`window.monitoraToast` e `window.monitoraLoader`, publicados por
  src/app/sistema.ts).
*/

const $ = (id: string) => globalThis.document?.getElementById(id);

/** Disparado no document quando o `#loader` aparece ou some. */
export const EVENTO_DO_CARREGAMENTO = "agsus:carregamento-alterado";

/** Notificação curta: `tom` é "ok" (padrão), "info", "warn" ou "error". */
export function avisar(texto: string, tom: string = "ok"): void {
  mostrarNotificacao($("toastBox"), texto, tom);
}

/** Tela de carregamento de salvamento; não aparece durante a entrada (`config-loading`). */
export function mostrarCarregamento(
  mostrar: boolean,
  titulo: string = "Carregando",
  subtitulo: string = "Aguarde...",
  percentual: number = 0,
): void {
  const documento = globalThis.document;
  if (mostrar && documento.body.classList.contains("config-loading")) return;
  const loader = $("loader");
  if (!loader) return;
  loader.classList.toggle("show", !!mostrar);
  $("loaderTitle")!.textContent = titulo;
  $("loaderSub")!.textContent = subtitulo;
  $("loaderPct")!.textContent = Math.round(percentual) + "%";
  $("loaderBar")!.style.width = Math.max(0, Math.min(100, percentual)) + "%";
  documento.dispatchEvent(new CustomEvent(EVENTO_DO_CARREGAMENTO));
}

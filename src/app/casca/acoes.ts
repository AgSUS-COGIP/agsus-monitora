/*
  As ações da casca chamam os contratos que `src/app/sistema.ts` publica em
  `window` (`refreshData`, `exportPDF`…), resolvidos na hora do clique — como
  faziam os `onclick` do index.html. Assim a casca monta antes de
  `ligarSistema()` e não importa o sistema (que importa a casca de volta só
  pelo DOM, nunca pelo módulo).
*/
export type AcaoDaCasca =
  | "exitExternalPanel"
  | "toggleSidebar"
  | "refreshData"
  | "toggleBrowserFullscreen"
  | "exportPDF"
  | "reloadExternal";

export function chamarAcaoDaCasca(nome: AcaoDaCasca): unknown {
  const acao: unknown = Reflect.get(window, nome);
  return typeof acao === "function" ? acao.call(window) : undefined;
}

/** Fecha o menu da conta (`<details>`) a partir de um botão dentro dele. */
export function fecharMenuDaConta(botao: Element) {
  botao.closest("details")?.removeAttribute("open");
}

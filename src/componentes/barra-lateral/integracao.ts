/** Resolve as ações do app no clique, incluindo suas guardas de navegação. */
function chamarAcao(nome: string, ...argumentos: string[]): unknown {
  const acao: unknown = Reflect.get(window, nome);
  return typeof acao === "function"
    ? acao.call(window, ...argumentos)
    : undefined;
}
export const navegarPelaJanela = (view: string) => chamarAcao("navigate", view);
export const alternarBarraPelaJanela = () => chamarAcao("toggleSidebar");
export const alternarTemaPelaJanela = () => chamarAcao("toggleDarkMode");

/*
  Decide como o aviso global deve aparecer, a partir do que está configurado.

  A decisão vive aqui, fora de `legacy-app.js`, para poder ser testada sem
  levantar a aplicação inteira — o mesmo motivo que tirou o cache da marca de
  lá. Quem chama fica com uma única responsabilidade: escrever no DOM o que esta
  função devolveu.

  As três aparências reaproveitam `.alert`, que já resolve cores e modo escuro.
  `info` fica sem sufixo porque é a variante neutra da classe base.
*/

const APARENCIA_POR_TIPO = {
  info: "",
  warning: "warn",
  danger: "error",
};

const CLASSE_BASE = "alert broadcast-bar";

/**
 * @param {{ mensagem?: unknown, tipo?: unknown }} configurado
 * @returns {{ visivel: boolean, mensagem: string, classe: string }}
 */
export function avisoGlobal(configurado = {}) {
  const mensagem = String(configurado.mensagem ?? "").trim();
  const tipo = String(configurado.tipo ?? "")
    .trim()
    .toLowerCase();

  /*
    Tipo desconhecido cai em `info` em vez de esconder o aviso: se alguém
    escreveu a mensagem, ela precisa aparecer — errar a cor é menos grave que
    engolir o recado.
  */
  const aparencia = APARENCIA_POR_TIPO[tipo] ?? "";

  return {
    visivel: mensagem.length > 0,
    mensagem,
    classe: aparencia ? `${CLASSE_BASE} ${aparencia}` : CLASSE_BASE,
  };
}

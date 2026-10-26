/*
  Endereço em que um painel externo (`TB_PAINEL_EXTERNO`: Apps Script, Looker
  Studio, outros sites) abre: só http(s) absoluto e de **outra origem**.
  Qualquer outra coisa (`javascript:`, texto inválido, caminho relativo como
  `/analises.html`, endereço do próprio MONITORA) vira vazio e o painel não
  abre.

  A mesma origem é recusada porque o quadro tem `allow-scripts` e
  `allow-same-origin` (src/app/paineis-externos.js): com a página do próprio
  app dentro dele, a sandbox não protegeria nada. Não há mais página do app em
  iframe — todas viraram módulos de src/modulos/.
*/
export function enderecoDoPainel(url: unknown, origemAtual?: unknown): string {
  const texto = String(url ?? "").trim();
  if (!texto) return "";
  let endereco: URL;
  try {
    // Sem base: endereço relativo não é endereço de painel.
    endereco = new URL(texto);
  } catch {
    return "";
  }
  if (endereco.protocol !== "http:" && endereco.protocol !== "https:")
    return "";
  let origem = "";
  try {
    origem = origemAtual ? new URL(origemAtual as string | URL).origin : "";
  } catch {
    origem = "";
  }
  if (origem && endereco.origin === origem) return "";
  return texto;
}

/*
  Endereço em que um painel externo (`TB_PAINEL_EXTERNO`: Apps Script, outros
  sites) abre: só http(s); qualquer outra coisa (`javascript:`, texto inválido)
  vira vazio e o painel não abre.

  Antes, as páginas do próprio MONITORA abertas num quadro (análises,
  seleção…) eram trazidas para o domínio atual e recebiam a área (`?area=`).
  Todas viraram módulos de src/modulos/; não há mais página do app em iframe.
*/
export function enderecoDoPainel(url, origemAtual) {
  const texto = String(url ?? "").trim();
  if (!texto) return "";
  let endereco;
  try {
    endereco = new URL(texto, origemAtual);
  } catch {
    return "";
  }
  if (endereco.protocol !== "http:" && endereco.protocol !== "https:")
    return "";
  return texto;
}

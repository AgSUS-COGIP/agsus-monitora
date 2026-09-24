/*
  Endereço em que um painel externo abre.

  O painel Análises é uma página do próprio MONITORA (`analises.html`), mas foi
  cadastrado com o endereço completo de produção. Aberto de outro lugar — o
  localhost, uma prévia da Vercel — ele carregava em outro domínio, não via a
  sessão e mostrava "Sessão não localizada". Página deste app abre sempre no
  domínio atual, qualquer que seja o host gravado no banco.

  Painéis de fora (Apps Script, outros sites) ficam como estão.
*/
export const PAGINAS_DO_APP = Object.freeze(["/analises.html"]);

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
  if (PAGINAS_DO_APP.includes(endereco.pathname)) {
    return new URL(
      endereco.pathname + endereco.search + endereco.hash,
      origemAtual,
    ).toString();
  }
  return texto;
}

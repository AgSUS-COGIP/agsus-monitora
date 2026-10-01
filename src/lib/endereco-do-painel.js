/*
  Endereço em que um painel externo abre.

  Os painéis do próprio MONITORA (`entrevistas.html`, `selecao.html`) podem
  estar cadastrados com o endereço completo de produção. Aberto de outro
  lugar — o localhost, uma prévia da Vercel — o painel carregaria em outro
  domínio, sem a sessão. Página deste app abre sempre no domínio atual,
  qualquer que seja o host gravado no banco.

  Painéis de fora (Apps Script, outros sites) ficam como estão.
*/
export const PAGINAS_DO_APP = Object.freeze([
  "/entrevistas.html",
  "/selecao.html",
]);

/*
  O endereço com a área do menu (`?area=`), para a página do app que serve
  várias áreas (Entrevistas e Seleção: Saúde Indígena, SEDE e Projetos,
  abertas por `src/modules/pagina-do-painel.js`). Só página do app
  recebe a área; sem área, fica o endereço de `enderecoDoPainel`.
*/
export function enderecoDoPainelNaArea(url, origemAtual, area) {
  const endereco = enderecoDoPainel(url, origemAtual);
  const codigo = String(area ?? "").trim();
  if (!endereco || !codigo) return endereco;
  const destino = new URL(endereco, origemAtual);
  if (!PAGINAS_DO_APP.includes(destino.pathname)) return endereco;
  destino.searchParams.set("area", codigo);
  return destino.toString();
}

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

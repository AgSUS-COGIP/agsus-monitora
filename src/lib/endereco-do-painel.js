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

/*
  O endereço com a área do menu (`?area=`), para a página do app que serve
  várias áreas (Análises curriculares: Saúde Indígena, SEDE e Projetos, aberta
  por `src/modules/pagina-de-analises.js`). Só página do app recebe a área; sem
  área, fica o endereço de `enderecoDoPainel`.
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

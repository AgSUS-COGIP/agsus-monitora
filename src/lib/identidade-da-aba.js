/* A aba identifica MONITORA. As seções mantêm seus títulos dentro da página.
   O favicon acompanha a marca institucional, com fallback local. */

/** O ícone que existe no repositório. É para onde tudo volta quando algo falha. */
export const FAVICON_PADRAO = "/assets/agsus-logo.webp";

/*
  As três tags que o SIGAV usa. `apple-touch-icon` é o que o iOS lê ao guardar
  a página na tela de início.
*/
const RELACOES = Object.freeze(["icon", "shortcut icon", "apple-touch-icon"]);

function ehUrlUsavel(valor) {
  const bruto = String(valor || "").trim();
  if (!bruto) return "";
  if (bruto.startsWith("/")) return bruto;
  return /^https:\/\//i.test(bruto) ? bruto : "";
}

/*
  `link[rel~="icon"]` NÃO alcança `apple-touch-icon`: o seletor `~=` casa
  palavras separadas por espaço, e "apple-touch-icon" é uma palavra só. Com ele,
  a tag do iOS ficava para trás enquanto as outras duas mudavam. Por isso as
  três relações são pedidas pelo nome.
*/
const SELETOR_DE_ICONES = RELACOES.map((rel) => `link[rel="${rel}"]`).join(",");

function ligacoesDeIcone(documento) {
  const existentes = [...documento.querySelectorAll(SELETOR_DE_ICONES)];
  if (existentes.length) return existentes;

  /* Primeira execução: cria as três, como no SIGAV. */
  return RELACOES.map((rel) => {
    const link = documento.createElement("link");
    link.rel = rel;
    documento.head.appendChild(link);
    return link;
  });
}

export function escreverFavicon(url, documento = globalThis.document) {
  const alvo = ehUrlUsavel(url);
  if (!alvo || !documento?.head) return false;
  for (const link of ligacoesDeIcone(documento)) {
    link.setAttribute("href", alvo);
    link.removeAttribute("type");
  }
  return true;
}

/*
  Só troca o ícone depois de a imagem carregar de verdade.

  Trocar antes deixaria a aba sem ícone nenhum quando a URL configurada estivesse
  errada ou fora do ar — pior do que o ícone antigo. Se a nova falha, fica o que
  estava; se nunca houve nada, fica o asset local.
*/
export function aplicarFaviconDaMarca(
  url,
  { documento = globalThis.document, criarImagem } = {},
) {
  const alvo = ehUrlUsavel(url);
  if (!alvo) return Promise.resolve(false);
  if (alvo === FAVICON_PADRAO)
    return Promise.resolve(escreverFavicon(alvo, documento));

  const Imagem = criarImagem || (() => new globalThis.Image());
  return new Promise((resolver) => {
    let respondido = false;
    const terminar = (ok) => {
      if (respondido) return;
      respondido = true;
      resolver(ok ? escreverFavicon(alvo, documento) : false);
    };

    const imagem = Imagem();
    imagem.onload = () => terminar(true);
    imagem.onerror = () => terminar(false);
    imagem.src = alvo;
  });
}

// A aba identifica o produto; o título de cada seção continua no conteúdo da tela.
export const TITULO_MONITORA = "MONITORA";

export function definirPaginaDaAba(_pagina, documento = globalThis.document) {
  if (documento) documento.title = TITULO_MONITORA;
  return TITULO_MONITORA;
}

export function definirSistemaDaAba(_sistema, documento = globalThis.document) {
  return definirPaginaDaAba(null, documento);
}

/*
  O que a aba do navegador mostra: o ícone e o nome.

  Dois defeitos moravam aqui, medidos antes de mexer.

  O ÍCONE nunca mudava. O `<link id="appFavicon">` existia com id — sinal de que
  alguém pretendeu atualizá-lo —, mas **nenhum código escrevia nele**. Ficava
  preso numa imagem hospedada em `i.postimg.cc`, um host de terceiros, para
  sempre e independentemente da marca configurada.

  O NOME era sobrescrito. `setPageTitle()` compõe corretamente
  "Saúde Indígena - AgSUS Monitora", mas `applyConfigToUi()` fazia
  `document.title = appVersion() || "AgSUS Monitora"` — e `appVersion()` devolve
  a **versão publicada**, algo como "AgSUS Monitora Web V2.9.35". Ou seja: a
  cada aplicação da configuração o nome da página era trocado por uma string de
  versão. Era isso que fazia o título "voltar" em vez de acompanhar a aba.

  Aqui há um dono só para as duas coisas. O SIGAV faz metade disto — usa um
  asset local em três tags de ícone, mas com caminho fixo. Este módulo vai além:
  o ícone acompanha a marca institucional configurada e cai no asset local
  quando ela não carrega, sem nunca depender de host de terceiros.
*/

/** O ícone que existe no repositório. É para onde tudo volta quando algo falha. */
export const FAVICON_PADRAO = "/assets/agsus-logo.webp";

/*
  As três tags que o SIGAV usa. `apple-touch-icon` é o que o iOS lê ao guardar
  a página na tela de início.
*/
const RELACOES = Object.freeze(["icon", "shortcut icon", "apple-touch-icon"]);

let ultimaPagina = "";
let ultimoSistema = "";

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

const texto = (valor) => String(valor ?? "").trim();

/*
  O nome da aba é sempre "<página> - <sistema>", com as partes vazias
  descartadas. Guardar as duas metades é o que permite recompor quando só uma
  delas muda — a configuração chega depois da primeira navegação, e antes disso
  o nome do sistema ainda não é conhecido.
*/
export function comporTitulo(pagina, sistema) {
  return [texto(pagina), texto(sistema)].filter(Boolean).join(" - ");
}

export function definirPaginaDaAba(pagina, documento = globalThis.document) {
  ultimaPagina = texto(pagina);
  const composto = comporTitulo(ultimaPagina, ultimoSistema);
  if (composto && documento) documento.title = composto;
  return composto;
}

export function definirSistemaDaAba(sistema, documento = globalThis.document) {
  ultimoSistema = texto(sistema);
  const composto = comporTitulo(ultimaPagina, ultimoSistema);
  if (composto && documento) documento.title = composto;
  return composto;
}

/** Usado pelos testes; a aplicação nunca precisa reiniciar este estado. */
export function reiniciarIdentidadeDaAba() {
  ultimaPagina = "";
  ultimoSistema = "";
}

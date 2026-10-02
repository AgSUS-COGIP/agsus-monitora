/*
  A marca da tela de acesso: arte de fundo, cor do painel, logo, saudação,
  texto do botão e o rodapé institucional. Estado sem React (`obter`/`assinar`)
  que a tela de entrada (entrada.jsx) lê com `useSyncExternalStore`.

  ORDEM DE CARREGAMENTO
    0. antes do primeiro quadro — o script clássico do <head> do index.html
       aplica a arte e a cor guardadas (cópia mínima desta leitura);
    1. ao avaliar este módulo (é o primeiro import de src/main.js) — a marca
       guardada da visita anterior, sem rede;
    2. em paralelo — `obter_branding_acesso_publico()`, que traz a identidade
       atual e não exige autenticação;
    3. se a RPC respondeu, o cache é atualizado e os campos reaplicados;
    4. depois que o legado carrega TB_CONFIGURACAO, `definirMarcaDaConfiguracao`
       aplica a configuração completa (só as chaves que vieram do banco).

  O que uma falha **não** pode fazer: trocar uma identidade correta por outra.
  Se a RPC não responder, fica o que estava; se nada estava, a tela fica neutra.
  Nunca a arte padrão apresentada como se fosse escolha da instituição.

  A arte e a cor vão no `#loginScreen` (variáveis CSS e a classe
  `login-panel-dark`, que o CSS exige no próprio elemento); logo, saudação,
  texto do botão e rodapé vão para o estado, que a tela desenha.
*/

import {
  guardarMarca,
  lerMarcaGuardada,
} from "../../lib/access-branding-cache.js";
import { buscarMarcaPublica } from "../../lib/access-branding-publico.js";
import {
  DEFAULT_ACCESS_BRANDING,
  normalizeAccessBackgroundUrl,
  normalizeAccessLogoUrl,
  normalizeAccessPanelColor,
} from "../../lib/access-branding.js";
import {
  MODO_AUTO,
  TEXTO_CLARO,
  corDoTextoPara,
  normalizarModo,
} from "../../lib/contraste.js";

const RODAPE_VAZIO = Object.freeze({
  nome: "",
  logoUrl: "",
  funcao: "",
  versao: "",
  departamento: "",
});

export const MARCA_INICIAL = Object.freeze({
  logoUrl: DEFAULT_ACCESS_BRANDING.logoUrl,
  saudacao: DEFAULT_ACCESS_BRANDING.greeting,
  textoDoBotao: "",
  rodape: RODAPE_VAZIO,
});

/** `url("…")` seguro: aspas e barras invertidas quebrariam a declaração CSS. */
function comoUrlCss(valor) {
  return `url("${String(valor).replace(/["\\]/g, "")}")`;
}

const texto = (valor) => String(valor ?? "").trim();

/** O estado da marca: `obter()`, `assinar(ouvinte)` e as escritas. */
export function criarMarcaDaEntrada() {
  let atual = MARCA_INICIAL;
  const ouvintes = new Set();
  const definir = (parcial) => {
    atual = { ...atual, ...parcial };
    ouvintes.forEach((ouvinte) => ouvinte());
  };
  return {
    obter: () => atual,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    definir,
    reiniciarParaTestes: () => definir(MARCA_INICIAL),
  };
}

export const marcaDaEntrada = criarMarcaDaEntrada();

/*
  Aplicar a cor do painel é, sempre, aplicar também o contraste: a classe
  `login-panel-dark` sai de `corDoTextoPara(cor, modo)` toda vez que a cor é
  aplicada. Com `auto`, que é o padrão, a luminância decide; "claro" e
  "escuro" são escolha de identidade (quem escolhe vê o número em
  Configurações antes de salvar).
*/
export function aplicarCorDoPainel(tela, cor, modo = MODO_AUTO) {
  if (!tela || !cor) return false;
  tela.style.setProperty("--login-panel-color", cor);
  tela.classList.toggle(
    "login-panel-dark",
    corDoTextoPara(cor, modo) === TEXTO_CLARO,
  );
  return true;
}

/**
 * Aplica uma marca (campos do cache: backgroundUrl, panelColor, textoModo,
 * logoUrl, greeting, buttonText). Cada campo é opcional; o que falta fica como
 * está. Os campos entram juntos: aplicar só a arte e a cor produzia tela
 * híbrida — o fundo de uma configuração com a saudação e o logotipo de outra.
 * @returns {boolean} `true` se algo chegou a ser aplicado.
 */
export function aplicarMarcaNaTela(
  marca,
  documento = globalThis.document,
  estado = marcaDaEntrada,
) {
  if (!marca) return false;

  const tela = documento?.getElementById?.("loginScreen");
  if (tela && marca.backgroundUrl) {
    tela.style.setProperty(
      "--login-background-image",
      comoUrlCss(marca.backgroundUrl),
    );
  }
  if (tela) aplicarCorDoPainel(tela, marca.panelColor, marca.textoModo);

  const parcial = {};
  if (marca.logoUrl) parcial.logoUrl = marca.logoUrl;
  if (marca.greeting) parcial.saudacao = marca.greeting;
  if (marca.buttonText) parcial.textoDoBotao = marca.buttonText;
  if (Object.keys(parcial).length) estado.definir(parcial);

  return Boolean(tela) || Object.keys(parcial).length > 0;
}

export function aplicarMarcaGuardadaNoArranque(
  documento = globalThis.document,
  estado = marcaDaEntrada,
) {
  return aplicarMarcaNaTela(lerMarcaGuardada(), documento, estado);
}

/**
 * Busca a identidade atual e aplica-a, guardando-a para a próxima visita.
 * Falhar aqui é inofensivo por construção: nada é aplicado e nada é guardado.
 */
export async function atualizarMarcaComBrandingPublico(
  documento = globalThis.document,
  estado = marcaDaEntrada,
) {
  const marca = await buscarMarcaPublica();
  if (!marca) return false;

  /*
    Aplica o resultado da mescla, não a resposta crua. A resposta pública não
    carrega todos os campos que a tela conhece — aplicar só ela reverteria os
    ausentes para o padrão, que é o mesmo efeito que a mescla no cache existe
    para evitar.
  */
  const completa = guardarMarca(marca) || marca;
  return aplicarMarcaNaTela(completa, documento, estado);
}

/**
 * A configuração completa (TB_CONFIGURACAO), que o legado carrega e repassa
 * aqui a cada `loadConfig`.
 *
 * A identidade só é tocada quando veio do banco: exige-se prova dupla — a
 * configuração carregou (`carregou`) **e** a chave veio mesmo na resposta
 * (`chaves`). O caminho de erro do `loadConfig()` chega aqui com a
 * configuração vazia; sem a prova, os normalizadores devolveriam os padrões e
 * `guardarMarca()` os gravaria como se fossem a identidade da instituição,
 * contaminando a inicialização seguinte. O rodapé institucional é desenhado
 * com o que houver.
 */
export function definirMarcaDaConfiguracao(
  { valores = {}, carregou = false, chaves = new Set() } = {},
  documento = globalThis.document,
  estado = marcaDaEntrada,
) {
  const valor = (chave) => texto(valores[chave]);
  const doBanco = (chave) =>
    carregou && chaves.has(chave) ? (valores[chave] ?? "") : null;

  const fundoDoBanco = doBanco("auth_access_background_url");
  const painelDoBanco = doBanco("auth_access_panel_color");
  const logoDoBanco = doBanco("auth_access_logo_url");
  const saudacaoDoBanco = doBanco("auth_access_greeting");

  const tela = documento?.getElementById?.("loginScreen");
  const marcaParaGuardar = {};
  const parcial = {};

  if (tela && fundoDoBanco !== null) {
    const url = normalizeAccessBackgroundUrl(fundoDoBanco);
    tela.style.setProperty("--login-background-image", comoUrlCss(url));
    marcaParaGuardar.backgroundUrl = url;
  }

  if (tela && painelDoBanco !== null) {
    const cor = normalizeAccessPanelColor(painelDoBanco);
    const modo = normalizarModo(valor("auth_access_texto_modo"));
    aplicarCorDoPainel(tela, cor, modo);
    marcaParaGuardar.panelColor = cor;
    marcaParaGuardar.textoModo = modo;
  }

  if (logoDoBanco !== null) {
    const logo = normalizeAccessLogoUrl(logoDoBanco);
    parcial.logoUrl = logo;
    marcaParaGuardar.logoUrl = logo;
  }

  if (saudacaoDoBanco !== null) {
    const saudacao = saudacaoDoBanco || DEFAULT_ACCESS_BRANDING.greeting;
    parcial.saudacao = saudacao;
    marcaParaGuardar.greeting = saudacao;
  }

  parcial.rodape = {
    nome: valor("cogip_nome"),
    logoUrl: valor("cogip_logo_url"),
    funcao: valor("cogip_funcao"),
    versao: valor("cogip_versao"),
    departamento: valor("cogip_dept") || valor("footer_text"),
  };
  estado.definir(parcial);

  /*
    Guarda os campos juntos, e só os que vieram do banco. Guardar apenas
    fundo e cor produzia tela híbrida: arte de uma configuração com
    saudação de outra.
  */
  if (Object.keys(marcaParaGuardar).length) guardarMarca(marcaParaGuardar);
}

/*
  O `#loginScreen` já existe quando este módulo é avaliado (src/main.js é
  `type="module"`, portanto adiado até o HTML ser analisado); o
  `DOMContentLoaded` cobre quem o importar antes disso.
*/
if (typeof document !== "undefined") {
  if (!document.getElementById("loginScreen")) {
    document.addEventListener(
      "DOMContentLoaded",
      () => aplicarMarcaGuardadaNoArranque(),
      { once: true },
    );
  } else {
    aplicarMarcaGuardadaNoArranque();
  }

  /*
    A busca não é aguardada: o primeiro quadro já foi pintado com o que havia, e
    esta chamada apenas o corrige quando a resposta chega.
  */
  void atualizarMarcaComBrandingPublico();
}

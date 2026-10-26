import { needsLightForeground } from "../lib/access-branding.ts";
import {
  CHAVE_DA_COR_DA_BARRA,
  CHAVE_DO_LOGO_DA_BARRA,
  COR_PADRAO_DA_BARRA,
  LOGO_PADRAO_DA_BARRA,
  corDaBarraSegura,
  logoDaBarraSegura,
} from "../lib/marca-da-barra-lateral.ts";

/*
  Pinta a barra lateral com a logo e a cor gravadas (`ui_sidebar_logo_url`,
  `ui_sidebar_background_color`). A escolha (envio de logo, galeria, cor e o
  aviso de contraste) é de Configurações › Aparência, em React
  (src/modulos/configuracoes/aparencia.tsx), que chama
  `aplicarMarcaDaBarraLateral` enquanto a pessoa experimenta.

  Os valores vêm da leitura da configuração que o app já faz na entrada
  (src/app/configuracao.ts chama `aplicarMarcaDaConfiguracao`): sem consulta
  própria. A consulta antiga relia TB_CONFIGURACAO a cada SIGNED_IN, e o
  Supabase emite SIGNED_IN toda vez que a aba volta a ficar visível.
*/

let initialized = false;
let currentLogo = LOGO_PADRAO_DA_BARRA;
let currentColor = COR_PADRAO_DA_BARRA;

/*
  A logo volta a ser o `<img id="sideLogo">`, e não um `background-image` numa
  variável CSS.

  A apresentação por variável dependia de `.side-logo-wrap { background-image }`,
  que o antigo `system-ui-fixes.css` anulava com `background: transparent !important` —
  o atalho `background` zera `background-image`, e o `!important` ganha da regra
  normal. Com o `<img>` em `opacity: 0` por baixo, não sobrava nada para ver:
  o topo da barra lateral ficava branco.

  Aqui há um elemento só, com um dono só. Se a URL escolhida não carregar, o
  `onerror` devolve o padrão em vez de esconder a imagem — uma logo tem de
  aparecer mesmo quando a leitura do banco falha.
*/
function aplicarLogoNaBarraLateral(logo) {
  const img = document.getElementById("sideLogo");
  if (!img) return false;

  img.onerror = () => {
    img.onerror = null;
    if (img.getAttribute("src") !== LOGO_PADRAO_DA_BARRA) {
      img.setAttribute("src", LOGO_PADRAO_DA_BARRA);
    }
  };
  if (img.getAttribute("src") !== logo) img.setAttribute("src", logo);
  img.alt = "AgSUS";
  img.style.removeProperty("display");
  return true;
}

/** Pinta a barra lateral: cor de fundo, texto claro ou escuro e logo. */
export function aplicarMarcaDaBarraLateral({
  logo = currentLogo,
  cor = currentColor,
} = {}) {
  currentLogo = logoDaBarraSegura(logo);
  currentColor = corDaBarraSegura(cor);

  document.documentElement.style.setProperty(
    "--sidebar-custom-bg",
    currentColor,
  );
  aplicarLogoNaBarraLateral(currentLogo);
  document.body?.classList.toggle(
    "sidebar-theme-dark",
    needsLightForeground(currentColor),
  );
}

/**
 * Pinta a barra com a logo e a cor da configuração carregada (objeto chave →
 * valor). Leitura sem nenhuma das duas chaves (a da tela de acesso, sem
 * sessão, não as traz) não mexe no que está pintado.
 */
export function aplicarMarcaDaConfiguracao(valores = {}) {
  const tem = (chave) => Object.hasOwn(valores || {}, chave);
  if (!tem(CHAVE_DO_LOGO_DA_BARRA) && !tem(CHAVE_DA_COR_DA_BARRA)) return false;
  aplicarMarcaDaBarraLateral({
    logo: valores[CHAVE_DO_LOGO_DA_BARRA],
    cor: valores[CHAVE_DA_COR_DA_BARRA],
  });
  return true;
}

export function initSidebarBranding() {
  if (initialized || typeof document === "undefined") return;
  initialized = true;

  // O padrão até a configuração chegar (aplicarMarcaDaConfiguracao).
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => aplicarMarcaDaBarraLateral(),
      { once: true },
    );
  } else {
    aplicarMarcaDaBarraLateral();
  }
}

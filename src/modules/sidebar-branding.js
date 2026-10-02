import { needsLightForeground } from "../lib/access-branding.js";
import {
  CHAVE_DA_COR_DA_BARRA,
  CHAVE_DO_LOGO_DA_BARRA,
  COR_PADRAO_DA_BARRA,
  LOGO_PADRAO_DA_BARRA,
  corDaBarraSegura,
  logoDaBarraSegura,
} from "../lib/marca-da-barra-lateral.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";

/*
  Pinta a barra lateral com a logo e a cor gravadas (`ui_sidebar_logo_url`,
  `ui_sidebar_background_color`). A escolha (envio de logo, galeria, cor e o
  aviso de contraste) é de Configurações › Aparência, em React
  (src/modulos/configuracoes/aparencia.jsx), que chama
  `aplicarMarcaDaBarraLateral` enquanto a pessoa experimenta.
*/

let initialized = false;
let client = null;
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

async function readSidebarBranding() {
  if (!client) return false;
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData?.session) return false;
  const { data, error } = await client
    .from("TB_CONFIGURACAO")
    .select("chave,valor")
    .in("chave", [CHAVE_DO_LOGO_DA_BARRA, CHAVE_DA_COR_DA_BARRA]);
  if (error) return false;
  const values = Object.fromEntries(
    (data || []).map((row) => [row.chave, row.valor]),
  );
  aplicarMarcaDaBarraLateral({
    logo: values[CHAVE_DO_LOGO_DA_BARRA],
    cor: values[CHAVE_DA_COR_DA_BARRA],
  });
  return true;
}

export function initSidebarBranding() {
  if (initialized || typeof document === "undefined") return;
  initialized = true;
  client = getSupabaseClient();

  const boot = () => {
    aplicarMarcaDaBarraLateral();
    void readSidebarBranding();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  if (!client) return;

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      void readSidebarBranding();
    }
  });
}

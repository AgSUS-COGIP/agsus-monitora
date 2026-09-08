/*
  Pinta a tela de acesso com a marca da visita anterior, antes de qualquer rede.

  Importado cedo em `main.js`, este módulo roda enquanto o restante da aplicação
  ainda está sendo avaliado — antes, portanto, da consulta que traz a
  configuração do Supabase. É o mais próximo que uma página única servida
  estaticamente chega do que o SIGAV faz no servidor: entregar a tela já pintada.

  Aplica só as duas propriedades que mudam a aparência do primeiro quadro — a
  arte de fundo e a cor do painel. O resto da marca (saudação, instrução,
  logotipo) é texto e imagem dentro do cartão, que já nasce com o conteúdo do
  HTML e não passa pelo estado intermediário.

  Quando a configuração real chega, `applyConfigToUi()` sobrescreve estes valores
  e chama `guardarMarca()`. Se a configuração divergir do que estava guardado, a
  troca acontece — mas entre duas configurações legítimas, não entre um padrão
  alheio e a identidade da instituição.
*/

import { lerMarcaGuardada } from "./access-branding-cache.js";

/** `url("…")` seguro: aspas e barras invertidas quebrariam a declaração CSS. */
function comoUrlCss(valor) {
  return `url("${String(valor).replace(/["\\]/g, "")}")`;
}

export function aplicarMarcaGuardadaNoArranque(
  documento = globalThis.document,
) {
  const marca = lerMarcaGuardada();
  if (!marca) return false;

  const tela = documento?.getElementById?.("loginScreen");
  if (!tela) return false;

  if (marca.backgroundUrl) {
    tela.style.setProperty(
      "--login-background-image",
      comoUrlCss(marca.backgroundUrl),
    );
  }
  if (marca.panelColor) {
    tela.style.setProperty("--login-panel-color", marca.panelColor);
  }

  return true;
}

/*
  O `loginScreen` pode ainda não existir quando este módulo é avaliado, porque o
  script é `type="module"` e portanto adiado. Tentar duas vezes — agora e no
  `DOMContentLoaded` — cobre os dois casos sem depender da ordem das tags.
*/
if (typeof document !== "undefined") {
  if (!aplicarMarcaGuardadaNoArranque()) {
    document.addEventListener(
      "DOMContentLoaded",
      () => aplicarMarcaGuardadaNoArranque(),
      { once: true },
    );
  }
}

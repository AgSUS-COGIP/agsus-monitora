/*
  Pinta a tela de acesso com a identidade da instituição, o mais cedo possível.

  Importado cedo em `main.js`, este módulo roda enquanto o restante da aplicação
  ainda está sendo avaliado. É o mais próximo que uma página única servida
  estaticamente chega do que o SIGAV faz no servidor: entregar a tela já pintada.

  ORDEM DE CARREGAMENTO
    1. primeiro quadro — a marca guardada da visita anterior, sem rede;
    2. em paralelo — `obter_branding_acesso_publico()`, que traz a identidade
       atual e não exige autenticação;
    3. se a RPC respondeu, o cache é atualizado e os campos reaplicados;
    4. depois do login, `applyConfigToUi()` cuida da configuração completa.

  O passo 2 existe porque o cache resolve a segunda visita, não a primeira.
  Navegador novo, aba anónima ou armazenamento limpo não têm o que aplicar no
  passo 1 — e é justamente aí que a tela precisa mostrar a identidade certa.

  O que uma falha **não** pode fazer: trocar uma identidade correta por outra.
  Se a RPC não responder, fica o que estava; se nada estava, a tela fica neutra.
  Nunca a arte padrão apresentada como se fosse escolha da instituição.
*/

import { guardarMarca, lerMarcaGuardada } from "./access-branding-cache.js";
import { buscarMarcaPublica } from "./access-branding-publico.js";
import { needsLightForeground } from "./access-branding.js";

/** `url("…")` seguro: aspas e barras invertidas quebrariam a declaração CSS. */
function comoUrlCss(valor) {
  return `url("${String(valor).replace(/["\\]/g, "")}")`;
}

/*
  Aplicar a cor do painel é, sempre, aplicar também o contraste.

  Antes havia duas implementações independentes da mesma identidade:
  `applyConfigToUi()` definia `--login-panel-color` **e** alternava
  `login-panel-dark`; este módulo definia só a cor. O resultado aparecia na tela
  de acesso não autenticada — onde `applyConfigToUi()` nem chega a tocar na
  identidade, porque `anon` não recebe `auth_access_panel_color` — com painel
  escuro e texto escuro por cima. Ilegível, e permanente, não por um quadro.

  A classe não é guardada em lado nenhum: é **derivada** da cor, toda vez que a
  cor é aplicada. `panelColor` é a única fonte de verdade.
*/
export function aplicarCorDoPainel(tela, cor) {
  if (!tela || !cor) return false;
  tela.style.setProperty("--login-panel-color", cor);
  tela.classList.toggle("login-panel-dark", needsLightForeground(cor));
  return true;
}

/**
 * Escreve uma marca na tela. Cada campo é opcional; o que falta fica como está.
 * @returns {boolean} `true` se algo chegou a ser aplicado.
 */
export function aplicarMarcaNaTela(marca, documento = globalThis.document) {
  if (!marca) return false;

  const tela = documento?.getElementById?.("loginScreen");
  if (!tela) return false;

  if (marca.backgroundUrl) {
    tela.style.setProperty(
      "--login-background-image",
      comoUrlCss(marca.backgroundUrl),
    );
  }
  aplicarCorDoPainel(tela, marca.panelColor);

  /*
    Os campos entram juntos. Aplicar só a arte e a cor produzia tela híbrida: o
    fundo de uma configuração com a saudação e o logotipo de outra — o pior dos
    dois mundos, porque parece uma identidade que ninguém escolheu.
  */
  const logo = documento?.getElementById?.("loginLogo");
  if (logo && marca.logoUrl) logo.setAttribute("src", marca.logoUrl);

  const saudacao = documento?.getElementById?.("loginGreeting");
  if (saudacao && marca.greeting) saudacao.textContent = marca.greeting;

  const instrucao = documento?.getElementById?.("loginDescription");
  if (instrucao && marca.instruction) instrucao.textContent = marca.instruction;

  const textoDoBotao = documento?.getElementById?.("googleLoginText");
  if (textoDoBotao && marca.buttonText) {
    textoDoBotao.textContent = marca.buttonText;
  }

  return true;
}

export function aplicarMarcaGuardadaNoArranque(
  documento = globalThis.document,
) {
  return aplicarMarcaNaTela(lerMarcaGuardada(), documento);
}

/**
 * Busca a identidade atual e aplica-a, guardando-a para a próxima visita.
 * Falhar aqui é inofensivo por construção: nada é aplicado e nada é guardado.
 */
export async function atualizarMarcaComBrandingPublico(
  documento = globalThis.document,
) {
  const marca = await buscarMarcaPublica();
  if (!marca) return false;

  guardarMarca(marca);
  return aplicarMarcaNaTela(marca, documento);
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

  /*
    A busca não é aguardada: o primeiro quadro já foi pintado com o que havia, e
    esta chamada apenas o corrige quando a resposta chega. `void` deixa explícito
    que a promessa é deliberadamente ignorada — falhar aqui não interrompe nada.
  */
  void atualizarMarcaComBrandingPublico();
}

import { needsLightForeground } from "../../lib/access-branding.ts";
import {
  CHAVE_DA_COR_DA_BARRA,
  CHAVE_DO_LOGO_DA_BARRA,
  COR_PADRAO_DA_BARRA,
  LOGO_PADRAO_DA_BARRA,
  corDaBarraSegura,
  logoDaBarraSegura,
} from "../../lib/marca-da-barra-lateral.ts";

/*
  A marca da barra lateral: a logo e a cor gravadas (`ui_sidebar_logo_url`,
  `ui_sidebar_background_color`), fora do React. Era o legado
  `src/modules/sidebar-branding.js`.

  A escolha (envio de logo, galeria, cor e o aviso de contraste) é de
  Configurações › Aparência (src/modulos/configuracoes/aparencia.tsx), que
  chama `aplicarMarcaDaBarraLateral` enquanto a pessoa experimenta. Os valores
  gravados vêm da leitura da configuração que o app já faz na entrada
  (src/app/configuracao.ts chama `aplicarMarcaDaConfiguracao`): sem consulta
  própria. A consulta antiga relia TB_CONFIGURACAO a cada SIGNED_IN, e o
  Supabase emite SIGNED_IN toda vez que a aba volta a ficar visível.

  Duas saídas:
  - a cor vale para a página inteira (`--sidebar-custom-bg` em `html`, usada
    também pelo carregamento, e `body.sidebar-theme-dark` para o texto claro),
    então é escrita aqui, na hora;
  - a logo é do React: `<Marca>` (barra-lateral.tsx) lê `logoDaBarraLateral()`
    e desenha o `<img id="sideLogo">`, com a volta para a padrão se o endereço
    não carregar — uma logo tem de aparecer mesmo quando a leitura do banco
    falha. Um elemento só, com um dono só (o `background-image` antigo era
    anulado por um `background: transparent !important` e o topo ficava branco).
*/

let logoAtual = LOGO_PADRAO_DA_BARRA;
let corAtual = COR_PADRAO_DA_BARRA;
const ouvintes = new Set<() => void>();

export function assinarMarcaDaBarraLateral(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** A logo que a barra mostra (já conferida: caminho do site ou https). */
export function logoDaBarraLateral() {
  return logoAtual;
}

export interface MarcaDaBarraLateral {
  logo?: unknown;
  cor?: unknown;
}

/** Pinta a barra lateral: cor de fundo, texto claro ou escuro e logo. */
export function aplicarMarcaDaBarraLateral({
  logo = logoAtual,
  cor = corAtual,
}: MarcaDaBarraLateral = {}) {
  const proximaLogo = logoDaBarraSegura(logo);
  corAtual = corDaBarraSegura(cor);

  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--sidebar-custom-bg", corAtual);
    document.body?.classList.toggle(
      "sidebar-theme-dark",
      needsLightForeground(corAtual),
    );
  }

  if (proximaLogo !== logoAtual) {
    logoAtual = proximaLogo;
    for (const ouvinte of ouvintes) ouvinte();
  }
}

/**
 * Pinta a barra com a logo e a cor da configuração carregada (objeto chave →
 * valor). Leitura sem nenhuma das duas chaves (a da tela de acesso, sem
 * sessão, não as traz) não mexe no que está pintado.
 */
export function aplicarMarcaDaConfiguracao(
  valores: Record<string, unknown> | null | undefined = {},
) {
  const tem = (chave: string) => Object.hasOwn(valores || {}, chave);
  if (!valores || (!tem(CHAVE_DO_LOGO_DA_BARRA) && !tem(CHAVE_DA_COR_DA_BARRA)))
    return false;
  aplicarMarcaDaBarraLateral({
    logo: valores[CHAVE_DO_LOGO_DA_BARRA],
    cor: valores[CHAVE_DA_COR_DA_BARRA],
  });
  return true;
}

/* Só para os testes: volta à marca padrão. */
export function redefinirMarcaDaBarraLateral() {
  aplicarMarcaDaBarraLateral({
    logo: LOGO_PADRAO_DA_BARRA,
    cor: COR_PADRAO_DA_BARRA,
  });
}

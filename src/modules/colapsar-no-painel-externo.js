/*
  O botão de recolher a barra lateral, no painel externo.

  Há dois controles para a mesma ação. No desktop vale o hambúrguer do
  cabeçalho, `#hambToggle`; o flutuante `#globalSidebarToggle` fica escondido por
  `system-ui-fixes.css`, em `@media (min-width: 901px)`. Em telas estreitas os
  papéis se invertem.

  `external-panel-mode` esconde o cabeçalho inteiro — e leva o hambúrguer junto.
  Medido no preview em 10/09/2026, a 1440x900: `header.top` com `display:none`,
  `#hambToggle` sem caixa, `#globalSidebarToggle` com `display:none`. Ou seja,
  dentro de um painel externo não sobrava nenhum botão de recolher.

  A correção move o botão flutuante para dentro da barra lateral, que é o único
  lugar que `external-panel-mode` mantém de pé. Mover, e não recriar: o `id`, o
  `onclick="toggleSidebar()"` e os rótulos que `syncSidebarToggle()` escreve vão
  com o nó.

  A mudança é feita uma vez, no arranque, e não depende do modo. Fora do painel
  externo o botão continua `position: fixed`, então sair do fluxo o deixa
  exatamente onde estava — a barra lateral não tem `transform`, `filter` nem
  `perspective`, logo não vira bloco de contenção. Quem decide quando ele aparece
  no fluxo da barra é o CSS, não este módulo; assim não é preciso observar
  mudanças de classe no `body`.
*/

export function moverColapsarParaSidebar(documento = document) {
  const botao = documento.getElementById("globalSidebarToggle");
  const barra = documento.querySelector(".sidebar");
  if (!botao || !barra) return false;
  if (botao.parentElement === barra) return false;

  botao.classList.add("side-collapse-toggle");
  const marca = barra.querySelector(".side-brand");
  if (marca) marca.after(botao);
  else barra.prepend(botao);
  return true;
}

export function initColapsarNoPainelExterno() {
  return moverColapsarParaSidebar();
}

---
tipo: regra
area: front
atualizado: 2026-11-10
---

# Ícones

**Todo o sistema desenha Lucide**; o Font Awesome não é mais carregado. Dois caminhos:

- **Barra lateral e o que é dela** (Sair, tema, botão de recolher e o ☰ do celular) e componente
  reescrito: SVG Lucide de verdade, pelo registro.
- **Resto do sistema:** o HTML e os módulos ainda escrevem `<i class="fa-solid fa-…">`, e
  `src/styles/icones-lucide.css` desenha em cada classe o ícone Lucide equivalente.

## Onde fica

- `src/modules/icones.ts` — **registro único** dos ícones Lucide, que importa cada ícone pelo nome
  (só os usados entram no bundle). Ícone novo: registre lá. Sem framework,
  `criarIcone(nome, { tamanho })`; em React, `<Icone nome="…" tamanho={…} />`
  (`src/componentes/icone.tsx`). Não misture dois conjuntos no mesmo componente.
- `src/lib/mapa-de-icones-lucide.ts` — o mapa Font Awesome → Lucide (`FA_PARA_LUCIDE`).
- `src/styles/icones-lucide.css` — **gerado** por `npm run icones`
  (`scripts/gerar-icones-lucide.mjs`): cada classe `fa-…` vira uma máscara no `::before` do `<i>`
  (`mask-image` com o SVG, `background-color: currentColor`), então segue a cor do texto.
  `img-src data:` já é permitido pela CSP (`vercel.json`). Ícone novo com classe `fa-…`: acrescente
  o par no mapa e rode `npm run icones`; `tests/icones-lucide.test.js` falha se faltar. Não edite o
  CSS à mão.

## Regras

- Tamanhos 16, 18 e 20px, traço 1,75, na cor do texto ao lado (`stroke: currentColor`).
- O ícone é decorativo (`aria-hidden`); quem nomeia o controle é o texto dele ou um `aria-label`.
  Botão só com ícone: `aria-label` + `title` e alvo de 40×40 ([[acessibilidade]]).
- Nenhum emoji no lugar de ícone (Design System, seção 14).
- Ao reescrever um componente, prefira o registro à classe `fa-…`.

## Relacionadas

- [[design-e-tokens]] — o resto do guia visual
- [[componentes-padrao]] — onde `Icone` é usado
- [[scripts-e-checagens]] — os geradores

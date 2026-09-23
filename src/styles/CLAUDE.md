# `src/styles/` — CSS do app principal

**Antes de qualquer edição: `DESIGN.md` seção 0** (regras de ouro). Tokens na seção 3, componentes na 4.

## Como a cascata funciona aqui

- `app.css` (110 KB, **não ler inteiro**) entra por `<link>` no `index.html` e carrega **antes** de todos
  os outros. Por isso perde empates e acumulou `!important`.
- Os demais são importados por `src/main.js`, **em ordem**. Em empate de especificidade, vence o último.
- `runtime-critical-fixes.css` é importado por `src/modules/connectivity-status.js`, não pelo `main.js`.
- `pwa-lifecycle.css` não é importado por ninguém (possível órfão).
- `health-reference-kpis.css` domina `#page-dashboard` com `#id … !important`. `colapsar-a-sidebar.css`
  usa `#appScreen` de propósito. Regra com só classe perde **em silêncio** para eles.

## Antes de escrever

```bash
grep -rn "nome-da-classe" src/styles src/analises | grep -E "important|#"   # quem manda no elemento
```

Depois, confira no navegador com `getComputedStyle(el).prop`, e não no arquivo.

## Onde colocar

- Estilo de um módulo → o CSS daquele módulo (`lista-aprovados.css`, `calendario-editais.css`, `nucleo-*.css`, `health-*.css`…).
- Arquivo novo só para módulo novo, com o mesmo nome do `src/modules/<modulo>.js`, importado no `main.js`.
- **Proibido** criar `*-fix.css`, `post-NNN-*.css`, `*-refinement.css`, `*-tuning.css`: corrija na origem.
- Cor, raio, sombra, espaço e z-index **só por token**. Nenhum `!important` ou `#id` novo.
- Tema escuro: `[data-theme="dark"]`. Não escreva regra nova com `body.dark-mode` (é um espelho).
- Anime só `opacity`/`transform`. Breakpoints: 420, 640, 900, 1220.

## Mapa rápido

`platform-shell.css` (shell institucional, sidebar, login) · `nielsen-shell-ux.css` (tema, foco,
feedback) · `mobile-*.css` · `health-*.css` (Saúde Indígena e mapa) · `nucleo-*.css` ·
`config-*.css` · `lista-aprovados.css` · `multi-select-busca.css` · `arara-guide.css`,
`nina-conversation.css` (guia) · `system-ui-fixes.css`, `post-152-regression-fixes.css`,
`post157-interface-tuning.css` (dívida, a dissolver — `DESIGN.md` seção 8, fase 5).

# `src/styles/` — CSS do app principal

**Antes de qualquer edição: `DESIGN.md` seção 0** (regras de ouro). Tokens na seção 3, componentes na 4.

## Como a cascata funciona aqui

- `app.css` (110 KB, **não ler inteiro**) entra por `<link>` no `index.html` e carrega **antes** de todos
  os outros. Por isso perde empates e acumulou `!important`.
- Os demais são importados por `src/main.js`, **em ordem**. Em empate de especificidade, vence o último.
- `barra-lateral.css` usa `#appScreen` de propósito (botão de recolher). Regra com só classe perde
  **em silêncio** para ele.

## Antes de escrever

```bash
grep -rn "nome-da-classe" src/styles src/modulos | grep -E "important|#"   # quem manda no elemento
```

Depois, confira no navegador com `getComputedStyle(el).prop`, e não no arquivo.

## Onde colocar

- Estilo de uma tela → o CSS do módulo dela, em `src/modulos/<nome>/<nome>.css` (ex.: `editais.css`,
  `cronograma.css`, `aprovados.css` + `convocacao.css`), importado no `main.js` depois do `ui.css`.
  Peça comum de várias telas → `src/ui/ui.css`. Legado que ainda mora aqui: `health-*.css`, `config-*.css`, `acessos.css`.
- **Proibido** criar `*-fix.css`, `post-NNN-*.css`, `*-refinement.css`, `*-tuning.css`: corrija na origem.
- Cor, raio, sombra, espaço e z-index **só por token**. Nenhum `!important` ou `#id` novo.
- Tema escuro: `[data-theme="dark"]`. Não escreva regra nova com `body.dark-mode` (é um espelho).
- Anime só `opacity`/`transform`. Breakpoints: 420, 640, 900, 1220.

## Mapa rápido

`tokens.css` (tokens do `DESIGN.md` §3, primeiro import dos dois `main.js`) · `platform-shell.css`
(shell institucional, contêiner da barra lateral e tokens `--menu-*`, login) · `barra-lateral.css`
(peças dos componentes React da barra: alça de recolher, menu em áreas, tema e Sair) ·
`nielsen-shell-ux.css` (dono do tema escuro da página, foco, feedback) · `mobile-*.css` · `health-*.css`
(Saúde Indígena e mapa) · `config-*.css` e `configuracoes.css` (moldura React de Configurações) ·
`multi-select-busca.css` · `carregamento.css` (skeleton da entrada, bloco `.esqueleto` e barra de
atualização) · `post157-interface-tuning.css` (dívida, a dissolver — `DESIGN.md` seção 8, fase 5).
A tela de acesso é da seção Login de `platform-shell.css`. Cores de etapa do calendário: tokens `--etapa-*`
em `tokens.css`. Os remendos `system-ui-fixes`, `post-152-regression-fixes` e `runtime-critical-fixes`
foram dissolvidos nas fontes (02/10/2026) — não recrie.

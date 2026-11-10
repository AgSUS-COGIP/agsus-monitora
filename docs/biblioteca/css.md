---
tipo: regra
area: front
atualizado: 2026-11-10
---

# CSS

Como a cascata do MONITORA funciona e onde escrever. **Antes de qualquer edição: `DESIGN.md` seção
0** ([[design-e-tokens]]); tokens na seção 3, componentes na 4, "Onde escrever CSS" na 7.

## Como a cascata funciona aqui

- `src/styles/app.css` (110 KB, **não ler inteiro**) entra por `<link>` no `index.html` e carrega
  **antes** de todos os outros. Por isso perde empates e acumulou `!important`.
- Os demais são importados por `src/main.ts`, **em ordem**. Em empate de especificidade, vence o
  último. Um `#id` vence qualquer número de classes.
- `barra-lateral.css` usa `#appScreen` de propósito (botão de recolher). Regra com só classe perde
  **em silêncio** para ele.

## Antes de escrever

```bash
grep -rn "nome-da-classe" src/styles src/modulos | grep -E "important|#"   # quem manda no elemento
```

Depois, confira no navegador com `getComputedStyle(el).prop`, e não no arquivo.

## Onde colocar

- Estilo de uma tela → o CSS do módulo dela, em `src/modulos/<nome>/<nome>.css` (ex.:
  `editais.css`, `cronograma.css`, `aprovados.css` + `convocacao.css`). Peça comum de várias telas
  → `src/ui/ui.css`. Legado que ainda mora em `src/styles/`: `health-*.css` e `saude-das-cargas.css`.
- **Proibido** criar `*-fix.css`, `post-NNN-*.css`, `*-refinement.css`, `*-tuning.css`: corrija na
  origem. Os remendos `system-ui-fixes`, `post-152-regression-fixes` e `runtime-critical-fixes`
  foram dissolvidos nas fontes (02/10/2026): não recrie.
- Cor, raio, sombra, espaço e z-index **só por token**. Nenhum `!important` ou `#id` novo.
- Tema escuro: `[data-theme="dark"]`. Não escreva regra nova com `body.dark-mode` (é um espelho).
- Anime só `opacity`/`transform`. Breakpoints: 420, 640, 900, 1220 ([[mobile]]).
- Não redefina `.btn` em CSS de módulo. A fase final é `@layer`, mas só depois que o legado for
  envolvido (CSS fora de camada vence qualquer camada): não comece por aí.

## Mapa de `src/styles/`

`tokens.css` (tokens do `DESIGN.md` §3, primeiro import) · `platform-shell.css` (shell
institucional, contêiner da barra lateral, tokens `--menu-*`, login; a tela de acesso é a seção
Login dele) · `barra-lateral.css` (peças da barra React: alça de recolher, menu em áreas, tema e
Sair) · `nielsen-shell-ux.css` (dono do tema escuro da página, foco, feedback) · `mobile-*.css` ·
`health-*.css` (Saúde Indígena e mapa) · `manutencao.css` (página "Em manutenção" e faixa do admin)
· `multi-select-busca.css` · `carregamento.css` (skeleton da entrada, bloco `.esqueleto` e barra de
atualização) · `icones-lucide.css` (gerado por `npm run icones`) · `post157-interface-tuning.css`
(dívida, a dissolver: `DESIGN.md` seção 8, fase 5). O CSS de Configurações, Acessos e Módulos está
em `src/modulos/configuracoes|acessos|modulos/`.

## Relacionadas

- [[design-e-tokens]] — regras de ouro e tokens
- [[componentes-padrao]] — o `ui.css`
- [[regras-do-codigo]] — a checagem de remendos

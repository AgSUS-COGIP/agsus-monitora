# `src/modulos/selecao/` — Seleção

A tela `#page-selecao` (view `selecao`), módulo do app desde a Etapa 2: monta na própria
`<section>` por `montarSelecao()` (`src/main.js` → `window.selecaoController`); o legado chama
`render()` ao navegar (`TELAS_REACT`). Área = a atual do app; sessão, tema, aviso e tela cheia =
os do app. Só leitura (`get_selecao_da_area`).

```
selecao.jsx     <TelaDeSelecao> e montarSelecao() (área atual, troca de área, controlador)
estado.js       store sem React: carga da área (cópia guardada), sessão, CSV
paineis.jsx     topo (status e ações), filtros de escolha múltipla, KPIs, recorte, gráficos,
                alertas da coluna Observação
tabela.jsx      base operacional consolidada (TabelaInfinita)
selecao.css     só o que é desta tela (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/selecao-do-painel.js` (carga: `selecao-da-planilha.js`,
`scripts/sincronizar-selecao.mjs`). Explicações das regras para a Aya:
`docs/aya/regras-da-selecao.md`. Testes: `tests/modulos/selecao.test.js` e
`tests/selecao-do-painel.test.js`.

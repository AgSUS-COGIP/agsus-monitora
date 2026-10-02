# `src/modulos/classificacao/` — Classificação

A tela `#page-classificacao` (view `classificacao`): monta na própria `<section>` por
`montarClassificacao()` (`src/main.js` → `window.classificacaoController`); o legado chama
`render()` ao navegar (`TELAS_REACT`). Área = a atual do app; o edital é escolhido no topo.

A regra de classificação é **de cada edital** (decidida pelo gestor do edital, versionada no
banco); nada é fixo no código. A conta é do motor puro `src/lib/classificacao/motor.js`.

```
classificacao.jsx  <TelaDeClassificacao>, montarClassificacao() e calcularClassificacao()
estado.js          store sem React: editais da área, dados do edital, salvar regra, gerar,
                   publicar, desempate (sorteio/decisão) e exportação (PDF, DOCX, XLSX)
listas.jsx         visão "Listas": KPIs, avisos e pendências, gerar/exportar, filtros, uma
                   tabela por vaga, eliminados, gaveta com a explicação, registro do empate
regra.jsx          visão "Regra": formulário (critérios ordenáveis do catálogo, empate final,
                   modalidades, convocação, rodapé) e versões
classificacao.css  só o que é desta tela (tokens)
```

Regras puras em `src/lib/classificacao/` (`motor.js`, `regra.js`, `catalogo.js`, `vagas.js`,
`numeros.js`, `sorteio.js`, `exportacao.js`, `dados.js`). Banco:
`supabase/migrations/20261002120000_classificacao.sql` (+ `20261002120500_liga_aba_classificacao.sql`),
seeds de exemplo em `supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql`.
Explicações para a Aya: `docs/aya/regras-da-classificacao.md`. Testes: `tests/lib/classificacao-*.test.js`,
`tests/modulos/classificacao.test.js`, `tests/classificacao-migration.test.js`.

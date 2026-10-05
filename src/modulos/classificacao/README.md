# `src/modulos/classificacao/` — Classificação

A tela `#page-classificacao` (view `classificacao`): monta na própria `<section>` por
`montarClassificacao()` (`src/main.js` → `window.classificacaoController`); o legado chama
`render()` ao navegar (`TELAS_REACT`). Área = a atual do app; o edital é escolhido no topo.

A regra de classificação é **de cada edital** (decidida pelo gestor do edital, versionada no
banco); nada é fixo no código. A conta é do motor puro `src/lib/classificacao/motor.js`.

Listas (`TIPOS_DE_LISTA`), no padrão das publicações da AgSUS: `PRELIMINAR` (avaliação documental e
de títulos, com as parciais e os eliminados — vale como preliminar ou final da etapa; a exportação
escolhe o título), `CONVOCACAO`, `ENTREVISTA` (resultado da etapa de entrevista; empate na mesma
posição) e `FINAL` (vagas imediatas e cadastro reserva).

Vagas por modalidade: quadro do edital > configuração de convocação do edital (Lista de aprovados ›
Convocação, `TB_CONVOCACAO_EDITAL`) > percentuais da regra — as duas últimas pela mesma
`derivarQuadro` da convocação (`src/lib/classificacao/convocacao-do-edital.js`). A regra de
classificação decide listas, remanejamento e acúmulo; a ordem de chamada é da Convocação.

```
classificacao.jsx  <TelaDeClassificacao>, montarClassificacao() e calcularClassificacao()
estado.js          store sem React: editais da área, dados do edital, salvar regra, gerar,
                   publicar, desempate (sorteio/decisão), documento oficial (Copiar para o
                   SEI, DOCX timbrado, PDF) e XLSX; salvar os textos do documento
listas.jsx         visão "Listas": KPIs, avisos e pendências, gerar/exportar, filtros, uma
                   tabela por vaga, eliminados, gaveta com a explicação, registro do empate
regra.jsx          visão "Regra": formulário (critérios ordenáveis do catálogo, empate final,
                   modalidades, convocação, rodapé) e versões
documento.jsx      "Como fica no SEI": prévia (iframe sem script) e textos do edital
documento-no-navegador.js  área de transferência (HTML + texto), logo em PNG, impressão
classificacao.css  só o que é desta tela (tokens)
```

Regras puras em `src/lib/classificacao/` (`motor.js`, `regra.js`, `catalogo.js`, `vagas.js`,
`numeros.js`, `sorteio.js`, `exportacao.js`, `documento-sei.js` — o documento no modelo das
publicações do SEI, textos-padrão do 83/2026 e do 100/2026 —, `documento-docx.js` — Word com papel
timbrado —, `dados.js`). Os textos do documento ajustados pelo gestor ficam na regra
(`DS_CONFIGURACAO.documento`, sem migration); o cabeçalho da agência, em Configurações › Marca
(`documento_cabecalho`, `src/lib/cabecalho-dos-documentos.js`). Banco:
`supabase/migrations/20261002150000_classificacao.sql` (+ `20261002150500_liga_aba_classificacao.sql`),
`20261002170000_classificacao_lista_da_entrevista.sql` (lista ENTREVISTA e critérios novos do
catálogo). Regras dos editais: `supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql` e
`supabase/correcoes/20261002-regras-de-classificacao-todos-os-editais.sql` (131 editais lidos dos PDFs
oficiais, 13 modelos; aplicar depois da migration 20261002170000, rodando antes o ensaio
`supabase/ensaios/20261002-regras-de-classificacao-todos-os-editais.sql`).
Explicações para a Aya: `docs/aya/regras-da-classificacao.md`. Testes: `tests/lib/classificacao-*.test.js`,
`tests/modulos/classificacao.test.js`, `tests/classificacao-migration.test.js`,
`tests/classificacao-lista-entrevista-migration.test.js` e `tests/classificacao-regras-dos-editais.test.js`
(seed e um edital por modelo).

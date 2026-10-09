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
publicar-aprovados.jsx  "Publicar como lista de aprovados" (resultado final, editor): o que
                   muda em relação à lista de aprovados vigente (entram, saem, mudam de
                   posição, preservados, sub judice mantidos) e revisão de quem não casou
agenda.jsx         visão "Agenda": regra da agenda das entrevistas (versões), gerar pela
                   regra, avisos (não cabe, sobra), ajuste manual com conflito, XLSX;
                   o botão "Agenda das entrevistas" da convocação abre esta visão
estado-da-agenda.js  store da agenda (obter_agenda_entrevista, salvar_regra_agenda_entrevista,
                   salvar_agenda_entrevista); a agenda salva preenche DATA e HORA do
                   documento da convocação (agendaDoDocumento)
regra.jsx          visão "Regra": formulário (critérios ordenáveis do catálogo, empate final,
                   modalidades, convocação, rodapé) e versões
documento.tsx      "Como fica no SEI": quase tela cheia (ou tela cheia), folha A4 com zoom
                   (escala em src/lib/classificacao/escala-da-previa.ts), painel recolhível
                   com as abas Dados | Textos e rodapé fixo; no celular, uma coluna
hora-de-nascimento.tsx  hora da certidão na gaveta do candidato, só quando o empate chega
                   à maior idade no mesmo dia (sem certidão = 23:59:59)
documento-no-navegador.js  área de transferência (HTML + texto), logo em PNG, impressão
classificacao.css  só o que é desta tela (tokens)
```

Regras puras em `src/lib/classificacao/` (`motor.js`, `regra.js`, `catalogo.js`, `vagas.js`,
`numeros.js`, `sorteio.js`, `exportacao.js`, `ajustes.js` — o motor com os ajustes da pontuação
aprovados em recurso e a prévia do recurso —, `documento-sei.js` — o documento no modelo das
publicações do SEI, textos-padrão do 83/2026 e do 100/2026 —, `documento-docx.js` — Word com papel
timbrado —, `dados.js`). Os textos do documento ajustados pelo gestor ficam na regra
(`DS_CONFIGURACAO.documento`, sem migration); o cabeçalho da agência, em Configurações › Marca
(`documento_cabecalho`, `src/lib/cabecalho-dos-documentos.js`). Banco:
`supabase/migrations/20261002150000_classificacao.sql` (+ `20261002150500_liga_aba_classificacao.sql`),
`20261002170000_classificacao_lista_da_entrevista.sql` (lista ENTREVISTA e critérios novos do
catálogo), `20261009130000_hora_de_nascimento_na_classificacao.sql` (hora da certidão para a maior
idade: `TB_HORA_NASCIMENTO_CANDIDATO`, `salvar_hora_nascimento_candidato`; ensaio e rollback com o
mesmo nome). Auditoria do 93/2026 (desempate do 10.1 na preliminar, quadro do 4.1):
`supabase/correcoes/20261009-classificacao-93-desempate-e-quadro.sql` e
`tests/classificacao-93-desempate.test.js`. Regras dos editais: `supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql` e
`supabase/correcoes/20261002-regras-de-classificacao-todos-os-editais.sql` (131 editais lidos dos PDFs
oficiais, 13 modelos; aplicar depois da migration 20261002170000, rodando antes o ensaio
`supabase/ensaios/20261002-regras-de-classificacao-todos-os-editais.sql`).
Lista de aprovados: o resultado FINAL é a fonte da Lista de aprovados. "Publicar como lista de
aprovados" cria a lista vigente do edital (`TB_LISTA_APROVADO` com `TP_ORIGEM` = `CLASSIFICACAO`),
levando status, matrícula, sub judice e anexos de quem já estava na lista (o casamento das pessoas,
o resumo e os candidatos do retrato em `src/lib/publicacao-de-aprovados.js`; o banco confere os
vínculos e grava `TH_PUBLICACAO_APROVADO`). Banco:
`supabase/migrations/20261005160000_lista_de_aprovados_da_classificacao.sql` (ensaio e rollback com
o mesmo nome); a Lista de aprovados mostra a origem e, no modal do edital, oferece publicar daqui.
Testes: `tests/lib/publicacao-de-aprovados.test.js`,
`tests/lista-de-aprovados-da-classificacao-migration.test.js`.
Agenda das entrevistas: motor em `src/lib/agenda-das-entrevistas.js`, banco em
`supabase/migrations/20261005120000_agenda_das_entrevistas.sql` (ensaio e rollback com o mesmo
nome); Conduzir entrevistas abre a fila em Hoje pela agenda salva (`src/modulos/entrevistas/fila-do-dia.tsx`).
A lista `CONVOCACAO` gerada aqui é a única convocação para a entrevista: Conduzir entrevistas › Preparar mostra
a última gerada e registra para a ficha só quem está nela
(`supabase/migrations/20261005150000_convocacao_unica_da_entrevista.sql`); o retrato guarda, por
vaga, as vagas, a origem delas e o limite da convocação (`instantaneoDaLista`).
Explicações para a Aya: `docs/aya/regras-da-classificacao.md`, `docs/aya/regras-da-lista-de-aprovados.md` e `docs/aya/regras-das-entrevistas.md`. Testes: `tests/lib/classificacao-*.test.js`,
`tests/modulos/classificacao.test.js`, `tests/modulos/agenda-das-entrevistas.test.js`,
`tests/lib/agenda-das-entrevistas.test.js`, `tests/agenda-das-entrevistas-migration.test.js`,
`tests/classificacao-migration.test.js`,
`tests/classificacao-lista-entrevista-migration.test.js` e `tests/classificacao-regras-dos-editais.test.js`
(seed e um edital por modelo).

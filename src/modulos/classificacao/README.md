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
classificacao.tsx  <TelaDeClassificacao>, montarClassificacao() e calcularClassificacao()
estado.ts          store sem React: editais da área, dados do edital, salvar regra, gerar,
                   publicar, desempate (sorteio/decisão), documento oficial (Copiar para o
                   SEI, DOCX timbrado, PDF) e XLSX; salvar os textos do documento
listas.tsx         visão "Listas" em TypeScript: KPIs, avisos e pendências, gerar/exportar, filtros, uma
                   tabela por vaga, eliminados, gaveta com a explicação, registro do empate
publicar-aprovados.tsx  "Publicar como lista de aprovados" (resultado final, editor): o que
                   muda em relação à lista de aprovados vigente (entram, saem, mudam de
                   posição, preservados, sub judice mantidos) e revisão de quem não casou
agenda.jsx         visão "Agenda": regra da agenda das entrevistas (versões), gerar pela
                   regra, avisos (não cabe, sobra), ajuste manual com conflito, XLSX;
                   o botão "Agenda das entrevistas" da convocação abre esta visão
estado-da-agenda.js  store da agenda (obter_agenda_entrevista, salvar_regra_agenda_entrevista,
                   salvar_agenda_entrevista); a agenda salva preenche DATA e HORA do
                   documento da convocação (agendaDoDocumento)
regra.tsx          visão "Regra" em TypeScript: formulário (critérios ordenáveis do catálogo, empate final,
                   modalidades, convocação, rodapé) e versões; o rascunho é guardado a cada
                   mudança (src/app/rascunho-da-regra.ts, tipo CLASSIFICACAO) e volta ao abrir
documento.tsx      "Como fica no SEI": quase tela cheia (ou tela cheia), folha A4 com zoom
                   (escala em src/lib/classificacao/escala-da-previa.ts), painel recolhível
                   com as abas Dados | Textos | Colunas e rodapé fixo; no celular, uma coluna
colunas-do-documento.tsx  aba Colunas: marcar e ordenar (setas ou arrastar) as colunas
                   das tabelas, por publicação (regras em src/lib/classificacao/colunas-do-documento.js)
hora-de-nascimento.tsx  hora da certidão na gaveta do candidato, só quando o empate chega
                   à maior idade no mesmo dia (sem certidão = 23:59:59)
documento-no-navegador.js  área de transferência (HTML + texto), logo em PNG, impressão
classificacao.css  só o que é desta tela (tokens)
```

Regras puras em `src/lib/classificacao/` (`motor.js`, `regra.ts`, `catalogo.js`, `vagas.js`,
`numeros.js`, `sorteio.js`, `exportacao.js`, `ajustes.ts` — o motor com os ajustes da pontuação
aprovados em recurso e a prévia do recurso —, `documento-sei.js` — o documento no modelo das
publicações do SEI, textos-padrão do 83/2026 e do 100/2026 —, `documento-docx.js` — Word com papel
timbrado —, `dados.ts`). Os textos e as colunas do documento ajustados pelo gestor ficam na regra
(`DS_CONFIGURACAO.documento`, `.colunas` por publicação, `.desempate` = a nota abaixo da tabela da
vaga com empate de nota resolvido; sem migration); o cabeçalho da agência, em Configurações › Marca
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
o resumo e os candidatos do retrato em `src/lib/publicacao-de-aprovados.ts`; o banco confere os
vínculos e grava `TH_PUBLICACAO_APROVADO`). Banco:
`supabase/migrations/20261005160000_lista_de_aprovados_da_classificacao.sql` (ensaio e rollback com
o mesmo nome); a Lista de aprovados mostra a origem e, no modal do edital, oferece publicar daqui.
Testes: `tests/lib/publicacao-de-aprovados.test.js`,
`tests/lista-de-aprovados-da-classificacao-migration.test.js`.
O modal e essas regras estão em TypeScript/TSX; contratos em
`src/lib/tipos-da-publicacao-de-aprovados.ts` e validação das respostas em
`src/lib/dados-da-publicacao-de-aprovados.ts`. A prévia exige os candidatos da lista vigente
com identidades únicas e coleções válidas, sem descartar pessoas para montar uma revisão
parcial. A confirmação valida quantidade e pendências retornadas pelo banco. Testes:
`tests/lib/dados-da-publicacao-de-aprovados.test.js`,
`tests/tipos/publicacao-da-classificacao.tsx` e o fluxo em `tests/modulos/classificacao.test.js`.
Listas e filtros: saída pública do motor em `src/lib/classificacao/tipos-do-resultado.ts`,
contratos de uso em `tests/tipos/listas-da-classificacao.tsx`. O motor usa esse contrato
via JSDoc e mantém o cálculo em JavaScript. O estado valida a quantidade de pendências
e a situação de publicação dos registros; uma ordem incompleta ou duplicada não é
apresentada como sorteio registrado. Testes em
`tests/lib/classificacao-metadados-das-listas.test.js`.
Regra: `src/lib/classificacao/regra.ts` normaliza e valida a configuração, incluindo textos
e colunas dos documentos; `src/lib/classificacao/edicao-da-regra.ts` converte as entradas e
altera campos, grupos e listas sem modificar a regra vigente. O rascunho admite texto nos
campos numéricos durante a edição; a normalização produz números. Cada edital recebe
listas independentes na modalidade padrão. O histórico valida a versão e a configuração,
preservando autoria, motivo e renomeações; só versões com configuração podem voltar ao
formulário. Testes em `tests/lib/classificacao-edicao-da-regra.test.js` e contratos em
`tests/tipos/regra-da-classificacao.tsx`.
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

## TypeScript na entrada e no estado

A tela principal e o estado estão em TypeScript/TSX. Os contratos de snapshot, editais,
versões da regra, registros das listas, RPCs e callbacks ficam em `tipos-do-estado.ts`.
`src/lib/classificacao/dados-do-estado.ts` valida os campos do seletor e os metadados
usados pelo estado, preservando os campos adicionais para as peças ainda em JSX.
Permissão de edição exige booleano; coleções malformadas são recusadas para não calcular
uma lista com candidatos descartados. Configuração da regra, cálculos e documentos
continuam nas bibliotecas existentes, com contratos JSDoc nas chamadas de documento.

Troca de edital, área ou usuário invalida os efeitos locais das gravações e leituras de
listas. Sair e voltar ao mesmo ID não aceita uma resposta anterior: ela não altera dados,
mostra avisos antigos nem libera os botões de outra gravação. A troca libera os controles
do contexto novo. Uma carga de logo antiga não inicia download; uma cópia já iniciada não
é cancelada, mas seu resultado antigo não mostra aviso. Chamadas ao banco já enviadas
não são canceladas. As RPCs, a versão conferida pelo banco e os cálculos não mudaram.

Listas, regra, publicação de aprovados, agenda e seu estado ainda estão em JavaScript/JSX.
Verificação: `tests/tipos/tela-estado-da-classificacao.tsx`,
`tests/lib/classificacao-dados-do-estado.test.js`,
`tests/modulos/classificacao-contexto-de-gravacao.test.js` e testes existentes da tela,
agenda, exportação e hora de nascimento.

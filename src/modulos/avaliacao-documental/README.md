# `src/modulos/avaliacao-documental/` — Avaliação documental

A tela de trabalho da etapa "Avaliação Documental e de Títulos" (view `avaliacao-documental`,
recurso `avaliacao_documental`). O Painel das análises (`src/modulos/analises/`, view `analises`)
continua sendo a leitura. Desenho e fases: `docs/analises-no-monitora/`; histórias AM-n em
`docs/historias-de-usuario/analises-no-monitora.md`.

## Fase F1 (esta)

- escolha do edital da área atual;
- **Regra**: criar a partir de um modelo, editar os blocos (eliminatórios com item do edital,
  critério étnico com aldeias, títulos por nível, cursos por faixa, vínculos), a eliminação
  automática e a nota declarada da Provisória, o lote e a reposição, a distribuição e a revisão,
  os modelos de parecer e as observações prontas; ligar as perguntas da última carga da Empregare
  aos blocos; salvar em versões com motivo; marcar como conferida; ver as versões;
- **Testar com um candidato fictício**: a conta pura sobre o rascunho, sem gravar;
- **Equipe**: analistas, revisores e coordenação (o gestor do edital já coordena).

## Fase F2

- **Pré-classificação**: a Lista Geral de Classificação Provisória por ART e o lote de convocação
  de cada vaga, como o job Python gravou (`scripts/pre_classificacao/`); contadores (inscritos,
  eliminados, ranqueados, lote "N de M", divergência ART × declarada), a linha de corte, os
  eliminados com o motivo e os avisos da vaga;
- "Recalcular" (coordenação): `POST /api/rodar-carga` com o edital, travado com a regra não
  conferida ou o job rodando; o resultado do pedido fica na aba (o motivo da recusa, com o botão
  de volta, ou "pedido") e a aba relê sozinha até a execução terminar;
- tamanho do lote por vaga: o campo vira `lote.por_vaga` numa versão nova da regra (com motivo);
- listas oficiais PROVISORIA e LOTE (cada reposição, se a regra publica): registradas no banco
  (`registrar_lista_pre_classificacao`) e exportadas pelo gerador da Classificação.

## Fase F3

- **Fila**: abas de etapa com contadores (Inscritos, No lote, Pendentes, Em análise, Em revisão,
  Concluídas, Eliminados), clicáveis como filtro; filtros (vaga, responsável, modalidade, código ou
  nome — Enter com o código abre a ficha) e **filtros salvos** por pessoa
  (`TB_FILTRO_FILA_ANALISE`; o último filtro também fica no navegador, só por conveniência);
- **Pegar próximo** e **Minhas fichas** para o analista;
- **ações em lote** da coordenação, com prévia, confirmação e motivo: distribuir (entre a equipe,
  para uma pessoa ou de volta à fila), liberar reservas, mandar para revisão; "Distribuir as
  livres" e "Abrir fichas do lote";
- a **ficha aberta** no modo de análise (ocupa a área de conteúdo; a lista some): topo fixo com
  "Voltar à fila", candidato pelo código e nome, vaga, posição, nota declarada (ART), situação,
  responsável, reserva e Anterior / Próxima pela lista filtrada; Esc volta; a ficha aberta fica na
  sessão da aba (recarregar volta a ela) e a **reserva** de 15 minutos, renovada a cada 5 minutos e
  liberada ao fechar; "Em uso por … desde HH:MM" só para leitura; a coordenação libera reserva
  presa com motivo. O conteúdo da análise é da F4;
- o seletor de editais mostra só os vigentes (`src/lib/avaliacao-documental/editais.js`), com
  "Mostrar todos os editais da área";
- na aba Regra: o lote "Todos com a nota mínima" (item 8.2.6 do 93/2026) e os desempates da
  Provisória (60 anos ou mais, experiência declarada com a pergunta, maior idade, candidatura).

A convocação para a Análise Comportamental (93/2026, item 8.2.10.11: até 5× as vagas imediatas e
até a 10ª posição do cadastro reserva) é regra da lista CONVOCACAO da Classificação, não do lote.

## Fase F4

- **Conteúdo da ficha** (`ficha/`), no modo de análise da Fila, calmo e guiado: cabeçalho enxuto
  (nome e código, a vaga com o nível, chips da nota declarada, posição e modalidade; situação,
  responsável, reserva e regra no "i"; aviso só com menos de 5 minutos de reserva) e o stepper
  (um passo por item que se aplica + Conclusão, com a marca do estado e a barra de progresso);
- **modo foco** (padrão): um item por vez — o que se pede (enunciado curto, "ver texto completo"),
  a resposta da Empregare em destaque com "Abrir na Empregare" (o anexo diz onde achar o arquivo:
  "Na Empregare: aba Questionários › Pergunta N — …"; o link sai de
  `src/lib/avaliacao-documental/anexo-na-empregare.ts`, para trocar pelo link direto do arquivo), as
  três decisões em botões grandes (teclas 1, 2, 3 no title; J/K; Ctrl+S; Ctrl+Enter), os motivos em
  chips; nos itens que pontuam, a lista compacta de títulos, cursos e vínculos e "Declarado →
  Apurado" (−/+ de meio ponto, até o teto) antes da decisão. Conforme sem pendência avança sozinho
  ao próximo que pede algo (`proximoPassoPendente`); "Ver todos" troca para a lista compacta (a
  escolha fica no navegador). Nota diferente da declarada pede justificativa;
- lateral só com a nota (parcial enquanto falta conferir; "Em análise · X de N requisitos
  conferidos"; Inapto só quando um item conferido elimina), o mínimo e a composição por bloco em
  barras finas (`composicaoDaNota`); ações secundárias no "⋯" (copiar código, abrir na Empregare,
  compartilhar no chat e, para a coordenação, o nível da vaga);
- **Conclusão**: resumo de todos os itens (clicáveis), nota final com a composição, observações
  prontas e observação, prévia do parecer (sem resultado enquanto falta conferir) e histórico;
- rodapé mínimo: "Salvo às HH:MM" (rascunho automático), Anterior / Próximo item e o botão do
  momento ("Próximo pendente", "Revisar e concluir"; na Conclusão, "Concluir e próxima", travado até
  não faltar nada, e "Salvar rascunho"); "← Voltar à fila" salva antes de soltar a reserva;
- concluída: abre na Conclusão, só leitura, com o parecer gravado e o histórico; a coordenação
  reabre com motivo;
- na Fila, as concluídas mostram nota e resultado; o analista vê só as vagas que analisa;
- as listas da Fila são a TabelaInfinita (`src/ui/`): colunas por etapa, ordem por coluna, busca,
  "N de M", carregamento contínuo e Exportar CSV (`csvDaFila`, csv-security).

## Inclusão no lote por decisão da coordenação

- na aba Pré-classificação (cada vaga) e na Fila, a coordenação inclui no lote, por decisão e com
  motivo (sugestão "Critério CORES"), candidatos que a regra deixa fora (eliminados ou abaixo do
  corte); selo "Decisão: …" nas listas e no topo da ficha; "Revogar decisão" com motivo (o banco
  recusa com a ficha concluída); contadores "N pela regra + M por decisão"; nos documentos oficiais,
  o nome com "*" e a nota "Incluído por decisão da coordenação: …";
- os recálculos mantêm a decisão (job Python e prévia JS, casos dourados); banco em
  `supabase/migrations/20261007200000_inclusao_no_lote_por_decisao.sql` (`TB_DECISAO_LOTE`,
  `TH_DECISAO_LOTE`).

A próxima fase traz a revisão (F5).

## Arquivos

```
avaliacao-documental.jsx  tela e montarAvaliacaoDocumental() (na #page-avaliacao-documental)
estado.js                 store sem React: editais, regra, equipe e as gravações (RPCs)
regra.jsx                 aba Regra: formulário, perguntas da carga, versões, aldeias
blocos.jsx                os blocos da ficha na regra
previa.jsx                "Testar com um candidato fictício"
equipe.jsx                aba Equipe
pre-classificacao.jsx     aba Pré-classificação (contadores, vagas, listas oficiais)
fila.jsx                  aba Fila (etapas, filtros, ações em lote, ficha aberta)
estado-da-fila.js         store da aba: obter_fila_avaliacao, Pegar próximo, reserva
                          (renovação e liberação), distribuição, revisão, filtros salvos
ficha/ficha.jsx           conteúdo da ficha aberta: modo foco / lista, passos, teclas, rodapé
ficha/*.tsx               cabeçalho, stepper, item, Conclusão, nota, "⋯", rodapé e links da
                          Empregare (contratos em ficha/tipos.ts)
ficha/estado-da-ficha.js  store da ficha: obter_ficha_analise, rascunho automático,
                          concluir_ficha, reabrir_ficha, registrar_acesso_ficha
ficha/ficha.css           estilos da ficha (só tokens)
estado-da-pre-classificacao.js  store da aba: obter_pre_classificacao, Recalcular,
                          registrar/publicar as listas, Copiar para o SEI e DOCX
decisao-do-lote.jsx       selo "Decisão: …", "Incluir por decisão da coordenação" e
                          "Revogar decisão" (Pré-classificação e Fila)
decisao-no-banco.js       incluir_no_lote_por_decisao / revogar_decisao_lote (uma chamada por vaga)
campos.jsx                peças de formulário da regra
avaliacao-documental.css  só tokens
```

## Regras

- A regra é **dado** do edital. Nenhum peso no código: o formato, os valores padrão e a validação
  ficam em `src/lib/avaliacao-documental/regra.js`, e o banco repete a validação em
  `private."FC_VALIDAR_REGRA_ANALISE"` (`supabase/migrations/20261006100000_regra_da_analise.sql`).
- A conta da pré-classificação é do job Python (`python/monitora/avaliacao_documental/`); a
  cópia em `src/lib/avaliacao-documental/pre-classificacao.js` só faz a prévia (tamanho sugerido do
  lote) e é conferida com o Python pelos casos de
  `tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json`. A aba não recalcula
  ninguém: lê o que o job gravou (`src/lib/avaliacao-documental/tela-da-pre-classificacao.js`).
- A conta da prévia é `src/lib/avaliacao-documental/pontuacao.js`. É só para a tela: a conta
  oficial, em lote (Provisória, lote, nota declarada de todos os inscritos), é da base Python
  (`python/monitora/`), que grava o resultado pronto e reproduz os casos dourados de
  `tests/fixtures/avaliacao-documental/casos-de-pontuacao.json`. Nada de conta pesada em SQL.
- Quem coordena cada edital, o banco decide (`FC_PAPEL_AVALIACAO`); a tela só esconde os
  controles de quem não pode (`pode_coordenar`).
- Explicações vão para `docs/aya/regras-da-avaliacao-documental.md`, não para a tela.
- A distribuição das fichas é a mesma conta em `src/lib/avaliacao-documental/distribuicao.js` (a
  prévia) e em `python/monitora/avaliacao_documental/distribuicao.py` (o job, para as fichas que
  entram depois), conferida por `tests/fixtures/avaliacao-documental/casos-de-distribuicao.json`.
  O banco valida e grava (`supabase/migrations/20261006120000_fichas_fila_e_reserva.sql`).
- A ficha: a tela calcula com `pontuacao.js` (e `src/lib/avaliacao-documental/ficha.js`:
  declarado, pendências, resumo); o banco revalida e grava
  (`supabase/migrations/20261007130000_conteudo_da_ficha.sql`); o Python
  (`python/monitora/avaliacao_documental/pontuacao.py`) reconfere em lote pelos casos dourados.
- A ficha não concluída segue a versão da regra do último recálculo (`FC_ABRIR_FICHAS`, a cada
  execução do job); a concluída mantém a versão com que foi analisada
  (`supabase/migrations/20261007110000_ficha_segue_versao_da_pre_classificacao.sql`).
- Testes: `tests/modulos/avaliacao-documental.test.js`, `tests/modulos/avaliacao-documental-fila.test.js`,
  `tests/modulos/avaliacao-documental-ficha.test.js`, `tests/lib/avaliacao-documental-ficha.test.js`,
  `tests/conteudo-da-ficha-migration.test.js`, `tests/python/test_pontuacao.py`,
  `tests/fichas-fila-reserva-migration.test.js`, `tests/ficha-segue-versao-migration.test.js`,
  `tests/python/test_distribuicao.py`, `tests/lib/avaliacao-documental-decisao-do-lote.test.js`,
  `tests/inclusao-no-lote-por-decisao-migration.test.js`,
  `tests/modulos/avaliacao-documental-pre-classificacao.test.js`,
  `tests/lib/avaliacao-documental-*.test.js`, `tests/avaliacao-documental-migration.test.js`,
  `tests/pre-classificacao-migration.test.js`, `tests/python/test_pre_classificacao.py` e
  `tests/python/test_pre_classificacao_job.py`.

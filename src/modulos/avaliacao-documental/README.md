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
- "Recalcular" (coordenação): RPC `disparar_robo` com o edital (o banco pede ao GitHub), travado com a regra não
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

- **Conteúdo da ficha** (`ficha/`), no modo de análise da Fila: um cartão por bloco da regra, na
  ordem da regra (os que não se aplicam numa linha expansível no fim), com a cor e o selo da
  situação depois de conferido, com o que o candidato declarou na Empregare (as respostas das perguntas ligadas,
  lidas como a nota declarada lê: aspas, múltipla escolha, "--", &nbsp;); Conforme / Não conforme
  / Não enviado (teclas 1, 2, 3; J/K; Ctrl+S; Ctrl+Enter), motivo em lista; títulos, cursos e
  vínculos que pontuam na hora; nota apurada ajustável até o teto, com justificativa obrigatória
  quando difere da declarada;
- lateral: resultado e nota ao vivo ("Em análise · X de N requisitos conferidos" enquanto falta
  conferir; Inapto só quando um bloco conferido elimina), declarado × apurado (apurado "—" e sem
  destaque antes de conferir; depois, a diferença destacada, com a justificativa),
  nível da vaga, "Copiar código", "Abrir candidato na Empregare" (o link capturado pelo robô; sem ele, a vaga ou a lista de vagas com o código copiado para a busca; o acesso fica registrado), observações
  prontas, observação livre e o parecer gerado;
- barra: "Salvo às HH:MM" (rascunho automático), "N de M itens conferidos" e "Falta: …",
  "Salvar rascunho", "Concluir e próxima" (travado até não faltar nada), "Fechar e
  liberar" (salva antes de soltar a reserva; aviso ao sair com alteração não salva);
- concluída: só leitura, com o parecer gravado e o histórico; a coordenação reabre com motivo;
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
ficha/ficha.jsx           conteúdo da ficha aberta (blocos, lateral, barra, histórico)
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

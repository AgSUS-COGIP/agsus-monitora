# `src/modulos/avaliacao-documental/` — Avaliação documental

A tela de trabalho da etapa "Avaliação Documental e de Títulos" (view `avaliacao-documental`,
recurso `avaliacao_documental`). O Painel das análises (`src/modulos/analises/`, view `analises`)
continua sendo a leitura. Desenho e fases: `docs/analises-no-monitora/`; histórias AM-n em
`docs/historias-de-usuario/analises-no-monitora.md`.

## Abas por papel e entrada

Regra, Equipe e Pré-classificação são só de quem coordena o edital (`pode_coordenar`, ou o
`papel` = `COORDENADOR` da lista de editais antes de o edital carregar); os demais veem só a Fila,
sem o seletor de abas, e a equipe nem é lida (`abas-e-entrada.ts`). Sem edital escolhido não há
abas: a tela abre sozinha a ficha que estava aberta, o último edital aberto (localStorage, por
pessoa e área) ou o único vigente; senão, mostra os cartões dos editais vigentes
(`entrada-da-avaliacao.tsx`).

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
  de volta, ou "pedido") e a aba acompanha a execução pela RPC leve
  `obter_situacao_pre_classificacao` (~0,4 KB a cada 15 s) e relê o resultado só quando ela termina;
- o cargo, a lotação e o nível de cada vaga vêm da linha do quadro de vagas
  (`private."FC_QUADRO_DA_VAGA_EMPREGARE"`): pelo nome da vaga na planilha e, quando a análise é
  do MONITORA (114/2026), pelo título da vaga na Empregare — o número do CARGO e, com o mesmo cargo
  em mais de uma lotação, a UF dos inscritos de cada vaga irmã (migration
  `20261013140000_quadro_da_vaga_pelo_titulo.sql`); o nível sai do "(Nível …)" do cargo;
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
  (um passo por item que se aplica + Conclusão, com a marca do estado e a barra de progresso).
  No notebook o bloco preso ao alto encolhe pela altura da tela (`data-tamanho`): "enxuto" até
  860 px de altura CSS (nome, código, vaga cortada com dica e chips numa linha; stepper e progresso
  numa faixa; rodapé mais fino) e "compacto" ao rolar ou até 680 px (125% de zoom: só as marcas e
  o nome do passo atual; os outros na dica); volta ao normal quando a rolagem volta ao alto;
- **modo foco** (padrão): um item por vez — o que se pede (enunciado curto, "ver texto completo"),
  a resposta da Empregare em destaque: os arquivos capturados da pergunta, cada um com o seu link
  (também quando a exportação traz "--"); com a resposta vigente lida e sem arquivo na pergunta,
  "Sem arquivo enviado" e "Conferir na Empregare" (a exportação escreve "Anexo" em toda pergunta de
  anexo); arquivo só num envio anterior, "Ver documento do envio anterior"; sem resposta capturada,
  "Abrir na Empregare" e onde achar o arquivo ("Na Empregare: aba Questionários › Pergunta N — …").
  Tudo sai de `src/lib/avaliacao-documental/anexo-na-empregare.ts`; a
  pergunta "O documento confere com o declarado?" com as escolhas lado a lado — Confere (pontuação
  = declarado), Não confere (só o motivo, pontuação 0; "não enviou" vira NAO_ENVIADO) e, nos itens
  que pontuam, Editar nota (pontuação pelos itens, −/+ e "Usar o calculado") — teclas 1, 2, 3; J/K;
  Ctrl+S; Ctrl+Enter. No Confere e no Editar, a lista de títulos, cursos e vínculos com a primeira
  linha aberta; um só resumo "Pontuação: X de 5 · declarou 5"; no máximo uma mensagem por item
  (`mensagemDoBloco`). O mapeamento para as situações do banco está em `apurado-da-ficha.ts`.
  Confere sem pendência avança sozinho ao próximo que pede algo (`proximoPassoPendente`); "Ver
  todos" troca para a lista compacta (a escolha fica no navegador). Pontuação diferente da
  declarada pede justificativa; o stepper conta "X de 6 conferidos" pela mesma regra do "!"
  (`itemConferido`);
- lateral só com a nota (parcial enquanto falta conferir; "Em análise · X de N requisitos
  conferidos"; Inapto só quando um item conferido elimina), o mínimo e a composição por bloco em
  barras finas (`composicaoDaNota`); ações secundárias no "⋯" (copiar código, abrir na Empregare
  e, para a coordenação, o nível da vaga);
- **Conclusão**: resumo de todos os itens (clicáveis), nota final com a composição, observações
  prontas e observação, prévia do parecer (sem resultado enquanto falta conferir) e histórico;
- rodapé mínimo: "Salvo às HH:MM" (rascunho automático), Anterior / Próximo item e o botão do
  momento ("Próximo pendente", "Revisar e concluir"; na Conclusão, "Concluir e próxima", travado até
  não faltar nada, e "Salvar rascunho"); "← Voltar à fila" salva antes de soltar a reserva;
- concluída: abre na Conclusão, só leitura, com o parecer gravado e o histórico; a coordenação
  reabre com motivo; "Espelho de nota" abre a impressão do espelho para o candidato (eliminado sem
  pontos; apto/inapto por nota com a pontuação por critério) e "Baixar PDF" baixa o mesmo espelho em
  PDF (gerado no navegador), sem gravar nada;
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

## Assistente da regra

A aba Regra abre no **assistente** (`assistente/`, em TSX, contratos em `assistente/tipos.ts` e
`src/lib/avaliacao-documental/tipos-da-regra.ts`); o **Modo avançado** é o formulário inteiro de
`regra.jsx`. Os dois editam o mesmo rascunho e salvam o mesmo JSON (`regra.js`) pelo
`salvar_regra_analise`. O rascunho é guardado a cada mudança (por edital e por pessoa, em
`TB_RASCUNHO_REGRA` com cópia no navegador sem conexão: `src/app/rascunho-da-regra.ts`, hook
`src/app/usar-rascunho-da-regra.ts`) e volta ao abrir ("Continuar de onde parei" / "Descartar");
salvar a versão (`aoGravarVersao` do `estado.js`) apaga. Cinco passos:

1. ponto de partida (`partida.tsx`): versão vigente, regra conferida de outro edital da área,
   modelo ou do zero — sempre cópia independente;
2. cardápio (`cardapio.tsx`): cartões que ligam ou desligam um bloco, uma eliminação automática ou
   o corte por pontos mínimos, com valores sugeridos das fontes (nenhum peso no código); o grupo
   "Na inscrição" vem primeiro (`GRUPOS_DO_CARDAPIO`);
3. perguntas da Empregare (`perguntas.tsx`): as colunas de cada vaga
   (`obter_apoio_regra_analise`) e as respostas da última carga (`obter_perguntas_carga_analise`,
   instantâneo calculado em Python pelo robô; pedidas só ao abrir este passo ou o formulário do modo
   avançado), ligação automática pelo enunciado, verde/amarelo/vermelho com a
   regra de `nota-declarada.js`, e a nota declarada;
4. nota mínima e desempate (`nota-e-desempate.tsx`, `lista-ordenavel.tsx`,
   `seletor-de-criterios.tsx`): a regra de classificação (gravada por
   `salvar_regra_classificacao`, com a permissão dela; sem Editor, só leitura com aviso) e o
   desempate da Provisória; "Acrescentar critério" abre o catálogo inteiro de cada lista, em grupos
   e com busca (`src/lib/avaliacao-documental/catalogo-de-desempate.ts`);
5. testar e salvar (`conferir.tsx`), nesta ordem: o resumo de uma página (`resumo-da-regra.ts`,
   "Copiar para o SEI" e imprimir), a comparação de versões (`comparar-regras.ts`), `previa.tsx`
   (fechada) e nome + motivo + salvar, com a lista do que falta ao lado do botão
   (`pendencias-do-salvar.ts`; cada item leva ao passo e ao campo). No topo, o cartão de estado
   (`estado-do-passo-5.tsx`: sem mudanças, pronto, salvo — com "Marcar como conferida" quando
   pode) e, preso ao pé, o botão do que vai acontecer (salvar, concluir sem mudanças ou fechar).
   A aba remonta a cada versão; `regraSalvaAgora` (estado.js) faz o assistente voltar ao passo 5.

"Conferida" é dupla conferência: quem salvou a versão não confere (o banco recusa em
`conferir_regra_analise`; o administrador global pode), e a regra vigente diz à tela
(`conferir_pede_outra_pessoa`). Migration `20261008120000_assistente_da_regra.sql`. O critério de
aceite (refazer a v7 do 93/2026 a partir do PROJ26) está em
`tests/lib/avaliacao-documental-assistente.test.js`.

## Diferenças por cargo

A regra varia por nível (`por_nivel`) e, quando o edital pede, por cargo (`regra.por_cargo`; formato,
conta e validação em `src/lib/avaliacao-documental/regra-por-cargo.ts`). Cada diferença vale para
códigos de vaga da Empregare e/ou o começo do nome do cargo ("CARGO 15", palavras inteiras) e muda,
por bloco: CURSOS teto/faixas/extras, TITULOS teto/extras, VINCULOS teto/área exigida e DOCUMENTO
requisitos (rótulo, motivo da eliminação, termos e "não pontua em" do 8.2.7). Precedência: cargo >
nível > padrão; o código da vaga vale antes do nome. A regra da vaga (`regraDaVaga`) é a mesma no JS,
no Python (`regra_da_vaga` em `pontuacao.py`, casos dourados "por cargo: …") e no banco
(`private."FC_REGRA_DA_VAGA"`, migration `20261013130000_regra_por_cargo.sql`): `salvar_rascunho_ficha`
e `concluir_ficha` gravam a vaga e o cargo da ficha no lançamento e validam contra ela.

- assistente (passo 2) e modo avançado: `assistente/diferencas-por-cargo.tsx` (as vagas e os cargos
  do quadro vêm de `obter_apoio_regra_analise`);
- ficha: `ficha/diferencas-do-cargo.tsx` — a lista de requisitos DAQUELE cargo com Confere / Não
  confere e o motivo pronto (o Não confere entra como motivo que elimina), as linhas extras (ex.:
  UMCQA, +5, até o teto do cargo; `blocos[X].extras`), o aviso do 8.2.7 e a área exigida da
  experiência; as faltas "requisito" e "extra" em `pendenciasDaFicha` (e `FC_PENDENCIAS_FICHA`);
- prévia: o seletor "Cargo" aplica uma diferença ao candidato fictício.

## Dono da avaliação: planilha ou MONITORA

Ao lado de "Avaliação:" (`origem-da-analise.tsx`), a coordenação da avaliação do edital (e o
admin global) troca o dono com confirmação e motivo (RPC `definir_origem_analise`, migration
`20261009200000_fichas_no_painel_das_analises.sql`). Com MONITORA, um gatilho em
`TB_FICHA_ANALISE` publica cada ficha em `TB_ANALISE_CURRICULAR` (`TP_ORIGEM_REGISTRO` MONITORA):
Pendente, Em análise, Revisar, Aprovado/Triados ou Reprovado, com responsável, data, parciais, nota
e parecer. O Painel das análises e a Classificação leem essas linhas sem código especial; a
sincronização da planilha ignora as linhas e os editais MONITORA. Edital que a planilha já decidiu
não vira MONITORA por aqui (a virada com adoção é da F8).

## Menos egress (plano gratuito do Supabase)

As leituras grandes vão por versão (migrations `20261014230000_avaliacao_leitura_por_versao.sql` e
`20261014231000_fila_e_ficha_so_o_que_mudou.sql`; lógica pura em
`src/lib/avaliacao-documental/leitura-por-versao.ts` e `fila-por-mudancas.ts`; cópia no navegador
em `src/app/copias-por-versao.ts`): a pré-classificação, a regra e a Classificação mandam a versão
que a tela tem e recebem só `{ inalterado }` quando nada mudou (a pré-classificação e a
Classificação, quando mudou, com os inscritos em colunas); a fila, depois da primeira leitura, só as
linhas que mudaram, e não é relida ao passar de uma ficha a outra no modo de análise (só ao voltar à
lista); a ficha não traz a configuração da regra que a tela já guardou. O rascunho automático sai 3 s
depois da última mudança (no máximo 15 s depois da primeira pendente) e na hora ao fechar, trocar de
ficha ou esconder a aba. Sem as migrations, a tela usa as RPCs de sempre.

## Arquivos

```
avaliacao-documental.jsx  tela e montarAvaliacaoDocumental() (na #page-avaliacao-documental)
estado.js                 store sem React: editais, regra, equipe e as gravações (RPCs)
abas-e-entrada.ts         abas por papel, edital que abre sozinho, último edital lembrado
entrada-da-avaliacao.tsx  cartões dos editais vigentes (sem edital escolhido)
regra.jsx                 aba Regra: formulário, perguntas da carga, versões, aldeias
assistente/diferencas-por-cargo.tsx  "Diferenças por cargo" (assistente e modo avançado)
blocos.jsx                os blocos da ficha na regra
previa.tsx                "Testar com um candidato fictício" (entradas à esquerda, resultado preso
                          à direita; uma coluna em largura estreita)
equipe.jsx                aba Equipe
pre-classificacao.jsx     aba Pré-classificação (contadores, vagas, listas oficiais)
fila.jsx                  aba Fila (etapas, filtros, ações em lote, ficha aberta)
estado-da-fila.js         store da aba: obter_fila_avaliacao (só o lote e as contagens),
                          os de fora do lote sob demanda e em páginas (obter_fila_fora_do_lote,
                          lib fila-fora-do-lote.ts), Pegar próximo, reserva (renovação e
                          liberação), distribuição, revisão, filtros salvos
ficha/ficha.jsx           conteúdo da ficha aberta: modo foco / lista, passos, teclas, rodapé
ficha/*.tsx               cabeçalho, stepper, item, Conclusão, nota, "⋯", rodapé e links da
                          Empregare (contratos em ficha/tipos.ts); as escolhas (Confere,
                          Não confere, Editar nota) e o que gravam em
                          src/lib/avaliacao-documental/apurado-da-ficha.ts
ficha/diferencas-do-cargo.tsx  requisitos e extras do cargo, aviso do 8.2.7, área exigida
ficha/espelho-de-nota.ts  botão "Espelho de nota": monta (src/lib/avaliacao-documental/
                          espelho-de-nota.ts) e imprime no navegador, ou baixa o PDF
                          (espelho-em-pdf.ts: jsPDF + autotable, sob demanda), sem banco
                          nem Storage; espelhoDaFichaGravada: a mesma montagem para os
                          espelhos em massa; baixarZipDosEspelhos: o ZIP (fflate)
espelhos-em-massa.tsx     Ações da coordenação › "Espelhos de nota em massa": vaga e filtro
                          ou códigos colados, obter_espelhos_de_nota em páginas de 200
                          (20261015180000); ZIP com um PDF por candidato (padrão, em lotes,
                          "x de N") ou um documento só para imprimir, um espelho por página
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
- Testes: `tests/modulos/avaliacao-documental.test.js`, `tests/modulos/avaliacao-documental-assistente.test.js`,
  `tests/assistente-da-regra-migration.test.js`, `tests/modulos/avaliacao-documental-fila.test.js`,
  `tests/modulos/avaliacao-documental-ficha.test.js`, `tests/lib/avaliacao-documental-ficha.test.js`,
  `tests/conteudo-da-ficha-migration.test.js`, `tests/python/test_pontuacao.py`,
  `tests/fichas-fila-reserva-migration.test.js`, `tests/ficha-segue-versao-migration.test.js`,
  `tests/python/test_distribuicao.py`, `tests/lib/avaliacao-documental-decisao-do-lote.test.js`,
  `tests/inclusao-no-lote-por-decisao-migration.test.js`,
  `tests/modulos/avaliacao-documental-pre-classificacao.test.js`,
  `tests/lib/avaliacao-documental-*.test.js`, `tests/avaliacao-documental-migration.test.js`,
  `tests/pre-classificacao-migration.test.js`, `tests/python/test_pre_classificacao.py` e
  `tests/python/test_pre_classificacao_job.py`; diferenças por cargo em
  `tests/lib/avaliacao-documental-regra-por-cargo.test.js`,
  `tests/modulos/avaliacao-documental-ficha-por-cargo.test.js`,
  `tests/modulos/avaliacao-documental-diferencas-por-cargo.test.js` e
  `tests/regra-por-cargo-migration.test.js`.

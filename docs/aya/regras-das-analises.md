# Regras do Painel das análises

A tela Painel das análises (view `analises`, antes chamada Análises curriculares) e a sincronização das planilhas de análise. Fontes:
`src/modulos/analises/`, `src/lib/analises-curriculares.ts`, `src/lib/data-de-analise.js`,
`apps-script/LEIA-ME.md` e as migrations `20260929150000_analises_lista_enxuta.sql`,
`20260930100000_analises_sem_registro_fantasma.sql`, `20261001140000_incremental_remove_ausentes.sql`
e `20260930234000_cache_sem_atropelo.sql`.

## Painel das análises

**perguntas:** painel das analises | para que serve o painel das analises | analises curriculares | analise curricular | tela de analises curriculares | tela de analises | aba analises curriculares | para que serve analises curriculares | para que serve a tela de analises | painel de analises curriculares
**resposta:** O Painel das análises (antes chamado Análises curriculares) é a tela de leitura da avaliação documental: mostra a análise curricular dos candidatos da área atual, vinda das planilhas de análise: indicadores (Total de aptos p/ análise, Análises realizadas, Pendentes, Em revisão, Aprovados e Reprovados), pendências prioritárias, carga por responsável, evolução diária e a lista. Os filtros são Unidade, Município/UF (só em SEDE e Projetos), Edital, Código da vaga, Status e Responsável, e em "Mais opções" Categoria, Modalidade e Validação da janela; as opções de cada filtro seguem os outros. A taxa de conclusão é aprovados mais reprovados sobre o total.
**fonte:** src/lib/analises-curriculares.ts; src/modulos/analises/
**abrir:** analises

## Filtrar por data no gráfico Análises por data

**perguntas:** filtrar por data | filtro por data | filtrar por dia | clicar no grafico de datas | analises por data | linha do tempo das analises | analises de um dia | intervalo de datas nas analises | data da analise de ate
**resposta:** O gráfico Análises por data conta só as análises com decisão (Aprovado, Reprovado ou Revisar) pela data da análise; pendente com data não entra. Nas Análises curriculares, clicar num dia do gráfico Análises por data filtra a tela por aquele dia, pela data da análise: os indicadores, a carga por responsável, as pendências prioritárias, a fila e o CSV passam a mostrar só as análises daquele dia. O filtro aparece como o chip Data no Recorte ativo e nos filtros aplicados, e o ponto escolhido fica destacado; o gráfico continua com todos os dias. Clicar de novo no mesmo dia, no x do chip ou em Limpar tudo tira o filtro; outro dia troca. Shift + clique em outro dia escolhe o intervalo entre os dois. Sem mouse, o mesmo filtro está em Refinar resultados › Mais opções, nos campos Data da análise: de e até. Análise sem data de análise sai do recorte enquanto houver filtro de data.
**fonte:** src/lib/analises-curriculares.ts; src/modulos/analises/paineis.tsx; docs/historias-de-usuario/analises-curriculares.md
**abrir:** analises

## Escopo Ativo, Inativo e Todos

**perguntas:** o que e o escopo ativo, inativo e todos | escopo ativo | escopo inativo | situacao do processo | ativo inativo todos
**resposta:** Nas Análises curriculares, o campo Situação do processo começa em Ativo. Ativo são as análises ativas de editais ativos; Inativo são as análises de editais encerrados (inativos); Todos junta os dois e as análises desativadas de editais ainda ativos. Só o Ativo fica pronto num cache do banco, remontado a cada 2 minutos; Inativo e Todos são montados na hora do pedido.
**fonte:** src/lib/analises-curriculares.ts; supabase/migrations/20260929150000_analises_lista_enxuta.sql; supabase/migrations/20260930234000_cache_sem_atropelo.sql

## Pendências das análises

**perguntas:** quais sao as pendencias das analises curriculares | pendencias das analises | data no futuro | data fora do periodo | sem responsavel | validacao da janela
**resposta:** Nas Análises curriculares, as pendências prioritárias aparecem da mais grave para a menos grave (até 8): Data no futuro, Data fora do período e Sem responsável; depois Pendentes, Em revisão e Etapa sem data. Cada uma tem um atalho que aplica o filtro. A data da análise é comparada com a janela do edital: Dentro do período, Fora do período, Sem data de análise, Sem janela configurada ou Data no futuro (data depois de hoje, um dado a corrigir na planilha). No gráfico de evolução diária, os dias com análise fora do período ou no futuro ficam em vermelho.
**fonte:** src/lib/analises-curriculares.ts; src/lib/data-de-analise.js

## Atualização das análises

**perguntas:** como as analises curriculares sao atualizadas | sincronizacao das analises | de onde vem as analises | quem saiu da planilha | atualizacao das analises
**resposta:** As três planilhas de análise (Saúde Indígena, Projetos e SEDE) enviam para o mesmo banco por Apps Script; em Projetos e SEDE o envio incremental roda a cada 20 minutos. Quem sai da planilha sai do MONITORA: no fim de cada sincronização, as análises ativas daquela planilha (de editais ativos) que não vieram no envio são desativadas, nada é apagado. Há travas: nada é desativado se o envio vier vazio ou incompleto, ou se a remoção passar de 2% das análises ativas da planilha (mínimo de 25). Se o mesmo candidato aparece de novo na mesma vaga e edital, só o registro mais recente fica ativo. Análises de editais encerrados ficam como histórico. Edital analisado no MONITORA não passa pela planilha: as fichas atualizam o painel na hora. O andamento das cargas aparece em Configurações › Status das atualizações.
**fonte:** apps-script/LEIA-ME.md; supabase/migrations/20261001140000_incremental_remove_ausentes.sql; supabase/migrations/20260930100000_analises_sem_registro_fantasma.sql

## Conferido às, no topo da tela

**perguntas:** conferido as | o que e conferido as | o que quer dizer conferido | ultima mudanca | hora no topo da tela | atualizado em | a tela parece parada | dados parados | por que a hora nao muda
**resposta:** No topo de Análises curriculares, Seleção e Entrevistas, "Conferido às 09:32" é a última vez que a carga conferiu os dados (horário de Brasília; se foi em outro dia, aparece a data, como "em 04/10, 13:05"). Nas Análises curriculares, vem junto "última mudança em …": quando os dados mudaram de fato. Se a carga rodou e a planilha não tinha nada novo, o "Conferido" avança e a última mudança fica — os dados não estão parados. Sem registro de conferência, aparece "Atualizado em …". Se suspeitar de carga atrasada ou com falha, o administrador global confere em Configurações › Status das atualizações.
**fonte:** src/lib/texto-da-conferencia.js; src/modulos/analises/analises.tsx; src/modulos/selecao/selecao.tsx; src/modulos/entrevistas/entrevistas.tsx

## Quem vê as Análises curriculares

**perguntas:** quem pode ver as analises curriculares | nao vejo a aba analises | permissao analises | posso editar a analise no monitora | onde corrijo a analise | corrigir nota da analise
**resposta:** A aba usa a permissão "Análises curriculares" (Leitor basta, em Configurações › Acessos) e mostra só a área atual e, com coordenação, os editais dela. Ela é só de consulta: a análise é feita e corrigida nas planilhas de análise, que chegam ao MONITORA pelo Apps Script, ou, no edital analisado no MONITORA, nas fichas da Avaliação documental. Nota alterada por recurso não muda a análise: vale como ajuste aprovado, aplicado na Classificação.
**fonte:** src/lib/access-roles.js; src/lib/permissoes-recursos.js; src/modulos/analises/; apps-script/LEIA-ME.md
**abrir:** analises

## Número das Análises que não bate

**perguntas:** por que o numero das analises nao bate | numero diferente da planilha | total de analises diferente | analise nao aparece | candidato sumiu das analises
**resposta:** Confira primeiro o recorte: a Situação do processo começa em Ativo (editais encerrados ficam em Inativo), os filtros e o filtro de data (chip Data) recortam todos os números, e a tela é só da área atual. O envio das planilhas é esperado a cada 20 minutos e o Ativo vem de um pacote remontado a cada 2 minutos, então uma mudança recente pode demorar um pouco; o "Conferido às" do topo diz quando a carga conferiu. Quem saiu da planilha é desativado no MONITORA, e o mesmo candidato repetido na mesma vaga e edital conta uma vez só (o registro mais recente).
**fonte:** src/lib/analises-curriculares.ts; supabase/migrations/20261001140000_incremental_remove_ausentes.sql; supabase/migrations/20260930100000_analises_sem_registro_fantasma.sql
**abrir:** analises

## Análise no MONITORA ou pela planilha

**perguntas:** avaliacao documental no monitora | analisar no monitora | analise no monitora | analise pela planilha | monitora ou planilha | fazer a analise curricular no monitora | ficha de analise do candidato | edital analisado no monitora | dono da avaliacao | origem da analise | edital 114 no painel | onde acompanho a analise do monitora | simulador da analise
**resposta:** Cada edital tem um dono da avaliação documental. Pela planilha (o padrão): a análise é feita nas planilhas de análise e chega ao Painel das análises pela sincronização do Apps Script. No MONITORA: a análise é feita nas fichas da Avaliação documental (Fila), e cada ficha alimenta a mesma base na hora: ao abrir o lote a linha entra como Pendente; atribuída, mostra o responsável; aberta por alguém, Em análise; concluída, Aprovado (apto) ou Reprovado (inapto), com a nota, as parciais, a data e o parecer; em revisão, Revisar; reaberta ou reiniciada, volta. A sincronização da planilha não altera nem inativa essas linhas, nem o edital. Acompanhe no Painel das análises (pendentes, em análise, concluídas, aprovados e reprovados por vaga e por responsável) e na Classificação, como os outros editais; o trabalho em si fica na Avaliação documental › Fila. Quem troca o dono é a coordenação da avaliação do edital (ou o administrador global), pelo botão ao lado de "Avaliação:" na Avaliação documental, com motivo; edital que a planilha já decidiu não passa para o MONITORA por ali. O Edital 114/2026 de Projetos é analisado no MONITORA.
**fato:** No MONITORA, o dono da avaliação documental de cada edital fica em TB_ORIGEM_ANALISE_EDITAL (PLANILHA ou MONITORA); com MONITORA, a ficha publica em TB_ANALISE_CURRICULAR com TP_ORIGEM_REGISTRO MONITORA.
**fonte:** supabase/migrations/20261009200000_fichas_no_painel_das_analises.sql; src/modulos/avaliacao-documental/origem-da-analise.tsx
**abrir:** analises

## Nota declarada e após a análise na gaveta

**perguntas:** nota declarada no painel | nota autodeclarada na gaveta | nota antes da analise | nota consolidada | nota apos a analise | declarada x apos analise | nota mudou na analise curricular | justificativa do criterio no painel | gaveta da analise curricular | espelho no painel | teto do criterio | composicao da pontuacao
**resposta:** Na gaveta de uma análise (clique na linha do Painel das análises), quando a linha veio de uma ficha concluída da Avaliação documental (edital analisado no MONITORA), a seção "Nota antes e após a análise" mostra, logo depois da Situação, a Nota autodeclarada (antes da análise) e a Nota consolidada (após a análise) e, por critério, Declarada, Após análise e Teto; embaixo do critério que mudou vêm as justificativas, com o mesmo texto do espelho de nota. Os números são os do espelho de nota da mesma ficha (a mesma conta), então os dois sempre batem. No eliminado (inapto por requisito), como no espelho, não há a declarada nem os critérios: a consolidada diz "Não se aplica" e aparecem os motivos da eliminação. Linhas que vieram da planilha, e fichas ainda não concluídas, seguem com a nota final e a composição da pontuação de sempre.
**fato:** No MONITORA, a gaveta do Painel das análises monta a nota declarada × após a análise pela mesma conta do espelho de nota (espelhoDaFichaGravada), com a entrada que get_analise_detalhe_do_painel traz em "espelho".
**fonte:** src/lib/espelho-do-painel-de-analises.ts; src/modulos/analises/espelho-na-gaveta.tsx; supabase/migrations/20261020150000_detalhe_do_painel_com_espelho.sql
**abrir:** analises

## Ritmo da análise

**perguntas:** ritmo da analise | no ritmo | abaixo do ritmo | meta de hoje | meta do dia | feito hoje | faltam hoje | quantas por dia | quantas fichas por dia | por avaliador | vai dar tempo | prazo da analise | quando termina a analise | previsao de termino | recolher ritmo | por que o ritmo nao bate
**resposta:** No Painel das análises, o card "Ritmo da análise" aparece para cada edital analisado no MONITORA. Os números são os do resumo do painel, o mesmo dos indicadores do topo ("Conferido às HH:MM", remontado a cada 30 minutos), mas só daquele edital: o topo soma todos os editais da área. O destaque é "Hoje": a meta do dia é o que faltava à meia-noite dividido pelos dias úteis até o prazo, contando hoje (segunda a sexta, sem feriados nacionais); "Feito hoje" são as fichas concluídas desde 00:00; "Faltam hoje" é a diferença, e o card diz quantas por avaliador até o fim do expediente (analistas ativos na equipe do edital; sem equipe, quem concluiu fichas nos últimos 7 dias). O selo do dia oscila: o esperado para a hora cresce das 8h às 18h; feito acima dele é No ritmo hoje, abaixo é Abaixo do ritmo hoje, e quem passa da meta vê Meta de hoje batida. Sábado, domingo e feriado: o card diz que hoje não é dia útil. O prazo é o fim da etapa de validação da documentação (ou análise documental/curricular) no cronograma; sem ela, não há meta. Embaixo, como referência, "Faltam" do edital (pendentes, em análise e a revisar), a média dos últimos dias com análise e a previsão de término. A setinha no canto recolhe o card numa linha ("hoje X de Y"); a escolha fica guardada neste navegador para você.
**fonte:** src/lib/ritmo-da-analise.ts; supabase/migrations/20261019170000_ritmo_da_analise.sql
**abrir:** analises

## Destaques de hoje (medalhas)

**perguntas:** destaques de hoje | medalha | medalhas | ouro prata bronze | podio | quem mais concluiu hoje | selo precisao | alvo precisao | ficha reaberta | ranking dos avaliadores | comemoracao da meta | meta batida pela equipe
**resposta:** No card "Ritmo da análise", "Destaques de hoje" mostra 🥇🥈🥉 para os três que mais concluíram fichas hoje (empate leva a mesma medalha) e o selo 🎯 Precisão para quem concluiu ao menos 10 fichas hoje sem nenhuma reaberta (reabrir uma ficha concluída hoje, pela coordenação ou pela própria pessoa, tira o selo do dia; reiniciar o edital não conta). Zera todo dia, à meia-noite de Brasília: não há ranking acumulado, e só aparecem os medalhistas e quem tem o selo. Quando a equipe bate a meta de hoje, cada pessoa vê uma comemoração uma vez por dia, se as comemorações estiverem ligadas (Configurações › Comemorações, "Meta de hoje batida pela equipe", e a sua preferência pessoal).
**fonte:** src/lib/ritmo-da-analise.ts; supabase/migrations/20261021100000_medalhas_do_dia.sql
**abrir:** analises

## Edital concluído: tela de encerramento e selo

**perguntas:** tela de encerramento | encerramento do edital | edital concluido | fim do edital | acabou o edital | selo do edital | selo no perfil | minha contribuicao no edital | quantas fichas eu analisei no edital
**resposta:** Quando todas as fichas do lote de um edital analisado no MONITORA ficam concluídas (as que saíram do lote não contam), quem concluiu ao menos uma ficha vê, uma vez, a tela de encerramento: inscritos, fichas analisadas e dias de análise do edital, o agradecimento à equipe e, embaixo, só a sua parte (fichas que você concluiu, quanto isso é do total e o seu melhor dia). Não há ranking nem números de outras pessoas. Quem entra depois (no dia seguinte, em outro navegador) também vê a tela, uma vez. A comemoração segue Configurações › Comemorações ("Edital 100% analisado") e a sua preferência; com as comemorações desligadas no sistema, a tela espera até religarem. Cada edital encerrado vira um selo com o número do edital (por exemplo, 114/2026) no menu da conta, no topo, com uma marca no avatar; os selos se acumulam, um por edital.
**fonte:** src/lib/encerramento-do-edital.ts; src/modulos/encerramento-do-edital/; supabase/migrations/20261021180000_encerramento_do_edital.sql
**abrir:** analises

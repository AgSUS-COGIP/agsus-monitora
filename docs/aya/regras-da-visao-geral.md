# Regras da Visão geral

Como a Visão geral (a página inicial de cada área) calcula e filtra. Estas explicações ficavam em
dicas, legendas e textos da própria tela; saíram da interface quando a Visão geral virou módulo do
app em React (Etapa 5, parte 1) e ficam aqui, com a Aya.

## Visão geral

**perguntas:** visao geral | pagina inicial | dashboard | painel inicial | para que serve visao geral | para que serve a visao geral | tela da visao geral
**resposta:** A Visão geral do Yeendé é a mesma página nas três áreas (Saúde Indígena, SEDE e Projetos) e mostra só os editais da área escolhida no menu. De cima para baixo: o cabeçalho (saudação, quantos editais têm etapa nos próximos 7 dias, a hora da carga e os botões Filtros, Atualizar e Exportar), as vagas, "Pede ação" (críticos e pendências do pós-resultado) ao lado de "Em andamento, por fase", o mapa e a tabela de processos. Em Projetos há também "Processos por projeto". Na Saúde Indígena o mapa mostra os DSEIs e as CASAIs; em Projetos, os municípios das vagas; a SEDE não tem mapa.
**fonte:** interface do Yeendé

## Indicadores da Visão geral

**perguntas:** indicadores da visao geral | kpis da visao geral | vagas ociosas da visao geral | kpi vagas imediatas | contratadas | em selecao | cadastro reserva | contratacoes alem das vagas imediatas | alem das vagas | como fecham os kpis | conta dos indicadores
**resposta:** Na Visão geral, o bloco das vagas conta os editais do recorte e fecha: Vagas imediatas = Contratadas + Em seleção + Ociosas, com a porcentagem de cada parte e uma barra da divisão; Contratações além das vagas imediatas e Inscritos ficam na linha de baixo. Os números aparecem só depois que a conta das vagas reabertas chega (até 10 segundos), para não trocarem na frente de quem lê; se ela falhar, as vagas aparecem como cada edital publicou, com o aviso "sem desconto das reabertas". Vagas imediatas é a soma das vagas do cadastro do edital, contando uma vez só a vaga reaberta: a vaga que ficou sem contratação num edital com resultado e voltou num edital mais novo da mesma unidade, para o mesmo cargo, conta só no edital novo (o número embaixo do indicador diz quantas saíram da soma). Contratadas são as contratações de cada edital limitadas às vagas imediatas dele (o que passa disso é Contratações além das vagas imediatas, mostrado à parte; antes se chamava "Cadastro reserva", mas não é o cadastro reserva do edital, e sim os contratados acima das vagas). Em seleção são as vagas ainda sem contratação dos editais sem resultado (em andamento, planejados ou sem cronograma). Ociosas são as vagas sem contratação dos editais com resultado (concluídos ou na fase Contratação). Editais cancelados não entram em nenhum indicador, nem em Inscritos. Críticos (em "Pede ação") conta os editais marcados manualmente como críticos e Inscritos soma os inscritos dos editais que informaram o número: quando só parte informou, o indicador diz "informado em X de Y editais", e quando nenhum informou aparece "—" (sem dado), não zero. O zero é zero confirmado; "—" com "nenhum edital com resultado" (em Ociosas) ou "nenhum edital sem resultado" (em Em seleção) quer dizer que aquele número não se aplica ao recorte. Os rótulos podem ser trocados em Configurações › Página inicial.
**fato:** Na Visão geral, Vagas imediatas = Contratadas (contratações limitadas às vagas de cada edital) + Em seleção (editais sem resultado) + Ociosas (editais concluídos ou na fase Contratação); contratações além das vagas são "Contratações além das vagas imediatas" (antes, "Cadastro reserva"); cancelados não entram; Inscritos sem número é "—", não zero.
**fonte:** src/lib/visao-geral/indicadores-do-monitoramento.ts

## Vagas reabertas

**perguntas:** vagas reabertas | vaga reaberta | vaga contada duas vezes | mesma vaga em dois editais | edital reaberto | reabertura de vaga | vagas imediatas repetidas | sem reabertas | edital deserto reaberto | por que as vagas imediatas diminuiram
**resposta:** O mesmo DSEI abre vários processos seletivos para a mesma vaga: o edital termina com vagas sem contratação (deserto, sem aprovados, desistência antes da contratação) e o posto volta num edital novo. Na Visão geral, essa vaga conta uma vez só, no edital mais novo. Vale quando os dois editais são da mesma unidade, o novo começou depois do fim do anterior, o anterior já tinha resultado e os dois têm o mesmo cargo (pelos cargos das vagas da Seleção e pelo quadro de vagas; na Saúde Indígena, pelo cadastro oficial de cargos, que junta as grafias diferentes do mesmo cargo, como "AISAN" e "Agente Indígena de Saneamento"). O edital novo reabre até as vagas dele nesses cargos, pelo quadro; sem quadro, até o total dele. No edital antigo, as vagas reabertas saem das vagas imediatas e das ociosas; as contratadas continuam nele, e a conta Vagas imediatas = Contratadas + Em seleção + Ociosas segue fechando. O indicador Vagas imediatas mostra embaixo quantas reabertas saíram da soma; os detalhes do edital dizem "N vagas reabertas no edital X" (no antigo) e "Reabre N vagas do edital Y" (no novo). A tabela continua com as vagas que cada edital publicou. Não conta como reaberta a reposição de quem foi contratado e saiu (é contratação nova), o mesmo cargo em outra unidade nem edital cancelado. O código da vaga não serve para ligar os editais: a Empregare dá código novo a cada edital.
**fato:** Na Visão geral, a vaga sem contratação de um edital com resultado, reaberta num edital mais novo da mesma unidade e do mesmo cargo, conta só no edital novo; o indicador Vagas imediatas mostra quantas saíram da soma.
**fonte:** src/lib/visao-geral/vagas-reabertas.ts

## Processos críticos

**perguntas:** processos criticos | o que e critico | quando um edital fica critico | criterio de critico | bloco atencao | edital parado | etapa atrasada | contratacao abaixo de 50 | sem inscritos | marcar edital critico | marcar como critico | quem marca critico | desmarcar critico
**resposta:** Na Visão geral, um edital só é crítico quando foi marcado manualmente como crítico pelo gestor, coordenador ou administrador global, no formulário de Editais ("Edital crítico"), com motivo de 10 a 500 caracteres. Desmarcar também pede motivo; as decisões ficam no histórico. Quem só vê lê quem marcou, quando e por quê. Datas vencidas, ausência de inscritos e taxa de contratação não tornam o processo crítico automaticamente. Editais cancelados não entram nos críticos, mesmo quando têm marcação. O indicador, a lista de críticos e o filtro usam as mesmas marcações manuais.
**fato:** Processos Críticos conta apenas editais não cancelados marcados manualmente como críticos.
**fonte:** src/lib/visao-geral/criticos-da-visao-geral.ts

## Filtros da Visão geral

**perguntas:** filtros da visao geral | como funcionam os filtros da visao geral | filtro por ano | filtrar editais de 2026 | busca da tabela da visao geral | limpar filtros da visao geral | filtro de fase
**resposta:** Na Visão geral, o botão Filtros do cabeçalho abre os campos Ano, Unidade, Edital e Status, com Fase e UF em "Mais opções"; os filtros aplicados ficam sempre à vista como etiquetas, com "Limpar tudo". Cada filtro aceita vários valores e as opções de um seguem os outros já escolhidos. O campo Ano escolhe de uma vez todos os editais daquele ano (pelo número, como 11/2026); outra escolha de editais aparece como "Seleção própria". A busca da tabela vale para a página toda: indicadores, mapa, blocos e tabela. Os filtros ficam guardados no navegador. Críticos e as pendências do Pós-resultado aparecem como "Recorte" entre os filtros aplicados. "Limpar tudo" apaga filtros, busca, recorte e o DSEI aberto e volta o mapa ao Brasil.
**fonte:** interface do Yeendé

## Mapa e filtros da Visão geral

**perguntas:** dsei aberto no mapa | filtro dsei da pagina | casai no mapa filtra
**resposta:** Na Visão geral da Saúde Indígena, escolher um DSEI no mapa recorta a página inteira por ele (aparece o filtro "DSEI" entre os filtros aplicados). Tirar esse filtro, ou voltar ao Brasil pelo mapa, sai do território e mantém os outros filtros. Clicar numa CASAI no mapa busca por ela na página.
**fonte:** interface do Yeendé

## Blocos da Visão geral

**perguntas:** proximos 7 dias | agenda da visao geral | fases | fases dos processos | pos-resultado | pos resultado | processos por projeto | blocos da visao geral
**resposta:** Na Visão geral, o cabeçalho diz quantos editais têm etapa nos próximos 7 dias, contando hoje (pelo dia de Brasília, sem os cancelados), com o atalho para o Cronograma. "Pede ação" junta os Críticos e as pendências do pós-resultado: nos editais com resultado, os concluídos sem lista de aprovados vigente e as listas sem nenhum status; o clique filtra a página por aquele item. "Em andamento, por fase" mostra só as fases com edital aberto (Edital, Inscrições, Análise curricular, Recursos, Entrevistas, Resultado, Contratação, Sem cronograma ou Outra), lidas do status e da atividade do cronograma, e embaixo quantos estão com cronograma encerrado, concluídos e cancelados; o clique filtra a fase. Em Projetos, "Processos por projeto" mostra cada projeto com processos, abertos, vagas e contratadas; o clique filtra o projeto.
**fonte:** interface do Yeendé

## Fases dos processos

**perguntas:** como a fase e calculada | de onde vem a fase | fase do edital | etapa e fase
**resposta:** A fase do edital na Visão geral vem primeiro do status (cancelado é Cancelado, planejado é Edital, e concluído é "Cronograma encerrado" quando o status vem das datas com o cálculo automático, ou Concluído só quando foi digitado à mão com o cálculo manual) e, nos demais, do texto da atividade do cronograma (a de hoje, ou a etapa mostrada), sem acento nem caixa: contratação, admissão ou posse é Contratação; prazo ou abertura de recurso é Recursos; resultado final ou homologação do resultado é Resultado; outro recurso é Recursos; entrevista é Entrevistas; análise curricular, documental, títulos, prova ou resultado preliminar é Análise curricular; inscrição é Inscrições; outro resultado é Resultado; edital, impugnação ou publicação é Edital. "Aguardando: X" conta como a fase de X; texto que nenhuma regra reconhece fica em Outra e "Cronograma pendente" em Sem cronograma.
**fonte:** src/lib/visao-geral/fases-do-processo.ts

## Tabela de processos da Visão geral

**perguntas:** tabela de processos da visao geral | como leio a tabela de processos | tabela de processos | prazo do edital | proxima etapa do cronograma | colunas da tabela | taxa de vagas sem contratacao
**resposta:** Na tabela de processos da Visão geral, a coluna Contratados mostra as contratações dentro das vagas, como o indicador "Contratadas"; as que passam das vagas imediatas aparecem ao lado, como "+N além". A célula do edital mostra o prazo do edital (encerra em até 7 dias em vermelho, em até 30 dias em amarelo; "Cronograma encerrado" ou cancelado em cinza) e a situação do cronograma de Editais (atrasada ou próxima etapa em até 3 dias em vermelho, em até 7 dias em amarelo; "Processo suspenso" ou "Processo paralisado" em amarelo; "Sem cronograma" só quando o edital não tem nenhuma etapa em Editais). "Cronograma encerrado" quer dizer que a última data do cronograma passou: não prova que o resultado foi publicado nem que o processo foi homologado, e a validade do cadastro reserva conta a partir da data de encerramento do edital. Por isso, na Visão geral, o status "Concluído" calculado pelas datas aparece como "Cronograma encerrado" também na coluna Status, na fase, nos filtros e no CSV; "Concluído" fica só para o que foi digitado à mão com o cálculo manual. Edital com o cálculo automático desligado (cálculo manual) e com etapas tem cronograma: os detalhes dizem "Cronograma cadastrado · cálculo manual", com o status digitado (por exemplo, "· suspenso"), e o andamento e a próxima etapa vêm das etapas. A borda esquerda da linha segue a mesma cor. "Sem contratação" é vagas menos contratados, com a porcentagem das vagas (a partir de 20% em amarelo, de 40% em vermelho). As colunas Fase e Atenção mostram a fase calculada e os motivos de crítico. Sem coluna escolhida, os críticos vêm primeiro (marcados manualmente como críticos) e depois quem tem mais vagas sem contratação. Clicar no cabeçalho ordena a coluna (crescente, decrescente e de volta à ordem padrão). "Colunas" escolhe as colunas visíveis, guardadas no navegador; o padrão, para todos, são todas menos Observações, que entra pelo menu "Colunas". Quando a tabela rola para o lado, Unidade e Edital ficam presas à esquerda. Clicar na linha (ou Enter) abre os detalhes do processo, com o andamento do cronograma ("N% do cronograma": quanto do cronograma já passou, não a contratação), a linha do tempo de Editais e o link do edital. Exportar abre o montador de relatório.
**fonte:** interface do Yeendé

## De onde vem cada número da tabela

**perguntas:** de onde vem o numero da tabela | ver os contratados do edital | abrir a lista de aprovados do edital | clicar no numero da tabela | composicao do numero | origem agregada | detalhe individual nao disponivel | ver os inscritos do edital | voltar para a linha da visao geral
**resposta:** Na tabela de processos da Visão geral, os números de Aprovados, Contratados, Aguardando chamada e Inscritos aparecem sublinhados quando levam aos dados que os compõem. Clicar abre um painel pequeno: Aprovados, Contratados e Aguardando chamada levam à Lista de aprovados já no edital da linha (Contratados com os status Contratado e Migração, Aguardando chamada com "Sem status"); Inscritos leva à tela de onde o número veio (a Seleção ou as Análises curriculares), também no edital. A linha é do edital: o destino nunca é um código de vaga. Quando só existe o total, sem os registros (por exemplo, contratados de um edital sem lista de aprovados vigente, ou inscritos de outra fonte), o painel diz "Origem agregada; detalhe individual não disponível", em vez de abrir uma lista vazia. Sem acesso à tela de destino, o número fica como texto. Ao voltar para a Visão geral (pelo Voltar do navegador ou pelo menu), a área, os filtros e a busca estão como estavam, e a linha de onde se saiu fica destacada.
**fato:** Na tabela da Visão geral, Aprovados, Contratados e Aguardando chamada abrem a Lista de aprovados no edital; Inscritos abre a Seleção (ou as Análises, conforme a fonte); só o total vira "Origem agregada; detalhe individual não disponível".
**fonte:** src/lib/visao-geral/origem-dos-numeros.ts

## Composição dos números da Visão geral

**perguntas:** composicao dos numeros da visao geral | ver a composicao | como se forma o numero | de onde sai o total | contratados dentro e alem das vagas | vagas publicadas menos reabertas | clicar no indicador | parcelas do numero
**resposta:** Na Visão geral, clicar num número sublinhado mostra as parcelas que o formam, quando os dados permitem. Na faixa das vagas: Vagas imediatas = Contratadas + Em seleção + Ociosas e, quando há vagas reabertas, Publicadas nos editais − Reabertas em edital mais novo; Contratadas e Contratações além das vagas imediatas = dentro das vagas + além delas (o total contratado); Em seleção e Ociosas = vagas dos editais sem (ou com) resultado − as contratadas nesses editais. Na tabela, por edital: Contratados = dentro das vagas imediatas + além delas; Vagas = publicadas no edital − reabertas em edital mais novo; Sem contratação = vagas publicadas − reabertas − contratadas dentro das vagas; Aprovados = já chamados (com status) + aguardando chamada (sem status). Quando o número é um só, sem parcela que o explique, não há composição.
**fato:** Clicar num número da Visão geral mostra a composição: Contratados = dentro + além das vagas imediatas; Vagas = publicadas − reabertas; Vagas imediatas = Contratadas + Em seleção + Ociosas.
**fonte:** src/lib/visao-geral/composicao-dos-numeros.ts

## Detalhes do edital na Visão geral

**perguntas:** detalhes do processo | gaveta do edital | resultado do edital na visao geral | admissoes conciliadas na gaveta | avisos do edital | avisos de conferencia do edital | selo de atencao | clicar no selo de atencao
**resposta:** Clicar numa linha da tabela da Visão geral abre os detalhes do edital. Além da situação, do provimento e do cronograma, há o bloco Resultado: Aprovados e Aguardando chamada (da lista de aprovados vigente; sem lista, "—" e "Sem lista de aprovados vigente."), Desistentes e as admissões conciliadas com o RH (a 1ª e a última admissão e quantas foram conciliadas). Embaixo, os avisos de conferência abertos daquele edital (os mesmos da central de avisos, com os casos, o tratamento e o histórico); quem é administrador global tem também "Abrir na central de avisos" (Configurações › Status das atualizações). Clicar no selo da coluna Atenção abre os detalhes já nos avisos do edital.
**fato:** Os detalhes do edital na Visão geral mostram o Resultado (aprovados, aguardando chamada, desistentes e admissões conciliadas com o RH: 1ª, última e quantas) e os avisos de conferência abertos do edital; o selo de Atenção abre direto nos avisos.
**fonte:** src/modulos/visao-geral/gaveta.tsx

## Resultado de cada processo seletivo

**perguntas:** quanto tempo levou o processo seletivo | duracao do edital | quantos aprovados no edital | quantos passaram | cadastro reserva do edital | quantos ficaram em cadastro reserva | resultado dos processos seletivos | dados dos processos de 2025
**resposta:** Na tabela de processos da Visão geral, quatro colunas mostram o resultado de cada edital (estão no padrão; o menu "Colunas" as desliga). Duração (dias) são os dias corridos do início ao encerramento do edital. Inscritos vem do funil do edital ("—" quando a fonte não tem o número). Aprovados são as pessoas da lista de aprovados vigente, e Aguardando chamada, as dessa lista que ainda não têm status, isto é, não foram chamadas (não confundir com o indicador Contratações além das vagas imediatas, que são os contratados acima das vagas); sem lista vigente, as duas ficam "—". Contratados é a coluna de sempre. O arquivo exportado leva as quatro, mesmo com as colunas desligadas, e o ano de cada processo está no número do edital (por exemplo, 80/2025).
**fonte:** interface do Yeendé

## Data de admissão e ciclo na Visão geral

**perguntas:** data de admissao do edital | quando foram admitidos | primeira admissao | ultima admissao | de onde vem a data de admissao | ciclo do edital | qual o ciclo do edital | filtrar por ciclo
**resposta:** As colunas 1ª admissão e Última admissão mostram a primeira e a última data de admissão das pessoas contratadas pelo edital, conferidas com o RH (sistema Impacto) nas planilhas de conciliação. Só entram as admissões que a conciliação comprovou; edital sem admissão comprovada fica "—". O arquivo exportado leva também quantas admissões foram conciliadas. A coluna Ciclo mostra o ciclo do edital (1º ciclo, 2º ciclo...), que também é filtro em "Mais opções"; o ciclo se preenche no formulário do edital, em Editais.
**fonte:** interface do Yeendé

## De onde vêm os KPIs da Visão geral

**perguntas:** de onde vem os kpis da visao geral | de onde vem os indicadores da visao geral | de onde vem os numeros da visao geral | origem dos kpis | kpis do edital | de onde vem os kpis
**resposta:** Os números de cada edital (inscritos, aptos, cancelados, eliminados, reprovados e aprovados na análise, entrevistados e contratados) são recalculados pelo banco no fim de cada carga da Seleção e, de novo, às 10h de Brasília. Valem para todo edital ativo que tem a fonte, com ou sem vaga na Seleção: as vagas da planilha Auditoria ligadas ao edital somadas, a lista de aprovados vigente do edital (Contratado ou Migração), as entrevistas do edital com parecer e as análises com status Aprovado do mesmo número de edital (ou do mesmo nome, para editais sem número, quando o nome é único na área). Sem a fonte, o valor anterior fica. As Vagas e o cronograma continuam vindo do cadastro do edital, em Editais. A Visão geral soma esses números dos editais do recorte.
**fato:** Os KPIs dos editais na Visão geral são recalculados pelo banco no fim de cada carga da Seleção e às 10h de Brasília, para todo edital ativo que tem a fonte (Seleção, lista de aprovados vigente, entrevistas, análises); sem a fonte, o valor anterior fica; as vagas vêm do cadastro do edital.
**fonte:** supabase/migrations/20261002130000_kpis_de_todo_edital_com_fonte.sql; supabase/migrations/20261002090000_kpis_depois_da_carga_da_selecao.sql; src/lib/visao-geral/indicadores-do-monitoramento.ts

## Números da Visão geral que não batem

**perguntas:** por que o numero da visao geral nao bate | kpi da visao geral diferente | contratados diferente da lista de aprovados | numero da visao geral desatualizado | vagas nao batem
**resposta:** Os números de cada edital são recalculados pelo banco no fim de cada carga da Seleção e, de novo, às 10h; entre uma carga e outra, a lista de aprovados pode já ter mudado. Contratadas ficam limitadas às vagas imediatas de cada edital (o excedente vai para Contratações além das vagas imediatas), editais cancelados não entram em nenhum indicador e as Vagas vêm do cadastro do edital, em Editais. Confira também a área atual, os filtros (guardados no navegador) e a busca, que valem para a página toda.
**fonte:** src/lib/visao-geral/indicadores-do-monitoramento.ts; supabase/migrations/20261002130000_kpis_de_todo_edital_com_fonte.sql; supabase/migrations/20261002090000_kpis_depois_da_carga_da_selecao.sql
**abrir:** dashboard

## Quem vê a Visão geral

**perguntas:** quem pode ver a visao geral | nao vejo a visao geral | permissao visao geral | posso editar a visao geral
**resposta:** A Visão geral usa a permissão "Visão geral" (Leitor basta, em Configurações › Acessos), mostra só a área atual e é só de consulta. Para mudar vagas, cronograma ou status de um edital, use Editais (Editor em Editais ou em Cronograma); os rótulos dos indicadores mudam em Configurações › Página inicial. Corrigir coordenadas do mapa de Projetos é do administrador global ou do Gestor; os pontos do mapa da Saúde Indígena se corrigem no SIGEPSI.
**fonte:** src/lib/acessos/access-roles.ts (paginasPermitidas, podeEditarCoordenadas)
**abrir:** dashboard

## Montar relatório da Visão geral

**perguntas:** como gerar relatorio | montar relatorio | exportar relatorio em pdf | relatorio em excel | relatorio da diretoria | escolher colunas do relatorio | exportar csv | vagas por cargo | relatorio com matricula | aprovados com data de admissao
**resposta:** O botão Exportar da Visão geral abre o montador com o que está na tela; o botão "Montar relatório", no topo de Painéis (menu Dados), abre o mesmo montador com todos os editais da área, sem filtros. Escolha um modelo pronto (Resumo rápido, Completo ou Diretoria) ou monte o seu: marque as seções (resumo em números, tabela dos editais, vagas por cargo, aprovados, editais que pedem atenção), as colunas da tabela e o formato. O modelo Diretoria sai em Excel com três abas: Editais (número, unidade, vagas, divulgação, encerramento e ciclo), Vagas por cargo (cada vaga do edital com as vagas imediatas, os inscritos e os aprovados; as vagas imediatas vêm do quadro de vagas do edital ou do texto da vaga, e ficam "—" quando nenhum dos dois tem o número) e Aprovados (edital, cargo, nota, classificação, nome, status, matrícula e data de admissão conciliada com o RH). A seção Aprovados só aparece para quem tem acesso à Lista de aprovados, e cada download fica registrado com o nome de quem baixou. No PDF, acima de 3 mil aprovados, o Yeendé pede o Excel ou um recorte menor. O PDF sai como um documento, com o timbrado da AgSUS, os números, as tabelas e "Página X de Y"; o Excel sai com uma aba por seção; o CSV leva todas as colunas da tabela, como antes. Pela Visão geral, o relatório sai do que está na tela: área, filtros, busca e atalho; por Painéis, sai da área inteira. A última escolha fica guardada neste navegador.
**fonte:** interface do Yeendé

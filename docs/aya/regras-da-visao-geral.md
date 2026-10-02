# Regras da Visão geral

Como a Visão geral (a página inicial de cada área) calcula e filtra. Estas explicações ficavam em
dicas, legendas e textos da própria tela; saíram da interface quando a Visão geral virou módulo do
app em React (Etapa 5, parte 1) e ficam aqui, com a Aya.

## Visão geral

**perguntas:** visao geral | pagina inicial | dashboard | painel inicial | para que serve visao geral | para que serve a visao geral | tela da visao geral
**resposta:** A Visão geral do MONITORA é a mesma página nas três áreas (Saúde Indígena, SEDE e Projetos) e mostra só os editais da área escolhida no menu: os indicadores, os filtros, os próximos 7 dias, os processos críticos (Atenção), o mapa, as fases, o pós-resultado e a tabela de processos. Em Projetos há também "Processos por projeto". Na Saúde Indígena o mapa mostra os DSEIs e as CASAIs; em Projetos, os municípios das vagas; a SEDE não tem mapa.
**fonte:** interface do MONITORA

## Indicadores da Visão geral

**perguntas:** indicadores da visao geral | kpis da visao geral | vagas ociosas da visao geral | kpi vagas imediatas | contratadas | em selecao | cadastro reserva | como fecham os kpis | conta dos indicadores
**resposta:** Na Visão geral, os sete indicadores contam os editais do recorte e fecham entre si: Vagas imediatas = Contratadas + Em seleção + Ociosas. Vagas imediatas é a soma das vagas do cadastro do edital. Contratadas são as contratações de cada edital limitadas às vagas imediatas dele (o que passa disso é Cadastro reserva, mostrado à parte). Em seleção são as vagas ainda sem contratação dos editais sem resultado (em andamento, planejados ou sem cronograma). Ociosas são as vagas sem contratação dos editais com resultado (concluídos ou na fase Contratação). Editais cancelados não entram em nenhum indicador, nem em Inscritos. Críticos conta os editais com algum motivo de atenção e Inscritos soma os inscritos. Os rótulos podem ser trocados em Configurações › Página inicial.
**fato:** Na Visão geral, Vagas imediatas = Contratadas (contratações limitadas às vagas de cada edital) + Em seleção (editais sem resultado) + Ociosas (editais concluídos ou na fase Contratação); contratações além das vagas são Cadastro reserva; cancelados não entram.
**fonte:** src/lib/indicadores-do-monitoramento.js

## Processos críticos

**perguntas:** processos criticos | o que e critico | quando um edital fica critico | criterio de critico | bloco atencao | edital parado | etapa atrasada | contratacao abaixo de 50 | sem inscritos
**resposta:** Na Visão geral, "crítico" é calculado (o risco preenchido no edital não entra). Um edital aberto é crítico quando: o fim do cronograma já passou e o edital não concluiu ("Etapa atrasada há N dias"); está em andamento, sem etapa em curso e sem mudança de etapa (início ou fim de uma etapa do cronograma) há 15 dias ou mais ("Parado há N dias"); ou está em andamento, já depois das inscrições, com 0 inscritos ("Sem inscritos"). Um edital concluído é crítico quando as contratadas ficam abaixo de 50% das vagas imediatas ("Contratação abaixo de 50%"). Cancelado nunca é crítico. Etapa chegando (próxima em até 3 dias) é agenda, não problema: não faz o edital crítico — aparece nas boas-vindas ("N editais têm etapa nos próximos 7 dias") e em vermelho na coluna de cronograma da tabela. O KPI Críticos, os detalhes do processo e a ordem da tabela usam os mesmos motivos; clicar em Críticos filtra a página pelos críticos e clicar de novo tira.
**fato:** Crítico na Visão geral: cronograma vencido sem concluir, parado há 15 dias ou mais, em andamento sem inscritos depois das inscrições, ou concluído com menos de 50% das vagas imediatas contratadas.
**fonte:** src/lib/criticos-da-visao-geral.js

## Filtros da Visão geral

**perguntas:** filtros da visao geral | como funcionam os filtros da visao geral | filtro por ano | filtrar editais de 2026 | busca da tabela da visao geral | limpar filtros da visao geral | filtro de fase
**resposta:** Na Visão geral, os filtros Unidade, Edital e Status ficam à vista e Fase e UF em "Mais opções". Cada filtro aceita vários valores e as opções de um seguem os outros já escolhidos. O campo Ano escolhe de uma vez todos os editais daquele ano (pelo número, como 11/2026); outra escolha de editais aparece como "Seleção própria". A busca da tabela vale para a página toda: indicadores, mapa, blocos e tabela. Os filtros ficam guardados no navegador. Críticos e as pendências do Pós-resultado aparecem como "Recorte" entre os filtros aplicados. "Limpar tudo" apaga filtros, busca, recorte e o DSEI aberto e volta o mapa ao Brasil.
**fonte:** interface do MONITORA

## Mapa e filtros da Visão geral

**perguntas:** dsei aberto no mapa | voltar ao brasil | casai no mapa filtra
**resposta:** Na Visão geral da Saúde Indígena, escolher um DSEI no mapa recorta a página inteira por ele (aparece o filtro "DSEI" entre os filtros aplicados). Tirar esse filtro, ou voltar ao Brasil pelo mapa, sai do território e mantém os outros filtros. Clicar numa CASAI no mapa busca por ela na página.
**fonte:** interface do MONITORA

## Blocos da Visão geral

**perguntas:** proximos 7 dias | agenda da visao geral | fases | fases dos processos | pos-resultado | pos resultado | processos por projeto | blocos da visao geral
**resposta:** Na Visão geral, as boas-vindas dizem quantos editais têm etapa nos próximos 7 dias, com o atalho para o Cronograma; o indicador "Processos Críticos" filtra a tabela pelos críticos, e o motivo aparece nos detalhes de cada processo. "Fases" conta os editais em cada fase fixa — Edital, Inscrições, Análise curricular, Recursos, Entrevistas, Resultado, Contratação e Concluído, mais Cancelado, Sem cronograma e Outra quando houver —, lida do status e da atividade do cronograma; o clique filtra a fase. "Pós-resultado" mostra, nos editais com resultado, os concluídos sem lista de aprovados vigente, as listas sem nenhum status, a contratação abaixo de 50% e as desistências; o clique filtra a página por aquela pendência. Em Projetos, "Processos por projeto" mostra cada projeto com processos, abertos, vagas e contratadas; o clique filtra o projeto.
**fonte:** interface do MONITORA

## Fases dos processos

**perguntas:** como a fase e calculada | de onde vem a fase | fase do edital | etapa e fase
**resposta:** A fase do edital na Visão geral vem primeiro do status (cancelado é Cancelado, concluído é Concluído, planejado é Edital) e, nos demais, do texto da atividade do cronograma (a de hoje, ou a etapa mostrada), sem acento nem caixa: contratação, admissão ou posse é Contratação; prazo ou abertura de recurso é Recursos; resultado final ou homologação do resultado é Resultado; outro recurso é Recursos; entrevista é Entrevistas; análise curricular, documental, títulos, prova ou resultado preliminar é Análise curricular; inscrição é Inscrições; outro resultado é Resultado; edital, impugnação ou publicação é Edital. "Aguardando: X" conta como a fase de X; texto que nenhuma regra reconhece fica em Outra e "Cronograma pendente" em Sem cronograma.
**fonte:** src/lib/fases-do-processo.js

## Tabela de processos da Visão geral

**perguntas:** tabela de processos da visao geral | como leio a tabela de processos | tabela de processos | prazo do edital | proxima etapa do cronograma | colunas da tabela | taxa de vagas sem contratacao
**resposta:** Na tabela de processos da Visão geral, a célula do edital mostra o prazo do edital (encerra em até 7 dias em vermelho, em até 30 dias em amarelo; concluído ou cancelado em cinza) e a situação do cronograma de Editais (atrasada ou próxima etapa em até 3 dias em vermelho, em até 7 dias em amarelo; "Sem cronograma" quando o edital ainda não tem cronograma em Editais). A borda esquerda da linha segue a mesma cor. "Sem contratação" é vagas menos contratados, com a porcentagem das vagas (a partir de 20% em amarelo, de 40% em vermelho). As colunas Fase e Atenção mostram a fase calculada e os motivos de crítico. Sem coluna escolhida, os críticos vêm primeiro (do motivo mais grave: atrasada, prazo, parado, sem inscritos, contratação baixa) e depois quem tem mais vagas sem contratação. Clicar no cabeçalho ordena a coluna (crescente, decrescente e de volta à ordem padrão). "Colunas" escolhe as colunas visíveis, guardadas no navegador. Clicar na linha (ou Enter) abre os detalhes do processo, com o andamento do cronograma, a linha do tempo de Editais e o link do edital. Exportar baixa o CSV do recorte.
**fonte:** interface do MONITORA

## De onde vêm os KPIs da Visão geral

**perguntas:** de onde vem os kpis da visao geral | de onde vem os indicadores da visao geral | de onde vem os numeros da visao geral | origem dos kpis | kpis do edital | de onde vem os kpis
**resposta:** Os números de cada edital (inscritos, aptos, cancelados, eliminados, reprovados e aprovados na análise, entrevistados e contratados) são recalculados pelo banco no fim de cada carga da Seleção e, de novo, às 10h de Brasília. Valem para todo edital ativo que tem a fonte, com ou sem vaga na Seleção: as vagas da planilha Auditoria ligadas ao edital somadas, a lista de aprovados vigente do edital (Contratado ou Migração), as entrevistas do edital com parecer e as análises com status Aprovado do mesmo número de edital (ou do mesmo nome, para editais sem número, quando o nome é único na área). Sem a fonte, o valor anterior fica. As Vagas e o cronograma continuam vindo do cadastro do edital, em Editais. A Visão geral soma esses números dos editais do recorte.
**fato:** Os KPIs dos editais na Visão geral são recalculados pelo banco no fim de cada carga da Seleção e às 10h de Brasília, para todo edital ativo que tem a fonte (Seleção, lista de aprovados vigente, entrevistas, análises); sem a fonte, o valor anterior fica; as vagas vêm do cadastro do edital.
**fonte:** supabase/migrations/20261002130000_kpis_de_todo_edital_com_fonte.sql; supabase/migrations/20261002090000_kpis_depois_da_carga_da_selecao.sql; src/lib/indicadores-do-monitoramento.js

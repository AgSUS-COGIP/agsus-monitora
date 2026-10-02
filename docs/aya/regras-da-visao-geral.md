# Regras da Visão geral

Como a Visão geral (a página inicial de cada área) calcula e filtra. Estas explicações ficavam em
dicas, legendas e textos da própria tela; saíram da interface quando a Visão geral virou módulo do
app em React (Etapa 5, parte 1) e ficam aqui, com a Aya.

## Visão geral

**perguntas:** visao geral | pagina inicial | dashboard | painel inicial | para que serve visao geral | para que serve a visao geral | tela da visao geral
**resposta:** A Visão geral do MONITORA é a mesma página nas três áreas (Saúde Indígena, SEDE e Projetos) e mostra só os editais da área escolhida no menu: os indicadores, os filtros, as unidades com mais de um processo seletivo, o mapa, o resumo por etapa, o status operacional, os processos que pedem atenção e a tabela de processos. Na Saúde Indígena o mapa mostra os DSEIs e as CASAIs; em Projetos, os municípios das vagas; a SEDE não tem mapa.
**fonte:** interface do MONITORA

## Indicadores da Visão geral

**perguntas:** indicadores da visao geral | kpis da visao geral | processos criticos | vagas ociosas da visao geral
**resposta:** Na Visão geral, os seis indicadores contam os editais do recorte: Processos (quantos editais), Vagas (vagas imediatas previstas), Contratações, Vagas ociosas (vagas ainda sem contratação), Críticos (editais abertos com risco Médio ou Alto; concluídos e cancelados não contam) e Inscritos. Sem nenhum filtro, quando a área tem todos os editais da base, os números (menos Críticos, sempre calculado na tela) vêm do resumo calculado no servidor. Clicar em Críticos filtra a página pelos riscos Médio e Alto; clicar de novo tira o filtro. Os rótulos podem ser trocados em Configurações › Página inicial.
**fonte:** interface do MONITORA

## Filtros da Visão geral

**perguntas:** filtros da visao geral | como funcionam os filtros da visao geral | filtro por ano | filtrar editais de 2026 | busca da tabela da visao geral | limpar filtros da visao geral
**resposta:** Na Visão geral, os filtros Unidade, Edital e Status ficam à vista e Etapa, Risco e UF em "Mais opções". Cada filtro aceita vários valores e as opções de um seguem os outros já escolhidos. O campo Ano escolhe de uma vez todos os editais daquele ano (pelo número, como 11/2026); outra escolha de editais aparece como "Seleção própria". A busca da tabela vale para a página toda: indicadores, mapa, blocos e tabela. Os filtros ficam guardados no navegador. "Limpar tudo" apaga filtros, busca e o DSEI aberto e volta o mapa ao Brasil.
**fonte:** interface do MONITORA

## Mapa e filtros da Visão geral

**perguntas:** dsei aberto no mapa | voltar ao brasil | casai no mapa filtra
**resposta:** Na Visão geral da Saúde Indígena, escolher um DSEI no mapa recorta a página inteira por ele (aparece o filtro "DSEI" entre os filtros aplicados). Tirar esse filtro, ou voltar ao Brasil pelo mapa, sai do território e mantém os outros filtros. Clicar numa CASAI no mapa busca por ela na página.
**fonte:** interface do MONITORA

## Blocos da Visão geral

**perguntas:** resumo por etapa | status operacional | unidades com mais de um processo seletivo | bloco atencao
**resposta:** Na Visão geral, o Resumo por etapa conta os editais do recorte em cada etapa, com a porcentagem; clicar numa etapa filtra por ela e clicar de novo tira. O Status operacional agrupa os status (em andamento, concluído, cancelado, planejado, suspenso; sem status é "Cronograma pendente") e a legenda ou a fatia do gráfico filtram por ele. "Unidades com mais de um processo seletivo" mostra as oito unidades com mais editais no recorte; o clique filtra a unidade. "Atenção" lista até 30 editais abertos com risco Médio ou Alto; o clique abre os detalhes do processo.
**fonte:** interface do MONITORA

## Tabela de processos da Visão geral

**perguntas:** tabela de processos da visao geral | como leio a tabela de processos | tabela de processos | prazo do edital | proxima etapa do cronograma | colunas da tabela | taxa de vagas ociosas
**resposta:** Na tabela de processos da Visão geral, a célula do edital mostra o prazo do edital (encerra em até 7 dias em vermelho, em até 30 dias em amarelo; encerrado, concluído ou cancelado em cinza) e a próxima etapa do cronograma de Editais (atrasada ou em até 3 dias em vermelho, em até 7 dias em amarelo; "Sem cronograma" quando o edital ainda não tem cronograma em Editais). A borda esquerda da linha segue a mesma cor. Ao lado das ociosas aparece a porcentagem das vagas que estão ociosas (a partir de 20% em amarelo, de 40% em vermelho). Clicar no cabeçalho ordena a coluna (crescente, decrescente e de volta à ordem padrão: risco, depois ociosas). "Colunas" escolhe as colunas visíveis, guardadas no navegador. Clicar na linha (ou Enter) abre os detalhes do processo, com o andamento do cronograma, a linha do tempo de Editais e o link do edital. Exportar baixa o CSV do recorte.
**fonte:** interface do MONITORA

## De onde vêm os KPIs da Visão geral

**perguntas:** de onde vem os kpis da visao geral | de onde vem os indicadores da visao geral | de onde vem os numeros da visao geral | origem dos kpis | kpis do edital | de onde vem os kpis
**resposta:** Os números de cada edital (inscritos, aptos, cancelados, eliminados, reprovados e aprovados na análise, entrevistados e contratados) são recalculados pelo banco uma vez por dia, às 10h de Brasília (depois da carga da Seleção, às 9h), a partir da Seleção: as vagas da planilha Auditoria somadas por edital, as análises com status Aprovado, as entrevistas com parecer e a lista de aprovados vigente (Contratado ou Migração). Só mudam os editais ativos que têm vaga na Seleção; sem a fonte, o valor anterior fica. As Vagas e o cronograma continuam vindo do cadastro do edital, em Editais. A Visão geral soma esses números dos editais do recorte; sem nenhum filtro, usa o resumo calculado no servidor.
**fato:** Os KPIs dos editais na Visão geral são recalculados pelo banco uma vez por dia, às 10h de Brasília (depois da carga da Seleção, às 9h), a partir da Seleção, das análises, das entrevistas e da lista de aprovados; as vagas vêm do cadastro do edital.
**fonte:** supabase/migrations/20260930235800_kpis_do_edital_pela_selecao.sql; supabase/migrations/20260930235900_kpis_uma_vez_por_dia.sql; src/lib/visao-geral.js

# Regras dos Relatórios

A página Relatórios (antes Painéis; view `paineis-de-dados`, endereço `/<área>/relatorios`), no
bloco Dados do menu de cada área: os relatórios de acompanhamento e gestão que cruzam editais, num
catálogo de cartões, para ver em tabela e baixar em Excel e PDF. Fontes:
`src/modulos/paineis-de-dados/`, `src/lib/paineis/catalogo-dos-relatorios.ts`,
`src/componentes/ver-em-relatorios.tsx`,
`src/lib/paineis/relatorios-dos-paineis.ts` e as migrations `20261113200000_paineis_no_bloco_dados.sql`
(a aba e a permissão), `20261116160000_relatorios_dos_paineis_prontos.sql` (os relatórios prontos e a
leitura paginada) e `20261123180000_aba_paineis_vira_relatorios.sql` (o nome Relatórios no menu).

## Página Relatórios

**perguntas:** relatorios | pagina relatorios | para que serve relatorios | para que serve a pagina relatorios | paineis | pagina paineis | para que serve paineis | bloco dados | relatorios de gestao | relatorios de acompanhamento | catalogo de relatorios | onde ficaram os paineis
**resposta:** A página Relatórios, no bloco Dados do menu (antes se chamava Painéis), reúne os relatórios de acompanhamento e gestão da área escolhida, que cruzam editais. Ela abre num catálogo de cartões, em grupos: Editais (Resumo dos editais, Editais por cargo e Montar relatório) e Aprovados (Aprovados, Resumo por cargo e status e Relatório da diretoria). Cada cartão diz o que o relatório mostra e quando foi calculado; os calculados no banco mostram quantas linhas têm e já exportam o relatório inteiro por "Exportar em Excel" ou "Salvar em PDF". Montar relatório abre o montador (seções, colunas e formato); o Relatório da diretoria sai direto do cartão; o Resumo por cargo e status só aparece para quem tem acesso à Lista de aprovados. A Visão geral e a Lista de aprovados têm o botão "Ver em Relatórios", que abre o relatório que saiu delas já no recorte da tela. "Abrir" mostra a tabela, com "Todos os relatórios" para voltar ao catálogo; o endereço guarda o relatório aberto, então o link copiado abre direto nele, e o link antigo de Painéis continua funcionando. O sistema recalcula os relatórios de hora em hora; o botão Sincronizar, no topo, recalcula na hora o relatório aberto, ou todos quando o catálogo está à vista (no máximo uma vez por minuto cada um). O ícone de informação ao lado dos botões diz de onde vêm os dados de cada relatório. Os documentos de uma etapa, como o resultado da Classificação e as cartas de convocação, continuam na tela da etapa. Quem vê é quem o administrador libera em Relatórios, na tela de Acessos.
**fonte:** src/modulos/paineis-de-dados/; src/lib/paineis/catalogo-dos-relatorios.ts
**abrir:** paineis-de-dados

## Resumo dos editais

**perguntas:** resumo dos editais | data da divulgacao do edital | data final do processo seletivo | vagas imediatas do edital
**resposta:** Em Relatórios, o Resumo dos editais traz uma linha por edital ativo da área: número, DSEI ou unidade, total de vagas imediatas (as do cadastro do edital), data da divulgação e data final do processo seletivo. A data da divulgação é o início da primeira etapa do cronograma, e a data final é o fim da última etapa; sem cronograma, valem as datas do cadastro do edital. Editais de treinamento não entram.
**fonte:** supabase/migrations/20261116160000_relatorios_dos_paineis_prontos.sql

## Editais por cargo

**perguntas:** editais por cargo | inscritos por cargo | aprovados por cargo | de onde vem as vagas por cargo | vagas imediatas do titulo da vaga | vagas imediatas vazias | quadro de vagas no relatorio
**resposta:** Em Relatórios, Editais por cargo traz uma linha por vaga de cada edital (na Saúde Indígena, uma vaga é um cargo num DSEI): o código da vaga, o cargo, as vagas imediatas, os inscritos da Seleção e os aprovados da lista de aprovados vigente. Inscritos e aprovados se casam pelo código da vaga, como no Painel da Seleção; nas vagas de outras bancas, sem código, pelo nome da vaga. As vagas imediatas vêm, nesta ordem, do quadro de vagas do edital (como na Classificação), da convocação da Lista de aprovados, do local da vaga publicado no edital ou do número no título da vaga ("2 vagas (1 AC + …)" conta 2; "Cadastro Reserva" conta 0). Célula vazia quer dizer que o edital não tem quadro de vagas importado nem convocação configurada para aquela vaga. Aprovados de uma vaga que a Seleção não tem saem numa linha própria, e o edital sem vaga na Seleção sai numa linha só, com os inscritos do edital. Aprovados vazio quer dizer edital sem lista de aprovados.
**fonte:** supabase/migrations/20261116180000_vagas_imediatas_dos_paineis_pelo_quadro.sql

## Fontes dos dados

**perguntas:** fontes dos dados | fonte da coluna | trocar a fonte | de onde vem a coluna | mudar a origem dos dados | escolher fonte | asterisco no cabecalho
**resposta:** Em Relatórios, com um relatório aberto, o botão Fontes dos dados mostra, para esse relatório e a área escolhida no menu, de onde vem cada coluna que pode trocar de origem (vagas, datas, inscritos, aprovados, nota, classificação, status, matrícula e data de admissão). Quem é Administrador em Relatórios escolhe outra fonte, entre as conferidas que o sistema lista (por exemplo, as vagas da convocação ou o quadro de vagas do edital), informa o motivo e salva; ou volta ao padrão. A escolha vale só para aquela área, e cada troca fica no histórico com quem, quando e o motivo. Coluna com fonte diferente do padrão aparece com um asterisco no cabeçalho, com a fonte na dica, e o XLSX traz a aba Fontes. Se a fonte não tiver o dado de uma linha, a célula fica vazia; com fonte diferente do padrão, os totais entre os relatórios podem não fechar. Ninguém escreve SQL: fonte nova é criada pela equipe de desenvolvimento.
**fonte:** src/modulos/paineis-de-dados/fontes-dos-dados.tsx; supabase/migrations/20261113220000_fontes_das_colunas_dos_paineis.sql
**abrir:** paineis-de-dados

## Relatório da diretoria

**perguntas:** relatorio da diretoria em relatorios | cartao da diretoria | baixar relatorio da diretoria | diferenca entre aprovados e diretoria | duas datas de admissao | admissao conciliada com o rh
**resposta:** Em Relatórios, o cartão "Relatório da diretoria" (grupo Aprovados) gera direto, em Excel ou PDF, o modelo Diretoria com os editais da área: Editais, Vagas por cargo e Aprovados. Ele convive com os cartões Editais por cargo e Aprovados, que contam parecido por regras diferentes, e cada cartão diz a sua: no Relatório da diretoria, a data de admissão é a conciliada com o RH e cada download fica registrado com o nome de quem baixou; no relatório Aprovados, é o dia em que o aprovado virou Contratado no sistema. Editais por cargo é calculado no banco, com os aprovados casados pelo código da vaga; as vagas por cargo da diretoria são ligadas na hora de gerar. A aba Aprovados da diretoria só sai para quem tem acesso à Lista de aprovados. Unificar as duas regras depende de decisão da equipe.
**fonte:** src/lib/paineis/catalogo-dos-relatorios.ts; src/modulos/paineis-de-dados/gerar-relatorio.ts; src/lib/paineis/relatorio-da-diretoria.ts
**abrir:** paineis-de-dados

## Gráficos no relatório

**perguntas:** grafico no relatorio | relatorio com graficos | montar relatorio com grafico | grafico no pdf | grafico no excel | vagas por unidade | editais por fase | contratacoes por mes | situacao dos aprovados | previa do grafico | carregar previa
**resposta:** No montador de relatório (cartão "Montar relatório", em Relatórios), o grupo Gráficos tem quatro caixas: Vagas × contratadas por unidade (barras por DSEI ou unidade, com o preenchimento das vagas imediatas), Editais por fase (os editais em andamento de Inscrições a Resultado, como o "Em andamento, por fase" da Visão geral), Contratações por mês (linha com as admissões conciliadas com o RH dos aprovados contratados) e Situação dos aprovados (barras empilhadas por edital com Contratado, Convocado, Desistente e Reserva, que é quem ainda não tem status). Os gráficos seguem o mesmo recorte do relatório. Ao marcar um gráfico, a miniatura aparece logo abaixo; os dois dos aprovados só aparecem para quem tem acesso à Lista de aprovados, e a miniatura deles carrega no botão "Carregar prévia", porque a leitura dos aprovados fica registrada com o nome de quem pediu (a geração reaproveita essa leitura no mesmo formato). No PDF, cada gráfico sai como imagem, depois dos números, com o título em cima e a fonte embaixo. No Excel, cada gráfico vira uma aba com a tabela dos números dele: a planilha gerada pelo Yeendé não desenha gráfico, e o desenho fica no PDF. O CSV não leva gráficos.
**fonte:** src/lib/paineis/graficos-do-relatorio.ts; src/modulos/paineis-de-dados/graficos-do-relatorio.tsx; src/modulos/paineis-de-dados/montador-de-relatorio.tsx
**abrir:** paineis-de-dados

## Ver em Relatórios

**perguntas:** ver em relatorios | botao ver em relatorios | sumiu a aba do resumo | atalho para relatorios
**resposta:** O botão "Ver em Relatórios" leva ao relatório que saiu de uma tela, já no recorte dela: na Visão geral, abre o montador de relatório com os filtros, a busca e o atalho que estavam na tela; na Lista de aprovados (topo da aba Aprovados), abre o Resumo por cargo e status nos editais escolhidos. O montador e o Resumo por cargo moraram nessas telas até 23/11/2026; a Visão geral continua exportando a tabela em Excel e PDF. O botão só aparece para quem tem acesso a Relatórios. O endereço guarda o relatório aberto (e os editais do Resumo), então o link copiado abre do mesmo jeito.
**fonte:** src/componentes/ver-em-relatorios.tsx; src/modulos/paineis-de-dados/paineis-de-dados.tsx
**abrir:** paineis-de-dados

## Aprovados em Relatórios

**perguntas:** aprovados nos relatorios | aprovados nos paineis | relatorio de aprovados | data de admissao | matricula dos aprovados
**resposta:** Em Relatórios, o relatório Aprovados traz uma linha por candidato da lista de aprovados vigente de cada edital da área: edital, cargo da vaga, nota, classificação, nome, status, matrícula e data de admissão. O sistema não guarda a data real de admissão: a coluna mostra a data em que o status atual (Contratado ou Migração) foi registrado no sistema, e fica vazia para os outros status.
**fonte:** supabase/migrations/20261116160000_relatorios_dos_paineis_prontos.sql

## Largura das colunas

**perguntas:** largura da coluna | aumentar coluna | diminuir coluna | arrastar coluna | coluna estreita | coluna larga
**resposta:** Nas tabelas de Relatórios, arraste a borda direita do cabeçalho de uma coluna para alargar ou estreitar a coluna; com o teclado, leve o foco até a borda e use as setas para a esquerda e para a direita. A largura vale enquanto a página estiver aberta, inclusive ao trocar de página ou de relatório; ao recarregar a página, as colunas voltam ao tamanho original.
**fonte:** src/modulos/paineis-de-dados/paineis-de-dados.tsx
**abrir:** paineis-de-dados

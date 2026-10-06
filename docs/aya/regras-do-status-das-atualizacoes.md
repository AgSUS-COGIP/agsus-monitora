# Regras do Status das atualizações

Configurações › Status das atualizações: quando rodou cada carga de dados, o que atrasou e o que
falhou. Fontes: `src/componentes/saude-das-cargas/`, `src/lib/saude-das-cargas.js` e a migration
`20261001120000_saude_das_cargas.sql`.

## Seção Status das atualizações

**perguntas:** o que e o status das atualizacoes | status das atualizacoes | para que serve status das atualizacoes | para que serve a secao status das atualizacoes | saude das cargas
**resposta:** Em Configurações › Status das atualizações (só o administrador global) aparece, para cada carga de dados, a última execução e um selo: "Falhou" (a execução terminada mais recente deu erro), "Em andamento", "Atrasada" (a última que deu certo passou do prazo), "Em dia" ou "Ainda sem carga". Mostra as 10 últimas execuções de cada uma.
**fonte:** src/lib/saude-das-cargas.js; supabase/migrations/20261001120000_saude_das_cargas.sql
**abrir:** config:cargas

## Horários das atualizações

**perguntas:** quando cada atualizacao de dados roda | horarios das atualizacoes | quando os dados sao atualizados | carga atrasada | cargas de dados
**resposta:** As análises curriculares chegam pelo Apps Script das planilhas (o envio incremental é esperado a cada 20 minutos e fica "Atrasada" depois de 1 hora; a carga completa não tem prazo). Entrevistas e Seleção carregam pelo GitHub Actions de hora em hora, das 7h às 19h de Brasília, e ficam atrasadas depois de 4 horas durante o dia (à noite, sem carga, só depois de 14 horas). O robô da Empregare não tem agenda: roda só quando um administrador clica em "Rodar agora", por isso nunca fica "Atrasado". As conferências de consistência rodam todo dia às 6h de Brasília e ficam atrasadas depois de 26 horas. A pré-classificação da Avaliação documental roda no fim de cada carga do robô da Empregare e no Recalcular da coordenação, sem agenda, por isso também nunca fica "Atrasada". As tarefas do banco que rodam a cada 2 minutos (como o pacote do painel de análises e o das entrevistas) atrasam depois de 15 minutos; as diárias, depois de 26 horas; as mensais, depois de 32 dias. Os KPIs dos editais são recalculados às 10h de Brasília, depois da carga da Seleção.
**fonte:** src/lib/saude-das-cargas.js; supabase/migrations/20261001120000_saude_das_cargas.sql; supabase/migrations/20260930235900_kpis_uma_vez_por_dia.sql

## Rodar agora

**perguntas:** rodar agora | como rodar a carga agora | rodar a carga agora | botao rodar agora | rodar a selecao agora | rodar as entrevistas agora | rodar o robo da empregare agora | rodar as conferencias agora | rodar a pre-classificacao agora | atualizar agora sem esperar
**resposta:** Em Configurações › Status das atualizações, o administrador global vê o botão "Rodar agora" nas linhas Robô da Empregare, Conferências de consistência, Pré-classificação (Avaliação documental), Seleção e Entrevistas. Na pré-classificação, o Rodar agora recalcula todos os editais ativos com vagas da Empregare; a coordenação de um edital usa o Recalcular da aba Pré-classificação. O clique pede ao GitHub Actions a execução do workflow daquela carga, em modo normal, e registra quem pediu. O botão fica desabilitado enquanto a carga roda (no GitHub ou no registro do banco) e por 3 minutos depois do pedido, até a execução aparecer. A nova execução entra na lista em alguns minutos; o robô da Empregare pode levar mais de meia hora.
**fonte:** src/lib/robos-de-carga.js; api/rodar-carga.js; docs/robo-empregare.md
**abrir:** config:cargas

## Rodar agora desabilitado

**perguntas:** rodar agora desabilitado | botao rodar agora nao funciona | falta configurar github_dispatch_token | github dispatch token | rodar agora so na versao publicada | rodar agora pedido enviado
**resposta:** "Falta configurar GITHUB_DISPATCH_TOKEN na Vercel" quer dizer que a Vercel não tem o token que deixa o MONITORA pedir execuções ao GitHub: crie um fine-grained token só com "Actions: read and write" no repositório agsus-monitora e cadastre como GITHUB_DISPATCH_TOKEN nas variáveis da Vercel. "Só na versão publicada" aparece fora da Vercel (no computador, a função não existe). "Rodando…" e "Pedido enviado" são esperados: a carga está na fila ou rodando. O estado e o histórico continuam visíveis em todos os casos.
**fonte:** docs/robo-empregare.md; api/rodar-carga.js
**abrir:** config:cargas

## Robô da Empregare

**perguntas:** robo da empregare | o que e o robo da empregare | candidatos da empregare | carga da empregare | exportacao da empregare | excel da empregare | robo empregare falhou | robo da empregare parcial
**resposta:** A Empregare não tem API, então um robô entra no portal da empresa, pede a exportação "Candidatos da vaga (Excel)" de cada vaga dos editais ativos em curso (as vagas vêm do quadro de vagas do edital e, nos editais antigos, da Seleção), baixa os arquivos e grava os candidatos no MONITORA, com todas as colunas e respostas do questionário. Uma vaga cujo arquivo traz menos da metade dos candidatos que já tinha é recusada (nada muda nela) e quem sai do arquivo fica inativo, sem ser apagado. "Falhou" na linha do robô pode ser falha geral (por exemplo, login recusado) ou execução parcial (alguma vaga não baixou ou foi recusada); a mensagem traz as contagens de vagas pedidas, baixadas, com falha e recusadas.
**fonte:** docs/robo-empregare.md; supabase/migrations/20261005170000_robo_empregare.sql; supabase/migrations/20261006080000_robo_empregare_vagas_do_quadro.sql
**abrir:** config:cargas

## Vagas do robô da Empregare

**perguntas:** de onde vem as vagas do robo da empregare | quais vagas o robo da empregare exporta | robo da empregare nao trouxe o edital | edital sem candidatos da empregare | vaga fora da selecao no robo | quadro de vagas no robo da empregare
**resposta:** O robô escolhe as vagas no próprio MONITORA, sem depender da planilha Auditoria. A fonte principal é o quadro de vagas do edital: em todo edital com quadro salvo, entram os códigos de vaga da Empregare das análises daquele edital (o mesmo vínculo vaga → linha do quadro da Classificação). A Seleção (planilha Auditoria) continua como segunda fonte, para os editais antigos; um código que está nas duas entra uma vez só, ligado ao edital do quadro. Sem filtro, entram as vagas dos editais ativos e em curso; pelo GitHub dá para pedir editais ou códigos. Edital sem quadro e fora da Seleção não entra: salve o quadro de vagas do edital ou rode pelo GitHub com os códigos.
**fonte:** docs/robo-empregare.md; supabase/migrations/20261006080000_robo_empregare_vagas_do_quadro.sql
**abrir:** config:cargas

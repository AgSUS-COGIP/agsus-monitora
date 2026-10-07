# Regras do Status das atualizações

Configurações › Status das atualizações: quando rodou cada carga de dados, o que atrasou e o que
falhou. Fontes: `src/componentes/saude-das-cargas/`, `src/lib/saude-das-cargas.js` e a migration
`20261001120000_saude_das_cargas.sql`.

## Seção Status das atualizações

**perguntas:** o que e o status das atualizacoes | status das atualizacoes | para que serve status das atualizacoes | para que serve a secao status das atualizacoes | saude das cargas | quem ve o status das atualizacoes | nao vejo status das atualizacoes
**resposta:** Em Configurações › Status das atualizações (só o administrador global) aparece, para cada carga de dados, a última execução e um selo: "Falhou" (a execução terminada mais recente deu erro), "Em andamento", "Atrasada" (a última que deu certo passou do prazo), "Em dia" ou "Ainda sem carga". Mostra as 10 últimas execuções de cada uma.
**fonte:** src/lib/saude-das-cargas.js; supabase/migrations/20261001120000_saude_das_cargas.sql
**abrir:** config:cargas

## Horários das atualizações

**perguntas:** quando cada atualizacao de dados roda | horarios das atualizacoes | quando os dados sao atualizados | carga atrasada | cargas de dados
**resposta:** As análises curriculares chegam pelo Apps Script das planilhas (o envio incremental é esperado a cada 20 minutos e fica "Atrasada" depois de 1 hora; a carga completa não tem prazo). Seleção e Entrevistas carregam pelo GitHub Actions de hora em hora, o dia todo, e ficam atrasadas depois de 4 horas. O robô da Empregare não tem agenda: roda só quando um administrador clica em "Rodar agora", por isso nunca fica "Atrasado". As tarefas do banco que rodam a cada 2 minutos (como o pacote do painel de análises e o das entrevistas) atrasam depois de 15 minutos; as diárias, depois de 26 horas; as mensais, depois de 32 dias. As conferências de consistência rodam todo dia às 6h de Brasília e ficam atrasadas depois de 26 horas. A pré-classificação da Avaliação documental roda no fim de cada carga do robô da Empregare e no Recalcular da coordenação, sem agenda, por isso também nunca fica "Atrasada". A retenção das mensagens do chat roda todo dia às 3h15 de Brasília. Os KPIs dos editais são recalculados no fim de cada carga da Seleção e, de novo, às 10h de Brasília.
**fonte:** src/lib/saude-das-cargas.js; supabase/migrations/20261001120000_saude_das_cargas.sql; supabase/migrations/20261002090000_kpis_depois_da_carga_da_selecao.sql; supabase/migrations/20261002130000_kpis_de_todo_edital_com_fonte.sql; .github/workflows/sincronizar-selecao.yml; .github/workflows/sincronizar-entrevistas.yml; supabase/migrations/20260930235900_kpis_uma_vez_por_dia.sql

## Rodar agora

**perguntas:** rodar agora | como rodar a carga agora | rodar a carga agora | botao rodar agora | rodar a selecao agora | rodar as entrevistas agora | rodar o robo da empregare agora | rodar as conferencias agora | rodar a pre-classificacao agora | atualizar agora sem esperar
**resposta:** Em Configurações › Status das atualizações, o administrador global vê o botão "Rodar agora" nas linhas Robô da Empregare, Conferências de consistência, Pré-classificação (Avaliação documental), Seleção e Entrevistas. Na pré-classificação, o Rodar agora recalcula todos os editais ativos com vagas da Empregare; a coordenação de um edital usa o Recalcular da aba Pré-classificação. O clique pede ao GitHub Actions a execução do workflow daquela carga, em modo normal, e registra quem pediu; para escolher editais, vagas, modo ou limite, use "Opções". O botão fica desabilitado enquanto a carga roda (no GitHub ou no registro do banco) e por 3 minutos depois do pedido, até a execução aparecer. A nova execução entra na lista em alguns minutos; o robô da Empregare pode levar mais de meia hora.
**fonte:** src/lib/robos-de-carga.js; api/rodar-carga.js; docs/robo-empregare.md
**abrir:** config:cargas

## Rodar um robô com opções

**perguntas:** rodar um robo com opcoes | rodar com opcoes | opcoes do robo | rodar o robo para um edital | rodar o robo da empregare para um edital | rodar so algumas vagas | rodar codigos de vaga | rodar a vaga 179698 | escolher edital do robo | modo seco | modo fumaca | modo forcar | refazer lote | limite de vagas do robo | previa do robo | quem rodou o robo | ultimas execucoes do robo | acompanhar o robo
**resposta:** Em Configurações › Status das atualizações, o administrador global tem o botão "Opções" nas linhas Robô da Empregare, Pré-classificação e Conferências de consistência. Ele abre uma gaveta para rodar com escolhas: editais (com busca e filtro por área; aparecem só os vigentes, e "Mostrar todos" traz os encerrados e cancelados), códigos de vaga da Empregare (cole a lista separada por vírgula, espaço ou linha; só dígitos — o que tiver letra é recusado; ao escolher o edital aparecem as vagas conhecidas dele com o cargo, e "Adicionar todas" põe todas), modo e limite de vagas (de 1 a 500; padrão 60). No robô da Empregare, os modos são: Normal (exporta, baixa e grava), Seco (só lista as vagas que exportaria, sem entrar na Empregare), Fumaça (só testa o login) e Forçar (grava mesmo se o arquivo vier com menos da metade dos candidatos). Na pré-classificação: Normal, Seco (calcula sem gravar) e Refazer lote (recorta o lote do zero, só antes das fichas). Nas conferências: Normal e Seco. Com códigos de vaga, o robô roda só os códigos; o edital escolhido serve para as sugestões. Antes de confirmar, "Vai rodar" mostra a prévia, como "5 vagas do 93/2026: 179698, 180231…", e avisa quando o limite corta (ficam as vagas nunca carregadas ou carregadas há mais tempo). Depois do pedido, a linha acompanha: "Pedido enviado. Aguardando o GitHub", depois "Rodando" e o resultado por vaga (gravada, candidatos no arquivo, ativos e quantos com link da Empregare), com o link da execução no GitHub. O modo seco e o fumaça não gravam no banco: o resultado fica no resumo da execução no GitHub. Em "Detalhes", o robô da Empregare e a pré-classificação mostram as 8 últimas execuções com quem pediu, os parâmetros usados e o resultado. A coordenação de um edital continua usando o Recalcular da aba Pré-classificação.
**fonte:** src/lib/robos-de-carga.js; src/lib/painel-dos-robos.js; api/rodar-carga.js; supabase/migrations/20261007190000_painel_dos_robos.sql; docs/robo-empregare.md
**abrir:** config:cargas

## Rodar agora desabilitado

**perguntas:** rodar agora desabilitado | botao rodar agora nao funciona | falta configurar github_dispatch_token | github dispatch token | rodar agora so na versao publicada | rodar agora pedido enviado
**resposta:** "Falta configurar GITHUB_DISPATCH_TOKEN na Vercel" quer dizer que a Vercel não tem o token que deixa o MONITORA pedir execuções ao GitHub: crie um fine-grained token só com "Actions: read and write" no repositório agsus-monitora e cadastre como GITHUB_DISPATCH_TOKEN nas variáveis da Vercel. "Só na versão publicada" aparece fora da Vercel (no computador, a função não existe). "Rodando…" e "Pedido enviado" são esperados: a carga está na fila ou rodando. O estado e o histórico continuam visíveis em todos os casos.
**fonte:** docs/robo-empregare.md; api/rodar-carga.js
**abrir:** config:cargas

## Robô da Empregare

**perguntas:** robo da empregare | o que e o robo da empregare | candidatos da empregare | carga da empregare | exportacao da empregare | excel da empregare | robo empregare falhou | robo da empregare parcial
**resposta:** A Empregare não tem API, então um robô entra no portal da empresa, pede a exportação "Candidatos da vaga (Excel)" de cada vaga dos editais ativos em curso (as vagas vêm do quadro de vagas do edital e, nos editais antigos, da Seleção), baixa os arquivos e grava os candidatos no MONITORA, com todas as colunas e respostas do questionário. Uma vaga cujo arquivo traz menos da metade dos candidatos que já tinha é recusada (nada muda nela) e quem sai do arquivo fica inativo, sem ser apagado. "Falhou" na linha do robô pode ser falha geral (por exemplo, login recusado) ou execução parcial (alguma vaga não baixou ou foi recusada); a mensagem traz as contagens de vagas pedidas, baixadas, com falha e recusadas. Ele não tem agenda automática: roda só quando o administrador global clica em "Rodar agora".
**fonte:** docs/robo-empregare.md; supabase/migrations/20261005170000_robo_empregare.sql; supabase/migrations/20261006080000_robo_empregare_vagas_do_quadro.sql
**abrir:** config:cargas

## Vagas do robô da Empregare

**perguntas:** de onde vem as vagas do robo da empregare | quais vagas o robo da empregare exporta | robo da empregare nao trouxe o edital | edital sem candidatos da empregare | vaga fora da selecao no robo | quadro de vagas no robo da empregare
**resposta:** O robô escolhe as vagas no próprio MONITORA, sem depender da planilha Auditoria. A fonte principal é o quadro de vagas do edital: em todo edital com quadro salvo, entram os códigos de vaga da Empregare das análises daquele edital (o mesmo vínculo vaga → linha do quadro da Classificação). A Seleção (planilha Auditoria) continua como segunda fonte, para os editais antigos; um código que está nas duas entra uma vez só, ligado ao edital do quadro. Sem filtro, entram as vagas dos editais ativos e em curso; pelo botão "Opções" (ou pelo GitHub) dá para pedir editais ou códigos. Edital sem quadro e fora da Seleção não entra: salve o quadro de vagas do edital ou rode pelo "Opções" com os códigos.
**fonte:** docs/robo-empregare.md; supabase/migrations/20261006080000_robo_empregare_vagas_do_quadro.sql
**abrir:** config:cargas

## Carga com falha ou atrasada

**perguntas:** carga falhou o que fazer | o que fazer quando a carga falha | selo falhou | carga recusada
**resposta:** Veja as últimas execuções da linha e a mensagem da que falhou. Uma carga recusada (planilha com menos da metade das linhas, ou vaga da Empregare com menos da metade dos candidatos) não mudou nada: os dados de antes continuam na tela. Em Seleção, Entrevistas e no robô da Empregare, depois de corrigir a causa, o administrador global pode usar "Rodar agora"; as análises não têm esse botão, porque o envio sai do Apps Script de cada planilha. Atrasada quer dizer que a última execução que deu certo passou do prazo da carga.
**fonte:** src/lib/saude-das-cargas.js; src/lib/robos-de-carga.js; docs/sincronizacao-das-planilhas.md
**abrir:** config:cargas

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
**resposta:** As análises curriculares chegam pelo Apps Script das planilhas (o envio incremental é esperado a cada 20 minutos e fica "Atrasada" depois de 1 hora; a carga completa não tem prazo). Entrevistas e Seleção carregam pelo GitHub Actions de hora em hora, das 7h às 19h de Brasília, e ficam atrasadas depois de 4 horas durante o dia (à noite, sem carga, só depois de 14 horas). O robô da Empregare não tem agenda: roda só quando um administrador clica em "Rodar agora", por isso nunca fica "Atrasado". As tarefas do banco que rodam a cada 2 minutos (como o pacote do painel de análises e o das entrevistas) atrasam depois de 15 minutos; as diárias, depois de 26 horas; as mensais, depois de 32 dias. A retenção das mensagens do chat roda todo dia às 3h15 de Brasília. Os KPIs dos editais são recalculados no fim de cada carga da Seleção e, de novo, às 10h de Brasília.
**fonte:** src/lib/saude-das-cargas.js; supabase/migrations/20261001120000_saude_das_cargas.sql; supabase/migrations/20261002090000_kpis_depois_da_carga_da_selecao.sql; supabase/migrations/20261002130000_kpis_de_todo_edital_com_fonte.sql; .github/workflows/sincronizar-selecao.yml; .github/workflows/sincronizar-entrevistas.yml

## Rodar agora

**perguntas:** rodar agora | como rodar a carga agora | rodar a carga agora | botao rodar agora | rodar a selecao agora | rodar as entrevistas agora | rodar o robo da empregare agora | atualizar agora sem esperar
**resposta:** Em Configurações › Status das atualizações, o administrador global vê o botão "Rodar agora" nas linhas Robô da Empregare, Seleção e Entrevistas. O clique pede ao GitHub Actions a execução do workflow daquela carga, em modo normal, e registra quem pediu. O botão fica desabilitado enquanto a carga roda (no GitHub ou no registro do banco) e por 3 minutos depois do pedido, até a execução aparecer. A nova execução entra na lista em alguns minutos; o robô da Empregare pode levar mais de meia hora.
**fonte:** src/lib/robos-de-carga.js; api/rodar-carga.js; docs/robo-empregare.md
**abrir:** config:cargas

## Rodar agora desabilitado

**perguntas:** rodar agora desabilitado | botao rodar agora nao funciona | falta configurar github_dispatch_token | github dispatch token | rodar agora so na versao publicada | rodar agora pedido enviado
**resposta:** "Falta configurar GITHUB_DISPATCH_TOKEN na Vercel" quer dizer que a Vercel não tem o token que deixa o MONITORA pedir execuções ao GitHub: crie um fine-grained token só com "Actions: read and write" no repositório agsus-monitora e cadastre como GITHUB_DISPATCH_TOKEN nas variáveis da Vercel. "Só na versão publicada" aparece fora da Vercel (no computador, a função não existe). "Rodando…" e "Pedido enviado" são esperados: a carga está na fila ou rodando. O estado e o histórico continuam visíveis em todos os casos.
**fonte:** docs/robo-empregare.md; api/rodar-carga.js
**abrir:** config:cargas

## Robô da Empregare

**perguntas:** robo da empregare | o que e o robo da empregare | candidatos da empregare | carga da empregare | exportacao da empregare | excel da empregare | robo empregare falhou | robo da empregare parcial | quais vagas o robo da empregare baixa | por que o robo nao rodou | robo nao roda sozinho | agenda do robo da empregare
**resposta:** A Empregare não tem API, então um robô entra no portal da empresa, pede a exportação "Candidatos da vaga (Excel)" de cada vaga, baixa os arquivos e grava os candidatos no MONITORA, com todas as colunas e respostas do questionário. Ele não tem agenda automática: roda só quando o administrador global clica em "Rodar agora". Sem filtro, pega as vagas ativas com código da Seleção cujo edital está ativo e em curso (sem cronograma ou com alguma etapa terminando há no máximo 30 dias), até 60 por execução, começando pelas nunca carregadas ou carregadas há mais tempo. Uma vaga cujo arquivo traz menos da metade dos candidatos que já tinha é recusada (nada muda nela) e quem sai do arquivo fica inativo, sem ser apagado. "Falhou" na linha do robô pode ser falha geral (por exemplo, login recusado) ou execução parcial (alguma vaga não baixou ou foi recusada); a mensagem traz as contagens de vagas pedidas, baixadas, com falha e recusadas.
**fonte:** docs/robo-empregare.md; supabase/migrations/20261005170000_robo_empregare.sql
**abrir:** config:cargas

## Carga com falha ou atrasada

**perguntas:** carga falhou o que fazer | o que fazer quando a carga falha | selo falhou | carga recusada
**resposta:** Veja as últimas execuções da linha e a mensagem da que falhou. Uma carga recusada (planilha com menos da metade das linhas, ou vaga da Empregare com menos da metade dos candidatos) não mudou nada: os dados de antes continuam na tela. Em Seleção, Entrevistas e no robô da Empregare, depois de corrigir a causa, o administrador global pode usar "Rodar agora"; as análises não têm esse botão, porque o envio sai do Apps Script de cada planilha. Atrasada quer dizer que a última execução que deu certo passou do prazo da carga.
**fonte:** src/lib/saude-das-cargas.js; src/lib/robos-de-carga.js; docs/sincronizacao-das-planilhas.md
**abrir:** config:cargas

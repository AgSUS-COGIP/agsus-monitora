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
**resposta:** As análises curriculares chegam pelo Apps Script das planilhas (o envio incremental é esperado a cada 20 minutos e fica "Atrasada" depois de 1 hora; a carga completa não tem prazo). Entrevistas e Seleção carregam pelo GitHub Actions às 9h de Brasília e ficam atrasadas depois de 26 horas. As tarefas do banco que rodam a cada 2 minutos (como o pacote do painel de análises e o das entrevistas) atrasam depois de 15 minutos; as diárias, depois de 26 horas; as mensais, depois de 32 dias. Os KPIs dos editais são recalculados às 10h de Brasília, depois da carga da Seleção.
**fonte:** src/lib/saude-das-cargas.js; supabase/migrations/20261001120000_saude_das_cargas.sql; supabase/migrations/20260930235900_kpis_uma_vez_por_dia.sql

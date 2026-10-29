# Regras da Automação

Configurações › Automação: uma chave por aba liga e desliga o que roda sozinho. Fontes:
`src/modulos/automacao/`, `src/lib/chaves-da-automacao.ts` e a migration
`20261022190000_chaves_da_automacao.sql`.

## Seção Automação

**perguntas:** secao automacao | automacao | para que serve automacao | para que serve a secao automacao | chaves da automacao | o que as chaves da automacao desligam | desligar a automacao | ligar a automacao | desligar a sincronizacao | pausar a sincronizacao
**resposta:** Em Configurações › Automação (só o administrador global), cada aba tem uma chave: Entrevistas, Seleção, KPIs do edital, Robô de inscrições, Triagem automática, Conferências, Pacotes dos painéis e Manutenção do banco. Desligada, as tarefas agendadas no banco daquela chave param e a agenda dos robôs não pede a carga ao GitHub; a triagem automática deixa de rodar no fim do robô da Empregare. Ligar ou desligar pede motivo (10 a 500 caracteres), e a lista mostra a última e a próxima execução e quem mudou, quando e por quê; o histórico guarda as 50 últimas mudanças. No Status das atualizações, a carga desligada aparece como "Desligada pelo administrador", e não como atrasada. "Gerar listas pelo Python" só tem efeito com "Classificação em Python" também ligada; ligada sozinha, a tela avisa que está sem efeito e o Gerar segue com o cálculo da tela.
**fonte:** src/modulos/automacao/automacao.tsx; supabase/migrations/20261022190000_chaves_da_automacao.sql
**abrir:** config:automacao

## Rodar com a automação desligada

**perguntas:** da para rodar uma carga com a automacao desligada | rodar com a automacao desligada | rodar agora com a chave desligada | carga desligada pelo administrador | desligada pelo administrador
**resposta:** Sim. A chave só para o que roda sozinho. O "Rodar agora" e as "Opções" do Status das atualizações continuam com o administrador global; com a chave desligada, a tela pede confirmação antes de pedir a carga. A coordenação de um edital continua usando o Recalcular da aba Triagem.
**fonte:** src/componentes/saude-das-cargas/saude-das-cargas.tsx; supabase/migrations/20261022190000_chaves_da_automacao.sql
**abrir:** config:cargas

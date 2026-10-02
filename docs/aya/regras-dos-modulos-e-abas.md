# Regras de Módulos e abas

Configurações › Módulos e abas: ativar, desativar e pôr em manutenção o sistema, as áreas, as abas
e os painéis; selo BETA; comemorações. Fontes: `src/componentes/modulos/modulos.jsx`,
`src/lib/situacao-dos-modulos.js`, `src/lib/modulos-e-abas.js`, `src/lib/access-roles.js` e a
migration `20260930140000_modulos_e_manutencao.sql`.

## Seção Módulos e abas

**perguntas:** secao modulos e abas | modulos e abas | para que serve modulos e abas | para que serve a secao modulos e abas
**resposta:** Em Configurações › Módulos e abas (só o administrador global), dá para pôr o sistema inteiro em manutenção, ativar, desativar ou pôr em manutenção cada área, cada aba (em todas as áreas ou só numa) e cada painel externo, e ligar o selo BETA de uma aba. Nada grava na hora: as mudanças vão juntas em "Revisar e salvar", com motivo (3 a 500 caracteres). O histórico mostra as 50 últimas mudanças. Pelo menos uma área precisa ficar ativa.
**fonte:** src/componentes/modulos/modulos.jsx; supabase/migrations/20260930140000_modulos_e_manutencao.sql
**abrir:** config:modulos

## Manutenção

**perguntas:** o que acontece quando uma aba fica em manutencao | aba em manutencao | sistema em manutencao | em manutencao | tela de manutencao | como por uma aba em manutencao
**resposta:** Em manutenção, a aba (ou a área, ou o sistema inteiro) continua no menu com o aviso, mas quem não é administrador global vê a tela de manutenção com a mensagem e a previsão configuradas; o administrador global entra normalmente, com a faixa "Em manutenção para os demais usuários". Vale a mensagem do nível mais alto: sistema, depois área, depois aba em todas as áreas, depois aba naquela área. O sistema inteiro não se desativa, só entra ou sai de manutenção. Se a situação não puder ser lida do banco, tudo vale como ativo.
**fonte:** src/lib/situacao-dos-modulos.js; supabase/migrations/20260930140000_modulos_e_manutencao.sql

## Área ou aba desativada

**perguntas:** o que acontece quando uma area e desativada | area desativada | aba desativada | desativar aba
**resposta:** Desativada, a área (ou a aba, ou o painel) some do menu de todos. Pelo menos uma área precisa continuar ativa.
**fonte:** supabase/migrations/20260930140000_modulos_e_manutencao.sql; src/lib/menu-lateral.js

## Selo BETA

**perguntas:** o que e o selo beta | selo beta | aba beta | beta
**resposta:** O selo BETA aparece ao lado do nome da aba no menu e marca uma aba ainda em teste. É ligado por aba, em Configurações › Módulos e abas, pelo administrador global, e vale em todas as áreas.
**fonte:** src/lib/menu-lateral.js; src/lib/modulos-e-abas.js

## Comemorações

**perguntas:** comemoracoes | confete | marcos do ano | o que sao as comemoracoes
**resposta:** As comemorações celebram o processo e a equipe, nunca uma pessoa (não há ranking): edital todo analisado e fila de análises zerada, vaga pronta para o resultado final nas Entrevistas, marcos do ano da área (1.000, 2.500, 5.000, 7.500 e 10.000 análises concluídas, depois a cada 5.000) e acesso liberado ou reativado. Aparecem como confete por cerca de 3 segundos e um aviso no topo (só o aviso com movimento reduzido), uma vez por pessoa. Liga e desliga em Módulos e abas › Sistema inteiro; desligado, ninguém vê.
**fonte:** src/lib/comemoracao.js; supabase/migrations/20260930150000_comemoracoes_e_marcos.sql

# Regras do Cronograma

A tela Cronograma (view `calendario`), o calendário dos cronogramas dos editais. Fontes:
`src/componentes/calendario-editais/calendario-editais.jsx`, `src/lib/calendario-editais.js`,
`src/lib/etapas-de-edital.js`, `src/lib/datas-do-cronograma.js` e `src/lib/access-roles.js`.

## Tela de Cronograma

**perguntas:** tela de cronograma | tela cronograma | aba cronograma | para que serve cronograma | para que serve a tela de cronograma | o que o cronograma mostra | calendario de editais
**resposta:** O Cronograma mostra, num calendário, as etapas dos cronogramas cadastrados em Editais, só da área atual. A tela é só de leitura e se atualiza quando um cronograma é salvo. O mês mostra quantas etapas de cada tipo há em cada dia (uma etapa conta no dia em que começa e no dia em que termina), e há filtros por unidade, edital, tipo de etapa e busca. O tipo é deduzido do texto da atividade: Impugnação, Recursos, Resultado final, Resultado, Convocação para entrevista, Entrevistas, Inscrições, Análise curricular ou Outros. Etapas com ano impossível ficam fora de "Próximas etapas" e aparecem listadas para correção.
**fonte:** src/componentes/calendario-editais/calendario-editais.jsx; src/lib/calendario-editais.js; src/lib/etapas-de-edital.js; src/lib/datas-do-cronograma.js
**abrir:** calendario

## Quem altera o cronograma

**perguntas:** quem pode alterar as etapas do cronograma | quem altera o cronograma | como editar uma etapa do cronograma | editar cronograma
**resposta:** As etapas se alteram no formulário do edital, na tela Editais, por quem tem nível Editor em Editais ou em Cronograma. O Cronograma em si só mostra as datas salvas. Em edital já cadastrado, a alteração pede um motivo, que vai para o histórico do edital.
**fonte:** src/lib/access-roles.js; src/componentes/nucleo/modal-do-edital.jsx
**abrir:** nucleo

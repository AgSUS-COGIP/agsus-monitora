# Regras do Cronograma

A tela Cronograma (view `calendario`), o calendário dos cronogramas dos editais. Fontes:
`src/modulos/cronograma/calendario-editais.tsx`, `src/lib/calendario-editais.ts`,
`src/lib/etapas-de-edital.js`, `src/lib/datas-do-cronograma.js` e `src/lib/access-roles.js`.

## Tela de Cronograma

**perguntas:** tela de cronograma | tela cronograma | aba cronograma | para que serve cronograma | para que serve a tela de cronograma | o que o cronograma mostra | calendario de editais
**resposta:** O Cronograma mostra, num calendário, as etapas dos cronogramas cadastrados em Editais, só da área atual. A tela é só de leitura e se atualiza quando um cronograma é salvo. O mês mostra quantas etapas de cada tipo há em cada dia (uma etapa conta no dia em que começa e no dia em que termina), e há filtros por unidade, edital, tipo de etapa e busca. O tipo é deduzido do texto da atividade: Impugnação, Recursos, Resultado final, Resultado, Convocação para entrevista, Entrevistas, Inscrições, Análise curricular ou Outros. Etapas com ano impossível ficam fora de "Próximas etapas" e aparecem listadas para correção.
**fonte:** src/modulos/cronograma/calendario-editais.tsx; src/lib/calendario-editais.ts; src/lib/etapas-de-edital.js; src/lib/datas-do-cronograma.js
**abrir:** calendario

## Quem altera o cronograma

**perguntas:** quem pode alterar as etapas do cronograma | quem altera o cronograma | como editar uma etapa do cronograma | editar cronograma | quem ve o cronograma | nao vejo a aba cronograma
**resposta:** As etapas se alteram no formulário do edital, na tela Editais, por quem tem nível Editor em Editais ou em Cronograma. O Cronograma em si só mostra as datas salvas, e vê a aba quem tem pelo menos Leitor em Cronograma. Em edital já cadastrado, a alteração pede um motivo, que vai para o histórico do edital.
**fonte:** src/lib/access-roles.js; src/modulos/editais/modal-do-edital.jsx
**abrir:** nucleo

## Filtros do Cronograma

**perguntas:** filtros do cronograma | ocultar concluidas | etapas concluidas sumiram | limpar filtros do cronograma | por que nao vejo etapas passadas
**resposta:** Os filtros ficam recolhidos em "Refinar resultados" (o botão "Mostrar filtros" abre): busca por etapa, edital ou unidade, unidade, edital, tipo de etapa e "Ocultar concluídas". "Ocultar concluídas" começa ligada, porque o que já terminou raramente é o que se procura; "Limpar tudo" tira os filtros e mostra também as concluídas. A linha do tempo oferece só os editais que restaram no filtro, e clicar numa etapa (nas próximas etapas ou no dia) mostra o edital dela na linha do tempo.
**fonte:** src/modulos/cronograma/calendario-editais.tsx; src/lib/calendario-editais.ts
**abrir:** calendario

## Etapa ou edital que não aparece no Cronograma

**perguntas:** por que o edital nao aparece no cronograma | etapa nao aparece no cronograma | sumiu a etapa do cronograma | cronograma vazio
**resposta:** O Cronograma só mostra etapas já salvas no cronograma de cada edital, em Editais, e só da área atual: edital sem cronograma não aparece. "Ocultar concluídas" começa ligada, então as etapas que já terminaram ficam escondidas até você desligá-la ou clicar em "Limpar tudo". Etapa com ano impossível sai de "Próximas etapas" e aparece na lista para correção. Confira também a busca e os filtros de unidade, edital e tipo de etapa.
**fonte:** src/modulos/cronograma/calendario-editais.tsx; src/lib/calendario-editais.ts; src/lib/datas-do-cronograma.js
**abrir:** calendario

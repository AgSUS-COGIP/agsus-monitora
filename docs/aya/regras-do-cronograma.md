# Regras do Cronograma

A tela Cronograma (view `calendario`), o calendário dos cronogramas dos editais. Fontes:
`src/modulos/cronograma/calendario-editais.tsx`, `src/lib/calendario-editais.ts`,
`src/lib/etapas-de-edital.ts`, `src/lib/datas-do-cronograma.ts` e `src/lib/access-roles.ts`.

## Tela de Cronograma

**perguntas:** tela de cronograma | tela cronograma | aba cronograma | para que serve cronograma | para que serve a tela de cronograma | o que o cronograma mostra | calendario de editais
**resposta:** O Cronograma mostra, num calendário, as etapas dos cronogramas cadastrados em Editais, só da área atual. As etapas não se editam aqui (só as demandas internas), e a tela se atualiza quando um cronograma é salvo. O Mês mostra cada etapa como um chip curto "unidade – etapa", com a borda na cor do tipo, só no dia em que ela acontece ou, se tem período, no dia em que começa ("início") e no dia em que termina ("fim"); os dias do meio ficam sem chip. Cada dia mostra até três chips e "+N mais", e clicar no dia abre todas as etapas dele, inclusive as que estão em andamento. A Lista mostra, dia a dia, o que começa ou termina, com "Acontecendo agora" no topo; a Semana segue o critério do Mês (só o início e o fim de cada período; nos dias do meio, "N em andamento"). Há filtros por unidade, edital e busca; a legenda dos tipos, acima do calendário, é o filtro de tipo: clicar num tipo esconde ou mostra as etapas dele no Mês, na Semana, na Lista e nas contagens, e "Mostrar todos" religa todos. Os tipos escondidos ficam lembrados neste navegador. O tipo é deduzido do texto da atividade: Impugnação, Recursos, Resultado final, Resultado, Convocação para entrevista, Entrevistas, Inscrições, Análise curricular ou Outros. Etapas com ano impossível ficam fora de "Próximas etapas" e aparecem listadas para correção.
**fonte:** src/modulos/cronograma/calendario-editais.tsx; src/lib/calendario-editais.ts; src/lib/etapas-de-edital.ts; src/lib/datas-do-cronograma.ts
**abrir:** calendario

## Quem altera o cronograma

**perguntas:** quem pode alterar as etapas do cronograma | quem altera o cronograma | como editar uma etapa do cronograma | editar cronograma | quem ve o cronograma | nao vejo a aba cronograma
**resposta:** As etapas se alteram no formulário do edital, na tela Editais, por quem tem nível Editor em Editais ou em Cronograma. O Cronograma em si só mostra as datas salvas, e vê a aba quem tem pelo menos Leitor em Cronograma. Em edital já cadastrado, a alteração pede um motivo, que vai para o histórico do edital.
**fonte:** src/lib/access-roles.ts; src/modulos/editais/modal-do-edital.tsx
**abrir:** nucleo

## Filtros do Cronograma

**perguntas:** filtros do cronograma | ocultar concluidas | etapas concluidas sumiram | limpar filtros do cronograma | por que nao vejo etapas passadas
**resposta:** Os filtros ficam recolhidos em "Refinar resultados" (o botão "Mostrar filtros" abre): busca por etapa, edital ou unidade, unidade, edital e "Ocultar concluídas"; o tipo de etapa se escolhe na legenda, acima do calendário. "Ocultar concluídas" começa ligada, porque o que já terminou raramente é o que se procura; "Limpar tudo" tira os filtros, religa todos os tipos da legenda e mostra também as concluídas. A linha do tempo oferece só os editais que restaram no filtro, e clicar numa etapa (nas próximas etapas ou no dia) mostra o edital dela na linha do tempo.
**fonte:** src/modulos/cronograma/calendario-editais.tsx; src/lib/calendario-editais.ts
**abrir:** calendario

## Etapa ou edital que não aparece no Cronograma

**perguntas:** por que o edital nao aparece no cronograma | etapa nao aparece no cronograma | sumiu a etapa do cronograma | cronograma vazio
**resposta:** O Cronograma só mostra etapas já salvas no cronograma de cada edital, em Editais, e só da área atual: edital sem cronograma não aparece. "Ocultar concluídas" começa ligada, então as etapas que já terminaram ficam escondidas até você desligá-la ou clicar em "Limpar tudo". Etapa com ano impossível sai de "Próximas etapas" e aparece na lista para correção. Confira também a busca, os filtros de unidade e edital e se o tipo está desligado na legenda (riscado).
**fonte:** src/modulos/cronograma/calendario-editais.tsx; src/lib/calendario-editais.ts; src/lib/datas-do-cronograma.ts
**abrir:** calendario

## Demandas internas no Cronograma

**perguntas:** demanda interna | nova demanda | criar demanda no cronograma | concluir demanda | demanda atrasada | quem pode criar demanda | excluir demanda
**resposta:** Além das etapas dos editais, o Cronograma mostra as demandas internas da área: itens da equipe com título, data (ou período), edital opcional e responsáveis. Elas aparecem no calendário com o tipo "Demanda interna", que também se liga e desliga na legenda, e no card "Demandas internas". Uma demanda em aberto cujo último dia já passou aparece como "Atrasada" e não some com "Ocultar concluídas". Quem é gestor da área (Editor em Cronograma ou Editais com acesso à área) ou administrador global cria pelo botão "Nova demanda" e, no detalhe da demanda, conclui, reabre, edita ou exclui; quem só tem acesso à área vê as demandas e os responsáveis. Cada mudança fica registrada com quem fez e quando.
**fonte:** src/modulos/cronograma/demandas-internas.tsx; src/lib/demandas-internas.ts
**abrir:** calendario

## Responsáveis pelo edital

**perguntas:** responsavel pelo edital | responsaveis do edital | quem e responsavel pelo edital | definir responsavel do edital
**resposta:** No formulário de um edital já cadastrado, em Editais, o bloco "Responsáveis pelo edital" guarda as pessoas do sistema responsáveis por ele. O gestor da área ou o administrador global escolhe as pessoas e clica em "Salvar responsáveis" (grava na hora, sem o Salvar do edital); quem só vê o edital lê os nomes. Só aparecem pessoas que têm acesso ao edital. O campo antigo "Responsável" (USI ou CORES) continua como estava.
**fonte:** src/modulos/editais/responsaveis-do-edital.tsx
**abrir:** nucleo

## Resumo do dia e sininho

**perguntas:** resumo do dia | sininho | popup ao entrar | seus editais hoje | desligar resumo do dia | nao quero o popup | bom dia seus editais
**resposta:** Quem é responsável por algum edital ou demanda interna vê, no primeiro acesso do dia, o resumo "seus editais hoje": o que começa ou termina hoje, nos próximos 7 dias e as demandas atrasadas. O sininho no topo mostra o número de pendências e reabre o resumo quando quiser. "Fechar" não deixa o resumo voltar sozinho no mesmo dia; "Ver no cronograma" abre o Cronograma só com os seus editais e demandas ("Ver todos" volta ao normal); "Concluir" fecha uma demanda atrasada, para quem pode. Para não abrir mais ao entrar, desmarque "Mostrar ao entrar" no próprio resumo: o sininho continua. Sem pendências, o resumo não abre.
**fonte:** src/modulos/resumo-do-dia/resumo-do-dia.tsx; src/lib/resumo-do-dia.ts
**abrir:** calendario

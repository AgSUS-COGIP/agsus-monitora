# `src/modulos/entrevistas/` — Entrevistas

Duas entradas do menu, com o mesmo recurso de permissão (`entrevistas`), como o Painel das análises
ao lado da Avaliação documental (acompanhar × fazer):

- **Painel de entrevistas** (view `entrevistas`, `#page-entrevistas`, `montarEntrevistas()` →
  `window.entrevistasController`): só leitura, para gestão e coordenação — filtros, KPIs, agenda dos próximos
  dias (com um edital), gráficos, pendências (inclusive sem comparecimento, sem nota e sem parecer),
  empatados na nota da entrevista com o aviso "o desempate é feito na Classificação", tabela,
  exportação e a gaveta do candidato. O edital de treinamento fica fora (o cache do painel,
  `private."FC_MONTAR_ENTREVISTAS_AREA"`, não o lê).
- **Conduzir entrevistas** (view `conduzir-entrevistas`, `#page-conduzir-entrevistas`,
  `montarConducaoDeEntrevistas()` → `window.conduzirEntrevistasController`): o fazer, para secretaria
  e avaliadores. Visões no topo: **Fila** (abre em Hoje pela agenda salva na Classificação › Agenda;
  sem entrevista hoje, Próximos; sem agenda, Todos; vaga e situações — aguardando, em andamento,
  concluída, faltou —; o contador "X de Y hoje" no topo; o cartão abre a ficha em tela cheia, com
  "Salvar e abrir o próximo" na ordem da fila; concluir o dia comemora uma vez) e **Preparar**
  (configuração e convocação do edital e os **roteiros** da área — a configuração do gestor, como
  Regra e Equipe ficam na própria tela da Avaliação documental). O último edital aberto na área
  fica no navegador (só conveniência); com um só na lista, ele abre sozinho.

Links antigos (`entrevistas:conduzir`, `entrevistas:roteiros`) vão para Conduzir entrevistas
(`destinoDaTela`, `src/lib/navegacao.js`; o controlador tem `abrirVisao` e `abrirEdital`).

**Desempate**: uma fonte só, a regra de classificação do edital. `obter_entrevistas_do_edital` traz
`regra_classificacao.desempate` e `empate_final` (migration `20261008130000`); Preparar e o editor do
roteiro mostram os critérios só para ler, com "Editar na Classificação". O texto livre antigo do
roteiro (`TB_ROTEIRO_ENTREVISTA."DS_DESEMPATE"`) fica no banco: a tela não o mostra nem o edita e o
repassa sem mudança a cada versão nova.

A convocação é uma só: a lista CONVOCACAO da Classificação (a última gerada, que vem em
`obter_entrevistas_do_edital.lista_convocacao`). Preparar › Convocação mostra essa lista e
`convocar_para_entrevista(p_edital, p_lista, p_analises)` registra para a ficha só quem está nela
(migration `20261005150000_convocacao_unica_da_entrevista.sql`). Sem lista gerada, o cálculo atual
do motor (`obter_classificacao_do_edital`, só para ver) e o atalho para gerar na Classificação.
Vagas imediatas e regra de convocação não se configuram aqui: o resumo "Regras da entrevista" (topo de
Preparar) mostra as da Classificação em linguagem simples, com a tabelinha por vaga e, em "Ver detalhes",
de onde vêm as vagas e o botão para onde se mudam (Editais, Lista de aprovados, Classificação).

**Avaliador por competência** (migration `20261008170000`): cada membro da banca avalia todas as
competências (padrão; sem vínculo) ou só as marcadas (`TB_ENTREVISTA_AVALIADOR_COMPETENCIA`,
`avaliadores[].competencias`). A configuração valida (cada competência com alguém em cada banca), o
lançamento recusa nota fora da competência do avaliador e o cálculo (banco, `calcularEntrevista`,
Python) faz a média só de quem avalia; a ficha esmaece o que não é do avaliador e os contadores contam
só as células atribuídas.

```
entrevistas.jsx         Painel de entrevistas: <TelaDeEntrevistas> e montarEntrevistas()
estado.js               store do painel: carga da área (cópia guardada), gaveta, CSV, agenda do
                        edital do recorte (obter_agenda_entrevista), comemorações
agenda-e-empates.tsx    agenda dos próximos dias (com um edital no recorte) e aviso dos empatados
paineis.jsx             topo (status, ações), filtros, KPIs, recorte, gráficos, pendências
tabela.jsx              tabela de resultados (TabelaInfinita), selo do parecer e do empate
gaveta.jsx              detalhe da entrevista (caminho do candidato, critérios) e aprovados sem entrevista
conduzir.tsx            Conduzir entrevistas: <TelaDeConducao>, visões Fila/Preparar, contador do dia,
                        comemoração, montarConducaoDeEntrevistas() (render, abrirVisao, abrirEdital)
fila-do-dia.tsx         a fila em cartões (avatar, horário, situação, notas), recortes e situações
tipos.ts                contratos da tela nova com o estado da condução (JS)
estado-da-conducao.js   store da condução e dos roteiros: editais, edital aberto, escritas (RPC), uma por vez
conducao.jsx            SeletorDoEdital, PrepararEdital (resumo das regras, configuração e convocação; os
                        detalhes da Classificação em "Ver detalhes"), DesempateDaClassificacao, liberação
resumo-das-regras.tsx   "Regras da entrevista": quem é chamado (tabelinha por vaga), como a nota é calculada,
                        quem avalia e o desempate, cada bloco com o "Editar" para onde se muda
competencias-do-membro.tsx  "Competências que avalia" de cada membro (Todas / Só estas)
ficha.jsx               ficha de notas em modo de análise (tela inteira, como a da Avaliação documental):
                        o estado, a gravação e o fluxo; por avaliador (padrão: uma aba por avaliador) ou
                        por competência (lembrado no navegador); componente independente (dados,
                        convocado, convocados, aoSalvar, aoAbrir, aoFechar)
cabecalho-da-ficha.tsx  cabeçalho enxuto: nome, vaga, chips, detalhes no "i", comparecimento, banca,
                        Anterior / "1 de 15" / Próximo
abas-da-ficha.tsx       abas dos avaliadores (ou competências), com o check ao completar
matriz-de-notas.tsx     a matriz competências × aspectos (ou "Nota") com o fluxo de planilha (dígito
                        avança, setas/Enter, Backspace volta, fora da escala recusa) e o chip da média
campo-de-nota.tsx       a célula grande da matriz (dica do nível em foco, pulso ao preencher)
resultado-da-ficha.tsx  a lateral viva: total no anel com o mínimo, barras por competência, parecer e
                        motivos, "X de Y notas"
aspectos-do-roteiro.tsx aspectos do roteiro no editor (e o modelo Conceitua · Propriedade · Profundidade)
roteiros.jsx            cartões dos roteiros e o editor (gaveta), com versões; desempate só leitura
partes.jsx              composição da banca, botão de linha
marcos.js               marco "vaga pronta" (comemoração)
entrevistas.css         só o que é destas telas (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/` (`entrevistas-do-painel.js`, `painel-de-entrevistas.ts` — edital do
recorte, empates, agenda dos próximos dias —, `fila-de-conducao.ts` — fila, situações, recortes, contador —,
`conducao-de-entrevista.js`,
`convocacao-da-entrevista.js` — a lista da Classificação por vaga, quem está na ficha, avisos —,
`roteiro-de-entrevista.js`, `digitacao-de-notas.ts` — a digitação da matriz —, `resumo-da-entrevista.ts` — as
regras em linguagem simples —, `comemoracao.js`). Testes: `tests/modulos/entrevistas.test.js` (painel), `tests/modulos/conduzir-entrevistas.test.js`,
`tests/painel-e-conducao-de-entrevistas.test.js`, `tests/digitacao-de-notas.test.js`,
`tests/convocacao-da-entrevista.test.js`, `tests/conducao-de-entrevista.test.js` e
`tests/convocacao-unica-da-entrevista-migration.test.js`, `tests/resumo-da-entrevista.test.js` e
`tests/avaliador-por-competencia-migration.test.js`.

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
  sem entrevista hoje, Próximos; sem agenda, Todos; cartões agrupados por vaga, em ordem de
  horário e nome, com a busca por nome ou código e as situações — aguardando, em andamento,
  concluída, faltou —; o contador "X de Y hoje" no topo; o cartão abre a ficha em tela cheia, com
  "Salvar e abrir o próximo" na ordem da tela; concluir o dia comemora uma vez) e **Preparar**
  (o resumo das regras e os passos Roteiro, Banca, Convocação e Agenda, cada um com o estado e o
  que falta; os **roteiros** da área ficam no passo 1 — a configuração do gestor, como Regra e
  Equipe ficam na própria tela da Avaliação documental). O edital fica num seletor compacto
  abaixo do topo (com "mostrar também os concluídos" dentro dele, para o administrador global); o
  último aberto na área fica no navegador (só conveniência); com um só na lista, ele abre sozinho.

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
entrevistas.tsx         Painel de entrevistas: <TelaDeEntrevistas> e montarEntrevistas()
estado.ts               store do painel: carga da área (cópia guardada), gaveta, CSV, agenda do
                        edital do recorte (obter_agenda_entrevista), comemorações
agenda-e-empates.tsx    agenda dos próximos dias (com um edital no recorte) e aviso dos empatados
paineis.tsx             topo (status, ações), filtros, KPIs, recorte, gráficos, pendências
tabela.tsx              tabela de resultados (TabelaInfinita), selo do parecer e do empate
gaveta.tsx              detalhe da entrevista (caminho do candidato, critérios) e aprovados sem entrevista
conduzir.tsx            Conduzir entrevistas: <TelaDeConducao>, visões Fila/Preparar, contador do dia,
                        comemoração, montarConducaoDeEntrevistas() (render, abrirVisao, abrirEdital)
seletor-do-edital.tsx   o edital compacto abaixo do topo, selo Treinamento, "mostrar também os concluídos"
                        (administrador global) dentro do seletor, liberação e erros com "Tentar novamente"
fila-do-dia.tsx         a fila em cartões por vaga (iniciais, código, horário e banca, situação, notas só
                        quando há), recortes, busca e situações, estados vazios
tipos-da-ficha.ts       contratos do estado local da ficha, do cálculo e das notas para salvar
tipos.ts                contratos da tela nova com o estado da condução (JS)
estado-da-conducao.js   store da condução e dos roteiros: editais, edital aberto, escritas (RPC), uma por vez
preparar.tsx            Preparar em passos: Roteiro, Banca, Convocação, Agenda (estado e o que falta, de
                        src/lib/passos-do-preparar.ts), o resumo das regras no topo
configuracao-do-edital.tsx  os campos do roteiro (passo 1) e da banca (passo 2) sobre um rascunho só e a
                        barra "Salvar configuração" com a lista do que falta
conducao.jsx            BotaoIrPara, ConvocacaoDaClassificacao ("Ver detalhes"), DesempateDaClassificacao,
                        ListaDeConvocacao (passo 3) e LiberacaoDoEdital
resumo-das-regras.tsx   "Regras da entrevista": quem é chamado (tabelinha por vaga), como a nota é calculada,
                        quem avalia e o desempate, cada bloco com o "Editar" para onde se muda
competencias-do-membro.tsx  "Competências que avalia" de cada membro (Todas / Só estas)
ficha.tsx               ficha de notas em modo de análise (tela inteira, como a da Avaliação documental):
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
textos-da-ficha.tsx     observação do avaliador (opcional, por avaliador) e justificativa da banca
                        (obrigatória para Inapto e Faltou; o banco recusa sem ela — 20261008220000)
parecer-pronto.tsx      o parecer em texto pronto (src/lib/parecer-da-entrevista.ts) com "Copiar parecer",
                        embaixo da matriz, com tudo lançado
aspectos-do-roteiro.tsx aspectos do roteiro no editor (e o modelo Conceitua · Propriedade · Profundidade)
roteiros.jsx            cartões dos roteiros e o editor (gaveta), com versões; desempate só leitura
secoes-do-roteiro.tsx   as seções recolhíveis do editor e a lista do que falta perto do Salvar
                        (src/lib/pendencias-do-roteiro.ts)
partes.jsx              composição da banca, botão de linha
marcos.js               marco "vaga pronta" (comemoração)
entrevistas.css         só o que é destas telas (tokens); o resto vem de src/ui/
```

A apresentação dos resultados está em TypeScript: filtros, KPIs, recorte, gráficos, pendências,
tabela e gavetas. `tipos-do-painel.ts` declara os contratos de entrevistas, filtros, critérios,
indicadores, pendências e aprovados sem entrevista. As notas e análises ausentes são anuláveis;
IDs externos preservados pelo normalizador ficam como `unknown`. A entrada `entrevistas.tsx`,
o estado em `estado.ts` e a normalização dos resultados em `entrevistas-do-painel.ts` também
estão migrados. O normalizador recebe `unknown`, verifica objetos e listas e mantém os IDs
e timestamps preservados como `unknown`. A agenda aceita apenas objetos e campos usados
pela apresentação; destinos de agenda e desempate exigem um ID textual do edital. Respostas
de agenda anteriores à troca de área ou de sessão são descartadas, inclusive para o mesmo
edital. O cliente declara apenas `get_entrevistas_da_area` e `obter_agenda_entrevista`,
compatíveis com o cliente único do app. O snapshot é somente leitura no compilador; dados
aninhados não são congelados. Os componentes de Conduzir e Roteiros ainda combinam TSX e JSX.
A ficha de notas (`ficha.tsx`) também está em TypeScript: estado local, modos de lançamento,
permissões, matriz, progresso, atalhos, observações, justificativa, prévia e salvamento.
`tipos-da-ficha.ts` distingue notas diretas de notas por aspectos e declara os campos enviados
ao salvar (valores numéricos; `null` apaga). Os auxiliares de cálculo e de roteiro continuam
em JavaScript, com contratos JSDoc para a integração. O estado da condução ainda recebe o
payload do banco sem validação completa em tempo de execução; estes tipos não validam JSON.
`tests/tipos/ficha-de-entrevistas.tsx` confere o contrato da ficha e rejeita notas textuais,
notas que misturam os dois formatos e códigos de comparecimento inválidos.
Isso não verifica todos os consumidores JavaScript nem valida o JSON inteiro. `tests/tipos/painel-de-entrevistas.tsx`
confere usos e rejeições do compilador; o teste do módulo verifica a apresentação integrada.

Regras puras em `src/lib/` (`entrevistas-do-painel.ts`, `painel-de-entrevistas.ts` — edital do
recorte, empates, agenda dos próximos dias —, `fila-de-conducao.ts` — fila, situações, recortes, contador —,
`conducao-de-entrevista.js`,
`convocacao-da-entrevista.js` — a lista da Classificação por vaga, quem está na ficha, avisos —,
`roteiro-de-entrevista.js`, `digitacao-de-notas.ts` — a digitação da matriz —, `resumo-da-entrevista.ts` — as
regras em linguagem simples —, `passos-do-preparar.ts` — os passos de Preparar e a agenda por dia —,
`pendencias-do-roteiro.ts` — as seções e o que falta no editor —, `parecer-da-entrevista.ts` — o parecer em
texto pronto —, `comemoracao.js`). Testes: `tests/modulos/entrevistas.test.js` (painel), `tests/modulos/agenda-do-painel-de-entrevistas.test.js` (respostas antigas da agenda), `tests/modulos/conduzir-entrevistas.test.js`,
`tests/painel-e-conducao-de-entrevistas.test.js`, `tests/digitacao-de-notas.test.js`,
`tests/convocacao-da-entrevista.test.js`, `tests/conducao-de-entrevista.test.js` e
`tests/convocacao-unica-da-entrevista-migration.test.js`, `tests/resumo-da-entrevista.test.js` e
`tests/avaliador-por-competencia-migration.test.js` e `tests/preparar-e-fila-de-entrevistas.test.js`.

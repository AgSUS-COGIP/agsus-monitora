---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Entrevistas

Duas entradas do menu em `src/modulos/entrevistas/`, com o mesmo recurso de permissão
(`entrevistas`), como o Painel das análises ao lado da Avaliação documental (acompanhar × fazer).

## Painel de entrevistas

View `entrevistas`, `#page-entrevistas`, rota `/<área>/painel-de-entrevistas`,
`criarEntrevistas()`: só leitura, para gestão e coordenação — filtros, KPIs, agenda dos próximos
dias (com um edital), gráficos, pendências (inclusive sem comparecimento, sem nota e sem parecer),
empatados na nota da entrevista com o aviso "o desempate é feito na Classificação", tabela,
exportação e a gaveta do candidato. O edital de treinamento fica fora (o cache do painel,
`private."FC_MONTAR_ENTREVISTAS_AREA"`, não o lê).

## Conduzir entrevistas

View `conduzir-entrevistas`, `#page-conduzir-entrevistas`, rota `/<área>/entrevistas[/<edital>]`,
`criarConducaoDeEntrevistas()`: o fazer, para secretaria e avaliadores, no layout das telas da
seleção (cabeçalho com o edital e as seções).

- **Fila**: abre em Hoje pela agenda salva na Classificação › Agenda (sem entrevista hoje, Próximos;
  sem agenda, Todos); faixa de situação (período, aguardando, em andamento, concluídas, faltaram e
  sem nota) com o contador "X de Y hoje" e a próxima entrevista; barra com período, busca, vaga e
  banca; tabela em ordem de horário, 50 e mais 50 ao rolar, com a linha "Agora"; a ação da linha
  abre a ficha em tela cheia, com "Salvar e abrir o próximo"; concluir o dia comemora uma vez.
- **Preparar**: o topo com "N de 4 passos prontos", o período e as regras; a trilha dos passos
  Roteiro, Banca, Convocação e Agenda e o passo escolhido, com o que falta; os **roteiros** da área
  ficam no passo 1 (a configuração do gestor, como Regra e Equipe na Avaliação documental).
- O edital fica no cabeçalho (com "mostrar também os concluídos", para o administrador global); o
  último aberto na área fica no navegador (só conveniência); com um só na lista, abre sozinho. Na
  URL: a seção, o período, a situação, a vaga, a banca e o passo.
- Links antigos (`entrevistas:conduzir`, `entrevistas:roteiros`) vão para Conduzir entrevistas
  (`destinoDaTela`, `src/lib/navegacao.ts`; o controlador tem `abrirVisao` e `abrirEdital`).

## Regras

- **Desempate**: uma fonte só, a regra de classificação do edital. `obter_entrevistas_do_edital` traz
  `regra_classificacao.desempate` e `empate_final` (migration `20261008130000`); Preparar e o editor
  do roteiro mostram os critérios só para ler, com "Editar na Classificação". O texto livre antigo
  (`TB_ROTEIRO_ENTREVISTA."DS_DESEMPATE"`) fica no banco: a tela não o mostra nem edita e o repassa
  sem mudança a cada versão nova.
- **Convocação** é uma só: a lista CONVOCACAO da Classificação (a última gerada, em
  `obter_entrevistas_do_edital.lista_convocacao`). Preparar › Convocação mostra essa lista e
  `convocar_para_entrevista(p_edital, p_lista, p_analises)` registra para a ficha só quem está nela
  (`20261005150000_convocacao_unica_da_entrevista.sql`). Sem lista gerada, o cálculo atual do motor
  (`obter_classificacao_do_edital`, só para ver) e o atalho para gerar na Classificação.
- Vagas imediatas e regra de convocação não se configuram aqui: o resumo "Regras da entrevista" (topo
  de Preparar) mostra as da Classificação em linguagem simples, com a tabelinha por vaga e, em "Ver
  detalhes", de onde vêm as vagas e o botão para onde se mudam (Editais, Lista de aprovados,
  Classificação).
- **Avaliador por competência** (`20261008170000`): cada membro da banca avalia todas as
  competências (padrão; sem vínculo) ou só as marcadas (`TB_ENTREVISTA_AVALIADOR_COMPETENCIA`,
  `avaliadores[].competencias`). A configuração valida (cada competência com alguém em cada banca),
  o lançamento recusa nota fora da competência do avaliador e o cálculo (banco,
  `calcularEntrevista`, Python) faz a média só de quem avalia; a ficha esmaece o que não é do
  avaliador e os contadores contam só as células atribuídas.
- A justificativa da banca é obrigatória para Inapto e Faltou (o banco recusa sem ela,
  `20261008220000`).
- Roteiro e banca também se editam nas Regras do edital, etapa Entrevista
  (`editor-da-configuracao.tsx`).

Arquivos, regras puras, contratos TypeScript e testes: [[entrevistas-arquivos-e-contratos]].
Explicações para quem usa: `docs/aya/regras-das-entrevistas.md`.

## Relacionadas

- [[modulo-classificacao]] — convocação, desempate e agenda vêm de lá
- [[modulo-regras-do-edital]] — etapa Entrevista
- [[cargas-de-planilha]] — a carga diária da aba Entrevistados
- [[modulo-recursos]] — o mesmo padrão acompanhar × fazer
- [[modulo-avaliacao-documental]] — a ficha em modo de análise, no mesmo molde
- [regras-das-entrevistas](../aya/regras-das-entrevistas.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)

# `src/modulos/entrevistas/` — Entrevistas

A tela `#page-entrevistas` (view `entrevistas`), módulo do app desde a Etapa 2: monta na própria
`<section>` por `montarEntrevistas()` (`src/main.js` → `window.entrevistasController`); o legado
chama `render()` ao navegar (`TELAS_REACT`). Área = a atual do app; sessão, tema, aviso, tela
cheia e comemorações = os do app.

Três visões no `Segmentado` do topo: **Resultados** (planilha + entrevistas conduzidas no sistema),
**Conduzir entrevistas** (edital → configuração, convocação, ficha de notas) e **Roteiros**
(versões).

A convocação é uma só: a lista CONVOCACAO da Classificação (a última gerada, que vem em
`obter_entrevistas_do_edital.lista_convocacao`). O passo 2 mostra essa lista e
`convocar_para_entrevista(p_edital, p_lista, p_analises)` registra para a ficha só quem está nela
(migration `20261005150000_convocacao_unica_da_entrevista.sql`). Sem lista gerada, o cálculo atual
do motor (`obter_classificacao_do_edital`, só para ver) e o atalho para gerar na Classificação.
Vagas imediatas e regra de convocação não se configuram aqui: o passo 1 mostra as da Classificação,
só leitura, com o botão para onde se mudam (Editais, Lista de aprovados, Classificação).

```
entrevistas.jsx         <TelaDeEntrevistas> e montarEntrevistas() (área atual, troca de área, controlador)
estado.js               store de "Resultados": carga da área (cópia guardada), gaveta, CSV, comemorações
estado-da-conducao.js   store da condução e dos roteiros: editais, edital aberto, escritas (RPC), uma por vez
paineis.jsx             topo (visões, status, ações), filtros, KPIs, recorte, gráficos, pendências
tabela.jsx              tabela de resultados (TabelaInfinita) e o selo do parecer
gaveta.jsx              detalhe da entrevista (caminho do candidato, critérios) e aprovados sem entrevista
conducao.jsx            "Conduzir entrevistas": edital, liberação (admin global), os três passos;
                        regra e vagas da Classificação (só leitura) e a lista de convocação
ficha.jsx               ficha de notas em modo de análise (tela inteira, como a da Avaliação documental):
                        topo preso, competências com os avaliadores lado a lado (aspectos: um campo por
                        aspecto e a média), prévia do parecer na lateral, barra presa; componente
                        independente (dados, convocado, convocados, aoSalvar, aoAbrir, aoFechar).
                        Enter avança, Ctrl+Enter salva, Esc volta; celular: uma competência por vez
campo-de-nota.tsx       campo compacto da nota e os botões da escala (0 a 5)
aspectos-do-roteiro.tsx aspectos do roteiro no editor (e o modelo Conceitua · Propriedade · Profundidade)
agenda-do-dia.jsx       "Agenda do dia" (só leitura): a agenda salva na Classificação › Agenda,
                        por dia e banca; a linha do convocado abre a ficha
roteiros.jsx            cartões dos roteiros e o editor (gaveta), com versões
partes.jsx              composição da banca, botão de linha
marcos.js               marco "vaga pronta" (comemoração)
entrevistas.css         só o que é desta tela (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/` (`entrevistas-do-painel.js`, `conducao-de-entrevista.js`,
`convocacao-da-entrevista.js` — a lista da Classificação por vaga, quem está na ficha, avisos —,
`roteiro-de-entrevista.js`, `comemoracao.js`). Testes: `tests/modulos/entrevistas.test.js`,
`tests/convocacao-da-entrevista.test.js`, `tests/conducao-de-entrevista.test.js` e
`tests/convocacao-unica-da-entrevista-migration.test.js`.

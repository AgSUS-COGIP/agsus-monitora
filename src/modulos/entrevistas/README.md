# `src/modulos/entrevistas/` — Entrevistas

A tela `#page-entrevistas` (view `entrevistas`), módulo do app desde a Etapa 2: monta na própria
`<section>` por `montarEntrevistas()` (`src/main.js` → `window.entrevistasController`); o legado
chama `render()` ao navegar (`TELAS_REACT`). Área = a atual do app; sessão, tema, aviso, tela
cheia e comemorações = os do app.

Três visões no `Segmentado` do topo: **Resultados** (planilha + entrevistas conduzidas no sistema),
**Conduzir entrevistas** (edital → configuração, convocação, ficha de notas) e **Roteiros**
(versões).

```
entrevistas.jsx         <TelaDeEntrevistas> e montarEntrevistas() (área atual, troca de área, controlador)
estado.js               store de "Resultados": carga da área (cópia guardada), gaveta, CSV, comemorações
estado-da-conducao.js   store da condução e dos roteiros: editais, edital aberto, escritas (RPC), uma por vez
paineis.jsx             topo (visões, status, ações), filtros, KPIs, recorte, gráficos, pendências
tabela.jsx              tabela de resultados (TabelaInfinita) e o selo do parecer
gaveta.jsx              detalhe da entrevista (caminho do candidato, critérios) e aprovados sem entrevista
conducao.jsx            "Conduzir entrevistas": edital, liberação (admin global), os três passos
ficha.jsx               ficha de notas por avaliador (Enter avança, Ctrl+Enter salva)
agenda-do-dia.jsx       "Agenda do dia" (só leitura): a agenda salva na Classificação › Agenda,
                        por dia e banca; a linha do convocado abre a ficha
roteiros.jsx            cartões dos roteiros e o editor (gaveta), com versões
partes.jsx              regra de convocação, composição da banca, botão de linha
marcos.js               marco "vaga pronta" (comemoração)
entrevistas.css         só o que é desta tela (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/` (`entrevistas-do-painel.js`, `conducao-de-entrevista.js`,
`roteiro-de-entrevista.js`, `comemoracao.js`). Testes: `tests/modulos/entrevistas.test.js`.

# Histórias de usuário — Análises curriculares

Tela `Análises curriculares` (`src/modulos/analises/`), regras em
`src/lib/analises-curriculares.ts`. Cada critério de aceite tem um teste com o mesmo código
(`AC-n.m`) em `tests/analises-curriculares.test.js` (regra) ou `tests/modulos/analises.test.js`
(tela).

## AC-1 — Filtrar a tela pelo dia clicado em "Análises por data"

**Como** pessoa que acompanha as análises curriculares da área, **quero** clicar num dia do gráfico
"Análises por data" e ver a tela só com as análises daquele dia, **para** entender o que foi feito
(e por quem) naquela data sem montar o filtro à mão.

O dia é o da **data da análise** (`data_analise`), o mesmo campo que o gráfico conta.

### Critérios de aceite

- **AC-1.1** — **Dado** o gráfico com vários dias, **quando** clico no ponto de 15/09/2026,
  **então** os KPIs, "Análises por responsável", "Pendências prioritárias" e a "Fila de análises"
  passam a contar e mostrar só as análises com data de análise em 15/09/2026.
- **AC-1.2** — **Dado** o dia escolhido, **quando** olho o "Recorte ativo" e os filtros aplicados de
  "Refinar resultados", **então** aparece o chip "Data: 15/09/2026" com o "x", e a frase do recorte
  termina em "Data: 15/09/2026".
- **AC-1.3** — **Dado** o dia escolhido, **quando** olho o gráfico, **então** ele continua com todos
  os dias (para eu poder trocar de dia) e o ponto escolhido fica destacado (maior e com borda).
- **AC-1.4** — **Dado** o dia escolhido, **quando** clico de novo no mesmo ponto, ou no "x" do chip,
  **então** o filtro de data sai e a tela volta ao recorte de antes.
- **AC-1.5** — **Dado** o dia escolhido, **quando** clico em outro dia, **então** o filtro troca para
  o novo dia.
- **AC-1.6** — **Dado** o filtro de data e outros filtros (status, responsável, KPI), **quando**
  combino os dois, **então** valem juntos; "Limpar tudo" tira também a data, e o CSV exporta o
  recorte com a data.
- **AC-1.7** — **Dado** uma análise sem data de análise, **quando** há filtro de data, **então** ela
  sai do recorte (não tem dia para cair).

## AC-2 — Escolher um intervalo de datas

**Como** pessoa que acompanha as análises, **quero** escolher um intervalo de dias, **para** ver uma
semana ou um mutirão de análises de uma vez.

### Critérios de aceite

- **AC-2.1** — **Dado** um dia escolhido, **quando** faço Shift + clique em outro dia do gráfico,
  **então** o filtro vira o intervalo entre os dois (as pontas contam, em qualquer ordem) e o chip
  mostra "Data: 01/09/2026 a 15/09/2026".
- **AC-2.2** — **Dado** que não uso mouse, **quando** abro "Mais opções" em "Refinar resultados",
  **então** encontro os campos "Data da análise: de" e "Data da análise: até", que aplicam o mesmo
  filtro (um dia, um intervalo, ou só uma das pontas: "a partir de …" / "até …"), e o clique no
  gráfico preenche esses campos.
- **AC-2.3** — **Dado** o gráfico (um `canvas`), **quando** um leitor de tela chega nele, **então**
  o rótulo diz que clicar filtra, que o período também se escolhe em "Mais opções" e qual data está
  escolhida.

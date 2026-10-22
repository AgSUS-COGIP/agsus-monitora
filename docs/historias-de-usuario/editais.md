# Histórias de usuário — Editais

Tela `Editais` (`src/modulos/editais/`), regras em `src/lib/editais-do-nucleo.js`. Cada critério
de aceite tem um teste com o mesmo código (`ED-n.m`) em `tests/editais-do-nucleo.test.js` (regra)
ou `tests/componentes/nucleo.test.js` (tela).

## ED-1 — Editais ativos e inativos nos indicadores

**Como** pessoa da equipe que acompanha os editais da área, **quero** ver no topo da tela quantos
editais estão ativos e quantos estão inativos, **para** saber de relance quantos processos ainda
pedem acompanhamento e quantos já acabaram.

Critério de ativo/inativo (o mesmo sentido da "Situação do processo" das Análises curriculares):
**inativo** é o edital cujo processo acabou — status _Concluído_ ou _Cancelado_; **ativo** é todo o
resto (_Planejado_, _Em andamento_, _Suspenso_, _Paralisado_ ou sem status). O status é o do resumo
dos cronogramas (o mesmo do indicador "Em andamento"). Os editais desligados no banco
(`ativo = false`) não chegam à tela e não entram em nenhum indicador.

### Critérios de aceite

- **ED-1.1** — **Dado** que a área atual tem editais _Em andamento_, _Planejado_ e _Concluído_,
  **quando** a tela carrega, **então** os cartões "Editais ativos" e "Editais inativos" aparecem no
  mesmo formato compacto dos outros indicadores, com a contagem de cada grupo, e o primeiro cartão
  passa a se chamar "Total de editais" (soma dos dois).
- **ED-1.2** — **Dado** um edital _Cancelado_, _Suspenso_ ou sem status, **quando** os indicadores
  são contados, **então** o cancelado conta como inativo e os outros dois como ativos.
- **ED-1.3** — **Dado** que o usuário troca de área no menu, **quando** a tela recarrega, **então**
  os cartões contam só os editais da nova área (como os demais indicadores).
- **ED-1.4** — **Dado** que o resumo ainda está carregando, **quando** a tela aparece, **então** os
  dois cartões aparecem como skeleton, como os outros (carregando não é zero).

## ED-2 — Filtrar a tabela por ativos ou inativos

**Como** pessoa da equipe, **quero** clicar em "Editais ativos" ou "Editais inativos" para ver só
esses editais na tabela, **para** trabalhar a fila certa sem procurar linha por linha.

### Critérios de aceite

- **ED-2.1** — **Dado** a tabela com todos os editais, **quando** clico em "Editais inativos",
  **então** a tabela mostra só os editais inativos, o cartão fica marcado (também para leitor de
  tela, `aria-pressed`) e aparece o chip "Situação: Editais inativos".
- **ED-2.2** — **Dado** o filtro "Editais ativos" ligado, **quando** clico de novo no mesmo cartão,
  **então** o filtro sai e a tabela volta a mostrar todos (vale para todos os indicadores).
- **ED-2.3** — **Dado** um filtro de situação ligado, **quando** clico no "x" do chip, **então** o
  filtro sai.
- **ED-2.4** — **Dado** um filtro de situação ligado, **quando** clico em outro indicador (ex.:
  "Sem cronograma"), **então** o filtro troca para o novo (um filtro por vez, como antes).

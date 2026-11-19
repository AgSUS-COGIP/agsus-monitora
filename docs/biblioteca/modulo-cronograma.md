---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Cronograma (Calendário de editais)

Tela de leitura dos cronogramas de Editais, montada em `#page-calendario`, rota
`/<área>/cronograma`. Pasta `src/modulos/cronograma/`; regras puras em
`src/lib/cronograma/calendario-editais.ts`. O controlador chama `render()` ao abrir e `recarregar()` para
ignorar o cache. A área vem do app e recorta os editais já carregados. Inclui o resumo do dia do
responsável (o sininho do topo), que leva a esta tela.

## Onde fica

- `calendario-editais.tsx` (tela, mês aberto, filtros, dia selecionado, edital da linha do tempo),
  `partes.tsx` (grade, seletor, próximas etapas, linha do tempo, modal do dia), `vistas.tsx`
  (Lista e Semana), `estado.ts` (store externo, sessão, carga, cache, aviso de falhas parciais),
  `tipos.ts` e `demandas-internas.tsx`. CSS em `cronograma.css` e `demandas-internas.css` (cor da
  demanda: `--etapa-demanda`).
- `cronograma/calendario-editais.ts`: etapas por dia (conta no início e no fim, não no meio), filtros, grade
  de 42 células, próximas etapas. Classificação de etapas e plausibilidade das datas em
  `editais/etapas-de-edital.ts` e `cronograma/datas-do-cronograma.ts`.

## Vistas

Alternância Mês · Semana · Lista (`Segmentado`, `radiogroup`), guardada em `localStorage`
(`agsus:cronograma:visao`); sem escolha, Mês no computador e Lista no celular. As três usam as
mesmas etapas filtradas e o mesmo popup do dia. O passo (‹ Mês anterior, › Próximo mês, ou a
semana na Semana) e "Hoje" são o `NavegadorDeMes` de `src/ui/` ([[componentes-padrao]]).

- **Uma cor só: a do tipo de etapa** (a da legenda). A unidade é texto; o rótulo do tipo vai
  escrito ao lado ("● Entrevistas") — a cor nunca é o único sinal.
- **A legenda é o filtro de tipo** nas três vistas: botões `aria-pressed`, todos ligados de início;
  "Mostrar todos" e "Limpar tudo" religam. Desligados ficam em `agsus:cronograma:tipos-ocultos`.
  O filtro entra em `filtrarEtapas` (vistas, contagens, "Próximas etapas" e popup).
- **Mês**: chips "unidade – etapa" (sem o "DSEI "; nome inteiro no `title`), borda na cor do tipo,
  só nos marcos (dia único, "início" e "fim"); dias do meio sem chip (faixa contínua tirada em
  04/11). Até três chips (`CHIPS_POR_DIA`), o resto "+N mais". No celular, bolinhas dos tipos e
  total. Embaixo, "Próximas etapas" (5) com "Ver todas na Lista".
- **Lista**: um grupo por dia em que algo começa ou termina; no mês de hoje começa hoje (anteriores
  atrás de um botão); o que está em andamento aparece uma vez em "Acontecendo agora · N etapas"
  (recolhido acima de três). Rola com a página.
- **Semana**: sete dias, mesmo critério do Mês; dias do meio só "N em andamento". ‹ › andam.
- Na Lista e na Semana, "Próximas etapas" sai e a linha do tempo ocupa a largura toda.

## Carregamento

RPCs `get_nucleo_cronograma_resumo` e `listar_etapas_do_cronograma`; sem a segunda (`PGRST202`),
`get_monitoramento_cronograma` por edital, no máximo seis simultâneos. Falha individual mantém os
outros e avisa carga incompleta. Cache de um minuto e deduplicação de pedidos em voo; salvar em
Editais invalida o cache; trocar de área só recorta. Respostas entram como `unknown`; edital
precisa de ID textual ou numérico finito; etapas sem início interpretável ficam fora.

**Edital suspenso fica fora** (cartão #59, `editalSuspenso` em `cronograma/calendario-editais.ts`): o banco
devolve todo edital com `ativo = true`, e o suspenso continua ativo. O resumo traz o status efetivo
(`status`, com o excepcional `status_override` por cima das datas, como
`private."FC_ESTADO_DO_CRONOGRAMA"`) e `status_override`; se um deles contém "suspens" (sem acento
nem caixa), o edital sai de `editaisComCronograma`. Como as etapas só entram para os editais dessa
lista, ele some do Mês, da Semana, da Lista, de "Próximas etapas", da linha do tempo, do caminho
por edital (`PGRST202`) e do cache. `listar_etapas_do_cronograma` ainda devolve as etapas dele
(filtra só `ativo`); a tela as descarta. Paralisado e Cancelado seguem aparecendo.

## Demandas internas

Itens da equipe (migration `20261104120000_cronograma_demandas_internas`): título, descrição, data
ou período, área, edital opcional, responsáveis e conclusão. Chegam na mesma carga
(`listar_demandas_internas`; sem a RPC, só as etapas) como etapas do tipo **Demanda interna**
(`src/lib/cronograma/demandas-internas.ts`). Em aberto com último dia no passado = **Atrasada**; "Ocultar
concluídas". Concluir/Reabrir, Editar e Excluir (lógica) para quem pode (gestor da área ou admin
global, decidido pelo banco em `pode_editar`/`pode_criar_em`). Responsáveis pelo edital ficam no
formulário do edital (`src/modulos/editais/responsaveis-do-edital.tsx`).

## Resumo do dia do responsável

Sininho no topo (`src/app/casca/topo.tsx`) e popup "Bom dia, {nome} — seus editais hoje" (o
`Modal` de [[componentes-padrao]]), para quem é responsável por algum edital
(`RL_RESPONSAVEL_EDITAL`) ou demanda interna (`RL_DEMANDA_INTERNA_RESPONSAVEL`). Pasta
`src/modulos/resumo-do-dia/` (`estado.ts` com o store `resumoDoDia`, `resumo-do-dia.tsx`, e o CSS,
em que a cor de cada linha é a do tipo no Cronograma, `data-cor`); regras puras em
`src/lib/resumo-do-dia/resumo-do-dia.ts`; migration `20261104130000_resumo_do_dia_do_responsavel`.

- **Uma chamada** (`obter_meu_resumo_do_dia`) ao entrar (`src/app/sistema.ts`) e outra a cada
  clique no sininho; sem polling. O sininho mostra o número de pendências.
- **Abre sozinho** só ao entrar, se há o que mostrar, "Mostrar ao entrar" está ligado
  (`TB_PREFERENCIA_USUARIO`), não foi fechado hoje neste navegador (`localStorage`
  `agsus:resumo-do-dia:visto:<perfil>:<dia>`) e a tela está livre (nenhum modal aberto nem campo
  em digitação). Senão, fica só o sininho.
- **Blocos**: Hoje, Próximos 7 dias e Atrasadas (demandas vencidas em aberto); até cinco por bloco
  e "e mais N".
- **Concluir** (demanda atrasada, se `pode_concluir`) usa `concluir_demanda_interna` e avisa o
  Cronograma (`agsus:nucleo-cronograma-saved`).
- **Ver no cronograma** abre `/<área>/cronograma?visao=meus`: `abrirVisao("meus")` liga o recorte
  (`definirRecorte`) e mostra só editais e demandas de que a pessoa é responsável, com "Ver todos"
  para voltar.

## Testes

`tests/tipos/cronograma.tsx` (no `typecheck:frontend`), `tests/editais-cargas-e-paineis-na-tela.test.ts` (bloco `componentes/calendario-editais`)
(mês, área, cache, filtros, modal, foco), `tests/editais-cargas-e-paineis.test.js` (bloco `calendario-editais`) (normalização,
intervalos, concorrência, falhas), `tests/editais-cargas-e-paineis.test.js` (bloco `calendario-editais-lista`) (Lista, Semana, marcos,
bordas de mês e fuso), `tests/editais-cargas-e-paineis.test.ts` (bloco `cronograma-sem-suspensos`) (edital suspenso fora de todas as
vias), `tests/editais-cargas-e-paineis.test.js` (bloco `etapas-de-edital`), `tests/editais-cargas-e-paineis.test.js` (bloco `datas-do-cronograma`). Resumo do dia:
`tests/aya-e-comemoracao.test.js` (bloco `resumo-do-dia`) e `tests/demais-telas-na-tela.test.ts` (bloco `componentes/resumo-do-dia`).

## Relacionadas

- [[modulo-editais]] — onde o cronograma e o responsável do edital são cadastrados
- [[componentes-padrao]] — o `Modal` do resumo do dia
- [[acessibilidade-e-mobile]] — cor nunca é o único sinal
- [[arquitetura-do-front]] — recorte por área
- [regras-do-cronograma](../aya/regras-do-cronograma.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)

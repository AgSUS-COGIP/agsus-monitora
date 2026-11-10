---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Cronograma (Calendário de editais)

Tela de leitura dos cronogramas de Editais, montada em `#page-calendario`, rota
`/<área>/cronograma`. Pasta `src/modulos/cronograma/`; regras puras em
`src/lib/calendario-editais.ts`. O controlador chama `render()` ao abrir e `recarregar()` para
ignorar o cache. A área vem do app e recorta os editais já carregados.

## Arquivos

| Arquivo                  | Responsabilidade                                                      |
| ------------------------ | --------------------------------------------------------------------- |
| `calendario-editais.tsx` | tela, mês aberto, filtros, dia selecionado e edital da linha do tempo |
| `partes.tsx`             | grade, seletor, próximas etapas, linha do tempo e modal do dia        |
| `vistas.tsx`             | vistas Lista e Semana do card do calendário                           |
| `estado.ts`              | store externo, sessão, carga, cache e aviso de falhas parciais        |
| `tipos.ts`               | cliente de leitura, snapshot, filtros, etapas e células normalizadas  |
| `demandas-internas.tsx`  | card, detalhe, formulário e exclusão das demandas internas            |
| `cronograma.css`, `demandas-internas.css` | estilos (demanda: cor `--etapa-demanda`)         |

`calendario-editais.ts`: etapas por dia (conta no início e no fim, não no meio), filtros, grade de
42 células, próximas etapas. Classificação de etapas e plausibilidade das datas ficam em
`etapas-de-edital.ts` e `datas-do-cronograma.ts`.

## Vistas

Alternância Mês · Semana · Lista (`Segmentado`, `radiogroup`), guardada em `localStorage`
(`agsus:cronograma:visao`); sem escolha, Mês no computador e Lista no celular. As três usam as
mesmas etapas filtradas e o mesmo popup do dia.

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

## Demandas internas

Itens da equipe (migration `20261104120000_cronograma_demandas_internas`): título, descrição, data
ou período, área, edital opcional, responsáveis e conclusão. Chegam na mesma carga
(`listar_demandas_internas`; sem a RPC, só as etapas) como etapas do tipo **Demanda interna**
(`src/lib/demandas-internas.ts`). Em aberto com último dia no passado = **Atrasada**; "Ocultar
concluídas". Concluir/Reabrir, Editar e Excluir (lógica) para quem pode (gestor da área ou admin
global, decidido pelo banco em `pode_editar`/`pode_criar_em`). Responsáveis pelo edital ficam no
formulário do edital (`src/modulos/editais/responsaveis-do-edital.tsx`).

## Só os meus (`?visao=meus`)

"Ver no cronograma" do [[modulo-resumo-do-dia]] abre `/<área>/cronograma?visao=meus`:
`abrirVisao("meus")` liga o recorte (`definirRecorte`) e mostra só editais e demandas de que a
pessoa é responsável, com "Ver todos" para voltar.

## Testes

`tests/tipos/cronograma.tsx` (no `typecheck:frontend`), `tests/componentes/calendario-editais.test.ts`
(mês, área, cache, filtros, modal, foco), `tests/calendario-editais.test.js` (normalização,
intervalos, concorrência, falhas), `tests/calendario-editais-lista.test.js` (Lista, Semana, marcos,
bordas de mês e fuso), `tests/etapas-de-edital.test.js`, `tests/datas-do-cronograma.test.js`.

## Relacionadas

- [[modulo-editais]] — onde o cronograma é cadastrado
- [[modulo-resumo-do-dia]] — "Ver no cronograma"
- [[acessibilidade]] — cor nunca é o único sinal
- [[areas-do-sistema]] — recorte por área

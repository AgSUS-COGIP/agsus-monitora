---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Análises curriculares (Painel das análises)

A tela `#page-analises` (view `analises`, rota `/<área>/analises`), em `src/modulos/analises/`,
módulo do app desde a Etapa 4: `criarAnalises()` devolve o conteúdo e o controlador; a rota
(`src/app/telas.tsx`) desenha na própria `<section>` e chama `render()` a cada abertura. Área = a
atual do app; sessão, tema, aviso e tela cheia = os do app. Sem iframe, sem postMessage, sem
`window.*` próprio. É a leitura das análises (fichas publicadas e planilhas legadas); o fazer é a
[[modulo-avaliacao-documental]].

## Arquivos

```
analises.tsx    <TelaDeAnalises> e criarAnalises(): filtros, KPI, busca e o responsável do
                gráfico (estado do componente), avisos de sessão/acesso/erro/demora, controlador
paineis.tsx     filtros (situação do processo, seleção múltipla em cascata, Mais opções, chips),
                os 7 KPIs, gráficos (responsável empilhado clicável, análises por data clicável —
                filtra pelo dia/período, também nos campos de data de Mais opções) e pendências
ritmo.tsx       card "Ritmo da análise" por edital analisado no MONITORA (prazo do cronograma,
                faltam, por dia e por avaliador, ritmo atual e projeção) e "Destaques de hoje"
                (🥇🥈🥉 do dia e selo 🎯 Precisão; zera todo dia)
tabela.tsx      fila (TabelaInfinita: 50 por vez, Carregar mais, busca só da fila)
gaveta.tsx      detalhe: contexto, links (origem e PDF, só http/https), seções e parecer
espelho-na-gaveta.tsx  linha da ficha concluída: nota autodeclarada × consolidada e, por critério,
                Declarada / Após análise / Teto, com as justificativas do critério que mudou
                (a conta: src/lib/espelho-do-painel-de-analises.ts)
estado.ts       store sem React: carga por área e escopo, cópia do navegador, porteiro, gaveta
                (detalhamento sob demanda), pareceres em lote, CSV, comemorações
consultas.ts    as RPCs (lista, porteiro, detalhamento, pareceres, ritmo) e a cópia no IndexedDB
marcos.ts       edital 100% analisado e fila zerada (escopo Ativo); meta de hoje batida pela
                equipe (uma vez por dia por pessoa)
```

Regras puras em `src/lib/analises-curriculares.ts` (janela e validação, filtros em cascata, KPIs,
gráficos, pendências, recorte, gaveta, CSV), mais `area-do-painel-de-analises.ts`,
`lista-do-painel-de-analises.ts`, `textos-do-painel-de-analises.ts` e
`cache-do-painel-de-analises.ts`; o ritmo (etapa do cronograma, dias úteis, projeção) em
`src/lib/ritmo-da-analise.ts`. Visual só de `src/ui/` (sem CSS próprio). `marcos.ts` também avisa o
[[modulo-encerramento-do-edital]].

## TypeScript

O módulo inteiro e as regras puras estão em TypeScript, com contratos em `tipos.ts`. Estado e
ações, filtros, período, callbacks, gráficos e detalhamento passam pelo compilador estrito; o
snapshot expõe linhas e detalhes só para leitura.

A lista e os pareceres vindos das RPCs ou do cache têm o envelope validado antes de decodificar:
colunas textuais, linhas em arrays e nomes seguros. Resposta malformada não é guardada como lista
válida. O porteiro aceita booleanos; resposta inesperada mantém a consulta da lista como decisão de
acesso. Campos dinâmicos das planilhas continuam `unknown`, convertidos em texto na apresentação; o
compilador não verifica o esquema de cada edital.

O cliente Supabase continua compartilhado. O detalhamento (`get_analise_detalhe_do_painel`) traz,
desde a migration `20261020150000`, a chave "espelho" na linha da ficha concluída: a mesma entrada
dos espelhos de nota em massa, montada no navegador por `espelhoDaFichaGravada` (gaveta e espelho
sempre batem).

## Testes

`tests/analises-curriculares.test.js`, `tests/modulos/analises*.test.js`,
`tests/ritmo-da-analise.test.js`; os testes simulam consultas e armazenamento com a rede
bloqueada; `tests/tipos/analises.tsx` confere usos válidos e rejeições dos contratos. Histórias
AC-n em [historias-de-usuario/analises-curriculares.md](../historias-de-usuario/analises-curriculares.md).
Explicações para quem usa: `docs/aya/regras-das-analises.md`.

## Relacionadas

- [[modulo-avaliacao-documental]] — onde as fichas são feitas e publicadas aqui
- [[cargas-de-planilha]] — as planilhas legadas que também alimentam o painel
- [[carga-da-entrada]] — cópia no navegador (IndexedDB)
- [[componentes-padrao]] — TabelaInfinita, Kpi, gráficos
- [regras-das-analises](../aya/regras-das-analises.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)

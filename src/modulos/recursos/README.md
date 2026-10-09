# `src/modulos/recursos/` — Recursos dos candidatos

A tela `#page-recursos` (view `recursos`), módulo do app desde a Etapa 2: monta na própria
`<section>` por `montarRecursos()` (`src/main.js` → `window.recursosController`); o legado chama
`render()` ao navegar. Área = a atual do app; sessão, tema, aviso e tela cheia = os do app.

```
recursos.jsx    <TelaDeRecursos> e montarRecursos() (área atual, troca de área, controlador)
estado.js       store sem React: carga da área, gaveta, formulário, escritas (RPC e Storage)
paineis.jsx     topo (status e ações), filtros, 4 KPIs, recorte, gráficos, pendências
tabela.jsx      fila (TabelaInfinita), selos de situação, resposta e prazo
gaveta.jsx      detalhe: parecer, etapas, resposta, anexos, resultado, prazo, observação, histórico
parecer.jsx     parecer jurídico: enviar, deferir/deferir parcialmente/indeferir, devolver, reabrir
ajuste.jsx      ajuste da pontuação no recurso deferido: componentes da regra, prévia da posição,
                propor, aprovar (prévia recalculada), cancelar, versões
formulario.jsx  cadastro e edição (candidato buscado nas análises do edital)
resposta.jsx    resposta ao candidato: modelo, prévia, revisão, documento
anexos.jsx      anexos com download registrado (URL assinada de 60 s)
modelos.jsx     modelos de resposta (administração)
partes.jsx      dataHora e nota
recursos.css    só o que é desta tela (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/` (`recursos-dos-candidatos.ts`, `prazo-do-recurso.ts`,
`resposta-do-recurso.js`, `parecer-do-recurso.js`, `anexos-do-recurso.js`,
`modelos-de-resposta.js`, `documento-da-resposta.js`). Testes: `tests/modulos/recursos*.test.js`.

Decidir é só de quem tem `recursos_parecer` (Acessos › "Parecer jurídico (Recursos)", grupo
"Jurídico"); o banco confere (`20261001170000_recursos_parecer_juridico.sql`). As regras
explicadas à pessoa ficam com a Aya (`docs/aya/regras-dos-recursos.md`).

Ajuste da pontuação (`20261005130000_recurso_ajusta_pontuacao.sql`): propor e aprovar são do
parecer jurídico; aprovar exige o recurso deferido; reabrir/indeferir/devolver/excluir cancela
(gatilho). A conta da prévia é a da Classificação (`src/lib/classificacao/ajustes.js`); a nota
da planilha nunca muda. "O recurso mudou a classificação" é automática (aprovação do ajuste).

## TypeScript no painel

O topo, filtros, indicadores, recorte, pendências, gráficos e fila estão em TSX.
As regras compartilhadas de enriquecimento, busca, indicadores, duplicidade, formulário e CSV
estão em `src/lib/recursos-dos-candidatos.ts`; leitura do cronograma e prazo em
`src/lib/prazo-do-recurso.ts`. Os contratos ficam em `src/lib/tipos-dos-recursos.ts`:
dados do recurso, cálculos, etapas, origens, filtros e rascunho. O enriquecimento preserva os
campos adicionais da entrada. Prazo e dias restantes podem ser nulos; os gráficos protegem
callbacks sem elemento e dicas vazias. Os testes de compilação ficam em
`tests/tipos/painel-de-recursos.tsx`.

A entrada, o estado, a gaveta e os formulários continuam em JavaScript/JSX. Estes contratos
não substituem validação do JSON recebido pelo estado; essa fronteira ainda será migrada.
As permissões, RPCs, Storage e transições jurídicas permanecem com as regras existentes.

# `src/modulos/recursos/` — Recursos dos candidatos

A tela `#page-recursos` (view `recursos`), módulo do app desde a Etapa 2: monta na própria
`<section>` por `montarRecursos()` (`src/main.js` → `window.recursosController`); o legado chama
`render()` ao navegar. Área = a atual do app; sessão, tema, aviso e tela cheia = os do app.

```
recursos.jsx    <TelaDeRecursos> e montarRecursos() (área atual, troca de área, controlador)
estado.js       store sem React: carga da área, gaveta, formulário, escritas (RPC e Storage)
paineis.jsx     topo (status e ações), filtros, KPIs, recorte, gráficos, pendências
tabela.jsx      fila (TabelaInfinita), selos de situação, resposta e prazo
gaveta.jsx      detalhe: etapas, resposta, anexos, resultado, prazo, observação, histórico
formulario.jsx  cadastro e edição (candidato buscado nas análises do edital)
resposta.jsx    resposta ao candidato: modelo, prévia, revisão, documento
anexos.jsx      anexos com download registrado (URL assinada de 60 s)
modelos.jsx     modelos de resposta (administração)
partes.jsx      dataHora e nota
recursos.css    só o que é desta tela (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/` (`recursos-dos-candidatos.js`, `prazo-do-recurso.js`,
`resposta-do-recurso.js`, `anexos-do-recurso.js`, `modelos-de-resposta.js`,
`documento-da-resposta.js`). Testes: `tests/modulos/recursos*.test.js`.

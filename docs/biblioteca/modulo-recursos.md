---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Recursos dos candidatos

Duas entradas do menu (como Entrevistas), cada uma na própria `<section>` e com o próprio estado,
em `src/modulos/recursos/` (o modelo de tela de página inteira). A rota (`src/app/telas.tsx`)
chama `render()` a cada abertura. Área = a atual do app; sessão, tema, aviso e tela cheia = os do app.

- **Painel de recursos** (`#page-recursos`, view `recursos`, rota `/<área>/painel-de-recursos`,
  `criarRecursos()`): acompanhar, só leitura — status, exportação, filtros, KPIs, recorte,
  gráficos, pendências e a fila; o detalhe abre sem ações (`somenteLeitura`).
- **Analisar recursos** (`#page-analisar-recursos`, view `analisar-recursos`, rota
  `/<área>/recursos`, `criarAnaliseDeRecursos()`, selo BETA): fazer — Novo recurso, Modelos de
  resposta, filtros e a fila; a gaveta com todas as ações.

Atalhos: no painel, "Analisar" (os mesmos filtros) e, no detalhe, "Analisar este recurso"; na
análise, "Ver no painel". Levam o pedido por `pedirFiltro` e navegam por `irParaTela`. Vê a análise
quem edita Recursos ou dá o parecer jurídico (`canAnalisarRecursos`); o menu vem do banco
(`20261009230000_analisar_recursos_no_menu.sql`).

## Arquivos

```
recursos.tsx    <TelaDeRecursos modo>, montarRecursos() e montarAnaliseDeRecursos() (área, controlador)
estado.ts       store sem React: carga da área, gaveta, formulário, escritas (RPC e Storage)
paineis.tsx     topo (status e ações), filtros, 4 KPIs, recorte, gráficos, pendências
tabela.tsx      fila (TabelaInfinita), selos de situação, resposta e prazo
gaveta.tsx      detalhe: parecer, etapas, resposta, anexos, resultado, prazo, observação, histórico
parecer.tsx     parecer jurídico: enviar, deferir/deferir parcialmente/indeferir, devolver, reabrir
ajuste.tsx      ajuste da pontuação no recurso deferido: componentes da regra, prévia da posição,
                propor, aprovar (prévia recalculada), cancelar, versões
formulario.tsx  cadastro e edição (candidato buscado nas análises do edital)
resposta.tsx    resposta ao candidato: modelo, prévia, revisão, documento
anexos.tsx      anexos com download registrado (URL assinada de 60 s)
modelos.tsx     modelos de resposta (administração)
partes.ts       dataHora e nota
parecer-em-blocos/  PROTÓTIPO "Montar parecer" (desligado): o simulador de pareceres da Saúde
                Indígena em blocos por etapa, com prévia
recursos.css    só o que é desta tela (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/` (`recursos-dos-candidatos.ts`, `prazo-do-recurso.ts`,
`resposta-do-recurso.ts`, `parecer-do-recurso.ts`, `anexos-do-recurso.ts`, `modelos-de-resposta.ts`,
`documento-da-resposta.ts`). Protótipo "Montar parecer": fontes do pré-preenchimento, tabelas e RPCs
propostas em [recursos/parecer-em-blocos.md](../recursos/parecer-em-blocos.md).

## Regras

- Decidir é só de quem tem `recursos_parecer` (Acessos › "Parecer jurídico (Recursos)", grupo
  "Jurídico"); o banco confere (`20261001170000_recursos_parecer_juridico.sql`).
- Ajuste da pontuação (`20261005130000_recurso_ajusta_pontuacao.sql`): propor e aprovar são do
  parecer jurídico; aprovar exige o recurso deferido; reabrir/indeferir/devolver/excluir cancela
  (gatilho). A conta da prévia é a da Classificação (`src/lib/classificacao/ajustes.ts`); a nota da
  planilha nunca muda. "O recurso mudou a classificação" é automática (aprovação do ajuste).
- As regras explicadas à pessoa ficam com a Aya (`docs/aya/regras-dos-recursos.md`).

Contratos TypeScript, validações e o comportamento na troca de área: [[recursos-contratos]].

## Testes

`tests/modulos/recursos*.test.js`; os demais (dados, contexto e contratos de compilação) estão em
[[recursos-contratos]].

## Relacionadas

- [[modulo-classificacao]] — motor e ajustes da pontuação
- [[permissoes-e-perfis]] — `recursos_parecer` e o grupo Jurídico
- [[modulo-acessos]] — onde se concede o parecer jurídico
- [[dados-pessoais]] — anexos com download registrado
- [[modulo-entrevistas]] — o mesmo padrão acompanhar × fazer
- [regras-dos-recursos](../aya/regras-dos-recursos.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)

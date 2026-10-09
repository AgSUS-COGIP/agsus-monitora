# `src/modulos/recursos/` — Recursos dos candidatos

Duas entradas do menu (como Entrevistas), cada uma na própria `<section>` e com o próprio estado:

- **Painel de recursos** (`#page-recursos`, view `recursos`, `montarRecursos()` →
  `window.recursosController`): acompanhar, só leitura — status, exportação, filtros, KPIs,
  recorte, gráficos, pendências e a fila; o detalhe abre sem ações (`somenteLeitura`).
- **Analisar recursos** (`#page-analisar-recursos`, view `analisar-recursos`,
  `montarAnaliseDeRecursos()` → `window.analisarRecursosController`, selo BETA): fazer — Novo
  recurso, Modelos de resposta, filtros e a fila; a gaveta com todas as ações.

Atalhos: no painel, "Analisar" (os mesmos filtros) e, no detalhe, "Analisar este recurso"; na
análise, "Ver no painel". Levam o pedido por `pedirFiltro` e navegam por `irParaLink`. Vê a
análise quem edita Recursos ou dá o parecer jurídico (`canAnalisarRecursos`); o menu vem do banco
(`20261009230000_analisar_recursos_no_menu.sql`). O legado chama `render()` ao navegar. Área = a
atual do app; sessão, tema, aviso e tela cheia = os do app.

```
recursos.tsx    <TelaDeRecursos modo>, montarRecursos() e montarAnaliseDeRecursos() (área, controlador)
estado.ts       store sem React: carga da área, gaveta, formulário, escritas (RPC e Storage)
paineis.tsx     topo (status e ações), filtros, 4 KPIs, recorte, gráficos, pendências
tabela.tsx      fila (TabelaInfinita), selos de situação, resposta e prazo
gaveta.tsx      detalhe: parecer, etapas, resposta, anexos, resultado, prazo, observação, histórico
parecer.tsx     parecer jurídico: enviar, deferir/deferir parcialmente/indeferir, devolver, reabrir
ajuste.jsx      ajuste da pontuação no recurso deferido: componentes da regra, prévia da posição,
                propor, aprovar (prévia recalculada), cancelar, versões
formulario.tsx  cadastro e edição (candidato buscado nas análises do edital)
resposta.tsx    resposta ao candidato: modelo, prévia, revisão, documento
anexos.tsx      anexos com download registrado (URL assinada de 60 s)
modelos.tsx     modelos de resposta (administração)
partes.ts      dataHora e nota
recursos.css    só o que é desta tela (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/` (`recursos-dos-candidatos.ts`, `prazo-do-recurso.ts`,
`resposta-do-recurso.ts`, `parecer-do-recurso.ts`, `anexos-do-recurso.js`,
`modelos-de-resposta.ts`, `documento-da-resposta.js`). Testes: `tests/modulos/recursos*.test.js`.

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

A entrada, o estado e o cadastro/edição também estão em TypeScript/TSX. Os contratos de
snapshot, cliente RPC/Storage, ações, busca e callbacks ficam em `tipos-do-estado.ts`.
`src/lib/dados-dos-recursos.ts` valida os campos usados no painel e no formulário,
conservando campos adicionais e tratando permissões somente quando booleanas. O detalhe
valida histórico, autores das etapas, textos do parecer e metadados dos anexos.
Resposta e modelos também são validados: identificadores, versões, textos, histórico e
escopo dos modelos. Modelos com área/origem malformada são ignorados; respostas com
identificador, revisão ou estado inválido são sinalizadas sem abrir um novo rascunho.
Dados complexos de ajuste e Classificação continuam opacos para o componente de ajuste.

Trocar área ou usuário invalida consultas de detalhe, ajustes, prévias e modelos, e os
efeitos locais de ações em curso: não fecha o formulário novo, mostra avisos antigos nem
libera a ação da nova área. Upload concluído depois da troca não inicia registro; uma
assinatura antiga não abre download. Isso não cancela escrita ou upload já enviado ao
banco/Storage. O arquivo de um upload interrompido depois de enviado pode ficar sem registro.

A busca de candidato descarta o resultado quando o campo muda ou o componente desmonta.
Gaveta, parecer, anexos, resposta e modelos estão em TSX; somente ajuste ainda está em JSX.
Os contratos da gaveta ficam em `tipos-da-gaveta.ts`; as regras do parecer e os botões
permitidos estão em `src/lib/parecer-do-recurso.ts`.
Os contratos da resposta e dos modelos ficam em `src/lib/tipos-da-resposta-do-recurso.ts`.
As regras de preenchimento e seleção de modelos estão em `src/lib/modelos-de-resposta.ts`;
transições e revisão em `src/lib/resposta-do-recurso.ts`. A versão usada na resposta continua
escolhível quando arquivada ou substituída; os marcadores são preenchidos uma única vez, como
texto puro. A autoria continua restringindo aprovação/devolução, e a decisão do recurso
continua sendo exigida para aprovação e marcação de envio.
As permissões no banco, RPCs, Storage e transições jurídicas seguem as regras existentes.

Verificação: `tests/dados-dos-recursos.test.js`, `tests/modulos/recursos-estado-contexto.test.js`,
testes existentes de Recursos e contratos de compilação em `tests/tipos/estado-dos-recursos.tsx`
`tests/tipos/gaveta-dos-recursos.tsx` e `tests/tipos/resposta-e-modelos-dos-recursos.tsx`.

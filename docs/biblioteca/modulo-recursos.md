---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Recursos dos candidatos

Duas entradas do menu (como Entrevistas), cada uma na própria `<section>` e com o próprio estado,
em `src/modulos/recursos/` (o modelo de tela de página inteira). A rota (`src/app/telas.tsx`)
chama `render()` a cada abertura. Área = a atual do app; sessão, tema, aviso e tela cheia = os do app.

- **Painel de recursos** (`#page-recursos`, view `recursos`, rota `/<área>/painel-de-recursos`,
  `criarRecursos()`): acompanhar, só leitura — status, exportação, filtros, KPIs, recorte,
  gráficos, pendências e a fila; o detalhe abre sem ações (`somenteLeitura`). Com a base carregada
  e nenhum recurso na área, uma linha compacta (`.recursos-sem-recursos`) fica no lugar dos gráficos
  e das pendências; carregando, os skeletons; com falha na carga, só o aviso de erro.
- **Analisar recursos** (`#page-analisar-recursos`, view `analisar-recursos`, rota
  `/<área>/recursos`, `criarAnaliseDeRecursos()`, selo BETA): fazer — Novo recurso, Modelos de
  resposta, filtros e a fila; a gaveta com todas as ações.

Atalhos: no painel, "Analisar" (os mesmos filtros) e, no detalhe, "Analisar este recurso"; na
análise, "Ver no painel". Levam o pedido por `pedirFiltro` e navegam por `irParaTela`. Vê a análise
quem edita Recursos ou dá o parecer jurídico (`canAnalisarRecursos`); o menu vem do banco
(`20261009230000_analisar_recursos_no_menu.sql`).

## Regras

- Decidir é só de quem tem `recursos_parecer` (Acessos › "Parecer jurídico (Recursos)", grupo
  "Jurídico"); o banco confere (`20261001170000_recursos_parecer_juridico.sql`). Sem ninguém no
  grupo, só os administradores dão o parecer.
- Ajuste da pontuação (`20261005130000_recurso_ajusta_pontuacao.sql`): propor e aprovar são do
  parecer jurídico; aprovar exige o recurso deferido; reabrir/indeferir/devolver/excluir cancela
  (gatilho). A conta da prévia é a da Classificação (`src/lib/classificacao/ajustes.ts`, que mantém
  totais pela soma das diferenças e recalcula a prévia antes da aprovação); a nota da planilha nunca
  muda. "O recurso mudou a classificação" é automática (aprovação do ajuste).
- Resposta ao candidato: a versão usada continua escolhível quando arquivada ou substituída; os
  marcadores são preenchidos uma única vez, como texto puro. A autoria restringe aprovação e
  devolução, e a decisão do recurso é exigida para aprovar e marcar o envio.
- Anexos com download registrado (URL assinada de 60 s).
- As regras explicadas à pessoa ficam com a Aya
  ([regras-dos-recursos](../aya/regras-dos-recursos.md)), não na interface.

## Validação na fronteira

Tudo em TypeScript/TSX. O que vem do banco é validado antes de usar:

- `src/lib/recursos/dados-dos-recursos.ts` valida os campos do painel e do formulário (conserva campos
  adicionais; permissões só quando booleanas) e, no detalhe, histórico, autores das etapas, textos
  do parecer e metadados dos anexos.
- Resposta e modelos: identificadores, versões, textos, histórico e escopo. Modelo com área/origem
  malformada é ignorado; resposta com identificador, revisão ou estado inválido é sinalizada sem
  abrir um novo rascunho.
- Ajuste: versões, itens, permissões e resumos de prévia em
  `src/lib/classificacao/dados-dos-ajustes.ts`; coleções malformadas da Classificação são
  sinalizadas antes de calcular, propor ou aprovar. A configuração da regra continua interpretada
  pelo motor (`src/lib/classificacao/motor.ts`).
- Prazo e dias restantes podem ser nulos; os gráficos protegem callbacks sem elemento e dicas vazias.

## Troca de área ou usuário

Invalida consultas de detalhe, ajustes, prévias e modelos, e os efeitos locais de ações em curso:
não fecha o formulário novo, não mostra avisos antigos nem libera a ação da nova área. Upload
concluído depois da troca não inicia registro; assinatura antiga não abre download. **Não cancela**
escrita ou upload já enviado ao banco/Storage: o arquivo de um upload interrompido depois de enviado
pode ficar sem registro. A busca de candidato descarta o resultado quando o campo muda ou o
componente desmonta.

## Código e testes

- `recursos.tsx` (`<TelaDeRecursos modo>`, `montarRecursos()`, `montarAnaliseDeRecursos()`),
  `estado.ts` (store sem React: carga da área, gaveta, formulário, escritas por RPC e Storage),
  `gaveta.tsx` (detalhe), `parecer.tsx` (enviar, deferir/deferir parcialmente/indeferir, devolver,
  reabrir), `ajuste.tsx` (componentes da regra, prévia da posição, propor, aprovar, cancelar,
  versões), `formulario.tsx` (candidato buscado nas análises do edital), `resposta.tsx`,
  `modelos.tsx` (administração), `recursos.css` (só tokens; o resto vem de `src/ui/`).
- Regras puras em `src/lib/`: `recursos/recursos-dos-candidatos.ts` (enriquecimento, busca, indicadores,
  duplicidade, formulário, CSV), `recursos/prazo-do-recurso.ts`, `recursos/parecer-do-recurso.ts` (botões permitidos),
  `recursos/resposta-do-recurso.ts` (transições e revisão), `recursos/modelos-de-resposta.ts`,
  `recursos/anexos-do-recurso.ts`, `recursos/documento-da-resposta.ts`.
- Contratos: `src/lib/recursos/tipos-dos-recursos.ts`, `tipos-do-estado.ts`, `tipos-da-gaveta.ts`,
  `src/lib/recursos/tipos-da-resposta-do-recurso.ts`, `src/lib/classificacao/tipos-dos-ajustes.ts`.
- `recursos/parecer-em-blocos/`: PROTÓTIPO "Montar parecer" (desligado), o simulador de pareceres da Saúde
  Indígena em blocos por etapa, com prévia. Fontes do pré-preenchimento, tabelas e RPCs propostas em
  [recursos/parecer-em-blocos.md](../recursos/parecer-em-blocos.md).
- Testes: `tests/modulos/recursos*.test.js`, `tests/avaliacao-e-recursos.test.js` (bloco `dados-dos-recursos`),
  `tests/classificacao.test.js` (bloco `lib/classificacao-ajustes`), `tests/classificacao.test.js` (bloco `lib/dados-dos-ajustes`) e os contratos de
  compilação em `tests/tipos/` (`painel-de-recursos.tsx`, `estado-dos-recursos.tsx`,
  `gaveta-dos-recursos.tsx`, `resposta-e-modelos-dos-recursos.tsx`, `ajuste-dos-recursos.tsx`).

## Relacionadas

- [[modulo-classificacao]] — motor e ajustes da pontuação
- [[modulo-avaliacao-documental]] — a ficha que o ajuste não altera; "Ver ficha" pendente (F6)
- [[modulo-acessos]] — `recursos_parecer`, o grupo Jurídico e onde se concede
- [[dados-pessoais]] — anexos com download registrado
- [[modulo-entrevistas]] — o mesmo padrão acompanhar × fazer
- [[regras-do-codigo]] — TypeScript e validação na fronteira

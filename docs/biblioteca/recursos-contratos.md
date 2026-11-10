---
tipo: referencia
area: modulo
atualizado: 2026-11-10
---

# Recursos: contratos TypeScript e validação

Complemento de [[modulo-recursos]]: o que está tipado, o que é validado na fronteira e o que
acontece quando a área ou o usuário mudam no meio de uma ação.

## Painel

Topo, filtros, indicadores, recorte, pendências, gráficos e fila estão em TSX. As regras de
enriquecimento, busca, indicadores, duplicidade, formulário e CSV estão em
`src/lib/recursos-dos-candidatos.ts`; leitura do cronograma e prazo em `src/lib/prazo-do-recurso.ts`.
Contratos em `src/lib/tipos-dos-recursos.ts`: dados do recurso, cálculos, etapas, origens, filtros e
rascunho. O enriquecimento preserva os campos adicionais da entrada. Prazo e dias restantes podem
ser nulos; os gráficos protegem callbacks sem elemento e dicas vazias. Compilação:
`tests/tipos/painel-de-recursos.tsx`.

## Entrada, estado e formulário

Entrada, estado e cadastro/edição em TypeScript/TSX; contratos de snapshot, cliente RPC/Storage,
ações, busca e callbacks em `tipos-do-estado.ts`. `src/lib/dados-dos-recursos.ts` valida os campos
usados no painel e no formulário, conservando campos adicionais e tratando permissões só quando
booleanas. O detalhe valida histórico, autores das etapas, textos do parecer e metadados dos anexos.

Resposta e modelos também são validados: identificadores, versões, textos, histórico e escopo dos
modelos. Modelos com área/origem malformada são ignorados; respostas com identificador, revisão ou
estado inválido são sinalizadas sem abrir um novo rascunho. Versões, itens, permissões e resumos de
prévia do ajuste são validados em `src/lib/classificacao/dados-dos-ajustes.ts`; coleções
malformadas da Classificação e itens inválidos de versões são sinalizados antes de
calcular/propor/aprovar. A configuração da regra continua interpretada pelo motor existente.

## Troca de área ou usuário

Trocar área ou usuário invalida consultas de detalhe, ajustes, prévias e modelos, e os efeitos
locais de ações em curso: não fecha o formulário novo, não mostra avisos antigos nem libera a ação
da nova área. Upload concluído depois da troca não inicia registro; assinatura antiga não abre
download. Isso não cancela escrita ou upload já enviado ao banco/Storage: o arquivo de um upload
interrompido depois de enviado pode ficar sem registro. A busca de candidato descarta o resultado
quando o campo muda ou o componente desmonta.

## Gaveta, ajuste, resposta e modelos

- Todos os componentes da pasta estão em TSX, e o estado em TypeScript.
- Ajuste: contratos de `src/lib/classificacao/tipos-dos-ajustes.ts` (componentes, valores, versões,
  permissões, proposta e prévia). As regras de `ajustes.ts` mantêm totais pela soma das diferenças e
  recalculam a prévia antes da aprovação. O motor `src/lib/classificacao/motor.ts` também está em
  TypeScript, com contratos para candidatos, entrevistas, ajustes e saída das listas.
- Gaveta: contratos em `tipos-da-gaveta.ts`; regras do parecer e botões permitidos em
  `src/lib/parecer-do-recurso.ts`.
- Resposta e modelos: contratos em `src/lib/tipos-da-resposta-do-recurso.ts`; preenchimento e
  seleção de modelos em `src/lib/modelos-de-resposta.ts`; transições e revisão em
  `src/lib/resposta-do-recurso.ts`. A versão usada na resposta continua escolhível quando arquivada
  ou substituída; os marcadores são preenchidos uma única vez, como texto puro. A autoria continua
  restringindo aprovação/devolução, e a decisão do recurso continua exigida para aprovação e
  marcação de envio.
- Permissões no banco, RPCs, Storage, transições jurídicas, regras dos editais e permissões do banco
  seguem as regras existentes.

## Verificação

`tests/dados-dos-recursos.test.js`, `tests/modulos/recursos-estado-contexto.test.js`, os testes de
Recursos e os contratos de compilação `tests/tipos/estado-dos-recursos.tsx`,
`tests/tipos/gaveta-dos-recursos.tsx`, `tests/tipos/resposta-e-modelos-dos-recursos.tsx` e
`tests/tipos/ajuste-dos-recursos.tsx`. Ajustes também em `tests/lib/classificacao-ajustes.test.js`
e `tests/lib/dados-dos-ajustes.test.js`.

## Relacionadas

- [[modulo-recursos]] — a tela
- [[typescript-no-front]] — o estado da migração
- [[testes]] — como rodar

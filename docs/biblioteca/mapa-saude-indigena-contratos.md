---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Mapa da Saúde Indígena: TypeScript e fronteiras dos dados

Contratos e limites da tipagem do [[modulo-mapa-saude-indigena]] e da base que ele compartilha
com o [[modulo-mapa-de-projetos]].

## Base compartilhada

- Painel, lista lateral, controles, legenda, tela cheia, retorno ao Brasil e o hook `usarUltimo`
  estão em TypeScript. Contratos em `tipos-do-painel.ts`; formas e cores em
  `src/lib/mapa-saude-indigena/formas.ts`. O painel preserva o tipo das camadas de cada mapa.
- A legenda das Terras Indígenas descreve a ponte opcional com a camada existente: sem ela, os
  controles ficam desabilitados; os ouvintes são retirados ao desmontar.

## Telas e regras

- As telas principal, nacional e por DSEI estão em TSX. Contagens, bolhas, CASAIs, unidades,
  vínculos, resumos e enquadramentos estão em `src/lib/mapa-saude-indigena/chaves.ts`,
  `mapa-nacional.ts` e `mapa-do-dsei.ts`.
- Contratos de distritos, polos, registros, CASAIs, Terras Indígenas e callbacks:
  `src/lib/mapa-saude-indigena/tipos.ts`.
- `dados-do-mapa.ts` valida os dados externos para a exibição: ignora registros inválidos, recusa
  posições não escalares e desabilita o enquadramento de terras com caixa inválida. Polo sem
  posição válida não vira ponto na coordenada zero.

## Leaflet

- A integração está em `leaflet.ts`, com contratos em `tipos-do-leaflet.ts`: criação, fundo com
  recurso, tamanho, contornos, enquadramento, leque, ícones e balões.
- `obterLeaflet` valida as fábricas essenciais e preserva o namespace original; contornos
  continuam opcionais. `tipos-do-leaflet.ts` declara a API mínima usada e verifica a presença dos
  métodos, sem alterá-lo; não valida os retornos internos do Leaflet nem substitui a API completa.
- A conversão de UF, as guardas globais e o recuo de tiles permanecem em JavaScript, com contratos
  JSDoc na integração.

## SIGEPSI como fonte dos pontos

- `src/lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts` transforma a resposta de `/api/dseis` em
  DSEIs, sedes, polos, CASAIs, unidades e CASAIs nacionais (`casaisNacionais`); `localizacoes.ts`
  (no módulo) faz o pedido. Do banco entram só nome, população e UFs administrativas do `lmap`.
- Sem o SIGEPSI não há mapa: a Visão geral mostra o erro com "Tentar novamente", sem plano B.
- Não há mais edição de coordenadas neste mapa (o editor comum é só de Projetos), nem `rede_cnes`
  nem reconciliação com o CNES. A tipagem não mudou contratos de RPC.

## Testes

- Ciclo de vida, StrictMode, legendas, Escape, foco, tela cheia e modo de edição: testes dos dois
  mapas.
- Dados: `tests/dados-do-mapa-saude-indigena.test.js`, `tests/coordenadas-so-do-sigepsi.test.js` e
  `tests/lib/localizacoes-do-sigepsi.test.ts`. Interações: `tests/modulos/mapa-saude-indigena.test.js`.
- Contratos: `tests/tipos/mapa-saude-indigena.tsx`, `tests/tipos/base-dos-mapas.tsx`,
  `tests/tipos/regras-geograficas.tsx` e `tests/tipos/integracao-do-leaflet.tsx`.

## Relacionadas

- [[typescript-no-front]] — o estado da migração para TypeScript
- [[mapas-e-leaflet]] — a fábrica do Leaflet e as guardas
- [[modulo-editor-de-coordenadas]] — o editor comum

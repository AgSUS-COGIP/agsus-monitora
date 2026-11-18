---
tipo: referencia
area: modulo
atualizado: 2026-11-17
---

# Mapa da Saúde Indígena: tipos, fronteiras dos dados e legado

Contratos e limites da tipagem do [[modulo-mapa-saude-indigena]] e da base que ele compartilha com
o [[modulo-mapa-de-projetos]], e o que a migração para React tirou do legado (para não recriar).

## Base compartilhada

- Painel, lista lateral, controles, legenda, tela cheia, retorno ao Brasil e o hook `usarUltimo`
  estão em TypeScript. Contratos em `tipos-do-painel.ts`; formas e cores em
  `src/lib/mapas/mapa-saude-indigena/formas.ts`. O painel preserva o tipo das camadas de cada mapa.
- A legenda das Terras Indígenas descreve a ponte opcional com a camada existente: sem ela, os
  controles ficam desabilitados; os ouvintes são retirados ao desmontar.

## Telas e regras

- As telas principal, nacional e por DSEI estão em TSX. Contagens, bolhas, CASAIs, unidades,
  vínculos, resumos e enquadramentos estão em `src/lib/mapas/mapa-saude-indigena/chaves.ts`,
  `mapa-nacional.ts` e `mapa-do-dsei.ts`.
- Contratos de distritos, polos, registros, CASAIs, Terras Indígenas e callbacks:
  `src/lib/mapas/mapa-saude-indigena/tipos.ts`.
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

- `src/lib/mapas/mapa-saude-indigena/localizacoes-do-sigepsi.ts` transforma a resposta de `/api/dseis` em
  DSEIs, sedes, polos, CASAIs, unidades e CASAIs nacionais (`casaisNacionais`); `localizacoes.ts`
  (no módulo) faz o pedido. Do banco entram só nome, população e UFs administrativas do `lmap`.
- Sem o SIGEPSI não há mapa: a aba Mapa mostra o erro com "Tentar novamente", sem plano B.
- Não há edição de coordenadas neste mapa (o editor comum é só de Projetos), nem `rede_cnes` nem
  reconciliação com o CNES. A tipagem não mudou contratos de RPC.

## O que saiu do legado

A migração (Etapa 5 da [[arquitetura-do-front]], parte "mapas") tirou de `index.html` o bloco do
mapa inteiro (`section.health-map-pane`, `#map`, `#detailMap`, listas, legendas), de
`legacy-app.js` o desenho dos dois mapas (`LMAP`, `REDE_CNES`, `initLeaflet`, `renderDetailMap`,
`voltarAoBrasil`, `applyFilters`…; ficou `loadMapaConfig`, que publica no estado), os módulos
`vinculos-territoriais.js`, `controles-do-mapa.js`, `legenda-das-terras.js` e
`health-map-immersive-workspace.js`, e o CSS `health-map-*` e os `#map` de `app.css` e afins (os
`--terra-*` foram para `tokens.css`). Não recrie nada disso.

## O que mudou em relação ao legado

- Sem o modo Calor (saiu em 02/10/2026, a pedido da gestão): a bolha só diz se há edital no recorte.
- O DSEI ativo é verde com borda amarela, como a legenda diz (`CORES_DO_MAPA`); o legado pintava de
  azul por cima.
- O DSEI fecha por "← Voltar ao Brasil" (botão primário no topo do painel; o trilho
  "Brasil › DSEI" saiu) ou por Esc.
- Lista de unidades com a forma do tipo (a mesma da legenda), não ícone Font Awesome.
- Sem textos de ajuda no mapa ("Escolha um DSEI…", "clique para abrir o território", avisos ao
  voltar): foram para a Aya; estados vazios em uma linha ([[textos-da-interface]]).

## Testes

- Ciclo de vida, StrictMode, legendas, Escape, foco, tela cheia e modo de edição: testes dos dois
  mapas.
- Dados: `tests/dados-do-mapa-saude-indigena.test.js`, `tests/coordenadas-so-do-sigepsi.test.js` e
  `tests/lib/localizacoes-do-sigepsi.test.ts`. Interações: `tests/modulos/mapa-saude-indigena.test.js`.
- Contratos: `tests/tipos/mapa-saude-indigena.tsx`, `tests/tipos/base-dos-mapas.tsx`,
  `tests/tipos/regras-geograficas.tsx` e `tests/tipos/integracao-do-leaflet.tsx`.

## Relacionadas

- [[modulo-mapa-saude-indigena]] — o mapa de hoje
- [[regras-do-codigo]] — o estado da migração para TypeScript
- [[nova-tela-e-legado]] — a regra de apagar o que a migração substituiu
- [[mapas-e-leaflet]] — a fábrica do Leaflet e as guardas
- [[coordenadas]] — o editor comum de coordenadas (só Projetos)

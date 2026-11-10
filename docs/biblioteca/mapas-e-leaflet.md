---
tipo: guia
area: front
atualizado: 2026-11-10
---

# Mapas e Leaflet

O MONITORA tem dois mapas, os dois em Leaflet e em TypeScript: o da Saúde Indígena (nacional e por
DSEI) e o de Projetos, ligados na Visão geral da área. O guia de uso para quem opera (Mapa e
Satélite, marcadores, zoom, quedas de camada, lista de unidades) está em
[docs/nucleo-e-mapas.md](../nucleo-e-mapas.md), seção "Mapas".

## Onde fica

- `src/lib/fabrica-do-leaflet.ts` — **único lugar que cria mapa Leaflet**; as guardas preservam o
  namespace `L`.
- `src/modulos/mapa-saude-indigena/leaflet.ts` — a integração comum (criação, fundo com recurso,
  tamanho, contornos, enquadramento, leque, ícones e balões), com contratos em
  `tipos-do-leaflet.ts`; a base compartilhada (painel, legenda, tela cheia, retorno ao Brasil e
  hooks) também mora em `src/modulos/mapa-saude-indigena/`.
- `src/lib/mapa-render.ts`, `src/lib/brasil-bounds.ts` (enquadramento pelo contorno real do
  Brasil), `src/lib/mapa-saude-indigena/*.ts` (contagens, bolhas, CASAIs, unidades, vínculos,
  enquadramentos, formas e cores).
- Guardas globais no legado: `src/modules/map-guard.ts`, `map-zoom-range.ts` e o seletor
  Mapa/Satélite `map-base-layer-switcher.ts`.
- `src/lib/filtros-do-mapa.ts` — a regra dos filtros da página do mapa: comparação sem acento,
  opções sem duplicata, poda até estabilizar. A Visão geral guarda o estado e delega para cá;
  avisa pelo evento `agsus:filtros-alterados`.
- Editor de coordenadas comum aos dois mapas: [[modulo-editor-de-coordenadas]].

## Regras de comportamento

- **A forma é a informação, a cor é reforço:** círculo = polo base (laranja), casa = CASAI
  (vermelho), cruz = UBSI (roxo), losango = unidade de saúde (azul-petróleo). A legenda desenha as
  mesmas formas.
- Enquadramento inicial pelo contorno real do Brasil; arrastar não sai para o oceano aberto nem
  cria cópias laterais do mundo. Zoom máximo: 18 no OpenStreetMap, 19 no CARTO e no satélite.
- Escolha Mapa/Satélite guardada no navegador, uma para o app inteiro, aplicada quando cada mapa é
  criado.
- Quedas automáticas: quatro ladrilhos seguidos falhando no OSM → CARTO; quatro falhando no
  satélite → volta ao mapa e grava a preferência (o seletor pisca uma vez). Um ladrilho que carrega
  zera a contagem. Mapa cinza nas duas camadas = rede ou acesso aos fornecedores, não dados.
- **As coordenadas vêm só do banco** ([[coordenadas]]).
- Cores de série dos projetos: `--series-*` ([[design-e-tokens]]).

## Relacionadas

- [[modulo-mapa-saude-indigena]] e [[modulo-mapa-de-projetos]] — os dois mapas
- [[terras-indigenas]] — a camada da Funai
- [[modulo-visao-geral]] — onde os mapas aparecem
- [[acessibilidade]] — formas, não só cores

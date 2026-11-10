---
tipo: referencia
area: front
atualizado: 2026-11-10
---

# Terras indígenas (camada da Funai)

A camada de Terras Indígenas do mapa da Saúde Indígena. A geometria vem da Funai, compilada num
arquivo que o mapa carrega uma vez só.

## Onde fica

- `src/modules/indigenous-territories-layer.ts` — a camada (41 KB, legado em TypeScript; **não ler
  por inteiro**); as partes puras estão em `src/lib/terras-indigenas/` (`catalogo.ts`,
  `fases-e-estilos.ts`, `geometria.ts`, `preferencias.ts`, `textos.ts`, `tipos.ts`).
- `scripts/compilar-terras-indigenas.mjs` — gera `public/data/terras-indigenas*.json` (arquivo
  gerado: regenere, não edite).
- `scripts/compilar-contornos-dos-dseis.mjs` — gera `public/data/contornos-dos-dseis.json`
  (shapefile Funai `areas_dsei`), usado pelo modo "Mapa DSEIs" ([[mapa-saude-indigena-modo-dseis]]).
- `api/funai-geodata.ts` (GeoServer OWS) e `api/funai-wms.ts` (WMS, camada `Funai:tis_poligonais`):
  proxies da Funai, com a origem validada ([[funcoes-da-vercel]]).

## Por que compilar

O mapa pedia a geometria à Funai a cada movimento, e nenhuma cache acertava (cada enquadramento é
um bbox diferente): ~0,5–0,7 s e 1,2 MB por arrasto para desenhar 23 terras. O país inteiro são 665
terras e 1.835.560 vértices (47 MB), detalhe que a tela não distingue. Simplificado com
Douglas-Peucker a 0,001° (111 m), ficam 113.864 vértices, 2,17 MB (0,61 MB comprimido): menos que
um enquadramento, com as 665 terras. Detalhes no comentário de topo do script.

## Regras

- Terras Indígenas têm cores de domínio (não de paleta; `DESIGN.md` 3.1).
- O servidor serve `/data/*.json` (o antigo Laravel não servia, e as camadas quebravam).
- Nada em `public/` que não deva ser publicado.

## Relacionadas

- [[mapas-e-leaflet]] — a base comum dos mapas
- [[modulo-mapa-saude-indigena]] — onde a camada aparece
- [[scripts-e-checagens]] — os geradores

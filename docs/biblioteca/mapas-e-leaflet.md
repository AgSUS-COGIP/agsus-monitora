---
tipo: guia
area: front
atualizado: 2026-11-10
---

# Mapas e Leaflet

O MONITORA tem dois mapas, os dois em Leaflet e em TypeScript: o da Saúde Indígena (nacional e por
DSEI) e o de Projetos, ligados na Visão geral da área. O que a pessoa vê (Mapa e Satélite,
marcadores, lista de unidades) é explicado pela Aya, em `docs/aya/regras-dos-mapas.md` e
`docs/aya/regras-do-mapa-saude-indigena.md`.

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
- `src/modulos/mapa-saude-indigena/guarda-do-mapa.ts` — a guarda que `criarMapa` liga em cada
  mapa: limites da América do Sul, zoom de 4,5 a 19, zoom mínimo que acompanha a moldura, régua,
  teclado (+, −, 0) e os azulejos sem cópias do mundo (`OPCOES_DOS_AZULEJOS`). Não envolve
  `L.map` nem `L.tileLayer`.
- Ainda no legado, envolvendo o Leaflet quando ele chega (`carregar-leaflet.ts`): o seletor
  Mapa/Satélite `src/modules/map-base-layer-switcher.ts` e a camada de Terras Indígenas
  ([[terras-indigenas]]).
- `src/lib/filtros-do-mapa.ts` — a regra dos filtros da página do mapa: comparação sem acento,
  opções sem duplicata, poda até estabilizar. A Visão geral guarda o estado e delega para cá;
  avisa pelo evento `agsus:filtros-alterados`.
- Editor de coordenadas comum aos dois mapas: [[modulo-editor-de-coordenadas]].

## Regras de comportamento

- **A forma é a informação, a cor é reforço:** estrela = sede do DSEI, círculo = polo base, casa =
  CASAI, cruz = UBSI, losango = outra unidade de saúde (formas e cores em
  `src/lib/mapa-saude-indigena/formas.ts`). A legenda desenha as mesmas formas.
- Enquadramento inicial pelo contorno real do Brasil; arrastar não sai para o oceano aberto nem
  cria cópias laterais do mundo. Zoom de 4.5 a 19 (`MAP_MIN_ZOOM`/`MAP_MAX_ZOOM`).
- Escolha Mapa/Satélite guardada no navegador (`agsus_map_base_layer_v1`), uma para o app inteiro,
  aplicada quando cada mapa é criado.
- Fundo com recurso (`adicionarFundo`, `leaflet.ts`): OpenStreetMap e, com quatro azulejos
  seguidos falhando, o satélite da Esri. A CARTO saiu: sem chave, devolve 200 com o azulejo "API
  KEY REQUIRED" e nunca falha. O seletor também troca sozinho de modo com quatro falhas seguidas
  (`SATELLITE_ERROR_LIMIT`); um azulejo que carrega zera a contagem. Mapa cinza nas duas camadas =
  rede ou acesso aos fornecedores, não dados.
- Em aberto: se os termos do ArcGIS World Imagery permitem o uso como base, se vale ter chave da
  CARTO e se o OpenStreetMap continua primário (a política dele desaconselha tráfego de aplicação).
- **As coordenadas vêm só do banco** ([[coordenadas]]).
- Cores de série dos projetos: `--series-*` ([[design-e-tokens]]).

## Relacionadas

- [[modulo-mapa-saude-indigena]] e [[modulo-mapa-de-projetos]] — os dois mapas
- [[terras-indigenas]] — a camada da Funai
- [[modulo-visao-geral]] — onde os mapas aparecem
- [[acessibilidade]] — formas, não só cores
- [regras-dos-mapas](../aya/regras-dos-mapas.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)

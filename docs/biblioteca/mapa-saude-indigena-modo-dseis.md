---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Mapa da Saúde Indígena: modo "Mapa DSEIs"

Terceiro botão do seletor do fundo, só no `#map` do [[modulo-mapa-saude-indigena]]
(`map-base-layer-switcher.ts`: `MODO_SIMPLES`, `aceitaMapaSimples`, `adicionarCamadaDeFundo`).

## Como é

- Nenhum azulejo — nem ao abrir a página já nesse modo —, contêiner com `map-simple-mode` e o fundo
  liso do CSS.
- `mapa-simples.tsx` desenha a silhueta do Brasil e os 34 DSEIs (pane `agsus-mapa-simples`, abaixo
  das Terras Indígenas) com o número no meio.
- Legenda aberta com "Colorir por" (`% preenchidas`, `Vagas ociosas`, `Cor do DSEI`, lembrado em
  `agsus_mapa_simples_colorir_v1`) e o interruptor "Sedes e CASAIs" (desligados de início).
- As Terras Indígenas desligam ao entrar, sem mudar a preferência guardada, e voltam ao sair; a
  regra mora na camada (`indigenous-territories-layer.ts`, que segue o aviso do seletor).
- A lista mostra o número do DSEI; foco/mouse na linha realça o polígono na hora.
- O mouse no polígono acende a linha só depois de parar nele (`ESPERA_DO_REALCE_NA_LISTA`, 150 ms)
  e nunca rola, reordena nem remonta a lista (linhas memorizadas, só a classe `is-realce` muda).
- O clique no polígono abre o DSEI como a bolha.

## De onde vem cada coisa

- Numeração: `src/lib/mapa-saude-indigena/dseis-oficiais.ts` (34 nomes oficiais em ordem
  alfabética, como o mapa institucional da AgSUS; constante única).
- Regras (faixas, sem dado, dica, tokens): `src/lib/mapa-saude-indigena/mapa-simples.ts`. Os
  números são os da lista "Territórios por vagas" — nenhuma consulta nova.
- Cores: tokens `--mapa-simples-*` (claro e escuro) em `src/styles/tokens.css`.
- **Contornos**: `public/data/contornos-dos-dseis.json` (~324 KB, carregado só nesse modo, uma
  vez), gerado por `scripts/compilar-contornos-dos-dseis.mjs` a partir do shapefile da camada
  **Funai `areas_dsei`**, na cópia de **20/04/2022 do Internet Archive**. A Funai tirou a camada do
  GeoServer; por isso `/api/funai-geodata?dataset=dsei` dá 502 e o mapa não tinha contorno de DSEI
  nenhum. A camada é a abrangência com atendimento, não uma partição do país: parte do território
  fica só com a silhueta do Brasil.

## Testes

`tests/mapa-simples.test.js`, `tests/map-base-layer-simples.test.js` e
`tests/modulos/mapa-simples.test.js`.

## Relacionadas

- [[modulo-mapa-saude-indigena]] — o mapa que tem este modo
- [[terras-indigenas]] — a camada que desliga ao entrar
- [[scripts-e-checagens]] — o gerador dos contornos
- [[design-e-tokens]] — os tokens `--mapa-simples-*`

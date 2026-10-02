/*
  FORMAS, CORES E TIPOS DO MAPA DA SAÚDE INDÍGENA

  Uma tabela só decide a forma e a cor de cada marcador e a legenda que os
  descreve (as mesmas de `src/modules/vinculos-territoriais.js` e do
  `detailUnitType` do legado, que saem quando o mapa React for ligado; até lá
  `tests/mapa-saude-indigena.test.js` confere que não divergem).

  Forma além de cor: estrela (sede), círculo (polo base), casa (CASAI), cruz
  (UBSI) e losango (outra unidade) — quem não distingue as cores continua
  distinguindo as formas. As cores foram medidas contra os azulejos do OSM
  (contraste ≥ 3:1 com a vegetação; ver o comentário em vinculos-territoriais).

  As formas são dados (caminhos SVG num quadro 18×18), não HTML: o React e o
  ícone do Leaflet desenham a partir daqui sem `innerHTML`.
*/

export const FORMAS = Object.freeze({
  sede: Object.freeze({
    forma: "estrela",
    rotulo: "Sede do DSEI",
    cor: "#1f2937",
  }),
  polo: Object.freeze({
    forma: "circulo",
    rotulo: "Polo base",
    cor: "#e49a1b",
  }),
  casai: Object.freeze({ forma: "casa", rotulo: "CASAI", cor: "#d92d3a" }),
  ubsi: Object.freeze({ forma: "cruz", rotulo: "UBSI", cor: "#6d28d9" }),
  unit: Object.freeze({
    forma: "losango",
    rotulo: "Unidade de saúde",
    cor: "#0d8192",
  }),
});

/* A ordem da legenda: a do mapa, os pontos que mais aparecem primeiro. */
export const TIPOS_DA_LEGENDA = Object.freeze([
  "sede",
  "polo",
  "casai",
  "ubsi",
  "unit",
]);

export function formaDoTipo(chave) {
  return FORMAS[chave] || FORMAS.unit;
}

/* Desenho de cada forma: `circulo` é círculo; as outras, um caminho. */
export const DESENHO_DAS_FORMAS = Object.freeze({
  estrela:
    "M9 1.9 11.2 6.7 16.4 7.3 12.6 10.9 13.6 16.1 9 13.6 4.4 16.1 5.4 10.9 1.6 7.3 6.8 6.7Z",
  circulo: null,
  casa: "M9 2.6 15.2 8v8.2H2.8V8Z",
  cruz: "M7 2.8h4v4.2h4.2v4H11v4.2H7V11H2.8V7H7Z",
  losango: "M9 2.4 15.6 9 9 15.6 2.4 9Z",
});

const tipo = (key, label) =>
  Object.freeze({ key, label, color: formaDoTipo(key).cor });

export const TIPO_SEDE = tipo("sede", "Sede do DSEI");
export const TIPO_POLO = tipo("polo", "Polo base");
export const TIPO_CASAI = tipo("casai", "CASAI");
export const TIPO_UBSI = tipo("ubsi", "UBSI");
export const TIPO_UNIDADE = tipo("unit", "Unidade");

/* O tipo pelo nome do estabelecimento (o `detailUnitType` do legado). */
export function tipoDaUnidade(nome) {
  const normalizado = String(nome ?? "").toUpperCase();
  if (/CASAI|CASA DE SAUDE|CASA DE SAÚDE/.test(normalizado)) return TIPO_CASAI;
  if (/POLO/.test(normalizado)) return TIPO_POLO;
  if (/UBSI|UNIDADE BASICA|UNIDADE BÁSICA/.test(normalizado)) return TIPO_UBSI;
  return TIPO_UNIDADE;
}

/*
  Cores do mapa nacional. Bolha de DSEI: verde com borda amarela quando há
  edital no recorte, azul quando não há. No modo calor, a cor é a faixa de
  ociosidade das vagas; sem edital, cinza.
*/
export const CORES_DO_MAPA = Object.freeze({
  comEdital: Object.freeze({ preenchimento: "#0b8f58", borda: "#f2b705" }),
  semEdital: Object.freeze({ preenchimento: "#5b9bd5", borda: "#1f6f4a" }),
  semEditalNoCalor: Object.freeze({
    preenchimento: "#cfd8e3",
    borda: "#9fb0c4",
  }),
  casaiNacional: "#7b2ff7",
  traco: "#4a6b80",
  contornoDoBrasil: "#0d3b66",
  divisasDasUfs: "#5b7fa6",
  contornoNoDetalhe: "#0d6f7b",
  divisasNoDetalhe: "#7798ad",
  fundoDasUfsNoDetalhe: "#dce9ee",
  // Editor de coordenadas: as posições sugeridas do ponto escolhido.
  sugestaoDeAldeia: "#c2410c",
  sugestaoDoCnes: "#2f6fb0",
});

/* Faixas do modo calor, pela % de vagas ociosas do DSEI. */
export const FAIXAS_DO_CALOR = Object.freeze([
  Object.freeze({ minimo: 60, cor: "#d92d3a", rotulo: "60% ou mais ociosas" }),
  Object.freeze({ minimo: 40, cor: "#f2730c", rotulo: "40% a 59%" }),
  Object.freeze({ minimo: 20, cor: "#f2b705", rotulo: "20% a 39%" }),
  Object.freeze({ minimo: 0, cor: "#0b8f58", rotulo: "menos de 20%" }),
]);

export function corDoCalor(porcentagem) {
  const pct = Number(porcentagem) || 0;
  return (FAIXAS_DO_CALOR.find((f) => pct >= f.minimo) || FAIXAS_DO_CALOR[3])
    .cor;
}

/* A linha do vínculo fora da área: secundária, pontilhada — não é trajeto. */
export const ESTILO_DA_LINHA_DE_VINCULO = Object.freeze({
  dashArray: "6 7",
  opacity: 0.55,
  weight: 1.75,
  color: "#4a6b80",
  interactive: true,
});

export const TEXTO_DA_LINHA_DE_VINCULO =
  "Vínculo territorial — não representa trajeto";

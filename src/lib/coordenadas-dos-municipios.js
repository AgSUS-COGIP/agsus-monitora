/*
  Coordenadas dos lugares que aparecem no mapa da Visão geral de Projetos.

  O mapa recebe o lugar da RPC `listar_municipios_das_vagas_da_area`: o
  município ("Município/UF" e, quando vem da tabela de locais, o código do
  IBGE) ou só a UF (o edital da CCE, por exemplo, diz só o estado). O
  repositório não tinha coordenada de município nenhum, e buscar na
  rede a cada abertura não vale a pena para poucas dezenas de pontos. Fica aqui
  uma tabela pequena, só com os municípios que existem nos editais
  (`supabase/correcoes/20261001-locais-das-vagas-dos-projetos.sql`) e nas
  vagas "UBS móvel".

  Fonte: sede municipal do IBGE (código de 7 dígitos ao lado), com as
  coordenadas do conjunto "municipios-brasileiros" (github.com/kelvins), que
  republica as do IBGE. Precisão de 4 casas (~10 m) — sobra para um ponto num
  mapa do Brasil. O ponto de uma UF é a média das sedes municipais dela (mesmo
  conjunto): cai no meio do estado, e não em cima da capital, que costuma ter
  ponto próprio.

  Desde a migration 20261002170000 a coordenada que o mapa desenha vem do
  banco (public."TB_COORDENADA_LOCAL_VAGA", carregada com estas mesmas sedes
  e centros por supabase/correcoes/20261002-pendencias-das-coordenadas-dos-projetos.sql
  e corrigida no editor de coordenadas). Esta tabela fica como referência:
  a sugestão "Sede do município (IBGE)"/"Centro da UF" do editor
  (src/lib/coordenadas-dos-projetos.js), o mapa da Saúde Indígena
  (sede do município das pendências) e o mapa enquanto a RPC não traz a
  coordenada do banco. Município novo nas vagas: acrescente uma linha aqui e
  na carga (o teste da migration confere que as duas são iguais).
*/

/** [Município, UF, código IBGE, latitude, longitude] */
const MUNICIPIOS = Object.freeze([
  ["Cruzeiro do Sul", "AC", 1200203, -7.6276, -72.6756],
  ["Rio Branco", "AC", 1200401, -9.975, -67.8243],
  ["Maceió", "AL", 2704302, -9.666, -35.735],
  ["Atalaia do Norte", "AM", 1300201, -4.3705, -70.1967],
  ["Lábrea", "AM", 1302405, -7.2641, -64.7948],
  ["Manaus", "AM", 1302603, -3.1187, -60.0212],
  ["Parintins", "AM", 1303403, -2.6374, -56.729],
  ["São Gabriel da Cachoeira", "AM", 1303809, -0.1191, -67.084],
  ["Tabatinga", "AM", 1304062, -4.2416, -69.9383],
  ["Tefé", "AM", 1304203, -3.3682, -64.7193],
  ["Macapá", "AP", 1600303, 0.0349, -51.0694],
  ["Salvador", "BA", 2927408, -12.9718, -38.5011],
  ["Fortaleza", "CE", 2304400, -3.7166, -38.5423],
  ["Brasília", "DF", 5300108, -15.7795, -47.9297],
  ["Uruaçu", "GO", 5221601, -14.5238, -49.1396],
  ["São Luís", "MA", 2111300, -2.5387, -44.2825],
  ["Governador Valadares", "MG", 3127701, -18.8545, -41.9555],
  ["Ubaporanga", "MG", 3170057, -19.6351, -42.1059],
  ["Campo Grande", "MS", 5002704, -20.4486, -54.6295],
  ["Barra do Garças", "MT", 5101803, -15.8804, -52.264],
  ["Canarana", "MT", 5102702, -13.5515, -52.2705],
  ["Colíder", "MT", 5103205, -10.8135, -55.461],
  ["Cuiabá", "MT", 5103403, -15.601, -56.0974],
  ["São Félix do Araguaia", "MT", 5107859, -11.615, -50.6706],
  ["Altamira", "PA", 1500602, -3.2041, -52.21],
  ["Belém", "PA", 1501402, -1.4554, -48.4898],
  ["Itaituba", "PA", 1503606, -4.2667, -55.9926],
  ["Novo Progresso", "PA", 1505031, -7.1435, -55.3786],
  ["Redenção", "PA", 1506138, -8.0253, -50.0317],
  ["João Pessoa", "PB", 2507507, -7.1151, -34.8641],
  ["Recife", "PE", 2611606, -8.0467, -34.8771],
  ["Curitiba", "PR", 4106902, -25.4195, -49.2646],
  ["Irati", "PR", 4110706, -25.4697, -50.6493],
  ["Itatiaia", "RJ", 3302254, -22.4897, -44.5675],
  ["Seropédica", "RJ", 3305554, -22.7526, -43.7155],
  ["Cacoal", "RO", 1100049, -11.4343, -61.4562],
  ["Porto Velho", "RO", 1100205, -8.7608, -63.8999],
  ["Boa Vista", "RR", 1400100, 2.8238, -60.6753],
  ["Pacaraima", "RR", 1400456, 4.4799, -61.1477],
  ["Florianópolis", "SC", 4205407, -27.5945, -48.5477],
  ["Palhoça", "SC", 4211900, -27.6455, -48.6697],
  ["Cubatão", "SP", 3513504, -23.8911, -46.424],
  ["Pindamonhangaba", "SP", 3538006, -22.9246, -45.4613],
  ["São Paulo", "SP", 3550308, -23.5329, -46.6395],
  ["Palmas", "TO", 1721000, -10.24, -48.3558],
  ["Talismã", "TO", 1720978, -12.7949, -49.0896],
]);

/** UF → [nome, latitude, longitude] (média das sedes municipais da UF). */
const UFS = Object.freeze({
  AC: ["Acre", -9.4017, -69.7098],
  AL: ["Alagoas", -9.5154, -36.4828],
  AM: ["Amazonas", -3.9313, -63.2203],
  AP: ["Amapá", 0.9128, -51.3585],
  BA: ["Bahia", -12.911, -40.4106],
  CE: ["Ceará", -4.9409, -39.4942],
  DF: ["Distrito Federal", -15.7795, -47.9297],
  ES: ["Espírito Santo", -19.8864, -40.8154],
  GO: ["Goiás", -16.1978, -49.4475],
  MA: ["Maranhão", -4.2359, -44.9113],
  MG: ["Minas Gerais", -19.5842, -44.102],
  MS: ["Mato Grosso do Sul", -21.2376, -54.4798],
  MT: ["Mato Grosso", -13.6058, -55.5486],
  PA: ["Pará", -2.9668, -49.7614],
  PB: ["Paraíba", -7.0593, -36.6429],
  PE: ["Pernambuco", -8.2183, -36.6585],
  PI: ["Piauí", -6.7032, -42.4093],
  PR: ["Paraná", -24.3961, -51.878],
  RJ: ["Rio de Janeiro", -22.2889, -42.8243],
  RN: ["Rio Grande do Norte", -5.9785, -36.6061],
  RO: ["Rondônia", -11.1715, -62.321],
  RR: ["Roraima", 2.5756, -60.5275],
  RS: ["Rio Grande do Sul", -28.9607, -52.6113],
  SC: ["Santa Catarina", -27.2638, -50.7068],
  SE: ["Sergipe", -10.6177, -37.275],
  SP: ["São Paulo", -22.1385, -48.6441],
  TO: ["Tocantins", -9.2729, -48.1896],
});

/*
  Chave de comparação: sem acento, sem diferença de caixa e de espaços.
  "Seropédica/RJ", "seropedica / rj" e "SEROPÉDICA/RJ" são o mesmo lugar.
*/
export function chaveDoMunicipio(municipioUf) {
  const [municipio = "", uf = ""] = String(municipioUf ?? "").split("/");
  const limpar = (valor) =>
    valor
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const nome = limpar(municipio);
  const sigla = limpar(uf);
  return nome && sigla ? `${nome}/${sigla}` : "";
}

const LUGARES = MUNICIPIOS.map(([municipio, uf, ibge, latitude, longitude]) =>
  Object.freeze({ municipio, uf, ibge, latitude, longitude }),
);
const POR_CHAVE = new Map(
  LUGARES.map((lugar) => [
    chaveDoMunicipio(`${lugar.municipio}/${lugar.uf}`),
    lugar,
  ]),
);
const POR_CODIGO = new Map(LUGARES.map((lugar) => [lugar.ibge, lugar]));

/**
 * { municipio, uf, ibge, latitude, longitude } do "Município/UF" — ou do
 * código do IBGE, que manda quando vem —, ou null.
 */
export function coordenadasDoMunicipio(municipioUf, codigoIbge = null) {
  const porCodigo = POR_CODIGO.get(Number(codigoIbge));
  if (porCodigo) return porCodigo;
  return POR_CHAVE.get(chaveDoMunicipio(municipioUf)) ?? null;
}

/** { uf, nome, latitude, longitude } do ponto da UF, ou null. */
export function coordenadasDaUf(uf) {
  const sigla = String(uf ?? "")
    .trim()
    .toUpperCase();
  const dado = UFS[sigla];
  if (!dado) return null;
  const [nome, latitude, longitude] = dado;
  return { uf: sigla, nome, latitude, longitude };
}

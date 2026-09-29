/*
  Coordenadas dos municípios que aparecem no mapa da Visão geral de Projetos.

  O mapa recebe o município como texto, "Município/UF", lido do nome da vaga
  nas análises ("… UBS móvel Seropédica/RJ …", RPC
  `listar_municipios_das_vagas_da_area`). O repositório não tinha coordenada de
  município nenhum (as de `localizacoes-validadas*` são de unidades da Saúde
  Indígena), e buscar na rede a cada abertura não vale a pena para meia dúzia
  de pontos. Fica aqui uma tabela pequena, só com os municípios que existem.

  Fonte: sede municipal do IBGE (código de 7 dígitos ao lado), com as
  coordenadas do conjunto "municipios-brasileiros" (github.com/kelvins), que
  republica as do IBGE. Precisão de 4 casas (~10 m) — sobra para um ponto num
  mapa do Brasil.

  Município novo nas vagas: acrescente uma linha. Enquanto não tiver, ele
  aparece na lista ao lado do mapa como "sem coordenada", em vez de sumir.
*/

/** [Município, UF, código IBGE, latitude, longitude] */
const MUNICIPIOS = Object.freeze([
  ["Seropédica", "RJ", 3305554, -22.7526, -43.7155],
  ["Talismã", "TO", 1720978, -12.7949, -49.0896],
  ["Cubatão", "SP", 3513504, -23.8911, -46.424],
  ["Palhoça", "SC", 4211900, -27.6455, -48.6697],
  ["Irati", "PR", 4110706, -25.4697, -50.6493],
]);

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

const POR_CHAVE = new Map(
  MUNICIPIOS.map(([municipio, uf, ibge, latitude, longitude]) => [
    chaveDoMunicipio(`${municipio}/${uf}`),
    Object.freeze({ municipio, uf, ibge, latitude, longitude }),
  ]),
);

/** { municipio, uf, ibge, latitude, longitude } do "Município/UF", ou null. */
export function coordenadasDoMunicipio(municipioUf) {
  return POR_CHAVE.get(chaveDoMunicipio(municipioUf)) ?? null;
}

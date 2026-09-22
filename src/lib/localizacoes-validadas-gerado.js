/*
  GERADO por scripts/validar-localizacoes.mjs. Não editar à mão.

  1366 vereditos de localização:

  1014  coerente
   125  conflito
    85  validada
    75  indeterminado
    67  erro

  Viajam todos, e não só os que trocam a coordenada. Um conflito entre as
  duas fontes é resultado de auditoria tanto quanto uma validação, e o mapa
  não tem como o dizer se ele ficar aqui de fora.

  A prova de cada veredito está em public/data/localizacoes-validadas.json.
*/
export const LOCALIZACOES_VALIDADAS = [
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "AL SE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "ACONA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "JERIPANKO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "KALANKO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "KARAPOTO PLAKI O",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "KARAPOTO TERRA NOVA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "KARIRI XOKO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "KARUAZU",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "KATOKINN",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "KOIUPANKA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "TINGUI BOTO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "WASSU COCAL",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "XOKO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "XUCURU KARIRI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALTAMIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALTAMIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALTAMRIRA VOLTA IRIRI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALTAMIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALTAMIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "MANCIO LIMA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "CRUZEIRO SUL",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 37.3
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "FEIJO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.4,
    "lat": -8.160772,
    "lon": -70.353398
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "JORDAO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "MANCIO LIMA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -7.606787,
    "lon": -72.907763
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "MARECHARL THAUMATURGO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "PORTO WALTER",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "TARAUACA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "SEDE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "SAO GABRIEL CACHOEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "BALAIO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 34.1
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "CAMARAO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.2,
    "lat": 0.621767,
    "lon": -67.448062
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "CANADA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 168.2
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "CARURU TIQUIE",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 276.3
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "CARURU WAUPES",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "CAUBURIS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "CUCUI",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_lotacoes",
    "km": 42.9,
    "lat": 1.188613,
    "lon": -66.838784
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "CUMARU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "ILHA FLORES",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 12.3
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "ITAPERERA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "JURUTI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 30.4
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "MARABITANA WAUPES",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 203.9
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "MASSARABI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 8.1
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "NAZARE ENUIXI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "PARI CACHOEIRA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 303.3
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "SAO GABRIEL PAPURI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 290.7
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "SAO JOAQUIM",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 326.6
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "SAO JOSE II",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 282.8
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "SERRINHA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.4,
    "lat": -0.47996,
    "lon": -64.825516
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "TAPERA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "TARACUA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 24.7
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "TUCUMA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 36.4
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "TUNUI CACHOEIRA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 31.9
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "VILA NOVA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 86.3
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "YAUARETE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "RIO BRANCO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 5.1
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "ASSIS BRASIL",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -10.937511,
    "lon": -69.56669
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "BOCA ACRE",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -8.775419,
    "lon": -67.330163
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "EXTREMA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 287.8
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "MANOEL URBANO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.3,
    "lat": -8.838598,
    "lon": -69.259615
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "PAUINI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "SANTA ROSA PURUS",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -9.443304,
    "lon": -70.485535
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "SENA MADUREIRA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -9.066521,
    "lon": -68.655131
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "SEDE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "AMATURA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "BENJAMIN CONSTANT",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.3,
    "lat": -4.379967,
    "lon": -70.026888
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "SANTO ANTONIO ICA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "SAO PAULO OLIVEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "TABATINGA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "TONANTINS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "NOVO DIA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "BELEM SOLIMOES",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 102.1
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "BETANIA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.2,
    "lat": -3.073856,
    "lon": -68.065859
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "CAMPO ALEGRE",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 38.8
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "FEIJOAL SAO LEOPOLDO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "FILADELFIA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -4.38443,
    "lon": -69.994466
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "NOVA ITALIA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -3.409263,
    "lon": -68.225226
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "SAO FRANCISCO CANIMARI",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.5,
    "lat": -3.388335,
    "lon": -68.34938
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "SAO PAULO OLIVENCA SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "SAO SEBASTIAO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 3.6,
    "lat": -2.744845,
    "lon": -67.623253
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "UMARIACU 1",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "UMARIACU 2",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "VENDAVAL",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 45.5
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "VILA BITENCOURT",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "SAPOTAL",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 46.4
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "SEDE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "BANANAL",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "BOM CAMINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "GUANABARA 3",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "LAGO GRANDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "MARI MARI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "NOSSA SENHORA NAZARE",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 35.8
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "NOVA ESPERANCA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "NOVA EXTREMA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "PORTO CORDEIRINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "PORTO ESPIRITUAL",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "PRESIDENTE VARGAS",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "TORRE MISSAO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 44.6
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "TUPI 2",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "MACAPA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "OIAPOQUE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "ARAMIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "BONA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "KUMARUMA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "KUMENE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "MANGA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "MISSAO TIRIYO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "GOIANIA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 1,
    "lat": -16.731646,
    "lon": -49.231904
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "CONFRESA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "GOIAS ARUANA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "SANTA TEREZINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "SAO FELIX ARAGUAIA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "SALVADOR",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "EUCLIDES CUNHA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "IBOTIRAMA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.7,
    "lat": -12.18532,
    "lon": -43.22132
  },
  {
    "dsei": "BAHIA",
    "canonico": "ILHEUS",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -14.786605,
    "lon": -39.045775
  },
  {
    "dsei": "BAHIA",
    "canonico": "ITAMARAJU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "JUAZEIRO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.9,
    "lat": -9.414156,
    "lon": -40.502944
  },
  {
    "dsei": "BAHIA",
    "canonico": "PAU BRASIL",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "PAULO AFONSO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -9.396456,
    "lon": -38.233322
  },
  {
    "dsei": "BAHIA",
    "canonico": "PORTO SEGURO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "RIBEIRA POMBAL",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -10.831599,
    "lon": -38.544095
  },
  {
    "dsei": "BAHIA",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CASAI DF",
    "canonico": "DF",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "CASAI SAO PAULO",
    "canonico": "SAO PAULO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "FORTALEZA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "ANACE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "AQUIRAZ",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "ARATUBA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "CRATEUS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "ITAREMA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "MARACANAU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "MONSENHOR TABOSA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "PIAUI AREA I",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "PIAUI AREA II",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "PIAUI AREA III",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "PIAUI AREA IV",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "PORANGA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "POTYRO TAPEBA CAUCAIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "SAO BENEDITO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "TERESINA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "UN TERESINA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "BRASNORTE",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -12.123712,
    "lon": -58.000753
  },
  {
    "dsei": "CUIABA",
    "canonico": "CUIABA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 16.8
  },
  {
    "dsei": "CUIABA",
    "canonico": "RONDONOPOLIS",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 19.2
  },
  {
    "dsei": "CUIABA",
    "canonico": "TANGARA SERRA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "BACAVAL",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "BRASNORTE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "CHIQUITANO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "COMODORO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "CUIABA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "MERURI",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "PAKUERA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "RIO VERDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "RONDONOPOLIS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "TANGARA SERRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "TRES LAGOAS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CUIABA",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "ICOARACI",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.3,
    "lat": -1.294001,
    "lon": -48.465366
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "MARABA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -5.346517,
    "lon": -49.106466
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "ORIXIMINA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.2,
    "lat": -1.774952,
    "lon": -55.862067
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "PARAGOMINAS",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -2.98121,
    "lon": -47.35657
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "SANTAREM",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "CAPITAO POCO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 1.6,
    "lat": -1.750741,
    "lon": -47.072283
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "MARABA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "MARABA XIKRIN",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "ORIXIMINA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 821.4
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "PARAGOMINAS",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 1.6,
    "lat": -2.993858,
    "lon": -47.353814
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "SANTA LUZIA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 32.2
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "SANTA MARIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "SANTAREM",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.2,
    "lat": -2.432419,
    "lon": -54.710412
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "TOME ACU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "TUCURUI",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 1.1,
    "lat": -3.766978,
    "lon": -49.668782
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "SEDE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "GUAMA TOCANTINS",
    "canonico": "UN SANTA MARIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "ARAQUARI",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "BARRA RIBEIRO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.4,
    "lat": -30.416777,
    "lon": -51.454897
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "CHAPECO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 6.9
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "FLORIANOPOLIS",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -27.515827,
    "lon": -48.645792
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "GUARITA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "IPUACU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "JOSE BOITEUX",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 274.3
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "NONOAI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "OSORIO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.4,
    "lat": -29.89029,
    "lon": -50.270476
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "PASSO FUNDO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "PORTO ALEGRE",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "VIAMAO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "COLIDER",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "JUARA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "PEIXOTO AZEVEDO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "COLIDER",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "JUARA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "PEIXOTO AZEVEDO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "OURILANDIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "REDENCAO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "SAO FELIX XINGU",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "TUCUMA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -6.76001,
    "lon": -51.157286
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "OURILANDIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "REDENCAO",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "SAO FELIX XINGU",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.3,
    "lat": -6.639415,
    "lon": -51.984386
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "TUCUMA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "SEDE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "LESTE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "FLEXAL",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MONTE MORIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "NAPOLEAO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ARACA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 29.5
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "BARRO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 47.2
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "BOQUEIRAO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 34.3
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CAMARA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.5,
    "lat": 3.998128,
    "lon": -60.178286
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CAMPO FORMOSO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": 4.722021,
    "lon": -60.773303
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CANTAGALO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CARACANA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CARAPARU I",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "FLEXAL",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "JACAMIM",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "JACAREZINHO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "JATAPUZINHO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MALACACHETA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MANOA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 1.5,
    "lat": 2.980457,
    "lon": -60.095589
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MATIRI",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.3,
    "lat": 4.030181,
    "lon": -59.920869
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MATURUCA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MILHO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 22.9
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MORRO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PEDRA BRANCA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PEDRA PRETA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PEDREIRA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 5.8
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PIUM",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 52.6
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "RAPOSA I",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.2,
    "lat": 3.812628,
    "lon": -60.091229
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ROCA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 37.8
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SANTA CRUZ",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SANTA INES",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 54.2
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SANTA MARIA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SAO FRANCISCO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SERRA SOL",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SERRA TRUARUM",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SOROCAIMA II",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": 4.41342,
    "lon": -61.161919
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TESO GAVIAO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TRES CORACOES",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 12.7
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "VISTA ALEGRE",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 6.6
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "WILLIMON",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 3.8,
    "lat": 4.635018,
    "lon": -60.176426
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PIUM MANOA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 13.4
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PIUM SERRA LUA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SAO MATEUS",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SEDE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TABALASCADA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "UN GUARIBA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "UN MANALAI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "UN MOSCOU",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "UN NOVA ESPERANCA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "CURITIBA",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_cnes",
    "km": 303.3,
    "lat": -25.461846,
    "lon": -49.29824
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "ANGRA REIS",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_cnes",
    "km": 677.3,
    "lat": -23.0158,
    "lon": -44.53614
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "BAURU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 273.3
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "GUAIRA",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_cnes",
    "km": 766.7,
    "lat": -24.085275,
    "lon": -54.18
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "GUARAPUAVA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 299.4
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "ITAPORANGA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "LONDRINA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "MIRACATU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 177.4
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "MONGAGUA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "PARANAGUA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "PERUIBE",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "REGISTRO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "RIO SILVEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "SANTA HELENA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "SAO PAULO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "SAO PAULO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "UBATUBA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "CAPANA GRANDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "MANAUS",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 20.5
  },
  {
    "dsei": "MANAUS",
    "canonico": "NOVA OLINDA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "MAICI MARMELOS",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "MANICORE",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "ABACAXIS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "ANAMA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 220.8
  },
  {
    "dsei": "MANAUS",
    "canonico": "BEIJA FLOR",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_cnes",
    "km": 543.9,
    "lat": -2.695591,
    "lon": -59.700952
  },
  {
    "dsei": "MANAUS",
    "canonico": "BERURI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 289.7
  },
  {
    "dsei": "MANAUS",
    "canonico": "BOCA JAUARI",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "CAREIRO CASTANHO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "IGAPO ACU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 167.7
  },
  {
    "dsei": "MANAUS",
    "canonico": "KWATA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "LARANJAL",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.4,
    "lat": -4.388,
    "lon": -59.594
  },
  {
    "dsei": "MANAUS",
    "canonico": "MAKIRA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 222.7
  },
  {
    "dsei": "MANAUS",
    "canonico": "MANACAPURU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "MANAQUIRI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 238.2
  },
  {
    "dsei": "MANAUS",
    "canonico": "MURUTINGA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 90.9
  },
  {
    "dsei": "MANAUS",
    "canonico": "NOSSA SENHORA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "NOVO AIRAO",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_cnes",
    "km": 605.8,
    "lat": -2.634653,
    "lon": -60.951548
  },
  {
    "dsei": "MANAUS",
    "canonico": "PANTALEAO",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_cnes",
    "km": 917.1,
    "lat": -3.580616,
    "lon": -59.130918
  },
  {
    "dsei": "MANAUS",
    "canonico": "PONTA NATAL",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 63.4
  },
  {
    "dsei": "MANAUS",
    "canonico": "RIO PRETO EVA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "SILVES",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "URUCARA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.3,
    "lat": -2.536351,
    "lon": -57.758561
  },
  {
    "dsei": "MANAUS",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "IMPERATRIZ",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "SAO LUIS",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.3,
    "lat": -2.484552,
    "lon": -44.223618
  },
  {
    "dsei": "MARANHAO",
    "canonico": "TERESINA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "AMARANTE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ARAME",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.7,
    "lat": -4.889333,
    "lon": -46.010925
  },
  {
    "dsei": "MARANHAO",
    "canonico": "BARRA CORDA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -5.509502,
    "lon": -45.246978
  },
  {
    "dsei": "MARANHAO",
    "canonico": "GRAJAU",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.8,
    "lat": -5.813483,
    "lon": -46.137085
  },
  {
    "dsei": "MARANHAO",
    "canonico": "SANTA INES",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -3.658606,
    "lon": -45.381047
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ZE DOCA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -3.273669,
    "lon": -45.657342
  },
  {
    "dsei": "MARANHAO",
    "canonico": "SEDE",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "AMAMBAI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "CAMPO GRANDE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "DOURADOS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "AMAMBAI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "ANTONIO JOAO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "AQUIDAUANA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "BODOQUENA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "BONITO",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "BRASILANDIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "CAARAPO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "CORUMBA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "DOURADOS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "JAPORA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "MIRANDA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "PARANHOS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "SAMUI DOURADOS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "SIDROLANDIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "TACURU",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "LABREA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "TAPAUA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "ABAQUADI PAJE SAWE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "NOVA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 139.5
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "CHICO CAMILO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 37.8
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "CRISPIM",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 58.8
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "FUNAI MPI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "IMINAA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 53.4
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "JAPIIM",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "MARRECAO SURUWAHA SESAI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "SAO FRANCISCO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 20.1
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "SAO PEDRO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 108.8
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "TAWAMIRIM",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "TUMIA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 68.9
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "UN FUNAI MPI",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "UN SURUWAHA SESAI DSEIPRP",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "EIRUNEPE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "TEFE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "BARREIRA MISSAO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.8,
    "lat": -3.392234,
    "lon": -64.637203
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "BIA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 133.8
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "BUA BUA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 6.4
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "BUGAIO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.3,
    "lat": -2.823544,
    "lon": -66.900902
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "CARAUARI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 6.7
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "COARI",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -4.082856,
    "lon": -63.142757
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "CUIU CUIU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "EIRUNEPE",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 30.3
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "ENVIRA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 71.7
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "IPIXUNA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "KUMARU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 69.2
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "MARAJAI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 813.1
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "MORADA NOVA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 484
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "MUCURA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 473.3
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "UARINI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 17.4
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "BELO HORIZONTE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "GOVERNADOR VALADARES",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "MONTES CLAROS",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.5,
    "lat": -16.71983,
    "lon": -43.872356
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "AGUA BOA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ARACUAI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "BARREIRO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "BELA VISTA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "BOA ESPERANCA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "BREJO MATA FOME",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "CAIEIRAS VELHA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "CAMPANARIO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "CAPAO ZEZINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "CARMESIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "COMBOIOS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "IRAJA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ITAPECERICA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ITAPICURU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "LADAINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "MACHACALIS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "PAU BRASIL",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "PINDAIBA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "PRADINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "PRATA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "RANCHARIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "RESPLENDOR",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "SANTA CRUZ",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "SAO JOAO MISSOES",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "SUMARE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "SUMARE III",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "TEOFILO OTONI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "TOPAZIO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "VARZEA GRANDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "UN ARACRUZ",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PARINTINS",
    "canonico": "MAUES",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "PARINTINS",
    "canonico": "NHAMUNDA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PARINTINS",
    "canonico": "PARINTINS",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.1,
    "lat": -2.622542,
    "lon": -56.731896
  },
  {
    "dsei": "PARINTINS",
    "canonico": "ARATICUM",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 64.2
  },
  {
    "dsei": "PARINTINS",
    "canonico": "KASSAWA",
    "estado": "erro",
    "motivo": "ambas_fora_da_uf",
    "km": 112.4
  },
  {
    "dsei": "PARINTINS",
    "canonico": "KURUATUBA",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_cnes",
    "km": 106.5,
    "lat": -2.818229,
    "lon": -56.732025
  },
  {
    "dsei": "PARINTINS",
    "canonico": "NOVA ALDEIA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 31.2
  },
  {
    "dsei": "PARINTINS",
    "canonico": "NOVA ALEGRIA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "PARINTINS",
    "canonico": "NOVA ESPERANCA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 28.1
  },
  {
    "dsei": "PARINTINS",
    "canonico": "PONTA ALEGRE",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 60.5
  },
  {
    "dsei": "PARINTINS",
    "canonico": "RIOZINHO",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_lotacoes",
    "km": 39.2,
    "lat": -1.429139,
    "lon": -57.913889
  },
  {
    "dsei": "PARINTINS",
    "canonico": "SANTA MARIA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 18.9
  },
  {
    "dsei": "PARINTINS",
    "canonico": "SAO FRANCISCO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "PARINTINS",
    "canonico": "UMIRITUBA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 75.2
  },
  {
    "dsei": "PARINTINS",
    "canonico": "VILA NOVA I",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_cnes",
    "km": 86.2,
    "lat": -2.879265,
    "lon": -56.821289
  },
  {
    "dsei": "PARINTINS",
    "canonico": "VILA NOVA II",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 15.8
  },
  {
    "dsei": "PARINTINS",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "CAMARAGIBE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ATIKUM",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.4,
    "lat": -8.321998,
    "lon": -38.743809
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ATIKUM",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 50
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "FULNI O I",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "FULNI O II",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "KAMBIWA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "KAMBIWA TUXA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.3,
    "lat": -8.9044,
    "lon": -37.825517
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "KAPINAWA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.3,
    "lat": -8.622059,
    "lon": -37.156988
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "PANKARA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "PANKARA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 47
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "PANKARARU",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "PANKARARU ENTRE SERRAS",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "PIPIPA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "TRUKA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 2.9,
    "lat": -8.513858,
    "lon": -39.306358
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "TRUKA TAPERA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "TUXI",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_cnes",
    "km": 1694.3,
    "lat": -8.647553,
    "lon": -39.246597
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "XUKURU CIMBRES",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "XUKURU ORORUBA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALTA FLORESTA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "GUAJARA MIRIM",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "HUMAITA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "JARU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "JI PARANA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "PORTO VELHO",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 4.8,
    "lat": -8.751616,
    "lon": -63.890569
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALTA FLORESTA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "GUAJARA MIRIM",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "HUMAITA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 1.6,
    "lat": -7.507833,
    "lon": -63.047619
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "JARU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "JI PARANA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "PORTO VELHO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "BAIA TRAICAO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "CONDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "GOIANIANHA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "JOAO CAMARA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "MARCACAO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "RIO TINTO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "SANTAREM RIO TAPAJOS",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "ITAITUBA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "JACAREACANGA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "NOVO PROGRESSO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "CAROCAL RIO TROPAS",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "ITAITUBA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -4.258624,
    "lon": -55.972122
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "JACAREACANGA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "KATO",
    "estado": "validada",
    "motivo": "arbitrada_pela_uf_lotacoes",
    "km": 98.8,
    "lat": -6.646461,
    "lon": -57.629369
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "MISSAO CURURU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 16.7
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "NOVO PROGRESSO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "RESTINGA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 91.5
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "SAI CINZA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 35.1
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "SANTA MARIA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 129.8
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "TELES PIRES",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 175.1
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "WARO APAMPU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "UN LOCAL CASTELO SONHOS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "ARAGUAINA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "GURUPI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "FORMOSO ARAGUAIA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -11.797134,
    "lon": -49.53081
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "GOIATINS",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "ITACAJA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": -8.391658,
    "lon": -47.771138
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "LAGOA CONFUSAO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "SANTA FE ARAGUAIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "TOCANTINIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "TOCANTINOPOLIS",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "SEDE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ATALAIA NORTE",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALTO CURUCA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 340.7
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALTO ITUI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 347.5
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ITACOAI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 151.7
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "JAQUIRANA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "MEDIO CURUCA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 257.5
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "MEDIO ITUI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 267
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "MEDIO JAVARI",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "RIO BRANCO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 164.9
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ARIPUANA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "CACOAL",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "JUINA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "VILHENA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ARIPUANA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "CACOAL",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 2,
    "lat": -11.440636,
    "lon": -61.434968
  },
  {
    "dsei": "VILHENA",
    "canonico": "JUINA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "VILHENA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "ARAGARCAS",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "BARRA GARCA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "CAMPINOPOLIS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "AGUA BOA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "CAMPINAPOLIS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "MARAIWATSEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "PARANATINGA ALDEIA PAKUERA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "SANGRADOURO",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "SAO MARCOS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XINGU",
    "canonico": "CANARANA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 1.6,
    "lat": -13.559414,
    "lon": -52.274752
  },
  {
    "dsei": "XINGU",
    "canonico": "GAUCHA NORTE",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 19.4
  },
  {
    "dsei": "XINGU",
    "canonico": "QUERENCIA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "XINGU",
    "canonico": "SINOP",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XINGU",
    "canonico": "DIAUARUM",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "XINGU",
    "canonico": "LEONARDO VILLAS BOAS",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "XINGU",
    "canonico": "PAVURU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XINGU",
    "canonico": "WAWI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XINGU",
    "canonico": "SEDE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "YANOMAMI",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "AJARANI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 42.5
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "AJURICABA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 146.9
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ALTO CATRIMANI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 234.9
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ALTO MUCAJAI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 106.3
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "APIAU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 7.9
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ARACA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 197.4
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ARATHAU",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "AUARIS",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 348.2
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "BAIXO CATRIMANI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 150.1
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "BAIXO MUCAJAI",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.2,
    "lat": 2.7352,
    "lon": -62.0188
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "BALAWAU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 227.3
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "CACHOEIRA ARACA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 261.1
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "DEMINI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 315.8
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ERICO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 114
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "HAKOMA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 153.6
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "HAXIU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 274.7
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "HOMOXI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 299.7
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "INAMBU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MAIA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 164.6
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MALOCA PAAPIU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 240.1
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MARARI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 211.3
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MARAUIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MATURACA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0,
    "lat": 0.628601,
    "lon": -66.136569
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MEDIO PADAUIRI PAHANA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MISSAO CATRIMANI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 126.5
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "NOVO DEMINI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 176
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "PAAPIU",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "PALIMIU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 119.7
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "PARAFURI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 216.5
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "SAUBA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 136.3
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "SURUCUCU",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 183.3
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "TOOTOTOBI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 139.5
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "URARICOERA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 101.4
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "WAHARO ALTO PADAUIRI",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "WAIKAS",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 141.4
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "WAPUTHA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 183.3
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "XITEI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 289.7
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "SEDE",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN ARIABU",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN AYARI",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN BALAIO",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN BANDEIRA BRANCA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN BARCELOS",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN BICHO ACU",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN BUDU U",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN CURUA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN HALIKATHO U",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN HEMARIPIWEI",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN HOKOLASSIMU",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN IXIMA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN JUTAI",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN KALISSI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN KATANA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN KATAROA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN KAYANAU",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN KETAA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN KOHEREPI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN KOLULU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN KOREKOREMA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN KURATANHA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN LAHAKA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN MARAXI U",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN MAXAPAPI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN NAZARE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN NOVA ESPERANCA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN OLOMAI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN ONKIOLA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN PARIMA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN PEWA U",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN POHOROA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN PUKIMA CACHOEIRA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN PUKIMA BEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN SANINAU HOKOMAWEN",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN SANTA ISABEL RIO NEGRO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN SAO GABRIEL CACHOEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN SERRINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN TARACUA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN UXIU",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN WAHARO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN XAMAKORONA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN XAMANI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN XEXENA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN XIHOPI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN XIROXIROPIU",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UN YEKUANA",
    "estado": "indeterminado",
    "motivo": "uf_indeterminada",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "KARIRI XOCO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "II XUCURU KARIRI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "I KARAPOTO PLAKI O",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "ATENCAO A KOIUPANKA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "I KARAPOTO TERRA NOVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "MARIA SAO PEDRO CORREIA KATOKINN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALAGOAS E SERGIPE",
    "canonico": "MACEIO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALDEIA PYTOTKO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ARADYTI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ARARA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALDEIA IRINAPAIN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "IRIRI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ITAAKA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "JURUATI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "KARARAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "KURUATXE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "KWATINEMU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "PAKANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "PARATATIM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "TA AKATI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "INDGENA TUKAMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "TUKAYA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "CUJUBIM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALDEIA CURUA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "IPIXUNA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "PAQUICAMBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "FURO SECO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "BOA VISTA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "MIRATU",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "PYKAJAKA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "KAMOKTIKO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALDEIA MROTDJAN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALDEIA BAKAJA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALDEIA KENKUDJOY",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALDEIA POTIKRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ALDEIA KRANH",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "INDIGINA TERRA WANGA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTAMIRA",
    "canonico": "ATENDIMENTO VITORIA XINGU",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "MARECHAL THAUMATURGO",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 32.4
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "NUKINI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "CAUCHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "ASSISTENCIAL A TARAUACA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "HASHEME KAMANAWA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO JURUA",
    "canonico": "ALTO RIO JURUA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "CARURU UAUPES",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 17.7
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "TAPERERA",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 222.1
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "NAZARE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "SANTA ISABEL RIO NEGRO ARN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO NEGRO",
    "canonico": "IAUARETE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "SANTA ROSA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "PAXIUBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "BARRINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "MARMELINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "PEDREIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "BUACU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "NOVA FRONTEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "MARONAWA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "BUENOS AIRES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO PURUS",
    "canonico": "ALTO RIO PURUS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "UMARIACU II",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 4.3,
    "lat": -4.259,
    "lon": -69.939
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "SAO PAULO OLIVENCA",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 3.1,
    "lat": -3.481894,
    "lon": -68.954315
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "UMARIACU I",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 29.4
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "FEIJOAL",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 0.7,
    "lat": -4.300532,
    "lon": -69.541252
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "ALTO SOLIMOES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "GUANABARA III",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "SAO PEDRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "VILA BITTENCOURT",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "TUPI II",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "DECU RU ME TCHIQUE CU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "A LOCAL AMATURA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "LOCAL SPO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ALTO RIO SOLIMOES",
    "canonico": "LOCAL TONANTINS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "PURURE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP MISSAO TIRIYOS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "BONA APALAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "I SANTO ANTONIO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "I BOCA MARAPI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "PEDRA ONCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "KUXARE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "URUNAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "YAWA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "I MARITEPU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "MATAWARE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP NORTE PARA I XUIXUIMENE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP ARAMIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP ESPIRITO SANTO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP KUMENE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP KUMARUMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP ESTRELA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP MANGA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP KUNANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP SANTA IZABEL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP ITUWASU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP MARYRY",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP TUKAY",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP GALIBY",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP ACAIZAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP FLEXA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP CTA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP JACAREKAGOKA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "AP YVYRARETA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "AMAPA E NORTE DO PARA",
    "canonico": "ESP AMAPA NORTE PARA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "SANTA ISABEL MORRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "FONTOURA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "INDIGINA IBUTUNA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "BISSOHANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "ARAGUAIA",
    "canonico": "ALDEIA MACAUBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "MARIA CARMINDA SANTOS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "TUMBALALA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "USFI PANKARARE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "USFI KANTARURE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "USFI BATIDA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "CARAMURU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "TUXA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "II IMBIRIBA ALDEIA VELHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "ALDEIA TUXA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "I BARRA VELHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "FUNASA FAMILIA ARACAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "ACUIPE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "EQUIPE MULTIDISCIPLINAR",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "USFI XUCURU KARIRI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "VILA SANTANINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "TUMBALALA ALONSO JOSE SILVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "TUPA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "BAHIA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "III BOCA MATA MEIO MATA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "PSI TRIBO TRUKA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "ATIKUM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "USI ATIKUM NOVA VIDA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "FAMILIA ALBERTO GONCALVES TEIXEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "IV JUERANA JAQUEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "BAHIA",
    "canonico": "ALDEIA VARGEM ALEGRE SERRA RAMALHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "POTYRO TAPEBA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "URUCUI AREA II",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "EQUIPE LAGOA SAO FRANCISCO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "MARIA GOMES FERREIRA ANACE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "ALMOFALA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "SAO JOSE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "GUIOMAR ALVES JULIAO CAUCAIA ANACE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "VILA FERNANDES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "VARJOTA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "PITAGUARY",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "INDIGINA GAMELEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "JENIPAPO KANIDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "CARNAUBA SAO BENEDITO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "CEARA CE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "NOVO ORIENTE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "MONGUBA POVO PITAGUARY",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "TABAJARA KALABASSA PORANGA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "ITAPIPOCA TREMEMBE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "QUITERIANOPOLIS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "DONA JOAQUINA VIEIRA PITAGUARY",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "MONSENHOR TABOSA EQUIPE 1",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "INDIGINA QUEIMADAS ACARAU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "MONSENHOR TABOSA EQUIPE 3",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "MONSENHOR TABOSA EQUIPE 2",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "EQUIPE CRATEUS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "TAMBORIL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "POTYRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "GERALDO TAPEBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "VICTOR TAPEBA CAUCAIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "CEARA",
    "canonico": "UNID RESERVA TABA ANACE CAUCAIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "SANTA LUZIA PARA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "TAWANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "INAJA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "KWANAMARI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA TOME ACU II",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "INDIGNA ALDEIA ACARA MIRIM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "PSI ALDEIA CAJUEIRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "PSI ALDEIA BARRERINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "FLONA TAPAJOS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "MAPUERA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA ITAHY",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA DJUDJEKO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA KATETE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA OODJA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "XARAIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "MAROXEWARA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "PS NOVA JACUNDA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA GUAJANAIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA OROROBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "CUXIU MIRIM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA TAQUARA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA TROCARA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "GUAMA TOCANTINS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "MOJU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "GOIANESIA PARA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA TEKENAY",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "MARABA II",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA SORORO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "PSI TEKOHAW",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "MAE MARIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "AUDEIA KRIKATEJE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "PSI ALDEIA CANIDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA SAO PEDRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA FRASQUEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "ALDEIA CUMINAPANEMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "PSI ALDEIA XIEPIHURENA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "GUAMA-TOCANTINS",
    "canonico": "A SANTAREM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "RESERVA MANGUEIRINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "I ALDEIA PLIPATOL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "I ALDEIA KOPLANG",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "I ALDEIA BUGIO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "I ALDEIA PALMEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "I ALDEIA TOLDO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "I ALDEIA SEDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "I ALDEIA PAVAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "ESPACO ALDEIA BUGIO GUARANI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "INTERIOR SUL COQUEIRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "TEKOA MARANGATU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "TOLDO IMBU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "ALDEIA TOLDO PINHAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "INTERIOR SUL IPUACU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "REGIAO 20 YYNN MOROTI WHERA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "CENTRO ALDEIA CONDA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "CENTRO TOLDO XIMBANGUE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "SAO JOAO IRAPUA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "ALTO RECREIO RONDA ALTA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "AREA SEDE CAMPO VERDE CACIQUE DOBLE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "ALDEIA VTOURO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "LIGEIRO CHARRUA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "INTERIOR SUL",
    "canonico": "RESERVA INHACORA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "SEDE KAIAPO MT",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "INDIO COLIDER",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "INDIO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO MATO GROSSO",
    "canonico": "INDIO PEIXOTO AZEVEDO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA MOIKARAKO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA APEXTI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA MOMOKRE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "KWARAYA PYA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "APYTEREWA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "PARANOPIONA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "XINGU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "KAIAPO PARA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA TUREDJAN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "IDIGENA ALDEIA KUBENKRANKENH",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "INDEGENA ALDEIA KIKRETUM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA AUKRE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA GOROTIRE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "SAUD ALDEIA KRANH APARI",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA LAS CASAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA PYKARARANKRE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA KENDJAN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA KOKRAIMORO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "KAIAPO DO PARA",
    "canonico": "ALDEIA KRINY",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "WILIMON",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SERRA TRUARU",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 4,
    "lat": 3.271527,
    "lon": -60.673329
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CANTA GALO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "COBRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "LARANJINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MAKARA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SAMAUMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SOMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "NOVA UNIAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MURIRU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "DALVA OLIVEIRA SOUZA COM IND MOSCOU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MUTAMBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SUCUBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ANTA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PONTA SERRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TAXI I",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ANINGAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "LEAO OURO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "RAIMUNDAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "NOVA ESPERANCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CARAPARU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "LIVRAMENTO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ANAUA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "XAARI",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "BISMARK",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CONSTANTINO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "BARREIRINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "IGARAPE GALO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "NOVA ALIANCA I",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "NOVA ALIANCA II",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SANTA LIBERDADE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SAO FELIPE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TABATINGA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TRIUNFO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CANAWAPAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CAXIRIMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "KUMAPAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "LAGE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MONTE MORIA I",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MONTE MORIA II",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "POPO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PROTOTO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SAO GABRIEL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "AREA UNICA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "AWENDEI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "KUMAIPA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MANALAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MAPAE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PAMAK",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PARANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PIPI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SAUPARU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "BANANEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CAMARAREM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "FLEXALZINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "LILAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "NOVA JERUSALEM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SOCO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TICOCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ANGICAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ARAMU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CUTIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MARACANA I",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MARACANA II",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MUTUM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "WARAPATA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "UIRAMUTA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "URINDUK",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ANDORINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ARAPA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MACUQUEM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MONTE SIAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "NOVA VIDA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SALVADOR",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SANTA CREUZA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "WARONKAYEN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "AGUA FRIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CARAPARU III",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CARAPARU IV",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ESTEVAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MANAPARU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MUDUBIM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SAO LUIS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SOL NASCENTE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TABOCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TAMANDUA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "WAROMADA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "PERDIZ",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ANTA II",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "BARATA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ARAPUA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "RAIMUNDAO II",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ANANAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "GARAGEM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "VIDA NOVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ANARO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "JURACI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "OURO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "URUCURI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CACHOEIRA SAPO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CUMARU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "JABUTI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "NOVO PARAISO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SAO JOAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "AGUA BOA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MARUPA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SAO DOMINGOS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "WAPUM",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "LAGO GRANDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TRES IRMAOS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MORCEGO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SERRA MOCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "TRUARU CABECEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "AAKAN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CAMPO ALEGRE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "DARORA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "ILHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "MAUIXE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "SAO MARCOS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "VISTA NOVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CANAUANIN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LESTE DE RORAIMA",
    "canonico": "CAMPINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "ALDEIA SAPUKAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "ALDEIA PARATY MIRIM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "USFI RIO SILVEIRA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "KRUKUTU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "VERA POTY",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "LITORAL SUL ITAP",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "PERUIBE ITARIRI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "AMBULATORIO ATENCAO ESPECIALIZADA A PESSOA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "INDIGINA AVAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "ALDEIA JARAGUA KWARAY DJEKUPE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "ALDEIA BOA VISTA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "RESERVA PINHALZINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "FAXINAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "ATENCAO A MOCOCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "ATENCAO A QUEIMADAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "AREA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "AVA GUARANI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "IVAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "PIN RIO COBRAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "ALDEIA VELHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "ALDEIA MARRECAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "RESERVA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "AREA PALMAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "TERRA APUCARANINHA MARIA VAGANH",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "LITORAL SUL",
    "canonico": "PINHAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "MUNICIPIO BERURI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "IGARAPE PRETO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "A MANAUS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MANAUS",
    "canonico": "NOVA OLINDA NORTE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "INIDIGENA ALDEIA FELIPE BONE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "CACIQUE IRACI AMORIM SOARES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ABRAAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA PORQUINHOS",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA ESCALVADO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ARARIBOIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA ANGICO TORTO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA NOVO PLANETA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "LAGO BRANCO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA RIO CORDA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ZE GURUPI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "AUGUSTO MOREIRA GAVIAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "CANUDAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "LAGOA COMPRIDA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "JUCARAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "RIACHINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "SARDINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA MAINUMY",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "COLONIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "CACHOEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "MARECHICO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "KRIKATI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "EL BETEL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA CANA BRAVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA COCALINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA COQUINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA CACIMBA VELHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA SAO PEDRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ATENCAO A PIN JURITI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "GUAJA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "TURIZINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "AMARANTE 2",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA NOVA VIANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA SIBIRINO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "XIMBORENDA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "BACURIZINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "BANANAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "GUARUHU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "MARANHAO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_da_uf",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA PRESIDIO ZUTIUA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "INDIGINA AXINGUIRENDA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA BEIRA RIO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA BAIXAO PEIXE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA NOVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA CHUPE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA AWA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA MACARANDUBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "PICARRA PRETA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA TIRACAMBU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA JANUARIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA TRES IRMAOS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA KWARAHY",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA VILA NOVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA JATOBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "ALDEIA JENIPAPO RIBEIROS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MARANHAO",
    "canonico": "A IMPERATRIZ",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MATO GROSSO DO SUL",
    "canonico": "DOIS IRMAOS BURITI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "MARRECAO",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "ABAQUADI",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 56.8
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "IINDIGENA ESCONDIDO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "ILHA ONCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "KANACURI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "NOVA FORTALEZA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "PAUZINHO NOVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "SAUBINHA NOVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "INDINA BOA ESPERANCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "TRES BOCAS SAO PEDRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "SEDE ANEXO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "CUJUBIM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "MEDIO PURUS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "IINDIGENA ESCONDICO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "CASTANHEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO PURUS",
    "canonico": "PARAIBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "ADMINISTRATIVO IPIXUNA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "CENTRO MAXIMO MAIA SILVA O CORUJA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "MEDIO SOLIMOES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "A EIRUNEPE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MEDIO RIO SOLIMOES E AFLUENTES",
    "canonico": "INDIO TEFE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "CAIERAS VELHA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA RENASCER WAKONA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "I ALDEIA IBIRAMA KIRIRI ACRE KARIRI WAKONA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA CORREGO PEZINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA ESCOLA FLORESTA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA CACHOEIRINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA RIACHO BREJO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "I ALDEIA XUCURU KARIRI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA PINDAIBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA ITAPICURU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA SUMARE III",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA PRATA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "MGES",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA BARREIRO PRETO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "KRENAK",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "KAXIXO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA MUA MIMATXI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA PRADINHO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA VERDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ALDEIA AGUA BOA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "II SAO JOAO MISSOES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ATENCAO A BELO HORIZONTE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "II TEOFILO OTONI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "II MACHACALIS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "ESCRITORIO LOCAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "MINAS GERAIS E ESPIRITO SANTO",
    "canonico": "A INDIO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PARINTINS",
    "canonico": "CENTRAL ABASTECIMENTO FARMACEUTICO SESAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PARINTINS",
    "canonico": "ADMINISTRATIVO II",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PARINTINS",
    "canonico": "INDIGINA PAUINI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "FULNI O",
    "estado": "validada",
    "motivo": "duas_fontes_concordam",
    "km": 3.6,
    "lat": -9.111,
    "lon": -37.123
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "PANKARURU ENTRE SERRAS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "PIPIPAN",
    "estado": "conflito",
    "motivo": "duas_fontes_discordam_na_uf",
    "km": 29.4
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ATENCAO A ALDEIA BAIXA D ALEXANDRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ATENCAO A ALDEIA PEREIROS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ALDEIA CANA BRAVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ALDEIA VILA CIMBRES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "SERROTE CAMPOS",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "TRAVESSAO OURO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ALDEIA SAO JOSE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ALDEIA FULNIO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "MINA GRANDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ALDEIA NAZARIO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "CALDEIRAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ITACURUBA ADPF",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "MUNDO NOVO TEREZA A CARVALHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "SABONETE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "PIN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "PERNAMBUCO PE",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "PONTA VARZEA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "KAMBIWA IBIMIRIM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "BREJO PADRES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "BAIXA LERO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "MULUNGU",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ALDEIA XIXIAKLA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ANTONIO CAXIADO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "ALMIRA ROSA MENEZES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "OLHO DAGUA PADRE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "FAVELEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "CARAIBAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "MACACO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "CAJUEIRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "VILA NOVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "CAATINGUINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "CAITITU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "JIBOIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PERNAMBUCO",
    "canonico": "A PERNAMBUCO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "COSTA MARQUES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA ALTO JARU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA 623",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA TRINCHEIRA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA LAGE VELHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA LAGE NOVO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA RIBEIRAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "GUAJARA MIRIM RO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALTA FLORESTA DOESTE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "1 JI PARANA RO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA KARITIANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA KARIPUNA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA RIO NEGRO OCAIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA LINHA 10",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "INDIGINA ALDEIA ITERAP",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "INDIGINA ALDEIA CASTANHEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "INDIGINA IKOLEN",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "INDIGINA ALDEIA PAYGAP",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA TRINDADE",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA COLORADO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "PALHAU",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "CAJUI I",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "JARU RO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA MARMELO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "ALDEIA FORQUILHA GRANDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "A ALTA FLORESTA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "A GUAJARA MIRIM RO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "A JI PARANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "PORTO VELHO",
    "canonico": "A PORTO VELHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "GOIANINHA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "CACIQUE ANIBAL CORDEIRO CAMPOS ALDEIA JARAGUA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "MARIA HILARIA CONCEICAO ALDEIA SILVA BELEM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "INDIO JURANDIR ALVES BARBOSA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "PEDRO GOMES SANTOS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "JACARE SAO DOMINGOS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "ALDEIA AKAJUTIBIRO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "JOSE ALFREDO CANDIDO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "ALDEIA TRAMATAIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "CESAR SOARES LIMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "CACIQUE MANUEL FRANCISCO INACIO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "ALDEIA CARNEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "ALDEIA BREJINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "DOMINGO BARBOSA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "ALDEIA LAGOA GRANDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "JURANDIR ALVES BARBOSA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "ALDEIA YBYKUARA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "ALDEIA COQUEIRINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "POTIGUARA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "RIO TINTO ALDEIA MONT MOR",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "BAIA TRAICAO ALDEIA FORTE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "JOAO OLIVEIRA MELO ALDEIA SAO MIGUEL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "JOAO FRANCISCO SANTOS ALDEIA SILVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "MANUEL HIGINO SILVA ALDEIA TRACOEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "ALEXANDRINA MARIA CONCEICAO ALDEIA LAGOA MATO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "MIGUEL BENTO AZEVEDO ALDEIA BENTO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "JOSE ROBERTO PEREIRA ALDEIA CUMARU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "ARTUR LOURENCO ALDEIA LARANJEIRAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "MARIA AUGUSTO BARBOSA ALDEIA SANTA RITA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "ALDEIA ALTO TAMBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "POTIGUARA",
    "canonico": "JOSE DOMINGOS SILVA ALDEIA SAO FRANCISCO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "KARAPANATUBA",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "RIO TAPAJOS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "WARO APOMPO MUNDURUKU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "PRAINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "CAROCAL RTP",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "PRAIA INDIO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "SAWRE MUYBU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "WARITODI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "SAO JOAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "MISSAO VELHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "CAROCAL RIO CURURU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "JACAREACANGA II",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "BIRIBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "A ITAITUBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "A JACAREACANGA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "RIO TAPAJOS",
    "canonico": "A RIO TAPAJOS SANTAREM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "INDIGINA XAMBIOA SANTA FE ARAGUAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "INDIGINA SANTA FE ARAGUAIA TOCANTINS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "ALDEIA SAO JOAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "CANUANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "TXUIRI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "ALDEIA CACHOEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "RIO VERMELHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "ALDEIA NOVA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "MANGABEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "INDIGINA PORTEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "INDIGINA SALTO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "INDIGINA RIO SONO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "INDIGINA FUNIL",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "INDIGINA BRUPRE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "INDIGINA BREJO CUMPRIDO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "SAO JOSE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "MARIAZINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "SANTA CRUZ",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "MORRO BOI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "GALHEIRO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "SERRA GRANDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "TOCANTINS",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "UNIDADA PEDRA BRANCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "BONITO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "UNIADE PATIZAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "BOTICA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "ALDEIA LANKRARE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "ALDEIA WARI WARI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "TOCANTINS",
    "canonico": "A ARAGUAINA AUX",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "LAR FELIZ",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "PARAISO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA TXECHE WASSA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA SOLES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA LOBO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA VOLTA GRANDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA NOVA ESPERANCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA RIO NOVO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA BANANEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA HOBANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ACAMPAMENTO COARI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA ALEGRIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA NUNTEWA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA LAGO GRANDE RIO JAVARI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA TERRINHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA PARANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA REMANSINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA PENTIAQUINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA FLORES",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ITUI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA JARINAL NOVO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "ALDEIA FRUTA PAO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VALE DO JAVARI",
    "canonico": "SEDE JAVARI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA CAPITAO CARDOSO SAPECADO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA AKUNTSU OMERE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA TUBARAO RIO OURO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA GLEBA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA TENENTE MARQUES JOAO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA CAPITAO CARDOSO TONHAO",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA 14 ABRIL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA ROOSEVELT CENTRAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ROOSEVELT MAWANAT",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA LINHA 07 PAYAMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "BAIXA VERDE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "LINHA 10 CENTRAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "LINHA 11 LAPETANHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "LINHA 11 LOBO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "LINHA 14 GAMIR",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "LINHA 11 AMARAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "LINHA 09 CENTRAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "LINHA 12 ANINE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "LINHA 14 PLACA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA SOWAINTE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "ALDEIA FURQUIM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "VILHENA",
    "canonico": "A CACOAL",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "PARANATINGA",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "NOSSA SENHORA FATIMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "NOSSA SENHORA GUARDALUPE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "NOSSA SENHORA GUIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "ALDEONA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "ALDEIA BELEM",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "ALDEIA CACULA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "ALDEIA TANGURO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "ALDEIA CAMPINAS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "ALDEIA SAO PEDRO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "BARRA GARCAS MT",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XAVANTE",
    "canonico": "A POPULACAO CAMPINAPOLIS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "XINGU",
    "canonico": "LEONARDO",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "XINGU",
    "canonico": "A SINOP",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ARATHA U",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ALTO PADAUIRI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MEDIO PADAUIRI",
    "estado": "coerente",
    "motivo": "fonte_unica_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "KAYANAU",
    "estado": "coerente",
    "motivo": "copia_entre_fontes_na_uf",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "SERRINHO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "JUTAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MISSAO MARAUIA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "IXIMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "PUKIMA BEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "NOVA ESPERANCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "CAUBURIS",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "RAITA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "XAMAKORONA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "POHOROA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "NAZARE",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ADMINISTRATIVO SAO GABRIEL CACHOEIRA YANOMAMI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "BICHO ACU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MAXAPAPI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "TAPERA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "CUMARU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "HEMARIPIWEI",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "BANDEIRA BRANCA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "KOHEREPI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ADMINISTRATIVO BARCELOS YANOMAMI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "XAMANI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "LAHAKA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "CURUA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "TARACUA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "PUKIMA CACHOEIRA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "WAHARO",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "PAHANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ADMINISTRATIVO SANTA ISABEL RIO NEGRO YANOMAMI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "XIHUPI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "XIROXIROPIU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "PEWAU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "HALIKATO U",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "XEXENA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "KETAA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "BUDU U",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "UXIU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "KATAROA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "KATANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "SANINAU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "KOREKOREMA",
    "estado": "erro",
    "motivo": "fonte_unica_fora_do_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "MARAXIU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ARATHAU PARIMA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "ONKIOLA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "YEKWANA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "POOLASAI TIROPEI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "HOKOLASIMU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "KURATANHA",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "OLOMAI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "KOLULU",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  },
  {
    "dsei": "YANOMAMI",
    "canonico": "KALISSI",
    "estado": "coerente",
    "motivo": "fonte_unica_no_municipio",
    "km": 0
  }
];

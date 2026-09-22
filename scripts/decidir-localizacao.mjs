import { dentroDaUf } from "./malhas-das-ufs.mjs";
import {
  dentroDoMunicipio,
  kmAteAFronteira,
} from "./malhas-dos-municipios.mjs";
import {
  distanciaKm,
  LIMIAR_PROXIMA_KM,
} from "../src/lib/reconciliacao-unidades.js";

/*
  A DECISÃO DE UM VEREDITO DE LOCALIZAÇÃO, NUM SÍTIO SÓ

  Duas passagens auditam localizações — a das lotações da planilha e a dos
  pontos que ela não cobre — e ambas fazem a mesma pergunta. Enquanto a regra
  estiver escrita nas duas, elas divergem, e dois vereditos com o mesmo nome
  passam a querer dizer coisas diferentes.

  AS PERGUNTAS, PELA ORDEM EM QUE SE FAZEM

  1. Há UF declarada e coordenada? Sem isso não há o que verificar.
  2. Há uma segunda fonte? Sem ela não se confirma nada — só se deteta
     contradição contra o município ou a UF que o próprio registro declara.
  3. Com duas fontes: estão no mesmo ponto? Concordam? Discordam? Uma delas
     cai fora da UF, e a outra decide?

  NENHUMA FONTE ÚNICA SAI `validada`

  Uma coordenada sozinha, por mais coerente que seja com o município declarado,
  não foi confirmada por ninguém. `coerente` é ausência de contradição, e o
  rótulo no ecrã diz isso por extenso.

  O MUNICÍPIO É UMA PERGUNTA MUITO MAIS ESTREITA DO QUE A UF

  Medido em 745 unidades de fonte única: a malha da UF acusou UMA, a malha
  municipal acusou CINQUENTA E DUAS. Por isso o município vem primeiro, e o
  motivo diz qual das duas respondeu — é o que dá a medida do "coerente".

  MAS "FORA" NÃO É UMA PERGUNTA DE SIM OU NÃO

  Dessas 52, VINTE estavam a menos de 2 km da divisa, e várias a cem metros.
  Acusar o cadastro por isso é arrogância: são dois campos administrativos a
  discordar numa linha, e a linha do IBGE não é a cerca que o posto de saúde vê.
  Só seis estavam a mais de 30 km dentro do vizinho.

  Por isso o veredito de erro exige margem. Dentro da margem o registro fica
  `coerente / fonte_unica_na_divisa`, que diz o que se viu sem acusar ninguém.
*/

/*
  Dois quilómetros. Abaixo disso a discordância entre a coordenada e o nome do
  município não distingue erro de fronteira, e o mapa não tem como saber qual é.
*/
export const MARGEM_DA_DIVISA_KM = 2;

/*
  Uma coordenada "copiada" — as duas fontes a dar exatamente o mesmo ponto —
  não é confirmação: é a mesma origem vista duas vezes. Meio metro é a folga
  para o arredondamento das casas decimais.
*/
export const COPIA_KM = 0.0005;

/*
  `null` de `dentroDoMunicipio` é ausência de malha ou de código, não "está
  fora". Acusar aí seria acusar o cadastro por falha nossa.
*/
function ondeCai({ lat, lon, malha, municipios, codigoMunicipio }) {
  if (!malha) return { naUf: null, noMunicipio: null, naDivisa: false };
  const naUf = dentroDaUf(malha, lat, lon);
  if (!naUf) return { naUf: false, noMunicipio: null, naDivisa: false };

  const noMunicipio =
    municipios && codigoMunicipio
      ? dentroDoMunicipio(municipios, codigoMunicipio, lat, lon)
      : null;

  // Fora, mas quão fora. Ver MARGEM_DA_DIVISA_KM.
  const naDivisa =
    noMunicipio === false &&
    (kmAteAFronteira(municipios, codigoMunicipio, lat, lon) ?? Infinity) <
      MARGEM_DA_DIVISA_KM;

  return { naUf: true, noMunicipio, naDivisa };
}

export function decidirLocalizacao({
  primeira,
  segunda = null,
  uf,
  malha,
  municipios = null,
  codigoMunicipio = null,
}) {
  if (
    !uf ||
    !primeira ||
    !Number.isFinite(Number(primeira.lat)) ||
    !Number.isFinite(Number(primeira.lon))
  ) {
    return {
      estado: "indeterminado",
      motivo: "uf_indeterminada",
      prova: { uf },
    };
  }

  const a = ondeCai({
    lat: Number(primeira.lat),
    lon: Number(primeira.lon),
    malha,
    municipios,
    codigoMunicipio,
  });
  if (a.naUf === null) {
    return {
      estado: "indeterminado",
      motivo: "uf_indeterminada",
      prova: { uf },
    };
  }

  const temSegunda =
    segunda &&
    Number.isFinite(Number(segunda.lat)) &&
    Number.isFinite(Number(segunda.lon));

  const b = temSegunda
    ? ondeCai({
        lat: Number(segunda.lat),
        lon: Number(segunda.lon),
        malha,
        municipios,
        codigoMunicipio,
      })
    : { naUf: null, noMunicipio: null };

  const km = temSegunda
    ? distanciaKm(
        Number(primeira.lat),
        Number(primeira.lon),
        Number(segunda.lat),
        Number(segunda.lon),
      )
    : null;

  const prova = {
    uf,
    km,
    dentroLot: a.naUf,
    dentroCnes: b.naUf,
    noMunicipioLot: a.noMunicipio,
    noMunicipioCnes: b.noMunicipio,
    naDivisa: a.naDivisa,
  };

  if (!temSegunda) {
    if (!a.naUf) {
      return { estado: "erro", motivo: "fonte_unica_fora_da_uf", prova };
    }
    if (a.noMunicipio === false && !a.naDivisa) {
      return { estado: "erro", motivo: "fonte_unica_fora_do_municipio", prova };
    }
    if (a.naDivisa) {
      return {
        estado: "coerente",
        motivo: "fonte_unica_na_divisa",
        ponto: primeira,
        prova,
      };
    }
    return {
      estado: "coerente",
      motivo:
        a.noMunicipio === true
          ? "fonte_unica_no_municipio"
          : "fonte_unica_na_uf",
      ponto: primeira,
      prova,
    };
  }

  if (km < COPIA_KM) {
    return a.naUf
      ? {
          estado: "coerente",
          motivo: "copia_entre_fontes_na_uf",
          ponto: primeira,
          prova,
        }
      : { estado: "erro", motivo: "copia_fora_da_uf", prova };
  }

  if (a.naUf && b.naUf) {
    return km <= LIMIAR_PROXIMA_KM
      ? {
          estado: "validada",
          motivo: "duas_fontes_concordam",
          ponto: segunda,
          prova,
        }
      : { estado: "conflito", motivo: "duas_fontes_discordam_na_uf", prova };
  }
  if (b.naUf) {
    return {
      estado: "validada",
      motivo: "arbitrada_pela_uf_cnes",
      ponto: segunda,
      prova,
    };
  }
  if (a.naUf) {
    return {
      estado: "validada",
      motivo: "arbitrada_pela_uf_lotacoes",
      ponto: primeira,
      prova,
    };
  }
  return { estado: "erro", motivo: "ambas_fora_da_uf", prova };
}

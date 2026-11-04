/*
  OS 34 DSEIs E O NÚMERO DE CADA UM

  A numeração é a do mapa institucional da AgSUS (Organização da Saúde
  Indígena): os 34 nomes oficiais da SESAI em ordem alfabética, de 1 (Alagoas
  e Sergipe) a 34 (Yanomami). É a única lista: o "Mapa simples", a lista
  "Territórios por vagas" e o script que compila os contornos
  (`scripts/compilar-contornos-dos-dseis.mjs`) leem daqui o número de cada
  distrito. `tests/dseis-oficiais.test.js` confere a ordem e as 34 posições.

  O nome que chega (lmap, edital, camada da Funai) é comparado pela chave de
  `chaveDoDsei` — sem acento, sem "DSEI", sem preposição —, mais um passo:
  apóstrofo e pontuação viram espaço ("Ye'kuana"). Os apelidos cobrem as
  grafias de outras fontes para o mesmo distrito.
*/
import { chaveDoDsei } from "./chaves.ts";

export const DSEIS_OFICIAIS = Object.freeze([
  "Alagoas e Sergipe",
  "Altamira",
  "Alto Rio Juruá",
  "Alto Rio Negro",
  "Alto Rio Purus",
  "Alto Rio Solimões",
  "Amapá e Norte do Pará",
  "Araguaia",
  "Bahia",
  "Ceará",
  "Cuiabá",
  "Guamá-Tocantins",
  "Interior Sul",
  "Kaiapó do Mato Grosso",
  "Kaiapó do Pará",
  "Leste de Roraima",
  "Litoral Sul",
  "Manaus",
  "Maranhão",
  "Mato Grosso do Sul",
  "Médio Rio Purus",
  "Médio Rio Solimões e Afluentes",
  "Minas Gerais e Espírito Santo",
  "Parintins",
  "Pernambuco",
  "Porto Velho",
  "Potiguara",
  "Rio Tapajós",
  "Tocantins",
  "Vale do Javari",
  "Vilhena",
  "Xavante",
  "Xingu",
  "Yanomami",
] as const);

export type NomeDoDseiOficial = (typeof DSEIS_OFICIAIS)[number];

/* A chave de comparação: a de `chaveDoDsei`, sem pontuação. */
export function chaveOficialDoDsei(nome: unknown): string {
  return chaveDoDsei(nome)
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Outras grafias do mesmo distrito (chave → nome oficial). */
const APELIDOS: Readonly<Record<string, NomeDoDseiOficial>> = Object.freeze({
  "YANOMAMI YE KUANA": "Yanomami",
  "YANOMAMI YEKUANA": "Yanomami",
  "KAYAPO MATO GROSSO": "Kaiapó do Mato Grosso",
  "KAYAPO PARA": "Kaiapó do Pará",
  "MEDIO RIO SOLIMOES": "Médio Rio Solimões e Afluentes",
  "MEDIO SOLIMOES AFLUENTES": "Médio Rio Solimões e Afluentes",
  "GUAMA TOCANTINS": "Guamá-Tocantins",
});

const NUMERO_POR_CHAVE: ReadonlyMap<string, number> = new Map([
  ...DSEIS_OFICIAIS.map(
    (nome, indice) => [chaveOficialDoDsei(nome), indice + 1] as const,
  ),
  ...Object.entries(APELIDOS).map(
    ([apelido, nome]) => [apelido, DSEIS_OFICIAIS.indexOf(nome) + 1] as const,
  ),
]);

/** O número (1–34) do DSEI pelo nome ou pela chave; `null` se não for um dos 34. */
export function numeroDoDsei(nome: unknown): number | null {
  const chave = chaveOficialDoDsei(nome);
  return chave ? (NUMERO_POR_CHAVE.get(chave) ?? null) : null;
}

/** O nome oficial do DSEI de número `numero` (1–34). */
export function nomeOficialDoDsei(numero: number): NomeDoDseiOficial | null {
  return Number.isInteger(numero) && numero >= 1 && numero <= 34
    ? (DSEIS_OFICIAIS[numero - 1] ?? null)
    : null;
}

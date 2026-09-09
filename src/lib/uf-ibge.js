/*
  Conversão explícita de código IBGE de UF para sigla, e a regra de vínculo
  territorial entre uma unidade e o DSEI a que ela pertence.

  A regra oficial, fixada em 09/09/2026:

    - o CNES/IBGE decide a **UF administrativa** da unidade;
    - latitude/longitude decide **onde o marcador é desenhado**;
    - `UF_GEO` não decide interestadualidade — serve para desenho e diagnóstico.

  Por que a conversão é explícita em vez de uma comparação direta: no payload de
  `mapa_saude_indigena_config`, o campo `uf` do estabelecimento é um **número**
  (o código IBGE, `29`), enquanto o `ufs` do DSEI são **siglas** (`["AL","SE"]`).
  Comparar os dois sem converter classifica todas as 1462 unidades como
  interestaduais.

  Por que `UF_GEO` ficou de fora da decisão: medido sobre os dados reais, o ray
  casting nele diverge do CNES em 20 unidades (1.4%) e aponta 12 como fora do
  próprio DSEI — das quais **9 são falso positivo**. Feijó é no Acre, Juazeiro é
  na Bahia, Paragominas é no Pará, Itacuruba é em Pernambuco; o polígono
  simplificado erra perto das fronteiras, o CNES acerta.
*/

export const UF_POR_CODIGO_IBGE = Object.freeze({
  11: "RO",
  12: "AC",
  13: "AM",
  14: "RR",
  15: "PA",
  16: "AP",
  17: "TO",
  21: "MA",
  22: "PI",
  23: "CE",
  24: "RN",
  25: "PB",
  26: "PE",
  27: "AL",
  28: "SE",
  29: "BA",
  31: "MG",
  32: "ES",
  33: "RJ",
  35: "SP",
  41: "PR",
  42: "SC",
  43: "RS",
  50: "MS",
  51: "MT",
  52: "GO",
  53: "DF",
});

const SIGLAS = Object.freeze(new Set(Object.values(UF_POR_CODIGO_IBGE)));

/*
  Aceita o que o payload realmente traz: número (código IBGE), string numérica,
  ou sigla. Devolve `null` para qualquer coisa que não seja uma UF reconhecível
  — e `null` significa "não classificar", nunca "está fora".
*/
export function siglaDaUf(valor) {
  if (valor === null || valor === undefined) return null;

  if (typeof valor === "number") {
    return Number.isInteger(valor) ? (UF_POR_CODIGO_IBGE[valor] ?? null) : null;
  }

  const bruto = String(valor).trim();
  if (!bruto) return null;

  if (/^\d+$/.test(bruto)) {
    return UF_POR_CODIGO_IBGE[Number(bruto)] ?? null;
  }

  const sigla = bruto.toUpperCase();
  return SIGLAS.has(sigla) ? sigla : null;
}

export const VINCULO_NORMAL = "normal";
export const VINCULO_EXTERNO = "externo";
export const VINCULO_INDETERMINADO = "indeterminado";

/*
  `ufDaUnidade` é o valor cru do CNES; `ufsDoDsei` são as siglas de abrangência.

  As duas guardas devolvem `indeterminado`, não `externo`: sem UF válida na
  unidade ou sem abrangência declarada no DSEI, não há como afirmar que algo
  está fora. Afirmar assim mesmo desenharia uma relação que ninguém verificou.
*/
export function classificarVinculoTerritorial(ufDaUnidade, ufsDoDsei) {
  const sigla = siglaDaUf(ufDaUnidade);
  if (!sigla) {
    return { vinculo: VINCULO_INDETERMINADO, uf: null, ufsDoDsei: [] };
  }

  const abrangencia = (Array.isArray(ufsDoDsei) ? ufsDoDsei : [])
    .map((item) => siglaDaUf(item))
    .filter(Boolean);

  if (!abrangencia.length) {
    return { vinculo: VINCULO_INDETERMINADO, uf: sigla, ufsDoDsei: [] };
  }

  return {
    vinculo: abrangencia.includes(sigla) ? VINCULO_NORMAL : VINCULO_EXTERNO,
    uf: sigla,
    ufsDoDsei: abrangencia,
  };
}

/*
  Diagnóstico, não decisão. Serve para registrar no console quando o polígono
  discorda do CNES — útil para achar coordenada errada — sem nunca mudar a
  classificação nem mexer na coordenada desenhada.
*/
export function divergenciaDeDiagnostico(ufCnes, ufDoPoligono) {
  const cnes = siglaDaUf(ufCnes);
  const poligono = siglaDaUf(ufDoPoligono);
  if (!cnes || !poligono || cnes === poligono) return null;
  return { cnes, poligono, autoridade: cnes };
}

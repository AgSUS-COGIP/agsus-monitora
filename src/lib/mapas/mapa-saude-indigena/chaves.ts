/*
  CHAVES E NÚMEROS DO MAPA DA SAÚDE INDÍGENA

  `chaveDoDsei` é a mesma regra do `dseiKey` do `legacy-app.js`: casa o nome
  da unidade do edital ("DSEI Kaiapó de Mato Grosso") com a chave do `lmap`
  ("KAIAPO DO MATO GROSSO") ignorando acento, hífen, os prefixos DSEI/CASAI, a
  palavra NACIONAL e as preposições. É por ela que um edital conta para uma
  bolha e que o DSEI escolhido no mapa recorta a tabela.
*/

export const texto = (valor: unknown) => String(valor ?? "").trim();

export const numero = (valor: unknown) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

export function chaveDoDsei(nome: unknown) {
  return texto(nome)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^DSEI\s+/, "")
    .replace(/^CASAI\s+/, "")
    .replace(/\bNACIONAL\b/g, " ")
    .replace(/-/g, " ")
    .replace(/\b(DE|DO|DA|DOS|DAS|E)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Coordenada utilizável: as duas partes numéricas e finitas. */
export function temCoordenada(lat: unknown, lon: unknown) {
  return (
    lat !== null &&
    lat !== undefined &&
    lat !== "" &&
    lon !== null &&
    lon !== undefined &&
    lon !== "" &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lon))
  );
}

export const formatarNumero = (valor: unknown) =>
  numero(valor).toLocaleString("pt-BR");

export const plural = (quantidade: number, um: string, varios: string) =>
  `${formatarNumero(quantidade)} ${quantidade === 1 ? um : varios}`;

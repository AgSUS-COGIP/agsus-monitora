/*
  Datas das etapas de cronograma: plausibilidade e "o que vem a seguir".

  Há etapas gravadas com o ano errado — um início em 0202 no lugar de 2026, um
  fim em 2206. Uma data dessas não quebra nada ao ser gravada, mas aparecia no
  Cronograma como "(666205 dias)" e, como a lista era ordenada pelo início, uma
  etapa "do ano 202" vinha antes de todas as outras em Próximas etapas.

  Datas no formato "AAAA-MM-DD", comparadas como texto.
*/

export const ANO_MINIMO = 2015;
export const ANO_MAXIMO = 2100;

/* "AAAA-MM-DD" com o ano entre os limites. O formato inteiro conta: um ano de
   cinco dígitos ("20206-09-14") passava como 2020 pelos 4 primeiros. */
export function dataPlausivel(chave) {
  const texto = String(chave ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const ano = Number(texto.slice(0, 4));
  return ano >= ANO_MINIMO && ano <= ANO_MAXIMO;
}

/** A etapa tem início e fim possíveis, e o fim não vem antes do início? */
export function etapaComDatasValidas(etapa) {
  const inicio = etapa?.data_inicio;
  const fim = etapa?.data_fim || inicio;
  return dataPlausivel(inicio) && dataPlausivel(fim) && fim >= inicio;
}

/*
  A data que importa para quem acompanha: o início, se a etapa ainda vai
  começar; o fim, se já está em andamento. Um prazo aberto desde agosto que
  termina amanhã é "amanhã", não "agosto".
*/
/**
 * @param {{ data_inicio: string, data_fim: string }} etapa
 * @param {string} hoje
 * @returns {string}
 */
export function proximaDataDaEtapa(etapa, hoje) {
  return etapa.data_inicio >= hoje ? etapa.data_inicio : etapa.data_fim;
}

/**
 * Etapas ainda não encerradas, da mais próxima para a mais distante.
 * Etapas com data impossível ficam de fora: não há como dizer quando vêm.
 * @template {{ data_inicio: string, data_fim: string, ordem?: number }} T
 * @param {readonly T[]} etapas
 * @param {string} hoje
 * @param {number} [limite]
 * @returns {T[]}
 */
export function proximasEtapas(etapas, hoje, limite = Infinity) {
  return etapas
    .filter((etapa) => etapaComDatasValidas(etapa))
    .filter((etapa) => (etapa.data_fim || etapa.data_inicio) >= hoje)
    .map((etapa) => ({ etapa, data: proximaDataDaEtapa(etapa, hoje) }))
    .sort(
      (a, b) =>
        a.data.localeCompare(b.data) ||
        (a.etapa.ordem ?? 0) - (b.etapa.ordem ?? 0),
    )
    .slice(0, limite)
    .map(({ etapa }) => etapa);
}

/** Editais com pelo menos uma etapa de data impossível, para quem vai corrigir.
 * @param {readonly { edital: string, unidade: string, data_inicio: string, data_fim: string }[]} etapas
 * @returns {{ edital: string, etapasComProblema: number }[]}
 */
export function editaisComDatasARevisar(etapas) {
  const porEdital = new Map();
  for (const etapa of etapas) {
    if (etapaComDatasValidas(etapa)) continue;
    const chave = `${etapa.edital} • ${etapa.unidade}`;
    porEdital.set(chave, (porEdital.get(chave) || 0) + 1);
  }
  return [...porEdital].map(([edital, etapasComProblema]) => ({
    edital,
    etapasComProblema,
  }));
}

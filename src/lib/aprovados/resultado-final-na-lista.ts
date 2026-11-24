/*
  O resultado final da Classificação e a Lista de aprovados: publicado lá não
  quer dizer que está aqui.

  Na Classificação, "Publicar" (publicar_lista_classificacao) só marca a lista
  como publicada; quem cria a lista de aprovados é "Publicar como lista de
  aprovados" (o casamento do job Python e aplicar_casamento_da_lista). No
  resultado final os dois viram um passo só para quem pode publicar como lista
  (`pode_publicar` de obter_publicacao_lista_aprovados); quem só pode marcar
  continua marcando, e o resultado final publicado que ainda não virou lista
  fica em destaque.

  - `passoDoResultadoFinal`: os botões e o destaque do resultado final.
  - `resultadosFinaisForaDaLista`: os editais da área com resultado final
    publicado e sem lista de aprovados vinda dele (o aviso da Lista de
    aprovados), com o que listar_editais_classificacao e as listas vigentes
    (abrir_lista_aprovados) já devolvem.
*/

import { compararNumeroDoEdital } from "../editais/numero-do-edital.ts";

const texto = (valor: unknown) =>
  typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";

const registro = (valor: unknown): Record<string, unknown> =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};

const instante = (valor: unknown) => {
  const t = Date.parse(texto(valor));
  return Number.isNaN(t) ? null : t;
};

/** A situação da lista de aprovados do edital, vista do resultado final. */
export interface ListaDeAprovadosDoEdital {
  /** Pode publicar como lista de aprovados (Classificação editor e pode substituir a vigente). */
  pode_publicar: boolean;
  /** A lista de classificação de que veio a lista de aprovados vigente (null: XLSX ou nenhuma). */
  lista_classificacao_id: string | null;
}

export interface PassoDoResultadoFinal {
  /** "Publicar" de sempre: só marca a lista como publicada. */
  marcar: boolean;
  /** "Publicar como lista de aprovados": a prévia, e ao confirmar marca e vira a lista. */
  comoLista: boolean;
  /** Publicado na Classificação, mas a lista de aprovados vigente não veio dele. */
  foraDaLista: boolean;
  /** A lista de aprovados vigente veio deste resultado final. */
  naLista: boolean;
  /** Edita a Classificação, mas a lista de aprovados é de quem cuida dela. */
  soMarca: boolean;
  /** A situação ainda está sendo lida (o botão espera). */
  carregando: boolean;
}

/**
 * O passo do resultado final. `situacao`: `undefined` enquanto é lida;
 * `null` se a leitura falhou (aí ficam os dois botões de antes, e o banco
 * confere cada um).
 */
export function passoDoResultadoFinal({
  lista,
  podeEditar,
  situacao,
}: {
  lista: { id: string; publicada?: boolean | null } | null;
  podeEditar: boolean;
  situacao: ListaDeAprovadosDoEdital | null | undefined;
}): PassoDoResultadoFinal {
  const nada: PassoDoResultadoFinal = {
    marcar: false,
    comoLista: false,
    foraDaLista: false,
    naLista: false,
    soMarca: false,
    carregando: false,
  };
  if (!lista?.id) return nada;
  const publicada = lista.publicada === true;
  if (situacao === undefined)
    return { ...nada, comoLista: podeEditar, carregando: true };
  if (situacao === null)
    return { ...nada, marcar: podeEditar && !publicada, comoLista: podeEditar };
  const naLista = situacao.lista_classificacao_id === lista.id;
  const foraDaLista = publicada && !naLista;
  if (naLista) return { ...nada, naLista, marcar: podeEditar && !publicada };
  if (situacao.pode_publicar)
    return { ...nada, foraDaLista, comoLista: podeEditar };
  return {
    ...nada,
    foraDaLista,
    marcar: podeEditar && !publicada,
    soMarca: podeEditar,
  };
}

export interface ResultadoFinalForaDaLista {
  id: string;
  edital: string;
  unidade: string;
}

/**
 * Os editais da área com o resultado final publicado na Classificação e sem
 * lista de aprovados vinda dele. `editais`: os de listar_editais_classificacao
 * (a última lista gerada de cada um); `listas`: as listas de aprovados
 * vigentes (abrir_lista_aprovados).
 *
 * Só conta o edital cuja última lista gerada é o resultado final publicado (o
 * que a RPC devolve). A lista vigente vinda da Classificação depois da geração
 * dele veio dele: o banco só publica o resultado final mais recente
 * (FC_NOVOS_DA_CLASSIFICACAO). Fora do treinamento e dos editais inativos.
 */
export function resultadosFinaisForaDaLista(
  editais: readonly unknown[] | null | undefined,
  listas: readonly unknown[] | null | undefined,
): ResultadoFinalForaDaLista[] {
  const vigentes = new Map(
    (listas || []).map((l) => [texto(registro(l).edital_id), registro(l)]),
  );
  const fora: ResultadoFinalForaDaLista[] = [];
  for (const bruto of editais || []) {
    const e = registro(bruto);
    const id = texto(e.id);
    if (!id || e.treinamento === true || e.ativo === false) continue;
    const ultima = registro(e.ultima_lista);
    if (texto(ultima.tipo).toUpperCase() !== "FINAL") continue;
    if (ultima.publicada !== true) continue;
    const vigente = vigentes.get(id);
    const daClassificacao =
      vigente &&
      texto(vigente.origem).toUpperCase() === "CLASSIFICACAO" &&
      texto(vigente.lista_classificacao_id) !== "";
    const gerada = instante(ultima.em);
    const publicadaEm = vigente ? instante(vigente.importado_em) : null;
    const veioDele =
      daClassificacao &&
      (gerada === null || (publicadaEm !== null && publicadaEm >= gerada));
    if (veioDele) continue;
    fora.push({ id, edital: texto(e.edital), unidade: texto(e.unidade) });
  }
  return fora.sort((a, b) => compararNumeroDoEdital(a.edital, b.edital));
}

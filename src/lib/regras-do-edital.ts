/*
  As Regras do edital (Editais › Regras do edital): as etapas do processo, na
  ordem em que acontecem, e os resumos só-leitura que as telas de cada etapa
  mostram no topo (com o "Editar nas Regras do edital"). Sem React e sem DOM.

  Este arquivo é leve de propósito: o estado de Editais (pacote de entrada)
  o importa. Os resumos, que puxam o código das regras da Avaliação
  documental e da Classificação, ficam em regras-do-edital-resumos.ts e
  chegam por import() (resumo-da-regra-da-etapa.tsx).

  Cada etapa continua com a regra (e as RPCs) que já tinha: Triagem
  (obter/salvar/conferir_regra_triagem), Avaliação documental
  (obter/salvar/conferir_regra_analise), Entrevista (configurar_entrevista_edital,
  o roteiro e a banca), Classificação
  (obter_classificacao_do_edital/salvar_regra_classificacao) e Chamada para
  contratação (configuração de convocação da Lista de aprovados). A página só
  junta tudo num lugar; nada aqui muda o cálculo.
*/
export type EtapaDasRegras =
  "triagem" | "avaliacao" | "entrevista" | "classificacao" | "chamada";

export const ETAPAS_DAS_REGRAS: ReadonlyArray<{
  valor: EtapaDasRegras;
  rotulo: string;
  icone: string;
}> = Object.freeze([
  { valor: "triagem", rotulo: "1 Triagem", icone: "fa-filter" },
  {
    valor: "avaliacao",
    rotulo: "2 Avaliação documental",
    icone: "fa-file-circle-check",
  },
  { valor: "entrevista", rotulo: "3 Entrevista", icone: "fa-comments" },
  {
    valor: "classificacao",
    rotulo: "4 Classificação",
    icone: "fa-ranking-star",
  },
  {
    valor: "chamada",
    rotulo: "5 Chamada para contratação",
    icone: "fa-bullhorn",
  },
]);

/** A etapa pedida, ou a primeira (Triagem) se o valor não for uma etapa. */
export function etapaDasRegras(valor: unknown): EtapaDasRegras {
  const achada = ETAPAS_DAS_REGRAS.find((e) => e.valor === valor);
  return achada ? achada.valor : "triagem";
}

/** Uma linha do resumo: rótulo curto e o valor em texto. */
export interface LinhaDoResumo {
  rotulo: string;
  valor: string;
}

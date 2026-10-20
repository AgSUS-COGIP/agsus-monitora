/*
  O ESPELHO DE NOTA NA GAVETA DO PAINEL DAS ANÁLISES. Sem DOM e sem banco.

  Para a linha publicada pela ficha concluída da Avaliação documental,
  get_analise_detalhe_do_painel (migration 20261020150000) manda em "espelho"
  a mesma entrada que obter_espelhos_de_nota manda aos espelhos em massa. A
  conta é a do espelho (espelhoDaFichaGravada → montarEspelho): a gaveta e o
  espelho de nota sempre batem. Daqui a gaveta só tira o que mostra:
  - as notas (autodeclarada × consolidada; no eliminado, só a consolidada,
    "Não se aplica…", como no espelho);
  - por critério, Declarada / Após análise / Teto, com as justificativas do
    espelho só no critério que mudou;
  - no eliminado, os motivos da eliminação (o texto do espelho).
  Linha da planilha (sem "espelho"): null, e a gaveta segue como antes.
*/
import { espelhoDaFichaGravada } from "./avaliacao-documental/espelho-da-ficha-gravada.ts";
import type {
  CriterioDoEspelho,
  LinhaDoEspelho,
} from "./avaliacao-documental/espelho-de-nota.ts";
import type { FichaDoEspelho } from "./avaliacao-documental/espelhos-em-massa.ts";
import {
  TEXTOS_PADRAO_DO_ESPELHO,
  type TextosDoEspelho,
} from "./avaliacao-documental/modelo-do-espelho.ts";

/** Os rótulos da gaveta: os do espelho, a consolidada sem "documental" e a autodeclarada sempre. */
export const TEXTOS_DO_ESPELHO_NO_PAINEL: TextosDoEspelho = Object.freeze({
  ...TEXTOS_PADRAO_DO_ESPELHO,
  rotulo_consolidada: "Nota consolidada (após a análise)",
  mostrar_autodeclarada: true,
});

export type CriterioNoPainel = CriterioDoEspelho & { mudou: boolean };

export type EspelhoNoPainel = {
  eliminado: boolean;
  notas: LinhaDoEspelho[];
  criterios: CriterioNoPainel[];
  motivos: string[];
};

type Objeto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Objeto =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
const numeroOuNulo = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const textoOuNulo = (v: unknown) =>
  typeof v === "string" && v.trim() ? v : null;

/** A ficha como o detalhe a manda, no formato de obter_espelhos_de_nota (sem nome, código nem cargo). */
function fichaDoDetalhe(ficha: Objeto): FichaDoEspelho {
  return {
    id: String(ficha.id ?? ""),
    codigo: null,
    nome: null,
    vaga: textoOuNulo(ficha.vaga),
    cargo: null,
    modalidade: null,
    posicao: null,
    art: numeroOuNulo(ficha.art),
    resultado: textoOuNulo(ficha.resultado),
    nota_final: numeroOuNulo(ficha.nota_final),
    regra: String(ficha.regra ?? ""),
    declarada: ehObjeto(ficha.declarada)
      ? (ficha.declarada as FichaDoEspelho["declarada"])
      : null,
    lancamento: ehObjeto(ficha.lancamento) ? ficha.lancamento : null,
  };
}

/**
 * O espelho da gaveta a partir dos dados do detalhe (`dados.espelho`), ou
 * null (linha da planilha, ficha não concluída ou entrada que não se monta).
 */
export function espelhoDoDetalhe(dados: unknown): EspelhoNoPainel | null {
  const entrada = ehObjeto(dados) ? dados.espelho : null;
  if (
    !ehObjeto(entrada) ||
    !ehObjeto(entrada.ficha) ||
    !ehObjeto(entrada.regra)
  )
    return null;
  let espelho;
  try {
    espelho = espelhoDaFichaGravada(
      fichaDoDetalhe(entrada.ficha),
      entrada.regra,
      ehObjeto(entrada.documental) ? entrada.documental : null,
      ehObjeto(entrada.edital)
        ? {
            rotulo: textoOuNulo(entrada.edital.rotulo),
            area: textoOuNulo(entrada.edital.area),
          }
        : null,
      TEXTOS_DO_ESPELHO_NO_PAINEL,
    );
  } catch (erro) {
    console.warn("Não foi possível montar o espelho de nota da análise:", erro);
    return null;
  }
  const eliminado = espelho.modelo === "ELIMINADO";
  return {
    eliminado,
    notas: espelho.notas,
    criterios: espelho.criterios.map((criterio) => {
      const mudou = criterio.declarada !== criterio.apurada;
      return {
        ...criterio,
        mudou,
        justificativas: mudou ? criterio.justificativas : [],
      };
    }),
    motivos: eliminado ? espelho.justificativas : [],
  };
}

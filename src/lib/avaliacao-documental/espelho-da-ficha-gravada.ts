/*
  A ENTRADA DO ESPELHO DE NOTA a partir da ficha, sem DOM e sem banco.

  - entradaDoEspelho: do estado da ficha carregada (estado-da-ficha.ts) e do
    cabeçalho dela — o botão "Espelho de nota" da ficha concluída.
  - espelhoDaFichaGravada: da ficha GRAVADA como o banco a entrega
    (obter_espelhos_de_nota nos Espelhos de nota em massa; a chave "espelho"
    de get_analise_detalhe_do_painel na gaveta do Painel das análises): a
    regra da vaga com a configuração da versão usada na conclusão, a conta
    (calcularFicha) e a declarada por critério gravada na conclusão.

  As três telas montam pela MESMA conta (montarEspelho), para os números
  baterem sempre.
*/
import { montarEspelho } from "./espelho-de-nota.ts";
import type { EntradaDoEspelho, Espelho } from "./espelho-de-nota.ts";
import type { FichaDoEspelho } from "./espelhos-em-massa.ts";
import {
  TEXTOS_PADRAO_DO_ESPELHO,
  type TextosDoEspelho,
} from "./modelo-do-espelho.ts";
import { calcularFicha, regraDaFicha } from "./ficha.ts";
import { nomeDaArea } from "../menu-lateral.ts";

export type FichaCarregada = {
  nome?: string | null;
  codigo?: string | number | null;
  modalidade?: string | null;
  vaga?: string | null;
  cargo?: string | null;
  art?: number | null;
  tp_resultado?: string | null;
  nota_final?: number | null;
  regime?: string | null;
  carga_horaria?: string | number | null;
};

export type EstadoCarregado = {
  regra: unknown;
  lancamento: unknown;
  avaliacao: unknown;
  declarada?: unknown;
  dados: {
    edital?: { rotulo?: string | null; area?: string | null } | null;
    declarada_gravada?: { art?: number | null; total?: number | null } | null;
  };
};

const numeroOuNulo = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** A modalidade final da conta (calcularAvaliacao: modalidade_final), se houver. */
function modalidadeFinal(avaliacao: unknown): string | null {
  const valor =
    avaliacao && typeof avaliacao === "object"
      ? (avaliacao as { modalidade_final?: unknown }).modalidade_final
      : null;
  return typeof valor === "string" && valor ? valor : null;
}

/** A entrada do espelho a partir do estado da ficha e do cabeçalho dela. */
export function entradaDoEspelho(
  st: EstadoCarregado,
  ficha: FichaCarregada,
): EntradaDoEspelho {
  return {
    regra: st.regra as EntradaDoEspelho["regra"],
    lancamento: st.lancamento as EntradaDoEspelho["lancamento"],
    avaliacao: st.avaliacao as EntradaDoEspelho["avaliacao"],
    declarada: (st.declarada ?? null) as EntradaDoEspelho["declarada"],
    resultado: String(ficha.tp_resultado ?? ""),
    notaFinal: numeroOuNulo(ficha.nota_final),
    notaAutodeclarada:
      numeroOuNulo(ficha.art) ?? numeroOuNulo(st.dados.declarada_gravada?.art),
    candidato: {
      nome: ficha.nome,
      codigo: ficha.codigo,
      // A modalidade final da conta (a cota confirmada de maior percentual, ou a
      // ampla); sem ela, a da pré-classificação.
      modalidade: modalidadeFinal(st.avaliacao) ?? ficha.modalidade,
    },
    vaga: {
      codigo: ficha.vaga,
      cargo: ficha.cargo,
      regime: ficha.regime,
      cargaHoraria: ficha.carga_horaria,
    },
    edital: {
      rotulo: st.dados.edital?.rotulo,
      unidade: nomeDaArea(st.dados.edital?.area ?? null),
    },
  };
}

/**
 * O espelho de uma ficha concluída gravada, pela MESMA montagem do botão da
 * ficha: a regra da vaga (regraDaFicha) com a configuração da versão usada na
 * conclusão, a conta (calcularFicha) e a declarada por critério gravada na
 * conclusão (DS_RESULTADO.declarada; o total é a soma, como em
 * declaradaDaFicha). `textos`: o modelo do edital (textosParaOEspelho).
 */
export function espelhoDaFichaGravada(
  ficha: FichaDoEspelho,
  configuracaoDaRegra: unknown,
  documental: unknown,
  edital: { rotulo?: string | null; area?: string | null } | null,
  textos: TextosDoEspelho = TEXTOS_PADRAO_DO_ESPELHO,
): Espelho {
  const lancamento = (ficha.lancamento ?? {}) as { nivel?: string };
  const regra = regraDaFicha(configuracaoDaRegra, lancamento);
  const avaliacao = calcularFicha(regra, lancamento, documental);
  const parciais: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(ficha.declarada ?? {}))
    if (typeof valor === "number" && Number.isFinite(valor))
      parciais[chave] = valor;
  const total = Object.values(parciais).reduce((a, b) => a + b, 0);
  return montarEspelho(
    entradaDoEspelho(
      {
        regra,
        lancamento,
        avaliacao,
        declarada: { parciais, total },
        dados: { edital, declarada_gravada: null },
      },
      {
        nome: ficha.nome,
        codigo: ficha.codigo,
        modalidade: ficha.modalidade,
        vaga: ficha.vaga,
        cargo: ficha.cargo,
        art: ficha.art,
        tp_resultado: ficha.resultado,
        nota_final: ficha.nota_final,
      },
    ),
    textos,
  );
}

import { PARCIAIS_CURTAS, rotuloDe } from "./catalogo.js";
import { MODELO_DOS_PONTOS_INFORMATIVOS } from "./regra.js";
import type { RegraAnalise } from "./tipos-da-regra.ts";

/*
  A pontuação informativa do inapto por requisito, como a ficha mostra (lateral
  "Nota" e Conclusão). Só existe com parecer.mostrar_pontos_quando_inapto na
  regra: a conta (calcularAvaliacao, pontuacao.js) devolve pontos_informativos
  = { nota, parciais } — a soma das parciais apuradas, que NÃO entra na nota
  final (o resultado continua Inapto e a nota final 0, item 8.2.1 do 114/2026).
*/

/** O rótulo da opção no assistente e no modo avançado. */
export const ROTULO_DA_OPCAO =
  "Mostrar a pontuação dos títulos mesmo quando inapto por requisito (só informativa)";

/**
 * Liga ou desliga a opção. Ligar traz o modelo padrão da linha do parecer
 * (se a regra não tem um); desligar tira a opção e o modelo, e a regra volta
 * a ser a de antes (sem diferença na comparação das versões).
 */
export function comPontosQuandoInapto(
  regra: RegraAnalise,
  ligado: boolean,
): RegraAnalise {
  const parecer = { ...regra.parecer };
  const modelo = parecer.pontos_informativos;
  delete parecer.mostrar_pontos_quando_inapto;
  delete parecer.pontos_informativos;
  if (ligado) {
    parecer.mostrar_pontos_quando_inapto = true;
    parecer.pontos_informativos = modelo || MODELO_DOS_PONTOS_INFORMATIVOS;
  }
  return { ...regra, parecer };
}

export type PontosInformativos = {
  nota: number;
  parciais: Record<string, number>;
};

export type ParteInformativa = {
  parcial: string;
  rotulo: string;
  valor: number;
};

export type PontuacaoInformativa = {
  nota: number;
  partes: ParteInformativa[];
};

/**
 * O que a ficha mostra como "Pontuação dos títulos (informativa)": a nota e
 * as parciais na ordem dos blocos da regra. Null fora do inapto por requisito
 * ou com a opção desligada (a conta não devolve pontos_informativos).
 */
export function pontuacaoInformativaDaFicha(
  avaliacao: { pontos_informativos?: PontosInformativos | null } | null,
  resultado: string | null | undefined,
): PontuacaoInformativa | null {
  const pontos = avaliacao?.pontos_informativos;
  if (resultado !== "INAPTO_REQUISITO" || !pontos) return null;
  return {
    nota: pontos.nota,
    partes: Object.entries(pontos.parciais).map(([parcial, valor]) => ({
      parcial,
      rotulo: rotuloDe(PARCIAIS_CURTAS, parcial),
      valor,
    })),
  };
}

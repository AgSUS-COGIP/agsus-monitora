/* Tours da Aya: onde pôr o balão e o holofote (API pública em ../aya-tours.ts). */

import type {
  GeometriaDoHolofote,
  LadoDoBalao,
  PosicaoDoBalao,
  RetanguloNaTela,
  TamanhoNaTela,
} from "./tipos.ts";

/* ---------- Onde pôr o balão ---------- */

/*
  `caixa`: o recorte na tela ({ top, left, width, height }) ou null (passo
  sem alvo); `balao`: { largura, altura }; `tela`: { largura, altura }.
  No celular, o balão ocupa a largura da tela, do lado oposto ao elemento
  (`{ modo: "celular", lado: "baixo" | "cima" }`). Fora dele, tenta embaixo,
  em cima, à direita e à esquerda do recorte, nessa ordem; se não couber em
  lugar nenhum, fica no pé da tela. Sempre dentro da tela.
*/
export function posicaoDoBalao({
  caixa,
  balao,
  tela,
  celular = false,
  margem = 12,
}: {
  caixa: RetanguloNaTela | null | undefined;
  balao: TamanhoNaTela | null | undefined;
  tela: TamanhoNaTela | null | undefined;
  celular?: boolean;
  margem?: number;
}): PosicaoDoBalao {
  const largura = balao?.largura || 0;
  const altura = balao?.altura || 0;
  const W = tela?.largura || 0;
  const H = tela?.altura || 0;
  if (celular) {
    const meio = caixa ? caixa.top + caixa.height / 2 : 0;
    return { modo: "celular", lado: caixa && meio > H / 2 ? "cima" : "baixo" };
  }
  const limitar = (valor: number, tamanho: number, total: number): number =>
    Math.round(
      Math.min(
        Math.max(margem, valor),
        Math.max(margem, total - tamanho - margem),
      ),
    );
  if (!caixa)
    return {
      modo: "centro",
      top: limitar((H - altura) / 2, altura, H),
      left: limitar((W - largura) / 2, largura, W),
    };
  const baixo = caixa.top + caixa.height;
  const direita = caixa.left + caixa.width;
  const centroX = caixa.left + caixa.width / 2 - largura / 2;
  const centroY = caixa.top + caixa.height / 2 - altura / 2;
  const opcoes: [LadoDoBalao, boolean, number, number][] = [
    ["baixo", H - baixo >= altura + margem * 2, baixo + margem, centroX],
    [
      "cima",
      caixa.top >= altura + margem * 2,
      caixa.top - altura - margem,
      centroX,
    ],
    ["direita", W - direita >= largura + margem * 2, centroY, direita + margem],
    [
      "esquerda",
      caixa.left >= largura + margem * 2,
      centroY,
      caixa.left - largura - margem,
    ],
  ];
  const escolhida = opcoes.find(([, cabe]) => cabe);
  if (!escolhida)
    return {
      modo: "sobre",
      top: limitar(H - altura - margem, altura, H),
      left: limitar(centroX, largura, W),
    };
  const [lado, , top, left] = escolhida;
  return {
    modo: lado,
    top: limitar(top, altura, H),
    left: limitar(left, largura, W),
  };
}

/* ---------- O holofote: recorte e véu do mesmo retângulo ---------- */

/** A folga em volta do elemento destacado, em pixels. */
export const MARGEM_DO_HOLOFOTE = 6;

/*
  `retangulo`: o getBoundingClientRect do elemento da vez. Devolve o recorte
  (onde fica a moldura) e as quatro faixas escuras em volta dele, todos do
  MESMO retângulo arredondado, para a moldura nunca ficar maior ou menor que
  a área clara. Faixa: { top, left, width?, height?, right?, bottom? }.
*/
export function geometriaDoHolofote(
  retangulo: RetanguloNaTela | null | undefined,
  margem = MARGEM_DO_HOLOFOTE,
): GeometriaDoHolofote | null {
  if (!retangulo) return null;
  // Não passa da borda de cima nem da esquerda: a moldura fica na tela.
  const top = Math.max(0, Math.round(retangulo.top - margem));
  const left = Math.max(0, Math.round(retangulo.left - margem));
  const right = Math.round(retangulo.left + retangulo.width + margem);
  const bottom = Math.round(retangulo.top + retangulo.height + margem);
  const recorte = { top, left, width: right - left, height: bottom - top };
  return {
    recorte,
    faixas: [
      { top: 0, left: 0, right: 0, height: top },
      { top: bottom, left: 0, right: 0, bottom: 0 },
      { top, left: 0, width: left, height: recorte.height },
      { top, left: right, right: 0, height: recorte.height },
    ],
  };
}

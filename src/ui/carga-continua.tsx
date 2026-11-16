import { useCallback, useEffect, useRef, useState } from "react";
import { formatNumberBR } from "../lib/formatters";
import { ITENS_POR_VEZ } from "../lib/carga-continua.ts";

/*
  O carregamento contínuo das listas que não são a TabelaInfinita nem a
  TabelaDaLista (blocos por dia ou por vaga, cartões): 50 itens por vez e mais
  50 quando o fim da lista chega perto da parte visível, ou em "Carregar mais"
  (teclado e leitor de tela). O recorte das linhas fica com a tela (ou com
  gruposAteOLimite, src/lib/carga-continua.ts).

  `usarCargaContinua(recorte, total)`: `recorte` é o que define a lista (a
  própria lista, memorizada, ou uma chave dos filtros); recorte novo volta aos
  primeiros 50 já neste desenho. `MaisDaCarga` vai logo depois da lista: o
  sentinela (IntersectionObserver na janela: o corte de uma caixa que rola,
  como a gaveta, também conta), o "N de M" e o botão. Sem nada faltando, não
  desenha nada.
*/

/* Quanto antes do fim a próxima leva começa. */
const ANTES_DO_FIM = "240px";

export interface CargaContinua {
  /** Quantos itens desenhar. */
  limite: number;
  /** Quantos estão desenhados (até o total). */
  mostrados: number;
  total: number;
  faltam: number;
  carregarMais: () => void;
}

export function usarCargaContinua(
  recorte: unknown,
  total: number,
): CargaContinua {
  const [carga, setCarga] = useState({ recorte, limite: ITENS_POR_VEZ });
  const limite = carga.recorte === recorte ? carga.limite : ITENS_POR_VEZ;
  const mostrados = Math.min(limite, total);
  const carregarMais = useCallback(
    () =>
      setCarga((atual) => ({
        recorte,
        limite:
          (atual.recorte === recorte ? atual.limite : ITENS_POR_VEZ) +
          ITENS_POR_VEZ,
      })),
    [recorte],
  );
  return {
    limite,
    mostrados,
    total,
    faltam: total - mostrados,
    carregarMais,
  };
}

export function MaisDaCarga({
  carga,
  oQue = "registros",
}: {
  carga: CargaContinua;
  /** O nome do que se conta, no plural ("convocados", "pendências"). */
  oQue?: string;
}) {
  const { faltam, mostrados, total, carregarMais } = carga;
  const fim = useRef<HTMLDivElement>(null);
  const mais = useRef(carregarMais);
  mais.current = carregarMais;
  useEffect(() => {
    const alvo = fim.current;
    if (faltam <= 0 || !alvo || typeof IntersectionObserver !== "function")
      return undefined;
    /*
      Recriado a cada leva: se o fim continua à vista (poucos itens na tela),
      o primeiro aviso do observador novo já pede a próxima.
    */
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) mais.current();
      },
      { rootMargin: `0px 0px ${ANTES_DO_FIM} 0px` },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [faltam, mostrados]);

  // O modo cartão do celular relê os cabeçalhos a cada leva.
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [mostrados]);

  if (faltam <= 0) return null;
  return (
    <div className="ui-carga-continua" data-carga-continua="">
      <div ref={fim} className="ui-lista-fim" aria-hidden="true" />
      <span className="ui-tabela-status" role="status" aria-live="polite">
        {formatNumberBR(mostrados)} de {formatNumberBR(total)} {oQue}
      </span>
      <button
        type="button"
        className="btn secondary small ui-tabela-mais"
        data-acao="carregar-mais"
        onClick={carregarMais}
      >
        <i className="fa-solid fa-plus" aria-hidden="true" /> Carregar mais{" "}
        {formatNumberBR(Math.min(ITENS_POR_VEZ, faltam))}
      </button>
    </div>
  );
}

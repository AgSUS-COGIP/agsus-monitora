import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { classes } from "../../ui/classes.js";

/*
  As abas da ficha de notas: um avaliador por aba ("Avaliador Teste 1 ·
  AgSUS ✓") no lançamento por avaliador, ou uma competência por aba no
  lançamento por competência. A aba completa ganha o check (anima ao
  completar); a contagem "4/12" fica discreta enquanto falta. É um
  `tablist`: só a ativa entra no Tab, setas ← → andam (dando a volta).
*/

export type AbaDaFicha = {
  id: string;
  titulo: string;
  detalhe?: string;
  preenchidas: number;
  total: number;
  /** Algo começado e não terminado (aspectos faltando). */
  pendente?: boolean;
};

export type PropriedadesDasAbas = {
  rotulo: string;
  abas: AbaDaFicha[];
  ativa: string;
  idDoPainel: string;
  /** "avaliador" ou "competencia" (data-modo: abas de competência são mais estreitas). */
  modo?: string;
  aoEscolher: (id: string) => void;
};

export function AbasDaFicha({
  rotulo,
  abas,
  ativa,
  idDoPainel,
  modo,
  aoEscolher,
}: PropriedadesDasAbas) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[evento.key];
    if (!passo) return;
    evento.preventDefault();
    const proximo = (indice + passo + abas.length) % abas.length;
    const aba = abas[proximo];
    if (!aba) return;
    aoEscolher(aba.id);
    botoes.current[proximo]?.focus();
  }

  return (
    <div
      className="entrevistas-abas-da-ficha"
      role="tablist"
      aria-label={rotulo}
      data-modo={modo}
      data-tour="entrevistas-ficha-abas"
    >
      {abas.map((aba, indice) => {
        const escolhida = aba.id === ativa;
        const completa = aba.total > 0 && aba.preenchidas === aba.total;
        return (
          <button
            key={aba.id}
            ref={(el) => {
              botoes.current[indice] = el;
            }}
            type="button"
            role="tab"
            aria-selected={escolhida}
            aria-controls={idDoPainel}
            tabIndex={escolhida ? 0 : -1}
            className={classes(
              "entrevistas-aba-da-ficha",
              escolhida && "is-ativa",
              completa && "is-completa",
              aba.pendente && "is-pendente",
            )}
            data-aba={aba.id}
            title={aba.titulo}
            onClick={() => aoEscolher(aba.id)}
            onKeyDown={(e) => aoTeclar(e, indice)}
          >
            <span className="entrevistas-aba-da-ficha-nome">
              <b>{aba.titulo}</b>
              {aba.detalhe ? <small>{aba.detalhe}</small> : null}
            </span>
            {completa ? (
              <span
                className="entrevistas-aba-da-ficha-check"
                aria-label="completo"
              >
                <i className="fa-solid fa-check" aria-hidden="true" />
              </span>
            ) : (
              <span
                className="entrevistas-aba-da-ficha-conta"
                aria-label={`${aba.preenchidas} de ${aba.total}`}
              >
                {aba.preenchidas}/{aba.total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

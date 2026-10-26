import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { classes } from "./classes.ts";

/*
  Controle segmentado (DESIGN.md, "Controle segmentado"; `.ui-segmentado`):
  poucas opções lado a lado, uma escolhida. É um `radiogroup`: só a escolhida
  entra no Tab, e as setas ← → movem a escolha (e o foco), dando a volta.
  Sem escolha válida, a primeira opção recebe o Tab.

  `opcoes`: `[{ valor, rotulo, icone? }]` (`icone` é a classe `fa-*`).
  `className` acrescenta a de quem usa. Cada botão leva `data-valor`.
  Usado pelas visões de Entrevistas (no topo da tela), pela escala do roteiro,
  pelo modo de lançamento e pelo comparecimento da ficha.
*/
export interface OpcaoDoSegmentado<V extends string = string> {
  valor: V;
  rotulo: string;
  icone?: string;
}

export interface PropriedadesDoSegmentado<V extends string = string> {
  rotulo: string;
  opcoes: ReadonlyArray<OpcaoDoSegmentado<V>>;
  valor: V;
  aoMudar: (valor: V) => void;
  desabilitado?: boolean;
  className?: string;
  tour?: string;
}

const PASSO_DA_SETA: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
};

export function Segmentado<V extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  desabilitado = false,
  className,
  tour,
}: PropriedadesDoSegmentado<V>) {
  const botoes = useRef<Array<HTMLButtonElement | null>>([]);
  const temEscolha = opcoes.some((o) => o.valor === valor);

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const passo = PASSO_DA_SETA[evento.key];
    if (!passo || desabilitado) return;
    evento.preventDefault();
    const proximo = (indice + passo + opcoes.length) % opcoes.length;
    aoMudar(opcoes[proximo]!.valor);
    botoes.current[proximo]?.focus();
  }

  return (
    <div
      className={classes("ui-segmentado", className)}
      role="radiogroup"
      aria-label={rotulo}
      data-tour={tour}
    >
      {opcoes.map((opcao, indice) => {
        const escolhida = valor === opcao.valor;
        return (
          <button
            key={opcao.valor}
            ref={(el) => {
              botoes.current[indice] = el;
            }}
            type="button"
            role="radio"
            aria-checked={escolhida}
            tabIndex={escolhida || (indice === 0 && !temEscolha) ? 0 : -1}
            disabled={desabilitado}
            className={classes("ui-segmentado-opcao", escolhida && "is-ativo")}
            data-valor={opcao.valor}
            onClick={() => aoMudar(opcao.valor)}
            onKeyDown={(evento) => aoTeclar(evento, indice)}
          >
            {opcao.icone ? (
              <i className={`fa-solid ${opcao.icone}`} aria-hidden="true" />
            ) : null}
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

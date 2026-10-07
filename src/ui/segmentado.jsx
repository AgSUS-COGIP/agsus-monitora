import { useRef } from "react";
import { classes } from "./classes.js";

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
/**
 * @template {string} V
 * @param {object} p
 * @param {string} p.rotulo
 * @param {ReadonlyArray<{ valor: V, rotulo: string, icone?: string }>} p.opcoes
 * @param {V} p.valor
 * @param {(valor: V) => void} p.aoMudar
 * @param {boolean} [p.desabilitado]
 * @param {string} [p.className]
 * @param {string} [p.tour]
 */
export function Segmentado({
  rotulo,
  opcoes,
  valor,
  aoMudar,
  desabilitado = false,
  className,
  tour,
}) {
  const botoes = useRef([]);
  const temEscolha = opcoes.some((o) => o.valor === valor);

  function aoTeclar(evento, indice) {
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[evento.key];
    if (!passo || desabilitado) return;
    evento.preventDefault();
    const proximo = (indice + passo + opcoes.length) % opcoes.length;
    aoMudar(opcoes[proximo].valor);
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
            ref={(el) => (botoes.current[indice] = el)}
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

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, Ref } from "react";
import { lerDigitacao } from "../../lib/digitacao-de-notas.ts";
import { classes } from "../../ui/classes.js";

/*
  A célula da matriz de notas (matriz-de-notas.tsx): o campo grande de uma
  nota, com o fluxo de planilha.

  - Ao focar, seleciona o que está escrito: a próxima tecla troca a nota.
  - O que é digitado passa por `lerDigitacao` (src/lib/digitacao-de-notas.ts):
    nota completa da escala grava e chama `aoAvancar` (a matriz foca a
    próxima célula); parcial ("1" num 0 a 10) grava e espera; fora da escala
    não muda a célula e chama `aoRecusar` (a matriz avisa, a célula treme).
  - Preenchida, pulsa de leve (Web Animations; nada com movimento reduzido).
  - Em foco, a dica com o nível da nota ("4 · Muito bom") ou a escala.
  Quem só lê vê o número (`editavel` falso).
*/

export type OpcaoDeNota = { valor: number; rotulo: string; descricao: string };

export type PropriedadesDaCelula = {
  valor: string;
  rotulo: string;
  editavel: boolean;
  opcoes: readonly OpcaoDeNota[];
  /** "0 a 5": a dica da célula vazia. */
  escala: string;
  desabilitado?: boolean;
  invalida?: boolean;
  /** A escala tem notas quebradas (3,5): teclado com vírgula no celular. */
  decimal?: boolean;
  /** Linha e coluna na matriz (data-linha, data-coluna). */
  linha: number;
  coluna: number;
  /** Chave da nota (data-chave): `competência|avaliador|aspecto`. */
  chave: string;
  campo?: Ref<HTMLInputElement>;
  aoMudar: (valor: string) => void;
  aoAvancar: () => void;
  aoRecusar: (texto: string) => void;
  aoTeclar: (evento: KeyboardEvent<HTMLInputElement>) => void;
  aoFocar?: () => void;
};

const numeroBR = (valor: string) =>
  valor === "" ? "—" : valor.replace(".", ",");

export const movimentoReduzido = () =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Uma animação curta, se o navegador tiver Web Animations e a pessoa não pediu menos movimento. */
export function animar(
  elemento: Element | null | undefined,
  quadros: Keyframe[],
  duracao = 200,
) {
  if (!elemento || movimentoReduzido() || !("animate" in elemento)) return;
  elemento.animate(quadros, {
    duration: duracao,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  });
}

export function nivelDaNota(
  opcoes: readonly OpcaoDeNota[],
  valor: string,
): OpcaoDeNota | undefined {
  if (valor === "") return undefined;
  const n = Number(valor.replace(",", "."));
  return opcoes.find((o) => o.valor === n);
}

export function CelulaDeNota({
  valor,
  rotulo,
  editavel,
  opcoes,
  escala,
  desabilitado = false,
  invalida = false,
  decimal = false,
  linha,
  coluna,
  chave,
  campo,
  aoMudar,
  aoAvancar,
  aoRecusar,
  aoTeclar,
  aoFocar,
}: PropriedadesDaCelula) {
  const [focada, setFocada] = useState(false);
  const caixa = useRef<HTMLSpanElement>(null);
  const anterior = useRef(valor);

  useEffect(() => {
    if (anterior.current !== valor && valor !== "")
      animar(caixa.current, [
        { transform: "scale(1)" },
        { transform: "scale(1.07)" },
        { transform: "scale(1)" },
      ]);
    anterior.current = valor;
  }, [valor]);

  const nivel = nivelDaNota(opcoes, valor);
  const dica = nivel
    ? [numeroBR(valor), nivel.rotulo].filter(Boolean).join(" · ")
    : valor === ""
      ? escala
      : "";

  if (!editavel)
    return (
      <span
        className="entrevistas-celula entrevistas-celula-fixa"
        aria-label={`${rotulo}: ${numeroBR(valor)}`}
        title={nivel?.rotulo || undefined}
        data-linha={linha}
        data-coluna={coluna}
      >
        {numeroBR(valor)}
      </span>
    );
  return (
    <span
      ref={caixa}
      className={classes(
        "entrevistas-celula",
        valor !== "" && "is-preenchida",
        invalida && "is-invalida",
      )}
    >
      <input
        ref={campo}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        enterKeyHint="next"
        autoComplete="off"
        maxLength={5}
        className="entrevistas-nota"
        value={valor}
        aria-label={rotulo}
        aria-invalid={invalida || undefined}
        title={nivel?.rotulo || undefined}
        data-chave={chave}
        data-linha={linha}
        data-coluna={coluna}
        disabled={desabilitado}
        onFocus={(e) => {
          e.currentTarget.select();
          setFocada(true);
          aoFocar?.();
        }}
        onBlur={() => setFocada(false)}
        onChange={(e) => {
          const lida = lerDigitacao(
            e.target.value,
            opcoes.map((o) => o.valor),
          );
          if (lida.estado === "recusada") {
            aoRecusar(lida.texto);
            return;
          }
          aoMudar(lida.texto);
          if (lida.estado === "completa") aoAvancar();
        }}
        onKeyDown={aoTeclar}
      />
      {focada && dica ? (
        <span className="entrevistas-celula-dica" aria-hidden="true">
          {dica}
        </span>
      ) : null}
    </span>
  );
}

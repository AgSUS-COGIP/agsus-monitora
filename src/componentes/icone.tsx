import { createElement } from "react";
import { ICONE_RESERVA, ICONES } from "../modules/icones.ts";

/*
  Ícone Lucide em React, a partir do mesmo registro de `criarIcone`
  (`src/modules/icones.ts`). Sempre decorativo: quem nomeia o controle é o
  texto dele ou um `aria-label`.
*/
export type NomeDoIcone = keyof typeof ICONES;

export interface PropriedadesDoIcone {
  /** Nome do registro; um nome desconhecido desenha o ícone de reserva. */
  nome: string;
  tamanho?: number;
  traco?: number;
  className?: string;
}

const ehConhecido = (nome: string): nome is NomeDoIcone =>
  Object.hasOwn(ICONES, nome);

export function Icone({
  nome,
  tamanho = 18,
  traco = 1.75,
  className = "",
}: PropriedadesDoIcone) {
  const conhecido: NomeDoIcone = ehConhecido(nome) ? nome : ICONE_RESERVA;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={traco}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["icone", className].filter(Boolean).join(" ")}
      aria-hidden="true"
      focusable="false"
      data-icone={conhecido}
    >
      {ICONES[conhecido].map(([tag, atributos], indice) =>
        createElement(tag, { key: indice, ...atributos }),
      )}
    </svg>
  );
}

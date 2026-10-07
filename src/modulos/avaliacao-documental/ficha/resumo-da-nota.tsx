import type { ReactNode } from "react";
import { textoDaNota } from "../../../lib/avaliacao-documental/ficha.js";
import { Selo } from "../../../ui/index.js";
import type { ParteDaNota } from "./tipos.ts";

/*
  A nota da ficha: o número grande ("parcial" enquanto falta conferir), o
  mínimo, o selo do resultado e a composição por bloco em barras finas
  (apurado sobre o teto; "—" antes de conferir; a diferença para a declarada
  em âmbar). Na lateral (fora da Conclusão) e, maior, na Conclusão.
*/

export type PropriedadesDoResumo = {
  nota: number | null;
  parcial: boolean;
  minima: number | null;
  /** "Nota declarada (ART) 40", com a dica. */
  art?: { rotulo: string; dica: string; valor: number } | null;
  selo: { tom: string; texto: string };
  resultado?: string | null;
  partes: ParteDaNota[];
  grande?: boolean;
  /** Ações ao lado do título (o menu "⋯"). */
  acoes?: ReactNode;
};

function Barra({ parte }: { parte: ParteDaNota }) {
  const { apurado, declarado, teto } = parte;
  const base = teto || Math.max(apurado ?? 0, declarado ?? 0, 1);
  const fracao = apurado === null ? 0 : Math.min(1, apurado / base);
  return (
    <li
      className="avd-ficha-parte"
      data-parcial={parte.parcial}
      data-conferido={apurado === null ? "nao" : "sim"}
      data-divergente={parte.divergente ? "sim" : undefined}
      title={
        declarado !== null ? `Declarado ${textoDaNota(declarado)}` : undefined
      }
    >
      <span className="avd-ficha-parte-rotulo">{parte.rotulo}</span>
      <span
        className="avd-ficha-parte-valor"
        title={apurado === null ? "Item ainda não conferido" : undefined}
      >
        {apurado === null ? "—" : textoDaNota(apurado)}
        {teto !== null ? <small> / {textoDaNota(teto)}</small> : null}
      </span>
      <span className="avd-ficha-parte-barra" aria-hidden="true">
        <span style={{ transform: `scaleX(${fracao})` }} />
        {declarado !== null ? (
          <i
            className="avd-ficha-parte-declarada"
            style={{ left: `${Math.min(100, (declarado / base) * 100)}%` }}
          />
        ) : null}
      </span>
      {declarado !== null ? (
        <span className="sr-only">declarado {textoDaNota(declarado)}</span>
      ) : null}
    </li>
  );
}

export function ResumoDaNota({
  nota,
  parcial,
  minima,
  art,
  selo,
  resultado,
  partes,
  grande,
  acoes,
}: PropriedadesDoResumo) {
  return (
    <div
      className="avd-ficha-total"
      data-resultado={resultado || undefined}
      data-grande={grande || undefined}
    >
      <div className="avd-ficha-total-topo">
        <span className="avd-ficha-rotulo">
          {grande ? "Nota final" : "Nota"}
        </span>
        {acoes}
      </div>
      <strong className="avd-ficha-nota-total">
        {textoDaNota(nota)}
        {parcial ? <small className="avd-ficha-parcial"> parcial</small> : null}
      </strong>
      <span className="avd-ficha-minima">
        {minima !== null ? `mínimo ${textoDaNota(minima)}` : ""}
        {art ? (
          <span title={art.dica}>
            {minima !== null ? " · " : ""}
            {`${art.rotulo} ${textoDaNota(art.valor)}`}
          </span>
        ) : null}
      </span>
      <Selo tom={selo.tom} className="avd-ficha-selo-resultado">
        {selo.texto}
      </Selo>
      {partes.length ? (
        <ul
          className="avd-ficha-composicao"
          aria-label="Composição da nota"
          data-tour="avd-ficha-composicao"
        >
          {partes.map((p) => (
            <Barra key={p.bloco} parte={p} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

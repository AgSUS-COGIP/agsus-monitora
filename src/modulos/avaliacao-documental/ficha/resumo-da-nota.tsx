import type { ReactNode } from "react";
import { textoDaNota } from "../../../lib/avaliacao-documental/ficha.js";
import type { MotivoDoResultado } from "../../../lib/avaliacao-documental/motivos-do-resultado.ts";
import { Selo } from "../../../ui/index.js";
import type { ParteDaNota } from "./tipos.ts";

/*
  A nota da ficha: o número grande ("parcial" enquanto falta conferir, somando
  as prévias dos itens sem decisão), o mínimo, o selo do resultado com o POR
  QUÊ do Inapto (cada motivo leva ao item) e a composição por bloco em barras
  finas (apurado sobre o teto; antes de decidir, a prévia em tom neutro com
  "(prévia)"; a diferença para a declarada em âmbar). Na lateral (fora da
  Conclusão) e, maior, na Conclusão.
*/

export type PropriedadesDoResumo = {
  nota: number | null;
  parcial: boolean;
  /** A nota parcial inclui prévias de itens sem decisão. */
  comPrevia?: boolean;
  minima: number | null;
  /** "Nota declarada (ART) 40", com a dica. */
  art?: { rotulo: string; dica: string; valor: number } | null;
  selo: { tom: string; texto: string };
  resultado?: string | null;
  /** Por que deu Inapto (motivos-do-resultado.ts). */
  motivos?: MotivoDoResultado[];
  /** Vai ao item do motivo. */
  aoIr?: (codigo: string) => void;
  partes: ParteDaNota[];
  grande?: boolean;
  /** Ações ao lado do título (o menu "⋯"). */
  acoes?: ReactNode;
};

function Barra({ parte }: { parte: ParteDaNota }) {
  const { apurado, declarado, teto } = parte;
  const previa =
    apurado === null && typeof parte.previa === "number" ? parte.previa : null;
  const valor = apurado ?? previa;
  const base = teto || Math.max(valor ?? 0, declarado ?? 0, 1);
  const fracao = valor === null ? 0 : Math.min(1, valor / base);
  return (
    <li
      className="avd-ficha-parte"
      data-parcial={parte.parcial}
      data-conferido={apurado === null ? "nao" : "sim"}
      data-previa={previa !== null ? "sim" : undefined}
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
        {valor === null ? "—" : textoDaNota(valor)}
        {teto !== null ? <small> / {textoDaNota(teto)}</small> : null}
        {previa !== null ? (
          <small className="avd-ficha-parte-previa"> (prévia)</small>
        ) : null}
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

function MotivosDoResultado({
  motivos,
  aoIr,
}: {
  motivos: MotivoDoResultado[];
  aoIr?: (codigo: string) => void;
}) {
  return (
    <ul className="avd-ficha-motivos-resultado" aria-label="Por que">
      {motivos.map((m) => (
        <li key={m.texto}>
          {m.bloco && aoIr ? (
            <button
              type="button"
              className="avd-ficha-link"
              onClick={() => aoIr(m.bloco as string)}
            >
              {m.texto}
            </button>
          ) : (
            m.texto
          )}
        </li>
      ))}
    </ul>
  );
}

export function ResumoDaNota({
  nota,
  parcial,
  comPrevia,
  minima,
  art,
  selo,
  resultado,
  motivos,
  aoIr,
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
        {parcial ? (
          <small className="avd-ficha-parcial">
            {comPrevia ? " parcial (com prévias)" : " parcial"}
          </small>
        ) : null}
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
      {motivos?.length ? (
        <MotivosDoResultado motivos={motivos} aoIr={aoIr} />
      ) : null}
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

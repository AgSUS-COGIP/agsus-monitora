import { useState, type ReactNode } from "react";
import { moverNaLista } from "../../../lib/avaliacao-documental/assistente-da-regra.ts";

/*
  Lista em ordem que se arrasta (mouse) ou se move pelas setas (teclado e
  celular): os critérios de desempate. Cada item tem o número da ordem, o
  conteúdo e "Tirar".
*/
type Props<T> = {
  rotulo: string;
  itens: ReadonlyArray<T>;
  chave: (item: T) => string;
  conteudo: (item: T, indice: number) => ReactNode;
  aoMudar: (itens: T[]) => void;
  desabilitado?: boolean;
  tour?: string;
};

export function ListaOrdenavel<T>({
  rotulo,
  itens,
  chave,
  conteudo,
  aoMudar,
  desabilitado = false,
  tour,
}: Props<T>) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const mover = (de: number, para: number) =>
    aoMudar(moverNaLista(itens, de, para));
  return (
    <ol className="avd-ast-ordem" aria-label={rotulo} data-tour={tour}>
      {itens.map((item, i) => (
        <li
          key={chave(item)}
          className="avd-ast-ordem-item"
          data-arrastando={arrastando === i ? "sim" : undefined}
          data-sobre={sobre === i && arrastando !== i ? "sim" : undefined}
          draggable={!desabilitado}
          onDragStart={(ev) => {
            setArrastando(i);
            ev.dataTransfer.effectAllowed = "move";
            ev.dataTransfer.setData("text/plain", String(i));
          }}
          onDragOver={(ev) => {
            if (arrastando === null) return;
            ev.preventDefault();
            setSobre(i);
          }}
          onDragLeave={() => setSobre((s) => (s === i ? null : s))}
          onDrop={(ev) => {
            ev.preventDefault();
            if (arrastando !== null) mover(arrastando, i);
            setArrastando(null);
            setSobre(null);
          }}
          onDragEnd={() => {
            setArrastando(null);
            setSobre(null);
          }}
        >
          <span className="avd-ast-alca" aria-hidden="true">
            <i className="fa-solid fa-grip-vertical" />
          </span>
          <span className="avd-ast-ordem-numero">{i + 1}º</span>
          <div className="avd-ast-ordem-conteudo">{conteudo(item, i)}</div>
          <div className="avd-ast-ordem-acoes">
            <button
              type="button"
              className="btn ghost small"
              aria-label={`Subir o ${i + 1}º`}
              title="Subir"
              disabled={desabilitado || i === 0}
              onClick={() => mover(i, i - 1)}
            >
              <i className="fa-solid fa-arrow-up" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn ghost small"
              aria-label={`Descer o ${i + 1}º`}
              title="Descer"
              disabled={desabilitado || i === itens.length - 1}
              onClick={() => mover(i, i + 1)}
            >
              <i className="fa-solid fa-arrow-down" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn ghost small perigo"
              aria-label={`Tirar o ${i + 1}º`}
              title="Tirar"
              disabled={desabilitado}
              onClick={() => aoMudar(itens.filter((_, j) => j !== i))}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

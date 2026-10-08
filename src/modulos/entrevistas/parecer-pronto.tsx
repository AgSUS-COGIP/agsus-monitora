import { useState } from "react";
import { copiarParaAreaDeTransferencia } from "../classificacao/documento-no-navegador.js";

/*
  O parecer da entrevista em texto pronto, embaixo da matriz da ficha de
  notas (ficha.jsx), quando tudo está lançado — como o parecer da ficha da
  Avaliação documental: o texto (src/lib/parecer-da-entrevista.ts) e
  "Copiar parecer". Com alterações sem salvar, avisa que é a prévia.
*/

export type CopiarTexto = (conteudo: {
  html: string;
  texto: string;
}) => Promise<unknown>;

const escapar = (valor: string) =>
  valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function ParecerPronto({
  texto,
  sujo,
  copiar = copiarParaAreaDeTransferencia as CopiarTexto,
}: {
  texto: string;
  /** Há alterações sem salvar: o texto é a prévia. */
  sujo: boolean;
  copiar?: CopiarTexto;
}) {
  const [aviso, setAviso] = useState("");
  return (
    <section
      className="ui-card entrevistas-parecer-pronto"
      aria-labelledby="entrevistasParecerProntoTitulo"
      data-tour="entrevistas-ficha-parecer-pronto"
    >
      <div className="entrevistas-parecer-pronto-topo">
        <h3 id="entrevistasParecerProntoTitulo">
          Parecer
          {sujo ? (
            <small className="entrevistas-parcial"> (prévia, sem salvar)</small>
          ) : null}
        </h3>
        <span className="entrevistas-parecer-pronto-aviso" role="status">
          {aviso}
        </span>
        <button
          type="button"
          className="btn secondary small"
          data-acao="copiar-parecer"
          onClick={async () => {
            let ok: unknown = false;
            try {
              ok = await copiar({
                html: `<pre>${escapar(texto)}</pre>`,
                texto,
              });
            } catch {
              ok = false;
            }
            setAviso(ok ? "Parecer copiado." : "Não foi possível copiar.");
          }}
        >
          <i className="fa-solid fa-copy" aria-hidden="true" /> Copiar parecer
        </button>
      </div>
      <pre className="entrevistas-parecer-pronto-texto">{texto}</pre>
    </section>
  );
}

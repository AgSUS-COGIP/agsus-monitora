import { forwardRef } from "react";
import type {
  DocumentoDoParecer,
  Trecho,
} from "../../../lib/parecer-em-blocos.ts";

/*
  A prévia do parecer: o documento que comporParecer monta, desenhado como
  texto (React, nunca HTML cru). Parágrafos, títulos e itens de lista são
  `p`, `h3` e `li` — a mesma leitura linha a linha que o teste e a comparação
  fazem com a prévia do simulador.
*/

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) =>
        t.negrito ? (
          <strong key={i}>{t.texto}</strong>
        ) : (
          <span key={i}>{t.texto}</span>
        ),
      )}
    </>
  );
}

export const DocumentoDoParecerVisto = forwardRef<
  HTMLElement,
  { documento: DocumentoDoParecer }
>(function DocumentoDoParecerVisto({ documento }, ref) {
  let cabecalho = true;
  return (
    <article
      ref={ref}
      className="parecer-documento"
      aria-label="Prévia do parecer"
    >
      {documento.linhas.map((linha, i) => {
        if (linha.tipo === "titulo") {
          cabecalho = false;
          return (
            <h3 key={i} className="parecer-documento__titulo">
              <Trechos trechos={linha.trechos} />
            </h3>
          );
        }
        if (linha.tipo === "lista")
          return (
            <ul key={i}>
              {linha.itens.map((item, j) => (
                <li key={j}>
                  <Trechos trechos={item} />
                </li>
              ))}
            </ul>
          );
        if (linha.tipo === "assinatura")
          return (
            <div key={i} className="parecer-documento__assinatura">
              {linha.linhas.map((l, j) => (
                <p key={j} data-estilo={l.estilo}>
                  {l.texto}
                </p>
              ))}
            </div>
          );
        return (
          <p
            key={i}
            data-estilo={linha.estilo ?? (cabecalho ? "cabecalho" : undefined)}
          >
            <Trechos trechos={linha.trechos} />
          </p>
        );
      })}
    </article>
  );
});

/* O CSS da impressão: o documento sozinho, preto no branco do papel. */
const CSS_DA_IMPRESSAO = `
  @page { margin: 2.2cm 2cm; }
  body { font: 12pt/1.5 "Times New Roman", serif; margin: 0; }
  h3 { font-size: 12pt; margin: 18pt 0 6pt; }
  p { margin: 0 0 8pt; text-align: justify; }
  p[data-estilo="cabecalho"] { margin: 0 0 2pt; text-align: left; font-weight: bold; }
  p[data-estilo="adicional"] { font-style: italic; }
  ul { margin: 0 0 8pt 18pt; padding: 0; }
  li { margin-bottom: 4pt; text-align: justify; }
  .parecer-documento__assinatura { margin-top: 18pt; break-inside: avoid; }
  .parecer-documento__assinatura p { margin: 0; text-align: left; font-size: 11pt; }
  .parecer-documento__assinatura p[data-estilo="nome"],
  .parecer-documento__assinatura p[data-estilo="destaque"] { font-weight: bold; }
  .parecer-documento__assinatura p[data-estilo="nota"] { font-size: 9pt; }
`;

/**
 * Imprime (ou salva em PDF) só o documento: num quadro escondido, com uma
 * cópia do nó da prévia — nada de HTML montado em texto.
 */
export function imprimirDocumento(no: HTMLElement | null, titulo: string) {
  if (!no) return;
  const quadro = document.createElement("iframe");
  quadro.setAttribute("aria-hidden", "true");
  quadro.style.position = "fixed";
  quadro.style.width = "0";
  quadro.style.height = "0";
  quadro.style.border = "0";
  document.body.append(quadro);
  const doc = quadro.contentDocument;
  const janela = quadro.contentWindow;
  if (!doc || !janela) {
    quadro.remove();
    return;
  }
  doc.title = titulo;
  const estilo = doc.createElement("style");
  estilo.textContent = CSS_DA_IMPRESSAO;
  doc.head.append(estilo);
  doc.body.append(doc.importNode(no, true));
  const remover = () => setTimeout(() => quadro.remove(), 500);
  janela.addEventListener("afterprint", remover, { once: true });
  janela.focus();
  janela.print();
}

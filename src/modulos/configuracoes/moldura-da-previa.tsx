import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/*
  Um quadro (`<iframe>` sem endereço) onde uma prévia desenha os componentes
  de verdade com o CSS de verdade, sem copiar marcação nem estilo.

  Por que um quadro: a barra lateral (e a tela de acesso) dependem de estado
  global da página — `html[data-theme]`, classes de `body`
  (`sidebar-collapsed`, `sidebar-theme-dark`), `--sidebar-custom-bg` na raiz,
  a largura da janela nas media queries — e de ids únicos (`#nav`,
  `#sideLogo`). Dentro do quadro, a prévia tem o próprio documento: o tema, a
  cor do rascunho e a largura de desktop valem só para ela, e os ids não
  colidem com os da página.

  As folhas de estilo da página são copiadas para o quadro quando ele monta
  (no Vite, `<style>`; no build, `<link>`). O React desenha dentro dele por
  portal, então os componentes leem os mesmos stores da página.

  Sem interação: o quadro sai da ordem de tabulação, fica fora da árvore de
  acessibilidade (o rótulo é da `Previa` em volta) e o CSS tira o ponteiro.
*/

type Propriedades = {
  titulo: string;
  className?: string;
  escuro: boolean;
  classesDoCorpo?: readonly string[];
  variaveis?: Readonly<Record<string, string>>;
  children: ReactNode;
};

const FOLHAS = 'style, link[rel="stylesheet"]';

function prepararDocumento(destino: Document) {
  destino.head.replaceChildren(
    ...Array.from(document.head.querySelectorAll(FOLHAS), (folha) =>
      destino.importNode(folha, true),
    ),
  );
}

export function MolduraDaPrevia({
  titulo,
  className,
  escuro,
  classesDoCorpo = [],
  variaveis = {},
  children,
}: Propriedades) {
  const quadro = useRef<HTMLIFrameElement>(null);
  const [corpo, definirCorpo] = useState<HTMLElement | null>(null);

  /*
    O documento do quadro existe assim que ele entra na página (about:blank).
    Se o navegador trocar esse documento ao terminar de carregar, o `load`
    prepara o novo.
  */
  const iniciar = useCallback(() => {
    const documento = quadro.current?.contentDocument;
    if (!documento?.body) return;
    prepararDocumento(documento);
    definirCorpo(documento.body);
  }, []);

  useLayoutEffect(() => {
    iniciar();
    return () => definirCorpo(null);
  }, [iniciar]);

  const classes = classesDoCorpo.join(" ");
  // Por valor, não por referência: o objeto de variáveis nasce a cada desenho.
  const chaveDasVariaveis = JSON.stringify(Object.entries(variaveis));
  useLayoutEffect(() => {
    const raiz = corpo?.ownerDocument.documentElement;
    if (!corpo || !raiz) return;
    if (escuro) raiz.setAttribute("data-theme", "dark");
    else raiz.removeAttribute("data-theme");
    corpo.className = classes;
    for (const [nome, valor] of JSON.parse(chaveDasVariaveis) as [
      string,
      string,
    ][])
      raiz.style.setProperty(nome, valor);
  }, [corpo, escuro, classes, chaveDasVariaveis]);

  return (
    <>
      <iframe
        ref={quadro}
        title={titulo}
        className={className}
        tabIndex={-1}
        aria-hidden="true"
        onLoad={iniciar}
      />
      {corpo ? createPortal(children, corpo) : null}
    </>
  );
}

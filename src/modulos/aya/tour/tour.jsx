/*
  O tour guiado da Aya ("Me mostra esta tela") e o motor das trilhas.

  Escurece a página com um recorte (spotlight) no elemento da vez e mostra um
  balão curto ao lado dele: contador ("Passo 2 de 6"), título, uma ou duas frases e
  os botões Pular · Anterior · Próximo. O roteiro vem de src/lib/aya-tours.js.

  - O passo aponta para um seletor estável (id, data-tour, data-*). Se o
    elemento não existe ou está escondido (sem permissão, tela vazia, aba
    fechada), o passo é pulado na direção em que a pessoa ia.
  - Passo de trilha tem `pagina`: o tour pede a troca de tela (`irPara`) e
    espera o elemento aparecer por alguns instantes, olhando de tempos em
    tempos (sem MutationObserver); se não aparecer, pula. Enquanto a tela
    ainda baixa (telas sob demanda, src/lib/carga-de-telas.js), a espera não
    se esgota.
  - O elemento destacado continua clicável (o véu são quatro faixas em volta
    do recorte); o resto da página não recebe clique enquanto o tour corre.
  - Teclado: Esc sai, ← e → navegam, Tab fica preso no balão. O leitor de
    tela ouve "Passo 2 de 6: título. texto" a cada passo.
  - O recorte acompanha o elemento: rolagem, redimensionar a janela e um
    ResizeObserver no elemento da vez (o elemento é achado com
    querySelector na hora do passo; nada de MutationObserver).
  - Celular (até 600px): balão com a largura da tela, embaixo ou em cima,
    do lado oposto ao elemento. Tema escuro: só tokens (tour.css).

  Sem innerHTML: todo texto entra como texto.
*/

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  geometriaDoHolofote,
  posicaoDoBalao,
  rotuloDoPasso,
} from "../../../lib/aya-tours.js";
import { haTelaCarregando } from "../../../lib/carga-de-telas.js";

const FOCAVEIS =
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
const INTERVALO_DA_PROCURA = 120;

/* O elemento está na tela? Escondido por `hidden`, página inativa ou display:none não conta. */
export function elementoVisivel(elemento) {
  if (!elemento?.isConnected) return false;
  if (elemento.closest("[hidden], [aria-hidden='true'], .page:not(.active)"))
    return false;
  if (typeof elemento.checkVisibility === "function")
    return elemento.checkVisibility();
  return true;
}

/* O primeiro seletor do passo que acha um elemento visível. */
export function acharAlvo(passo, documento, visivel = elementoVisivel) {
  const seletores = [passo?.alvo].flat().filter(Boolean);
  for (const seletor of seletores) {
    let elementos = [];
    try {
      elementos = [...documento.querySelectorAll(seletor)];
    } catch {
      continue; // seletor inválido: tenta o próximo
    }
    const achado = elementos.find((elemento) => visivel(elemento));
    if (achado) return achado;
  }
  return null;
}

function movimentoReduzido(janela) {
  try {
    return janela.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

function telaDeCelular(janela) {
  try {
    return janela.matchMedia?.("(max-width: 600px)").matches === true;
  } catch {
    return false;
  }
}

/* O recorte e as faixas saem do mesmo retângulo (moldura == área clara). */
function medir(elemento) {
  return geometriaDoHolofote(elemento.getBoundingClientRect());
}

export function Tour({
  passos,
  inicio = 0,
  rotulo = "Tour guiado",
  aoFechar,
  aoMudarPasso,
  irPara,
  janela = globalThis.window,
  documento = globalThis.document,
  visivel = elementoVisivel,
  espera = 1600,
  carregando = haTelaCarregando,
}) {
  const total = passos.length;
  // `pedido`: o índice desejado e a direção (1 avança, -1 volta) para pular ausentes.
  const [pedido, setPedido] = useState(() => ({
    indice: Math.min(Math.max(0, inicio), Math.max(0, total - 1)),
    direcao: 1,
  }));
  const [atual, setAtual] = useState(null); // { indice, elemento }
  const [caixa, setCaixa] = useState(null);
  const [posicao, setPosicao] = useState(null);
  const refBalao = useRef(null);
  const refProximo = useRef(null);
  const focoAnterior = useRef(null);
  const ultimoValido = useRef(-1);
  const idTitulo = useId();
  const idTexto = useId();

  const fechar = useCallback(
    (motivo) => aoFechar?.(motivo, atual?.indice ?? pedido.indice),
    [aoFechar, atual, pedido.indice],
  );

  // Guarda o foco de antes para devolver ao sair.
  useEffect(() => {
    focoAnterior.current = documento.activeElement;
    return () => {
      const anterior = focoAnterior.current;
      if (anterior?.isConnected && typeof anterior.focus === "function")
        anterior.focus();
    };
  }, [documento]);

  // Resolve o passo pedido: troca de tela se precisar, acha o alvo ou pula.
  useEffect(() => {
    let cancelado = false;
    let temporizador = 0;
    const { indice, direcao } = pedido;

    if (indice < 0) {
      // Voltou antes do primeiro visível: fica no último válido.
      setPedido({ indice: Math.max(0, ultimoValido.current), direcao: 1 });
      return undefined;
    }
    if (indice >= total) {
      if (direcao > 0) aoFechar?.("concluiu", total - 1);
      return undefined;
    }
    const passo = passos[indice];
    const trocouDeTela = passo.pagina ? irPara?.(passo) === true : false;

    const aceitar = (elemento) => {
      if (cancelado) return;
      ultimoValido.current = indice;
      setAtual({ indice, elemento });
      aoMudarPasso?.(indice);
    };
    const pular = () => {
      if (cancelado) return;
      setPedido({ indice: indice + direcao, direcao });
    };

    if (!passo.alvo) {
      aceitar(null);
      return () => {
        cancelado = true;
      };
    }

    // `antes`: a aba ou visão que precisa estar aberta (Conduzir, Pendentes):
    // um clique nela, se ainda não estiver marcada. Só muda o que se vê.
    let preparado = !passo.antes;
    const preparar = () => {
      if (preparado) return false;
      const aba = acharAlvo({ alvo: passo.antes }, documento, visivel);
      if (!aba) return false;
      preparado = true;
      const marcada = ["aria-checked", "aria-selected", "aria-pressed"].some(
        (atributo) => aba.getAttribute(atributo) === "true",
      );
      if (marcada) return false;
      aba.click();
      return true;
    };

    const clicou = preparar();
    const primeiro = clicou ? null : acharAlvo(passo, documento, visivel);
    const vaiMudar = trocouDeTela || clicou || !preparado;
    if (primeiro) {
      aceitar(primeiro);
    } else if (!vaiMudar || espera <= 0) {
      pular();
    } else {
      const limite = Date.now() + espera;
      const procurar = () => {
        if (cancelado) return;
        preparar();
        const achado = acharAlvo(passo, documento, visivel);
        if (achado) aceitar(achado);
        else if (Date.now() >= limite && !carregando()) pular();
        else temporizador = janela.setTimeout(procurar, INTERVALO_DA_PROCURA);
      };
      temporizador = janela.setTimeout(procurar, INTERVALO_DA_PROCURA);
    }
    return () => {
      cancelado = true;
      janela.clearTimeout(temporizador);
    };
    // `passos` e as funções não mudam durante o tour: só o pedido dispara.
  }, [pedido]);

  // Rola até o elemento e mede; mede de novo ao rolar, redimensionar ou clicar.
  useLayoutEffect(() => {
    const elemento = atual?.elemento;
    if (!elemento) {
      setCaixa(null);
      return undefined;
    }
    elemento.scrollIntoView?.({
      block: "center",
      inline: "nearest",
      behavior: movimentoReduzido(janela) ? "auto" : "smooth",
    });
    let quadro = 0;
    const atualizar = () => {
      janela.cancelAnimationFrame?.(quadro);
      const refazer = () =>
        setCaixa(elemento.isConnected ? medir(elemento) : null);
      if (typeof janela.requestAnimationFrame === "function")
        quadro = janela.requestAnimationFrame(refazer);
      else refazer();
    };
    setCaixa(medir(elemento));
    janela.addEventListener("scroll", atualizar, true);
    janela.addEventListener("resize", atualizar);
    documento.addEventListener("click", atualizar, true);
    // O elemento mudou de tamanho (filtro aberto, lista carregou): mede de novo.
    const Observador = janela.ResizeObserver;
    const observador =
      typeof Observador === "function" ? new Observador(atualizar) : null;
    observador?.observe(elemento);
    return () => {
      observador?.disconnect();
      janela.cancelAnimationFrame?.(quadro);
      janela.removeEventListener("scroll", atualizar, true);
      janela.removeEventListener("resize", atualizar);
      documento.removeEventListener("click", atualizar, true);
    };
  }, [atual, janela, documento]);

  // Posição do balão, depois de saber o tamanho dele.
  useLayoutEffect(() => {
    if (!atual) return;
    const balao = refBalao.current;
    setPosicao(
      posicaoDoBalao({
        caixa: caixa?.recorte ?? null,
        balao: {
          largura: balao?.offsetWidth || 0,
          altura: balao?.offsetHeight || 0,
        },
        tela: { largura: janela.innerWidth, altura: janela.innerHeight },
        celular: telaDeCelular(janela),
      }),
    );
  }, [atual, caixa, janela]);

  // Foco no balão a cada passo (no botão Próximo).
  useEffect(() => {
    if (!atual) return;
    (refProximo.current || refBalao.current)?.focus();
  }, [atual]);

  const proximo = useCallback(() => {
    if (!atual) return;
    setPedido({ indice: atual.indice + 1, direcao: 1 });
  }, [atual]);
  const voltar = useCallback(() => {
    if (!atual || atual.indice <= 0) return;
    setPedido({ indice: atual.indice - 1, direcao: -1 });
  }, [atual]);

  // Teclado em qualquer lugar: Esc sai, setas navegam.
  useEffect(() => {
    const aoTeclar = (evento) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        fechar("pulou");
      } else if (evento.key === "ArrowRight") {
        evento.preventDefault();
        proximo();
      } else if (evento.key === "ArrowLeft") {
        evento.preventDefault();
        voltar();
      }
    };
    documento.addEventListener("keydown", aoTeclar, true);
    return () => documento.removeEventListener("keydown", aoTeclar, true);
  }, [documento, fechar, proximo, voltar]);

  function prenderFoco(evento) {
    if (evento.key !== "Tab") return;
    const balao = refBalao.current;
    const focaveis = [...(balao?.querySelectorAll(FOCAVEIS) || [])];
    if (!focaveis.length) {
      evento.preventDefault();
      return;
    }
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    const ativo = documento.activeElement;
    if (evento.shiftKey && (ativo === primeiro || !balao.contains(ativo))) {
      evento.preventDefault();
      ultimo.focus();
    } else if (
      !evento.shiftKey &&
      (ativo === ultimo || !balao.contains(ativo))
    ) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  if (!atual) return null;
  const passo = passos[atual.indice];
  const ultimo = atual.indice >= total - 1;
  const contador = rotuloDoPasso(atual.indice, total);
  const estiloDoBalao =
    posicao && posicao.modo !== "celular"
      ? { top: `${posicao.top}px`, left: `${posicao.left}px` }
      : undefined;
  const classeDoBalao = [
    "aya-tour__balao",
    posicao?.modo === "celular"
      ? `aya-tour__balao--celular-${posicao.lado}`
      : "",
    !posicao ? "aya-tour__balao--medindo" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div className="aya-tour" data-tour-ativo="">
      {caixa ? (
        <>
          {caixa.faixas.map((faixa, indice) => (
            <div key={indice} className="aya-tour__faixa" style={faixa} />
          ))}
          <div
            className="aya-tour__recorte"
            aria-hidden="true"
            style={caixa.recorte}
          />
        </>
      ) : (
        <div className="aya-tour__faixa aya-tour__faixa--inteira" />
      )}

      <section
        ref={refBalao}
        className={classeDoBalao}
        style={estiloDoBalao}
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        aria-describedby={`${idTitulo} ${idTexto}`}
        tabIndex={-1}
        onKeyDown={prenderFoco}
      >
        {/* Sem <div> filho direto: mobile-app.css estiliza "[role=dialog] > div" com !important. */}
        <article className="aya-tour__conteudo">
          <p className="aya-tour__contador">{contador}</p>
          <h2 id={idTitulo} className="aya-tour__titulo">
            {passo.titulo}
          </h2>
          <p id={idTexto} className="aya-tour__texto">
            {passo.texto}
          </p>
          <div className="aya-tour__acoes">
            <button
              type="button"
              className="aya-tour__pular"
              onClick={() => fechar("pulou")}
            >
              {ultimo ? "Fechar" : "Pular"}
            </button>
            <span className="aya-tour__navegacao">
              <button
                type="button"
                className="aya-tour__voltar"
                onClick={voltar}
                disabled={atual.indice === 0}
              >
                Anterior
              </button>
              <button
                ref={refProximo}
                type="button"
                className="aya-tour__proximo"
                onClick={proximo}
              >
                {ultimo ? "Concluir" : "Próximo"}
              </button>
            </span>
          </div>
        </article>
      </section>
      <p className="aya-visualmente-oculto" role="status" aria-live="polite">
        {`${contador}: ${passo.titulo}. ${passo.texto}`}
      </p>
    </div>,
    documento.body,
  );
}

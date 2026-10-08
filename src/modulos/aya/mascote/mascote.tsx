/*
  A mascote da Aya: a arara-azul viva, sempre de corpo inteiro. Desenho em
  desenho.tsx (fiel à ilustração de referência); movimento em
  mascote.css (transform/opacity, por `data-estado`) e, para o que é sorteado
  (piscar a cada 3–7 s, arrepiar as penas da cabeça), Web Animations direto
  no elemento — nada disso passa pelo React a cada quadro.

  Estados (src/lib/estado-da-aya.ts): parada, atenta, falando, pensando,
  comemorando, dormindo e acenando. Quem vence quando vários valem juntos é
  `resolverEstado`: estado fixo (prévia, fogos) > pedido global `aya:estado`
  > o do painel (falando/pensando) > momento local (aceno de boas-vindas) >
  atenta (ponteiro perto; o olho acompanha) > dormindo (inatividade longa) >
  parada.

  Movimento reduzido: só pisca. Aba oculta: tudo pausa (sem piscar, sem CSS).
  Comemorações desligadas pela pessoa: não comemora.
*/

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import {
  comemoracoesPessoaisDesligadas,
  deveAcenar,
  direcaoDoOlhar,
  INATIVIDADE_PARA_DORMIR_MS,
  intervaloDaPiscada,
  intervaloDoArrepio,
  piscadaDupla,
  RAIO_DE_ATENCAO_PX,
  resolverEstado,
  estadoVisivel,
  DURACAO_PADRAO_MS,
  type EstadoDaMascote,
} from "../../../lib/estado-da-aya.ts";
/* Começa em 0 0: os pivôs do CSS (transform-box: view-box) contam da origem. */
export const VIEWBOX = "0 0 200 190";

/*
  O desenho (desenho.tsx + contornos.ts, ~60 KB) vem num pedaço próprio do
  bundle, carregado na primeira arara montada. Até chegar, o <svg> já ocupa
  o tamanho final (sem pulo de layout), vazio.
*/
type ModuloDoDesenho = typeof import("./desenho.tsx");
let desenho: ModuloDoDesenho | null = null;
let carregamento: Promise<ModuloDoDesenho> | null = null;
const ouvintesDoDesenho = new Set<() => void>();

/** Carrega o desenho (uma vez); os testes e a prévia podem esperar por ele. */
export function carregarDesenhoDaMascote() {
  carregamento ??= import("./desenho.tsx").then((modulo) => {
    desenho = modulo;
    for (const ouvinte of [...ouvintesDoDesenho]) ouvinte();
    return modulo;
  });
  return carregamento;
}

function assinarDesenho(ouvinte: () => void) {
  ouvintesDoDesenho.add(ouvinte);
  void carregarDesenhoDaMascote().catch(() => {
    /* sem o pedaço (rede): a arara fica vazia, nada quebra */
  });
  return () => ouvintesDoDesenho.delete(ouvinte);
}
const obterDesenho = () => desenho;
import { assinarPedidoDaAya, obterPedidoDaAya } from "./estado.ts";
import "./mascote.css";

/* Abaixo disto (px), a versão simples (contornos chapados). */
export const TAMANHO_DA_VERSAO_SIMPLES = 40;
/* A arara do canto (botão da Aya), em pé no poleiro: px de altura. */
export const ALTURA_DA_ARARA = 84;
const PISCADA_MS = 170;

export interface PropsDaMascote {
  /** Estado imposto (prévia, fogos): ignora pedidos, ponteiro e sono. */
  estado?: EstadoDaMascote | null;
  /** O que o painel da Aya está fazendo: "falando", "pensando"… */
  proprio?: EstadoDaMascote | null;
  /** Lado em px (a arara inteira cabe no quadrado). Abaixo de 40px, versão simples. */
  tamanho?: number;
  /** Em pé no poleiro, com a sombra de contato (padrão: sim; os fogos voam sem). */
  poleiro?: boolean;
  /** Ouve o evento global `aya:estado` (padrão: sim). */
  ouvirAya?: boolean;
  /** Fica atenta e acompanha o ponteiro quando ele chega perto (padrão: sim). */
  atencao?: boolean;
  /** Dorme depois de muito tempo sem interação (padrão: sim). */
  dormir?: boolean;
  /** Acena ao entrar, uma vez por sessão. */
  acenarAoEntrar?: boolean;
  /** Estado de momento ao montar (ex.: atenta ao abrir o painel). */
  momentoInicial?: { estado: EstadoDaMascote; duracaoMs: number } | null;
  /** Texto para leitores de tela; sem ele, a arara é decorativa. */
  rotulo?: string;
  className?: string;
  janela?: Window;
  rng?: () => number;
}

const nada = () => () => {};
const semPedido = () => null;

function assinarMovimentoReduzido(janela: Window | undefined) {
  return (ouvinte: () => void) => {
    const consulta = janela?.matchMedia?.("(prefers-reduced-motion: reduce)");
    consulta?.addEventListener?.("change", ouvinte);
    return () => consulta?.removeEventListener?.("change", ouvinte);
  };
}

function movimentoReduzido(janela: Window | undefined) {
  try {
    return Boolean(
      janela?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
  } catch {
    return false;
  }
}

function armazenamento(janela: Window | undefined, tipo: "local" | "sessao") {
  try {
    return tipo === "local" ? janela?.localStorage : janela?.sessionStorage;
  } catch {
    return null;
  }
}

/** Anima um elemento se o navegador tiver Web Animations (o jsdom não tem). */
function animar(
  elemento: Element | null | undefined,
  quadros: Keyframe[],
  opcoes: KeyframeAnimationOptions,
) {
  const alvo = elemento as (Element & { animate?: Element["animate"] }) | null;
  if (!alvo || typeof alvo.animate !== "function") return false;
  alvo.animate(quadros, opcoes);
  return true;
}

export function Mascote({
  estado: fixo = null,
  proprio = null,
  tamanho = 64,
  poleiro = true,
  ouvirAya = true,
  atencao = true,
  dormir = true,
  acenarAoEntrar = false,
  momentoInicial = null,
  rotulo,
  className,
  janela = globalThis.window,
  rng = Math.random,
}: PropsDaMascote) {
  const prefixo = `arara${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const refRaiz = useRef<SVGSVGElement | null>(null);
  const simples = tamanho < TAMANHO_DA_VERSAO_SIMPLES;
  const modulo = useSyncExternalStore(
    assinarDesenho,
    obterDesenho,
    obterDesenho,
  );
  const livre = !fixo;

  const global = useSyncExternalStore(
    ouvirAya && livre ? assinarPedidoDaAya : nada,
    ouvirAya && livre ? obterPedidoDaAya : semPedido,
    semPedido,
  );
  const assinarReduzido = useMemo(
    () => assinarMovimentoReduzido(janela),
    [janela],
  );
  const reduzido = useSyncExternalStore(
    assinarReduzido,
    () => movimentoReduzido(janela),
    () => false,
  );
  const [perto, setPerto] = useState(false);
  const [dormindo, setDormindo] = useState(false);
  const [momento, setMomento] = useState<EstadoDaMascote | null>(null);

  const desligadas = comemoracoesPessoaisDesligadas(
    armazenamento(janela, "local"),
  );
  const pedido = resolverEstado({
    fixo,
    global,
    proprio,
    momento,
    perto: livre && atencao && perto,
    dormindo: livre && dormir && dormindo,
    comemoracoesDesligadas: desligadas,
  });
  const visivel = estadoVisivel(pedido, { reduzido });
  const refVisivel = useRef(visivel);
  refVisivel.current = visivel;

  // Momento ao montar: aceno de boas-vindas (1x por sessão) ou o pedido de quem montou.
  const momentoInicialEstado = momentoInicial?.estado ?? null;
  const momentoInicialDuracao = momentoInicial?.duracaoMs ?? 0;
  useEffect(() => {
    let estadoDoMomento: EstadoDaMascote | null = null;
    let duracao = 0;
    if (acenarAoEntrar && deveAcenar(armazenamento(janela, "sessao"))) {
      estadoDoMomento = "acenando";
      duracao = DURACAO_PADRAO_MS.acenando ?? 2600;
    } else if (momentoInicialEstado) {
      estadoDoMomento = momentoInicialEstado;
      duracao = momentoInicialDuracao;
    }
    if (!estadoDoMomento) return undefined;
    setMomento(estadoDoMomento);
    const tempo = setTimeout(() => setMomento(null), Math.max(duracao, 300));
    return () => clearTimeout(tempo);
    // Só ao montar.
  }, []);

  // Piscar (3–7 s sorteados; às vezes duas vezes) — também com movimento reduzido.
  const olhosFechados = visivel === "dormindo";
  useEffect(() => {
    if (olhosFechados) return undefined;
    let tempo: ReturnType<typeof setTimeout> | null = null;
    const piscar = () => {
      const raiz = refRaiz.current;
      if (raiz && !janela?.document?.hidden) {
        const palpebras = raiz.querySelectorAll(".mascote__palpebra");
        const dupla = piscadaDupla(rng);
        for (const palpebra of palpebras)
          animar(
            palpebra,
            dupla
              ? [
                  { transform: "scaleY(0)" },
                  { transform: "scaleY(1)", offset: 0.25 },
                  { transform: "scaleY(0)", offset: 0.5 },
                  { transform: "scaleY(1)", offset: 0.75 },
                  { transform: "scaleY(0)" },
                ]
              : [
                  { transform: "scaleY(0)" },
                  { transform: "scaleY(1)", offset: 0.45 },
                  { transform: "scaleY(0)" },
                ],
            {
              duration: dupla ? PISCADA_MS * 2.2 : PISCADA_MS,
              easing: "ease-in-out",
            },
          );
        raiz.dataset.piscadas = String(Number(raiz.dataset.piscadas || 0) + 1);
      }
      tempo = setTimeout(piscar, intervaloDaPiscada(rng));
    };
    tempo = setTimeout(piscar, intervaloDaPiscada(rng));
    return () => {
      if (tempo) clearTimeout(tempo);
    };
  }, [olhosFechados, janela, rng]);

  // Às vezes as penas da cabeça arrepiam (parada ou atenta, com movimento).
  useEffect(() => {
    if (reduzido || simples) return undefined;
    let tempo: ReturnType<typeof setTimeout> | null = null;
    const arrepiar = () => {
      const raiz = refRaiz.current;
      const agora = refVisivel.current;
      if (
        raiz &&
        !janela?.document?.hidden &&
        (agora === "parada" || agora === "atenta")
      )
        animar(
          raiz.querySelector(".mascote__penas-da-cabeca"),
          [
            { transform: "rotate(0deg) scale(1)" },
            { transform: "rotate(-16deg) scale(1.18)", offset: 0.3 },
            { transform: "rotate(7deg) scale(1.08)", offset: 0.6 },
            { transform: "rotate(0deg) scale(1)" },
          ],
          { duration: 700, easing: "ease-out" },
        );
      tempo = setTimeout(arrepiar, intervaloDoArrepio(rng));
    };
    tempo = setTimeout(arrepiar, intervaloDoArrepio(rng));
    return () => {
      if (tempo) clearTimeout(tempo);
    };
  }, [reduzido, simples, janela, rng]);

  // Ponteiro perto: atenta, e o olho acompanha (CSS vars, sem render por quadro).
  const acompanhar = livre && atencao && !reduzido;
  useEffect(() => {
    if (!acompanhar || !janela?.addEventListener) return undefined;
    let quadro = 0;
    let ultimo: { x: number; y: number } | null = null;
    let pertoAgora = false;
    const medir = () => {
      quadro = 0;
      const raiz = refRaiz.current;
      if (!raiz || !ultimo) return;
      const caixa = raiz.getBoundingClientRect();
      const centro = {
        x: caixa.left + caixa.width / 2,
        y: caixa.top + caixa.height / 2,
      };
      const olhar = direcaoDoOlhar(centro, ultimo);
      const alcance =
        RAIO_DE_ATENCAO_PX + Math.max(caixa.width, caixa.height) / 2;
      const estaPerto = olhar.distancia <= alcance;
      if (estaPerto !== pertoAgora) {
        pertoAgora = estaPerto;
        setPerto(estaPerto);
      }
      // Só a atenta segue o ponteiro (pensando olha para cima, por exemplo).
      if (estaPerto && refVisivel.current === "atenta") {
        raiz.style.setProperty("--olho-x", String(olhar.x));
        raiz.style.setProperty("--olho-y", String(olhar.y));
      } else {
        raiz.style.removeProperty("--olho-x");
        raiz.style.removeProperty("--olho-y");
      }
    };
    const aoMover = (evento: PointerEvent) => {
      ultimo = { x: evento.clientX, y: evento.clientY };
      if (!quadro && janela.requestAnimationFrame)
        quadro = janela.requestAnimationFrame(medir);
    };
    janela.addEventListener("pointermove", aoMover, { passive: true });
    return () => {
      janela.removeEventListener("pointermove", aoMover);
      if (quadro) janela.cancelAnimationFrame?.(quadro);
      refRaiz.current?.style.removeProperty("--olho-x");
      refRaiz.current?.style.removeProperty("--olho-y");
    };
  }, [acompanhar, janela]);

  // Saiu de "atenta": o olho volta ao centro (ou ao que o estado pede).
  useEffect(() => {
    if (visivel === "atenta") return;
    refRaiz.current?.style.removeProperty("--olho-x");
    refRaiz.current?.style.removeProperty("--olho-y");
  }, [visivel]);

  // Sem interação por muito tempo: dorme; qualquer interação acorda.
  const podeDormir = livre && dormir;
  useEffect(() => {
    if (!podeDormir || !janela?.addEventListener) return undefined;
    let ultimaAtividade = Date.now();
    let tempo: ReturnType<typeof setTimeout> | null = null;
    let dormiu = false;
    const vigiar = () => {
      const passou = Date.now() - ultimaAtividade;
      if (passou >= INATIVIDADE_PARA_DORMIR_MS) {
        dormiu = true;
        setDormindo(true);
        tempo = null;
        return;
      }
      tempo = setTimeout(vigiar, INATIVIDADE_PARA_DORMIR_MS - passou);
    };
    const aoInteragir = () => {
      ultimaAtividade = Date.now();
      if (dormiu) {
        dormiu = false;
        setDormindo(false);
      }
      if (!tempo) tempo = setTimeout(vigiar, INATIVIDADE_PARA_DORMIR_MS);
    };
    const eventos = [
      "pointermove",
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
      "focusin",
    ];
    for (const nome of eventos)
      janela.addEventListener(nome, aoInteragir, { passive: true });
    tempo = setTimeout(vigiar, INATIVIDADE_PARA_DORMIR_MS);
    return () => {
      for (const nome of eventos) janela.removeEventListener(nome, aoInteragir);
      if (tempo) clearTimeout(tempo);
    };
  }, [podeDormir, janela]);

  // Aba oculta: pausa as animações de CSS (o piscar já confere `hidden`).
  useEffect(() => {
    const documento = janela?.document;
    if (!documento?.addEventListener) return undefined;
    const marcar = () => {
      const raiz = refRaiz.current;
      if (!raiz) return;
      if (documento.hidden) raiz.dataset.pausada = "sim";
      else delete raiz.dataset.pausada;
    };
    marcar();
    documento.addEventListener("visibilitychange", marcar);
    return () => documento.removeEventListener("visibilitychange", marcar);
  }, [janela]);

  const viewBox = VIEWBOX;
  const classes = ["mascote", className].filter(Boolean).join(" ");
  return (
    <svg
      ref={refRaiz}
      className={classes}
      viewBox={viewBox}
      width={tamanho}
      height={tamanho}
      data-estado={visivel}
      data-pedido={pedido}
      data-versao={simples ? "simples" : "completa"}
      data-reduzido={reduzido ? "sim" : undefined}
      role={rotulo ? "img" : undefined}
      aria-label={rotulo || undefined}
      aria-hidden={rotulo ? undefined : "true"}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {!modulo ? null : simples ? (
        <modulo.DesenhoSimples p={prefixo} />
      ) : (
        <modulo.DesenhoCompleto p={prefixo} poleiro={poleiro} />
      )}
    </svg>
  );
}

/**
 * Monta uma arara fora de uma árvore React (os fogos, em
 * src/modules/comemoracao.js). Devolve `desmontar`.
 */
export function montarMascoteAvulsa(
  elemento: Element,
  props: PropsDaMascote = {},
) {
  const raiz = createRoot(elemento);
  raiz.render(<Mascote {...props} />);
  return () => raiz.unmount();
}

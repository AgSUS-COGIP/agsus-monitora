/*
  A mascote da Aya: a arara-azul viva. Desenho em
  desenho.tsx (fiel à ilustração de referência); movimento em
  mascote.css (transform/opacity, por `data-estado`) e, para o que é sorteado
  (piscar a cada 3–7 s, arrepiar as penas da cabeça), Web Animations direto
  no elemento — nada disso passa pelo React a cada quadro.

  Estados (src/lib/aya/estado-da-aya.ts): parada, atenta, falando, pensando,
  comemorando, dormindo e acenando. Quem vence quando vários valem juntos é
  `resolverEstado`: estado fixo (prévia, fogos) > pedido global `aya:estado`
  > o do painel (falando/pensando) > momento local (aceno de boas-vindas) >
  atenta (ponteiro perto; o olho acompanha) > dormindo (inatividade longa) >
  parada.

  Enquadramento: "corpo" (a arara inteira: painel aberto, fogos, prévia) ou
  "rosto" (só a cabeça e um busto curto, com os detalhes de perto: a Aya
  fechada, no botão). Trocar o enquadramento na mesma arara aproxima ou
  afasta o quadro por transição de CSS (transform/opacity; o <svg> não muda
  de tamanho); `enquadramentoInicial` faz a arara nascer no outro e passar
  ao pedido logo depois (a ida do botão para o painel e a volta).

  Movimento reduzido: só pisca (e o enquadramento troca sem transição). Aba oculta: tudo pausa (sem piscar, sem CSS).
  Comemorações desligadas pela pessoa: não comemora.

  Duas artes, a mesma lógica de estados: o desenho em SVG (padrão; a arara
  do canto e a da tela de solicitação de acesso) e a arara ilustrada em 3D
  (`ilustrada`: o painel aberto, o tour, as comemorações e a prévia), uma
  pose por estado (ilustrada.tsx). A ilustrada mostra o estado pedido também
  com movimento reduzido (troca a imagem, sem animação) e aceita uma `pose`
  fora dos estados ("apontando", do tour). Cada arte vem num pedaço próprio
  do bundle, só quando a primeira arara dela monta.
*/

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, RefObject } from "react";
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
} from "../../../lib/aya/estado-da-aya.ts";
import type { PoseDaArara } from "../../../lib/aya/poses-da-aya.ts";
/* Começa em 0 0: os pivôs do CSS (transform-box: view-box) contam da origem. */
export const VIEWBOX = "0 0 200 190";

/*
  O desenho (desenho.tsx + contornos.ts, ~60 KB) vem num pedaço próprio do
  bundle, carregado na primeira arara montada. Até chegar, o <svg> já ocupa
  o tamanho final (sem pulo de layout), vazio.
*/
type ModuloDoDesenho = typeof import("./desenho.tsx");
let desenho: ModuloDoDesenho | null = null;
const ouvintesDoDesenho = new Set<() => void>();
/* A falha do download é esquecida: a próxima arara montada pede de novo. */
const baixarDesenho = pedidoSobDemanda(() => import("./desenho.tsx"));

/** Carrega o desenho (uma vez); os testes e a prévia podem esperar por ele. */
export function carregarDesenhoDaMascote() {
  return baixarDesenho().then((modulo) => {
    if (desenho !== modulo) {
      desenho = modulo;
      for (const ouvinte of [...ouvintesDoDesenho]) ouvinte();
    }
    return modulo;
  });
}

function assinarDesenho(ouvinte: () => void) {
  ouvintesDoDesenho.add(ouvinte);
  void carregarDesenhoDaMascote().catch(() => {
    /* sem o pedaço (rede): a arara fica vazia, nada quebra */
  });
  return () => ouvintesDoDesenho.delete(ouvinte);
}
const obterDesenho = () => desenho;

/* A arara ilustrada (ilustrada.tsx, com o CSS e as imagens): outro pedaço, carregado do mesmo jeito. */
type ModuloDaIlustracao = typeof import("./ilustrada.tsx");
let ilustracao: ModuloDaIlustracao | null = null;
const ouvintesDaIlustracao = new Set<() => void>();
const baixarIlustracao = pedidoSobDemanda(() => import("./ilustrada.tsx"));

/** Carrega a arara ilustrada (uma vez); os testes podem esperar por ela. */
export function carregarIlustracaoDaMascote() {
  return baixarIlustracao().then((modulo) => {
    if (ilustracao !== modulo) {
      ilustracao = modulo;
      for (const ouvinte of [...ouvintesDaIlustracao]) ouvinte();
    }
    return modulo;
  });
}

function assinarIlustracao(ouvinte: () => void) {
  ouvintesDaIlustracao.add(ouvinte);
  void carregarIlustracaoDaMascote().catch(() => {
    /* sem o pedaço (rede): a arara fica vazia, nada quebra */
  });
  return () => ouvintesDaIlustracao.delete(ouvinte);
}
const obterIlustracao = () => ilustracao;
const semModulo = () => null;
import { assinarPedidoDaAya, obterPedidoDaAya } from "./estado.ts";
import { pedidoSobDemanda } from "../../../lib/carga/pedido-sob-demanda.ts";
import "./mascote.css";

/* Abaixo disto (px), a versão simples (contornos chapados); o rosto, de perto, nunca é simples. */
export const TAMANHO_DA_VERSAO_SIMPLES = 40;
/* A Aya fechada (o botão do canto), só o rosto: px de lado. */
export const ALTURA_DA_ARARA = 56;
/* A arara inteira no cabeçalho do painel aberto: px de lado. */
export const TAMANHO_NO_PAINEL = 88;
const PISCADA_MS = 170;

export type Enquadramento = "corpo" | "rosto";

export interface PropsDaMascote {
  /** Estado imposto (prévia, fogos): ignora pedidos, ponteiro e sono. */
  estado?: EstadoDaMascote | null;
  /** O que o painel da Aya está fazendo: "falando", "pensando"… */
  proprio?: EstadoDaMascote | null;
  /** Lado em px (a arara inteira cabe no quadrado). Abaixo de 40px, versão simples. */
  tamanho?: number;
  /** A arara inteira ("corpo", padrão) ou só o rosto, de perto ("rosto"). */
  enquadramento?: Enquadramento;
  /** Nasce neste enquadramento e passa ao pedido logo depois (transição de entrada). */
  enquadramentoInicial?: Enquadramento | null;
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
  /** A arara ilustrada em 3D (aparições grandes) em vez do desenho em SVG. */
  ilustrada?: boolean;
  /** Só na ilustrada: uma pose imposta, fora dos estados ("apontando", do tour). */
  pose?: PoseDaArara | null;
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
  enquadramento = "corpo",
  enquadramentoInicial = null,
  poleiro = true,
  ouvirAya = true,
  atencao = true,
  dormir = true,
  acenarAoEntrar = false,
  momentoInicial = null,
  ilustrada = false,
  pose = null,
  rotulo,
  className,
  janela = globalThis.window,
  rng = Math.random,
}: PropsDaMascote) {
  const prefixo = `arara${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const refRaiz = useRef<HTMLSpanElement | SVGSVGElement | null>(null);
  const simples =
    !ilustrada &&
    enquadramento === "corpo" &&
    tamanho < TAMANHO_DA_VERSAO_SIMPLES;
  const modulo = useSyncExternalStore(
    ilustrada ? nada : assinarDesenho,
    ilustrada ? semModulo : obterDesenho,
    semModulo,
  );
  const moduloIlustrado = useSyncExternalStore(
    ilustrada ? assinarIlustracao : nada,
    ilustrada ? obterIlustracao : semModulo,
    semModulo,
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
  // A entrada no outro enquadramento (sem ela com movimento reduzido: só troca).
  const [entrada, setEntrada] = useState<Enquadramento | null>(() =>
    enquadramentoInicial &&
    enquadramentoInicial !== enquadramento &&
    !movimentoReduzido(janela)
      ? enquadramentoInicial
      : null,
  );
  const quadro = entrada ?? enquadramento;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao montar.
  }, []);

  // Dois quadros depois de montar (o navegador já pintou a entrada): vai ao pedido.
  const temEntrada = entrada !== null;
  useEffect(() => {
    if (!temEntrada) return undefined;
    const proximo = (passo: () => void) =>
      janela?.requestAnimationFrame
        ? janela.requestAnimationFrame(passo)
        : setTimeout(passo, 16);
    let cancelado = false;
    proximo(() =>
      proximo(() => {
        if (!cancelado) setEntrada(null);
      }),
    );
    return () => {
      cancelado = true;
    };
  }, [temEntrada, janela]);

  // Piscar (3–7 s sorteados; às vezes duas vezes) — também com movimento reduzido.
  const olhosFechados = visivel === "dormindo";
  useEffect(() => {
    if (olhosFechados || ilustrada) return undefined;
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
  }, [olhosFechados, ilustrada, janela, rng]);

  // Às vezes as penas da cabeça arrepiam (parada ou atenta, com movimento).
  useEffect(() => {
    if (reduzido || simples || ilustrada) return undefined;
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
  }, [reduzido, simples, ilustrada, janela, rng]);

  // Ponteiro perto: atenta, e o olho acompanha (CSS vars, sem render por quadro).
  const acompanhar = livre && atencao && !reduzido;
  useEffect(() => {
    if (!acompanhar || !janela?.addEventListener) return undefined;
    // O svg da raiz é sempre desenhado: o mesmo nó do início vale na limpeza.
    const raizDoEfeito = refRaiz.current;
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
      raizDoEfeito?.style.removeProperty("--olho-x");
      raizDoEfeito?.style.removeProperty("--olho-y");
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

  if (ilustrada) {
    // A ilustrada mostra o pedido (ou a pose imposta) também com movimento reduzido.
    const poseDesejada: PoseDaArara = pose ?? pedido;
    const lado = Number(tamanho);
    const classesDaIlustrada = ["mascote", "mascote--ilustrada", className]
      .filter(Boolean)
      .join(" ");
    return (
      <span
        ref={refRaiz as RefObject<HTMLSpanElement | null>}
        className={classesDaIlustrada}
        style={{ "--mascote-tamanho": `${lado}px` } as CSSProperties}
        data-estado={poseDesejada}
        data-enquadramento={quadro}
        data-pedido={pedido}
        data-reduzido={reduzido ? "sim" : undefined}
        role={rotulo ? "img" : undefined}
        aria-label={rotulo || undefined}
        aria-hidden={rotulo ? undefined : "true"}
      >
        {moduloIlustrado ? (
          <moduloIlustrado.PosesDaArara
            pose={poseDesejada}
            tamanho={lado}
            rosto={enquadramento === "rosto"}
            reduzido={reduzido}
            livre={livre}
            janela={janela}
          />
        ) : null}
      </span>
    );
  }

  const viewBox = VIEWBOX;
  const classes = ["mascote", className].filter(Boolean).join(" ");
  return (
    <svg
      ref={refRaiz as RefObject<SVGSVGElement | null>}
      className={classes}
      viewBox={viewBox}
      width={tamanho}
      height={tamanho}
      data-estado={visivel}
      data-enquadramento={quadro}
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

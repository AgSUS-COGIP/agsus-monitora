/*
  A mascote da Aya: a arara-azul ilustrada, uma pose por estado (webp com
  transparência em imagens/; medidas e recorte do rosto em
  src/lib/aya/poses-da-aya.ts). A troca de pose é suave (a nova entra com
  fade e um pulinho, a antiga sai com fade); a parada só respira de leve. O
  movimento é de mascote.css (transform/opacity, por `data-estado`), nada
  passa pelo React a cada quadro.

  Estados (src/lib/aya/estado-da-aya.ts): parada, atenta, falando, pensando,
  comemorando, dormindo, acenando e apontando (o tour). Quem vence quando
  vários valem juntos é `resolverEstado`: estado fixo (prévia, fogos, tour) >
  pedido global `aya:estado` > o do painel (falando/pensando) > momento local
  (aceno de boas-vindas) > atenta (ponteiro perto) > dormindo (inatividade
  longa) > parada.

  Enquadramento: "corpo" (a arara inteira: painel aberto, fogos, prévia) ou
  "rosto" (a cabeça e um busto curto: a Aya fechada, no botão). Trocar o
  enquadramento na mesma arara aproxima ou afasta por transição de CSS (a
  caixa não muda de tamanho); `enquadramentoInicial` faz a arara nascer no
  outro e passar ao pedido logo depois (a ida do botão para o painel e a volta).

  Carga: cada arara baixa só a pose que mostra, no arquivo (1x ou 2x) que
  fica nítido no tamanho dela. A pose nova só entra depois de decodificada
  (sem piscar vazio). As araras livres (as que mudam de estado sozinhas)
  pedem as outras poses com prioridade baixa depois que a página carregou e o
  navegador ficou ocioso.

  Movimento reduzido: sem animação (a pose troca direto). Aba oculta:
  animações pausadas. Comemorações desligadas pela pessoa: não comemora.
*/

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties } from "react";
import {
  comemoracoesPessoaisDesligadas,
  deveAcenar,
  INATIVIDADE_PARA_DORMIR_MS,
  ponteiroPerto,
  resolverEstado,
  DURACAO_PADRAO_MS,
  ESTADOS_DA_MASCOTE,
  type EstadoDaMascote,
} from "../../../lib/aya/estado-da-aya.ts";
import {
  enquadramentoDoRosto,
  escolherArquivo,
  larguraNaTela,
  MEDIDAS_DAS_POSES,
  type ArquivoDaPose,
} from "../../../lib/aya/poses-da-aya.ts";
import { assinarPedidoDaAya, obterPedidoDaAya } from "./estado.ts";
import "./mascote.css";

/* Os arquivos (o Vite publica cada um com hash; o literal precisa ficar escrito). */
const ARQUIVOS: Readonly<
  Record<EstadoDaMascote, Readonly<Record<ArquivoDaPose, string>>>
> = {
  parada: {
    "1x": new URL("./imagens/arara-parada.webp", import.meta.url).href,
    "2x": new URL("./imagens/arara-parada-2x.webp", import.meta.url).href,
  },
  atenta: {
    "1x": new URL("./imagens/arara-atenta.webp", import.meta.url).href,
    "2x": new URL("./imagens/arara-atenta-2x.webp", import.meta.url).href,
  },
  falando: {
    "1x": new URL("./imagens/arara-falando.webp", import.meta.url).href,
    "2x": new URL("./imagens/arara-falando-2x.webp", import.meta.url).href,
  },
  pensando: {
    "1x": new URL("./imagens/arara-pensando.webp", import.meta.url).href,
    "2x": new URL("./imagens/arara-pensando-2x.webp", import.meta.url).href,
  },
  comemorando: {
    "1x": new URL("./imagens/arara-comemorando.webp", import.meta.url).href,
    "2x": new URL("./imagens/arara-comemorando-2x.webp", import.meta.url).href,
  },
  dormindo: {
    "1x": new URL("./imagens/arara-dormindo.webp", import.meta.url).href,
    "2x": new URL("./imagens/arara-dormindo-2x.webp", import.meta.url).href,
  },
  acenando: {
    "1x": new URL("./imagens/arara-acenando.webp", import.meta.url).href,
    "2x": new URL("./imagens/arara-acenando-2x.webp", import.meta.url).href,
  },
  apontando: {
    "1x": new URL("./imagens/arara-apontando.webp", import.meta.url).href,
    "2x": new URL("./imagens/arara-apontando-2x.webp", import.meta.url).href,
  },
};

/** O endereço do arquivo da pose (testes e prévia). */
export const enderecoDaPose = (pose: EstadoDaMascote, arquivo: ArquivoDaPose) =>
  ARQUIVOS[pose][arquivo];

/* A Aya fechada (o botão do canto), só o rosto: px de lado. */
export const ALTURA_DA_ARARA = 56;
/* A arara inteira no cabeçalho do painel aberto: px de lado. */
export const TAMANHO_NO_PAINEL = 88;
/* Quanto dura a troca de pose (a saída da antiga), em ms; igual a mascote.css. */
export const TROCA_DE_POSE_MS = 380;

export type Enquadramento = "corpo" | "rosto";

export interface PropsDaMascote {
  /** Estado imposto (prévia, fogos, tour): ignora pedidos, ponteiro e sono. */
  estado?: EstadoDaMascote | null;
  /** O que o painel da Aya está fazendo: "falando", "pensando"… */
  proprio?: EstadoDaMascote | null;
  /** Lado em px (a arara inteira cabe no quadrado). */
  tamanho?: number;
  /** A arara inteira ("corpo", padrão) ou só o rosto, de perto ("rosto"). */
  enquadramento?: Enquadramento;
  /** Nasce neste enquadramento e passa ao pedido logo depois (transição de entrada). */
  enquadramentoInicial?: Enquadramento | null;
  /** Ouve o evento global `aya:estado` (padrão: sim). */
  ouvirAya?: boolean;
  /** Fica atenta quando o ponteiro chega perto (padrão: sim). */
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
}

/* ---------- Carga das poses (fora do React: vale para todas as araras) ---------- */

type ImagemComPrioridade = HTMLImageElement & { fetchPriority?: string };

const preparadas = new Map<string, Promise<void>>();

/**
 * Baixa e decodifica o arquivo uma vez; resolve quando ele pode entrar sem
 * piscar vazio (ou se falhar: a troca não fica presa). Sem `decode` (jsdom),
 * resolve na hora.
 */
function prepararArquivo(endereco: string, janela: Window | undefined) {
  const pronta = preparadas.get(endereco);
  if (pronta) return pronta;
  const Imagem = (janela as (Window & typeof globalThis) | undefined)?.Image;
  let promessa: Promise<void> = Promise.resolve();
  if (Imagem) {
    const imagem = new Imagem() as ImagemComPrioridade;
    imagem.decoding = "async";
    imagem.fetchPriority = "low";
    imagem.src = endereco;
    if (typeof imagem.decode === "function")
      promessa = imagem.decode().catch(() => undefined);
  }
  preparadas.set(endereco, promessa);
  return promessa;
}

const variantesPedidas = new Set<ArquivoDaPose>();

/** Depois da carga da página, com o navegador ocioso: as outras poses, em prioridade baixa. */
function preCarregarPoses(arquivo: ArquivoDaPose, janela: Window | undefined) {
  if (!janela || variantesPedidas.has(arquivo)) return;
  variantesPedidas.add(arquivo);
  const pedir = () => {
    for (const pose of ESTADOS_DA_MASCOTE)
      void prepararArquivo(ARQUIVOS[pose][arquivo], janela);
  };
  const quandoOcioso = () => {
    if (typeof janela.requestIdleCallback === "function")
      janela.requestIdleCallback(pedir, { timeout: 5000 });
    else janela.setTimeout(pedir, 1500);
  };
  if (janela.document?.readyState === "complete") quandoOcioso();
  else janela.addEventListener?.("load", quandoOcioso, { once: true });
}

/** Só para testes: esquece o que já foi baixado. */
export function reiniciarPosesDaMascote() {
  preparadas.clear();
  variantesPedidas.clear();
}

/* ---------- Preferências da tela ---------- */

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

/* ---------- Uma pose na tela ---------- */

function Pose({
  pose,
  endereco,
  saindo,
  entrando,
}: {
  pose: EstadoDaMascote;
  endereco: string;
  saindo?: boolean;
  entrando?: boolean;
}) {
  const medidas = MEDIDAS_DAS_POSES[pose];
  const rosto = enquadramentoDoRosto(pose);
  const estilo = {
    "--pose-x": `${medidas.x * 100}%`,
    "--pose-y": `${medidas.y * 100}%`,
    "--pose-largura": `${medidas.largura * 100}%`,
    "--pose-altura": `${medidas.altura * 100}%`,
    "--rosto-x": `${rosto.x}%`,
    "--rosto-y": `${rosto.y}%`,
    "--rosto-escala": String(rosto.escala),
  } as CSSProperties;
  return (
    <span
      className="mascote__pose"
      data-pose={pose}
      data-saindo={saindo ? "sim" : undefined}
      data-entrando={entrando ? "sim" : undefined}
      style={estilo}
    >
      <img
        className="mascote__imagem"
        src={endereco}
        alt=""
        decoding="async"
        draggable={false}
      />
    </span>
  );
}

export function Mascote({
  estado: fixo = null,
  proprio = null,
  tamanho = 64,
  enquadramento = "corpo",
  enquadramentoInicial = null,
  ouvirAya = true,
  atencao = true,
  dormir = true,
  acenarAoEntrar = false,
  momentoInicial = null,
  rotulo,
  className,
  janela = globalThis.window,
}: PropsDaMascote) {
  const refRaiz = useRef<HTMLSpanElement | null>(null);
  const livre = !fixo;
  // Lido já no render: um tamanho inválido estoura aqui (a ErrorBoundary de quem monta segura).
  const lado = Number(tamanho);

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

  // O arquivo que fica nítido aqui (o rosto, ampliado, pede mais pixels).
  const densidade = Number(janela?.devicePixelRatio) || 1;
  const rosto = enquadramento === "rosto";
  const arquivoDe = (pose: EstadoDaMascote) =>
    escolherArquivo(pose, larguraNaTela(pose, lado, rosto), densidade);

  // A pose na tela segue o pedido depois que o arquivo dela estiver pronto.
  const [exibida, setExibida] = useState<EstadoDaMascote>(pedido);
  const [saindo, setSaindo] = useState<EstadoDaMascote | null>(null);
  const refExibida = useRef(exibida);
  refExibida.current = exibida;
  const enderecoPedido = ARQUIVOS[pedido][arquivoDe(pedido)];
  useEffect(() => {
    if (pedido === refExibida.current) return undefined;
    let cancelado = false;
    void prepararArquivo(enderecoPedido, janela).then(() => {
      if (cancelado) return;
      setSaindo(reduzido ? null : refExibida.current);
      setExibida(pedido);
    });
    return () => {
      cancelado = true;
    };
  }, [pedido, enderecoPedido, reduzido, janela]);

  // A antiga sai com fade e some no fim da troca.
  useEffect(() => {
    if (!saindo) return undefined;
    const tempo = setTimeout(() => setSaindo(null), TROCA_DE_POSE_MS);
    return () => clearTimeout(tempo);
  }, [saindo, exibida]);

  // As araras livres deixam as outras poses prontas (prioridade baixa, depois da carga).
  const arquivoDaParada = arquivoDe("parada");
  useEffect(() => {
    if (livre) preCarregarPoses(arquivoDaParada, janela);
  }, [livre, arquivoDaParada, janela]);

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

  // Ponteiro perto: atenta (mede uma vez por quadro, sem render por movimento).
  const vigiarPonteiro = livre && atencao;
  useEffect(() => {
    if (!vigiarPonteiro || !janela?.addEventListener) return undefined;
    let quadroPedido = 0;
    let ultimo: { x: number; y: number } | null = null;
    let pertoAgora = false;
    const medir = () => {
      quadroPedido = 0;
      const raiz = refRaiz.current;
      if (!raiz || !ultimo) return;
      const estaPerto = ponteiroPerto(raiz.getBoundingClientRect(), ultimo);
      if (estaPerto !== pertoAgora) {
        pertoAgora = estaPerto;
        setPerto(estaPerto);
      }
    };
    const aoMover = (evento: PointerEvent) => {
      ultimo = { x: evento.clientX, y: evento.clientY };
      if (!quadroPedido && janela.requestAnimationFrame)
        quadroPedido = janela.requestAnimationFrame(medir);
    };
    janela.addEventListener("pointermove", aoMover, { passive: true });
    return () => {
      janela.removeEventListener("pointermove", aoMover);
      if (quadroPedido) janela.cancelAnimationFrame?.(quadroPedido);
    };
  }, [vigiarPonteiro, janela]);

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

  // Aba oculta: pausa as animações de CSS.
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

  const classes = ["mascote", className].filter(Boolean).join(" ");
  const estilo = { "--mascote-tamanho": `${lado}px` } as CSSProperties;
  return (
    <span
      ref={refRaiz}
      className={classes}
      style={estilo}
      data-estado={exibida}
      data-pedido={pedido}
      data-enquadramento={quadro}
      data-reduzido={reduzido ? "sim" : undefined}
      role={rotulo ? "img" : undefined}
      aria-label={rotulo || undefined}
      aria-hidden={rotulo ? undefined : "true"}
    >
      <span className="mascote__movimento">
        {saindo && saindo !== exibida ? (
          <Pose
            key={`saindo-${saindo}`}
            pose={saindo}
            endereco={ARQUIVOS[saindo][arquivoDe(saindo)]}
            saindo
          />
        ) : null}
        <Pose
          key={exibida}
          pose={exibida}
          endereco={ARQUIVOS[exibida][arquivoDe(exibida)]}
          entrando={Boolean(saindo)}
        />
      </span>
    </span>
  );
}

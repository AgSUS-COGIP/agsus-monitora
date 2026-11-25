/*
  A arara ilustrada (3D) da Aya: as poses em webp de imagens/, postas no
  quadro pelas medidas de src/lib/aya/poses-da-aya.ts. É a arte das aparições
  grandes (painel aberto, tour, comemorações, prévia); a arara do canto segue
  no desenho em SVG (desenho.tsx). Vem num pedaço próprio do bundle, só quando
  a primeira `<Mascote ilustrada>` monta: nem o código, nem o CSS, nem as
  imagens entram na entrada.

  - Troca de pose: a nova só entra depois de decodificada (sem piscar vazio);
    entra com fade e um pulinho, a antiga sai com fade (mascote-ilustrada.css).
  - Carga: cada arara baixa só a pose que mostra, no arquivo (1x ou 2x) que
    fica nítido no tamanho e na densidade da tela. As araras livres (que mudam
    de estado sozinhas, como a do painel) pedem as outras poses com prioridade
    baixa depois que a página carregou e o navegador ficou ocioso.
  - Movimento reduzido: a pose troca direto, sem a antiga saindo.
*/

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  enquadramentoDoRosto,
  escolherArquivo,
  larguraNaTela,
  MEDIDAS_DAS_POSES,
  POSES_DA_ARARA,
  type ArquivoDaPose,
  type PoseDaArara,
} from "../../../lib/aya/poses-da-aya.ts";
import "./mascote-ilustrada.css";

/* Os arquivos (o Vite publica cada um com hash; o literal precisa ficar escrito). */
const ARQUIVOS: Readonly<
  Record<PoseDaArara, Readonly<Record<ArquivoDaPose, string>>>
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
export const enderecoDaPose = (pose: PoseDaArara, arquivo: ArquivoDaPose) =>
  ARQUIVOS[pose][arquivo];

/* Quanto dura a troca de pose (a saída da antiga), em ms; igual ao CSS. */
export const TROCA_DE_POSE_MS = 380;

/* ---------- Carga (fora do React: vale para todas as araras) ---------- */

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
    for (const pose of POSES_DA_ARARA)
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

/* ---------- Uma pose na tela ---------- */

function Pose({
  pose,
  endereco,
  saindo,
  entrando,
}: {
  pose: PoseDaArara;
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

export interface PropsDasPoses {
  /** A pose pedida (o estado resolvido pela `<Mascote>`, ou "apontando"). */
  pose: PoseDaArara;
  /** Lado do quadro, em px. */
  tamanho: number;
  /** O enquadramento pedido (o rosto ampliado pede mais pixels). */
  rosto: boolean;
  reduzido: boolean;
  /** Muda de estado sozinha (painel): pede as outras poses depois da carga. */
  livre: boolean;
  janela: Window | undefined;
}

/** As poses dentro da `<Mascote ilustrada>` (a caixa, o enquadramento e o estado são dela). */
export function PosesDaArara({
  pose,
  tamanho,
  rosto,
  reduzido,
  livre,
  janela,
}: PropsDasPoses) {
  const densidade = Number(janela?.devicePixelRatio) || 1;
  const arquivoDe = (qual: PoseDaArara) =>
    escolherArquivo(qual, larguraNaTela(qual, tamanho, rosto), densidade);

  // A pose na tela segue o pedido depois que o arquivo dela estiver pronto.
  const [exibida, setExibida] = useState<PoseDaArara>(pose);
  const [saindo, setSaindo] = useState<PoseDaArara | null>(null);
  const refExibida = useRef(exibida);
  refExibida.current = exibida;
  const enderecoPedido = ARQUIVOS[pose][arquivoDe(pose)];
  useEffect(() => {
    if (pose === refExibida.current) return undefined;
    let cancelado = false;
    void prepararArquivo(enderecoPedido, janela).then(() => {
      if (cancelado) return;
      setSaindo(reduzido ? null : refExibida.current);
      setExibida(pose);
    });
    return () => {
      cancelado = true;
    };
  }, [pose, enderecoPedido, reduzido, janela]);

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

  return (
    <span className="mascote__movimento" data-pose={exibida}>
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
  );
}

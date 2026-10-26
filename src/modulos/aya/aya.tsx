/*
  A Aya, assistente do MONITORA: o botão flutuante (a arara) e o painel de
  conversa, um cartão ancorado no canto inferior direito, por cima da página
  (que continua visível e rolável atrás). No celular (até 600px) o painel
  ocupa a tela.

  O que o painel antigo (src/modules/arara-guide.js, arara-speaking-effects.js
  e nina-panel-drag.js) fazia e continua aqui:
  - respostas da base: resposta direta dos verbetes de docs/aya, contexto da tela e,
    busca na base de conhecimento, sem servidor nem modelo local;
  - a conversa guardada na aba (aya-memoria.ts, sessionStorage), restaurada ao
    recarregar e apagada por "Limpar conversa";
  - aberto/fechado lembrado no navegador (mesma chave de antes);
  - a arara pode ser arrastada para outro lugar da tela, e a posição fica
    guardada (mesma chave de antes); clique sem arrastar abre o painel;
  - fechada, a arara mostra só o rosto (de perto); aberta, o painel mostra a
    arara inteira, maior, e o rosto se afasta até o corpo (e volta ao fechar);
  - solta encostada numa borda (ou empurrada com as setas, com o foco nela),
    a arara se esconde e fica espiando; passar o mouse ou focar a traz um
    pouco para fora, arrastar ou as setas a tiram da borda, e a borda fica
    guardada junto com a posição (src/lib/borda-da-aya.ts);
  - Enter envia, Shift+Enter quebra linha; até 1.200 caracteres;
  - origem de cada resposta ("Fonte oficial", "Base do MONITORA"…) e fontes oficiais;
  - o texto aparece aos poucos ("digitando"), menos com movimento reduzido.
  Novo: saudação e sugestões da página e da área atuais; botão que abre a
  tela citada na resposta; "Isso ajudou?" guardado só no navegador; e o
  cartão "Abrir chamado" (e-mail ao suporte) depois de um "não ajudou" ou
  quando a pessoa pede o suporte.

  Camada: z-index 10038 (aya.css), acima do cabeçalho (.top 10030) e da barra
  lateral (10036), abaixo dos menus das telas (10040) e do aviso de parabéns
  (10045).
*/

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  RefObject,
} from "react";
import { montarModulo } from "../../app/montar-modulo.tsx";
import { comemorar } from "../../modules/comemoracao.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import { Icone } from "../../componentes/icone.tsx";
import {
  acaoDaAya,
  blocosDoTexto,
  caracteresRevelados,
  duracaoDaRevelacao,
  paginaDaAya,
  SECOES_DA_AYA,
  SEGUNDA_MENSAGEM,
  VIEWS_DA_AYA,
} from "../../lib/aya-paginas.ts";
import {
  chaveDoTour,
  deveConvidar,
  passoParaRetomar,
  tourDaPagina,
  trilhasDoPerfil,
} from "../../lib/aya-tours.ts";
import { montarChamado, pedeSuporte } from "../../lib/chamado-da-aya.ts";
import { nomeDaArea } from "../../lib/menu-lateral.ts";
import { abrirSecaoDeConfiguracao } from "../configuracoes/secoes.ts";
import { collectAyaPageContext, estadoDaTela } from "./contexto.ts";
import { responderComDados } from "../../lib/dados-da-aya.ts";
import { isAdminGlobal } from "../../lib/access-roles.ts";
import {
  comPerguntaSemResposta,
  perguntasGuardadas,
  textoDasPerguntas,
} from "../../lib/perguntas-sem-resposta.ts";
import { pedirFiltro } from "../../app/pedido-de-filtro.ts";
import { criarFontesDaAya } from "./fontes.ts";
import {
  esquecerConversa,
  lerConversa,
  salvarConversa,
} from "../../modules/aya-memoria.ts";
import { assinarPaginaDaAya, obterPaginaDaAya } from "./estado.ts";
import { OfertaDePrimeirosPassos, SecaoAprender } from "./tour/aprender.tsx";
import {
  concluirTrilha,
  lerConvitesDeTour,
  lerProgressoDasTrilhas,
  marcarConviteDeTour,
  marcarOfertaDePrimeirosPassos,
  ofertaDePrimeirosPassosFeita,
  salvarPassoDaTrilha,
} from "./tour/progresso.ts";
import { acharAlvo, Tour } from "./tour/tour.tsx";
import {
  ALTURA_DA_ARARA,
  Mascote,
  TAMANHO_NO_PAINEL,
} from "./mascote/mascote.tsx";
import {
  bordaEncostada,
  lerPosicaoDaAya,
  passoDaSeta,
} from "../../lib/borda-da-aya.ts";
import type { BordaDaAya, PosicaoDaAya } from "../../lib/borda-da-aya.ts";
import type { AcaoDaAya, SugestaoDaAya } from "../../lib/aya-paginas.ts";
import type { PassoDoTour } from "../../lib/aya-tours.ts";
import type { FonteOficial } from "../../lib/busca-da-aya.ts";
import type { ChamadoDaAya } from "../../lib/chamado-da-aya.ts";
import type { MensagemDaConversa } from "../../lib/contexto-da-aya.ts";
import type {
  AcaoDaIntencao,
  FiltroDaAcao,
} from "../../lib/intencoes-da-aya.ts";
import type {
  PerguntaBruta,
  PerguntaSemResposta,
} from "../../lib/perguntas-sem-resposta.ts";
import type { MotivoDoFimDoTour } from "./tour/tour.tsx";

/* ---------- Tipos ---------- */

/** A janela do navegador (ou a dos testes). */
export type JanelaDaAya = Window & typeof globalThis;

/** A navegação do legado (src/app), posta em window. */
type JanelaDoLegado = Window & { navigate?: (view: string) => unknown };

/** Uma mensagem da conversa no painel. */
export interface MensagemDaAya {
  id: string;
  papel: "user" | "assistant";
  texto: string;
  restaurada?: boolean;
  provider?: string;
  fontes?: readonly FonteOficial[];
  acao?: string;
  acaoDados?: AcaoDaIntencao | null;
  sugestoes?: readonly SugestaoDaAya[];
  oferecerChamado?: boolean;
  avaliacao?: AvaliacaoDaResposta;
}

/** "Isso ajudou?": sim ou não. */
export type AvaliacaoDaResposta = "sim" | "nao";

/** O que o painel pergunta a quem responde (`perguntar`). */
export interface PerguntaDoPainel {
  question: string;
  section: string;
  title: string;
  area: string;
  secao: string;
  history: MensagemDaConversa[];
  doc: Document;
  perfil: unknown;
}

/** A resposta que o painel mostra (da base ou dos dados ao vivo). */
export interface RespostaDoPainel {
  answer?: string;
  provider?: string;
  sources?: readonly FonteOficial[];
  acao?: string;
  acaoDados?: AcaoDaIntencao | null;
  sugestoes?: readonly SugestaoDaAya[];
  oferecerChamado?: boolean;
  semResposta?: boolean;
  unavailable?: boolean;
}

export type PerguntarAAya = (
  opcoes: PerguntaDoPainel,
) => Promise<RespostaDoPainel | null>;

/** Um botão que leva a uma tela (a ação do verbete ou a dos dados ao vivo). */
type AcaoDeTela = Pick<AcaoDaAya, "view" | "secao"> & {
  filtro?: FiltroDaAcao;
};

/** O tour em curso: o da tela ou o de uma trilha. */
interface TourEmCurso {
  chave: string;
  trilha?: string;
  rotulo: string;
  passos: readonly PassoDoTour[];
  inicio: number;
}

/** O arraste da arara em andamento. */
interface ArrasteDaArara {
  id: number;
  x: number;
  y: number;
  left: number;
  top: number;
  moveu: boolean;
  desejada: { left: number; top: number } | null;
}

interface ManipuladoresDoArraste {
  onPointerDown(evento: PointerEvent<HTMLButtonElement>): void;
  onPointerMove(evento: PointerEvent<HTMLButtonElement>): void;
  onPointerUp(evento: PointerEvent<HTMLButtonElement>): void;
  onKeyDown(evento: KeyboardEvent<HTMLButtonElement>): void;
  onPointerCancel?: (evento: PointerEvent<HTMLButtonElement>) => void;
}

export interface PropsDaAya {
  perguntar?: PerguntarAAya;
  navegar?: (view: string) => unknown;
  abrirSecao?: (secao: string) => unknown;
  configuracao?: (chave: string) => unknown;
  obterPerfil?: () => unknown;
  janela?: JanelaDaAya;
}

/* As mesmas chaves do painel antigo: quem fechou a Aya ou moveu a arara continua assim. */
export const CHAVE_OCULTA = "agsus_monitora_arara_oculta_v1";
export const CHAVE_POSICAO_DA_ARARA =
  "agsus_monitora_nina_launcher_position_v1";
export const CHAVE_AVALIACOES = "agsus_aya_avaliacoes_v1";
export const CHAVE_SEM_RESPOSTA = "agsus_aya_perguntas_sem_resposta_v1";

const LIMITE_DE_AVALIACOES = 200;
/* Ao abrir o painel, a arara fica atenta por um instante. */
const ATENTA_AO_ABRIR = Object.freeze({ estado: "atenta", duracaoMs: 2200 });
const ARRASTE_MINIMO = 4;
const MARGEM = 8;

const ROTULO_DA_ORIGEM: Readonly<Record<string, string>> = Object.freeze({
  "curated-official": "Fonte oficial",
  "monitora-local-context": "Dados desta tela",
  "base-monitora": "Base do MONITORA",
  "monitora-dados": "Dados ao vivo",
  "monitora-perfil": "Seu acesso",
});

/* localStorage pode faltar (janela privada, bloqueio): a Aya funciona igual. */
function ler(janela: JanelaDaAya, chave: string): string | null {
  try {
    return janela.localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(janela: JanelaDaAya, chave: string, valor: string): void {
  try {
    janela.localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: só não lembra
  }
}

function registrarAvaliacao(
  janela: JanelaDaAya,
  avaliacao: Readonly<Record<string, unknown>>,
): void {
  let lista: unknown[] = [];
  try {
    lista = JSON.parse(ler(janela, CHAVE_AVALIACOES) || "[]");
    if (!Array.isArray(lista)) lista = [];
  } catch {
    lista = [];
  }
  lista.push(avaliacao);
  gravar(
    janela,
    CHAVE_AVALIACOES,
    JSON.stringify(lista.slice(-LIMITE_DE_AVALIACOES)),
  );
}

function lerSemResposta(janela: JanelaDaAya): PerguntaSemResposta[] {
  try {
    return perguntasGuardadas(
      JSON.parse(ler(janela, CHAVE_SEM_RESPOSTA) || "[]"),
    );
  } catch {
    return [];
  }
}

function guardarSemResposta(
  janela: JanelaDaAya,
  item: PerguntaBruta,
): PerguntaSemResposta[] {
  const lista = comPerguntaSemResposta(lerSemResposta(janela), item);
  gravar(janela, CHAVE_SEM_RESPOSTA, JSON.stringify(lista));
  return lista;
}

/*
  A resposta padrão: primeiro as perguntas com número (dados ao vivo, só
  leitura, pelas RPCs que a pessoa já pode chamar); depois a base de
  verbetes, com a aba e o edital da tela e o perfil de quem pergunta.
*/
let fontesPadrao: ReturnType<typeof criarFontesDaAya> | null = null;
/*
  A base de verbetes (busca-da-aya.ts e src/modules/aya-conhecimento-gerado.js,
  ~100 KB gzip) baixa na primeira pergunta ou ao abrir o painel
  (preCarregarBase), fora do pacote principal.
*/
let buscaDaBase: Promise<typeof import("../../lib/busca-da-aya.ts")> | null =
  null;
const preCarregarBase = () =>
  (buscaDaBase ??= import("../../lib/busca-da-aya.ts").catch((erro) => {
    buscaDaBase = null;
    throw erro;
  }));
async function perguntarPadrao(
  opcoes: PerguntaDoPainel,
): Promise<RespostaDoPainel> {
  const tela = estadoDaTela(opcoes.doc);
  fontesPadrao ||= criarFontesDaAya();
  const comDados = await responderComDados({
    pergunta: opcoes.question,
    contexto: { view: opcoes.section, area: opcoes.area, edital: tela.edital },
    perfil: opcoes.perfil,
    buscar: fontesPadrao.buscar,
  });
  if (comDados) return comDados;
  const { responderAya } = await preCarregarBase();
  return responderAya({
    ...opcoes,
    aba: tela.aba,
    context: collectAyaPageContext(opcoes.doc),
  });
}

const PEDE_TOUR =
  /\b(me mostr\w* (a |esta |essa )?tela|mostr\w* (esta|essa|a) tela|tour|item por item|passo a passo|educacao guiada|me (ensina|ensine) (a )?(usar )?(esta|essa|a) tela)\b/;
const normalizarPedido = (texto: string): string =>
  String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const ehApresentacaoGuardada = (turno: MensagemDaConversa | null | undefined) =>
  turno?.role === "assistant" &&
  /^ol[aá]! eu sou a aya\b/i.test(String(turno.content || "").trim());

let proximoId = 0;
const novoId = () => `aya-${Date.now().toString(36)}-${(proximoId += 1)}`;

function mensagensGuardadas(janela: JanelaDaAya): MensagemDaAya[] {
  return lerConversa(janela)
    .filter((turno) => !ehApresentacaoGuardada(turno))
    .map((turno) => ({
      id: novoId(),
      papel: turno.role,
      texto: turno.content,
      restaurada: true,
    }));
}

function movimentoReduzido(janela: JanelaDaAya): boolean {
  try {
    if (typeof janela.matchMedia !== "function") return true;
    return janela.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

function telaPequena(janela: JanelaDaAya): boolean {
  try {
    return janela.matchMedia?.("(max-width: 600px)").matches === true;
  } catch {
    return false;
  }
}

/* ---------- Texto da resposta, sem HTML ---------- */

function TextoEmBlocos({ texto }: { texto: string }) {
  return blocosDoTexto(texto).map((bloco, indice) => {
    if (bloco.tipo === "paragrafo") return <p key={indice}>{bloco.itens[0]}</p>;
    const Lista = bloco.tipo === "numerada" ? "ol" : "ul";
    return (
      <Lista key={indice}>
        {bloco.itens.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </Lista>
    );
  });
}

/* O texto aparece aos poucos; o leitor de tela recebe o texto inteiro de uma vez. */
function TextoRevelado({
  texto,
  animar,
  aoTerminar,
}: {
  texto: string;
  animar: boolean;
  aoTerminar?: () => void;
}) {
  const [visiveis, setVisiveis] = useState(() =>
    animar ? 1 : String(texto).length,
  );
  useEffect(() => {
    if (!animar || typeof requestAnimationFrame !== "function") {
      setVisiveis(String(texto).length);
      aoTerminar?.();
      return undefined;
    }
    const inicio = performance.now();
    const duracao = duracaoDaRevelacao(texto);
    let quadro = 0;
    const passo = (agora: number) => {
      const quantos = caracteresRevelados(texto, agora - inicio);
      setVisiveis(quantos);
      if (agora - inicio < duracao) quadro = requestAnimationFrame(passo);
      else aoTerminar?.();
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [texto, animar, aoTerminar]);

  const completo = visiveis >= String(texto).length;
  return (
    <>
      <span className="aya-visualmente-oculto">{texto}</span>
      <div className="aya-mensagem__texto" aria-hidden="true">
        {completo ? (
          <TextoEmBlocos texto={texto} />
        ) : (
          <p>{String(texto).slice(0, visiveis)}</p>
        )}
      </div>
    </>
  );
}

/* ---------- Uma mensagem ---------- */

function Avaliacao({
  mensagem,
  aoAvaliar,
}: {
  mensagem: MensagemDaAya;
  aoAvaliar: (mensagem: MensagemDaAya, valor: AvaliacaoDaResposta) => void;
}) {
  if (mensagem.avaliacao) {
    return (
      <p className="aya-avaliacao__obrigado" role="status">
        {mensagem.avaliacao === "sim"
          ? "Obrigada pela avaliação."
          : "Obrigada. Se quiser, abra um chamado abaixo."}
      </p>
    );
  }
  return (
    <div className="aya-avaliacao" role="group" aria-label="Isso ajudou?">
      <span>Isso ajudou?</span>
      <button
        type="button"
        className="aya-avaliacao__botao"
        aria-label="Ajudou"
        onClick={() => aoAvaliar(mensagem, "sim")}
      >
        <Icone nome="thumbs-up" tamanho={15} />
      </button>
      <button
        type="button"
        className="aya-avaliacao__botao"
        aria-label="Não ajudou"
        onClick={() => aoAvaliar(mensagem, "nao")}
      >
        <Icone nome="thumbs-down" tamanho={15} />
      </button>
    </div>
  );
}

function CartaoDoChamado({ chamado }: { chamado: ChamadoDaAya }) {
  return (
    <div className="aya-chamado" role="note" aria-label="Abrir chamado">
      <strong>Abrir chamado</strong>
      <p>
        Vou abrir o Gmail com a conversa preenchida. Revise antes de enviar.
      </p>
      <a
        className="aya-chamado__botao"
        href={chamado.href}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icone nome="mail" tamanho={15} />
        Abrir chamado no Gmail
      </a>
    </div>
  );
}

function Mensagem({
  mensagem,
  animar,
  aoTerminarRevelacao,
  aoAvaliar,
  aoAbrir,
  aoPerguntar,
  chamado,
}: {
  mensagem: MensagemDaAya;
  animar: boolean;
  aoTerminarRevelacao: () => void;
  aoAvaliar: (mensagem: MensagemDaAya, valor: AvaliacaoDaResposta) => void;
  aoAbrir: (acao: AcaoDeTela) => void;
  aoPerguntar: (pergunta: string) => unknown;
  chamado: ChamadoDaAya | null;
}) {
  if (mensagem.papel === "user") {
    return (
      <li className="aya-mensagem aya-mensagem--pessoa">
        <span className="aya-visualmente-oculto">Você: </span>
        <div className="aya-mensagem__texto">
          <TextoEmBlocos texto={mensagem.texto} />
        </div>
      </li>
    );
  }
  // Mensagem restaurada não tem `provider`: o rótulo fica vazio.
  const origem = ROTULO_DA_ORIGEM[mensagem.provider as string] || "";
  const acao = acaoDaAya(mensagem.acao);
  const fontes = Array.isArray(mensagem.fontes) ? mensagem.fontes : [];
  return (
    <li className="aya-mensagem aya-mensagem--aya">
      <span className="aya-visualmente-oculto">Aya: </span>
      <TextoRevelado
        texto={mensagem.texto}
        animar={animar}
        aoTerminar={aoTerminarRevelacao}
      />
      {origem || fontes.length ? (
        <div className="aya-mensagem__meta">
          {origem ? (
            <span className="aya-mensagem__origem">{origem}</span>
          ) : null}
          {fontes.map((fonte) => (
            <a
              key={fonte.url || fonte.label}
              href={String(fonte.url || "#")}
              target="_blank"
              rel="noopener noreferrer"
            >
              {String(fonte.label || "Fonte oficial")}
            </a>
          ))}
        </div>
      ) : null}
      {acao ? (
        <button
          type="button"
          className="aya-acao"
          onClick={() => aoAbrir(acao)}
        >
          {acao.rotulo}
          <Icone nome="arrow-right" tamanho={14} />
        </button>
      ) : null}
      {!acao && mensagem.acaoDados ? (
        <button
          type="button"
          className="aya-acao"
          onClick={() => aoAbrir(mensagem.acaoDados!)}
        >
          Abrir
          <Icone nome="arrow-right" tamanho={14} />
        </button>
      ) : null}
      {mensagem.sugestoes?.length ? (
        <div className="aya-sugestoes">
          {mensagem.sugestoes.map((s) => (
            <button
              type="button"
              className="aya-sugestao"
              key={s.pergunta}
              onClick={() => aoPerguntar(s.pergunta)}
            >
              {s.rotulo}
            </button>
          ))}
        </div>
      ) : null}
      {!mensagem.restaurada ? (
        <Avaliacao mensagem={mensagem} aoAvaliar={aoAvaliar} />
      ) : null}
      {chamado ? <CartaoDoChamado chamado={chamado} /> : null}
    </li>
  );
}

/* ---------- Arrastar a arara ---------- */

function lerPosicao(janela: JanelaDaAya): PosicaoDaAya | null {
  return lerPosicaoDaAya(ler(janela, CHAVE_POSICAO_DA_ARARA));
}

function limitarPosicao(
  janela: JanelaDaAya,
  elemento: Element | null,
  left: number,
  top: number,
): { left: number; top: number } {
  const caixa = elemento?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const maxLeft = Math.max(MARGEM, janela.innerWidth - caixa.width - MARGEM);
  const maxTop = Math.max(MARGEM, janela.innerHeight - caixa.height - MARGEM);
  return {
    left: Math.min(Math.max(MARGEM, left), maxLeft),
    top: Math.min(Math.max(MARGEM, top), maxTop),
  };
}

/*
  Onde a arara para: contida na janela e, se a posição desejada encostou numa
  borda, escondida nela. O tamanho vem de offsetWidth/Height (o translate de
  quem está escondida não conta).
*/
function pousar(
  janela: JanelaDaAya,
  elemento: HTMLElement | null,
  left: number,
  top: number,
): PosicaoDaAya {
  const contida = limitarPosicao(janela, elemento, left, top);
  const borda = bordaEncostada({
    left,
    top,
    largura: elemento?.offsetWidth || 0,
    altura: elemento?.offsetHeight || 0,
    larguraDaJanela: janela.innerWidth,
    alturaDaJanela: janela.innerHeight,
    margem: MARGEM,
  });
  if (!borda) return contida;
  // Escondida, encosta de vez na borda (a mesma folga de sempre).
  const extremo: Partial<Record<BordaDaAya, number>> = {
    esquerda: -Infinity,
    direita: Infinity,
  };
  const vertical: Partial<Record<BordaDaAya, number>> = {
    topo: -Infinity,
    baixo: Infinity,
  };
  return {
    ...limitarPosicao(
      janela,
      elemento,
      extremo[borda] ?? contida.left,
      vertical[borda] ?? contida.top,
    ),
    borda,
  };
}

function usarArraste(
  janela: JanelaDaAya,
  refBotao: RefObject<HTMLButtonElement | null>,
) {
  const [posicao, setPosicao] = useState<PosicaoDaAya | null>(() =>
    lerPosicao(janela),
  );
  const [arrastando, setArrastando] = useState(false);
  const arraste = useRef<ArrasteDaArara | null>(null);
  const ignorarClique = useRef(false);

  useEffect(() => {
    const aoRedimensionar = () =>
      setPosicao((atual) =>
        atual
          ? {
              ...atual,
              ...limitarPosicao(
                janela,
                refBotao.current,
                atual.left,
                atual.top,
              ),
            }
          : atual,
      );
    janela.addEventListener("resize", aoRedimensionar);
    return () => janela.removeEventListener("resize", aoRedimensionar);
  }, [janela, refBotao]);

  /* O canto de cima à esquerda de agora (escondida, o translate não conta). */
  function origem(elemento: Element): { left: number; top: number } {
    if (posicao) return { left: posicao.left, top: posicao.top };
    const caixa = elemento.getBoundingClientRect();
    return { left: caixa.left, top: caixa.top };
  }

  function guardar(final: PosicaoDaAya): void {
    gravar(janela, CHAVE_POSICAO_DA_ARARA, JSON.stringify(final));
  }

  const manipuladores: ManipuladoresDoArraste = {
    onPointerDown(evento) {
      if (evento.button !== undefined && evento.button !== 0) return;
      arraste.current = {
        id: evento.pointerId,
        x: evento.clientX,
        y: evento.clientY,
        ...origem(evento.currentTarget),
        moveu: false,
        desejada: null,
      };
      evento.currentTarget.setPointerCapture?.(evento.pointerId);
    },
    onPointerMove(evento) {
      const atual = arraste.current;
      if (!atual || atual.id !== evento.pointerId) return;
      const dx = evento.clientX - atual.x;
      const dy = evento.clientY - atual.y;
      if (!atual.moveu && Math.hypot(dx, dy) < ARRASTE_MINIMO) return;
      if (!atual.moveu) setArrastando(true);
      atual.moveu = true;
      atual.desejada = { left: atual.left + dx, top: atual.top + dy };
      // Durante o arraste ela sai da borda (a pessoa vê onde vai soltar).
      setPosicao(
        limitarPosicao(
          janela,
          refBotao.current,
          atual.desejada.left,
          atual.desejada.top,
        ),
      );
    },
    onPointerUp(evento) {
      const atual = arraste.current;
      if (!atual || atual.id !== evento.pointerId) return;
      evento.currentTarget.releasePointerCapture?.(evento.pointerId);
      arraste.current = null;
      if (!atual.moveu) return;
      ignorarClique.current = true;
      setArrastando(false);
      const final = pousar(
        janela,
        refBotao.current,
        atual.desejada!.left,
        atual.desejada!.top,
      );
      setPosicao(final);
      guardar(final);
    },
    /* As setas movem a arara (a alternativa ao arraste); contra a borda, ela se esconde. */
    onKeyDown(evento) {
      const passo = passoDaSeta(evento.key, evento.shiftKey);
      if (!passo || evento.altKey || evento.ctrlKey || evento.metaKey) return;
      evento.preventDefault();
      const { left, top } = origem(evento.currentTarget);
      const final = pousar(
        janela,
        refBotao.current,
        left + passo.dx,
        top + passo.dy,
      );
      setPosicao(final);
      guardar(final);
    },
  };
  manipuladores.onPointerCancel = manipuladores.onPointerUp;

  /* Depois de arrastar, o clique que o navegador dispara não abre o painel. */
  const consumirCliqueDoArraste = () => {
    if (!ignorarClique.current) return false;
    ignorarClique.current = false;
    return true;
  };
  return { posicao, arrastando, manipuladores, consumirCliqueDoArraste };
}

/* ---------- Foco preso no painel ---------- */

const FOCAVEIS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function prenderFoco(
  evento: KeyboardEvent<HTMLElement>,
  painel: HTMLElement | null,
): void {
  if (evento.key !== "Tab" || !painel) return;
  const focaveis = [...painel.querySelectorAll<HTMLElement>(FOCAVEIS)];
  if (!focaveis.length) return;
  const primeiro = focaveis[0]!;
  const ultimo = focaveis[focaveis.length - 1]!;
  const ativo = painel.ownerDocument.activeElement;
  if (evento.shiftKey && (ativo === primeiro || !painel.contains(ativo))) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && ativo === ultimo) {
    evento.preventDefault();
    primeiro.focus();
  }
}

/* ---------- A Aya ---------- */

const navegarPelaJanela = (view: string) =>
  (globalThis.window as JanelaDoLegado | undefined)?.navigate?.(view);
const abrirSecaoPadrao = (secao: string) =>
  abrirSecaoDeConfiguracao(globalThis.document, secao);
const configuracaoPublicada = (chave: string) =>
  estadoDasConfiguracoes.obter().valores?.get?.(chave) ?? "";

/*
  O balão da oferta fica junto da arara (ALTURA_DA_ARARA): em cima dela, ou
  embaixo quando ela foi arrastada para o alto da tela (o cabeçalho).
*/
function estiloDaOferta(
  posicao: PosicaoDaAya | null,
): CSSProperties | undefined {
  if (!posicao) return undefined;
  const emCima = posicao.top > 150;
  return {
    left: `${Math.max(MARGEM, posicao.left - 234)}px`,
    top: `${emCima ? posicao.top - 130 : posicao.top + ALTURA_DA_ARARA + 8}px`,
    right: "auto",
    bottom: "auto",
  };
}

const perfilDoLegado = () => globalThis.window?.getMonitoraProfile?.() || null;

export const ID_DOS_PRIMEIROS_PASSOS = "primeiros-passos";

export function Aya({
  perguntar = perguntarPadrao,
  navegar = navegarPelaJanela,
  abrirSecao = abrirSecaoPadrao,
  configuracao = configuracaoPublicada,
  obterPerfil = perfilDoLegado,
  janela = globalThis.window,
}: PropsDaAya) {
  const local = useSyncExternalStore(assinarPaginaDaAya, obterPaginaDaAya);
  const temArea = VIEWS_DA_AYA.includes(local.view);
  const nomeDaAreaAtual = temArea ? nomeDaArea(local.area) : "";
  const pagina = paginaDaAya({
    view: local.view,
    titulo: local.titulo,
    area: local.area,
    nomeDaArea: nomeDaAreaAtual,
    secao: local.secao,
  });

  const [aberta, setAberta] = useState(() => ler(janela, CHAVE_OCULTA) === "0");
  // Depois de o painel abrir uma vez, o rosto do botão nasce do corpo (a volta).
  const [rostoVemDoCorpo, setRostoVemDoCorpo] = useState(aberta);
  const [mensagens, setMensagens] = useState<MensagemDaAya[]>(() =>
    mensagensGuardadas(janela),
  );
  const [ocupada, setOcupada] = useState(false);
  const [texto, setTexto] = useState("");
  const [revelando, setRevelando] = useState("");
  const [chamadoPara, setChamadoPara] = useState("");
  const [semResposta, setSemResposta] = useState(() => lerSemResposta(janela));
  // Saída do sistema (esquecerConversaDaAya): a conversa na tela sai também.
  const conversaVista = useRef(local.conversa);
  useEffect(() => {
    if (conversaVista.current === local.conversa) return;
    conversaVista.current = local.conversa;
    setMensagens([]);
    setTexto("");
    setChamadoPara("");
    setRevelando("");
  }, [local.conversa]);
  const [copiado, setCopiado] = useState("");

  const refPainel = useRef<HTMLElement>(null);
  const refCampo = useRef<HTMLTextAreaElement>(null);
  const refArara = useRef<HTMLButtonElement>(null);
  const refCorpo = useRef<HTMLDivElement>(null);
  const devolverFocoAArara = useRef(false);
  const idDoTitulo = useId();
  const idDoCampo = useId();
  const { posicao, arrastando, manipuladores, consumirCliqueDoArraste } =
    usarArraste(janela, refArara);
  const borda = arrastando ? null : posicao?.borda || null;

  /* ---------- Tour da tela e trilhas ---------- */

  const perfil = obterPerfil();
  const tourDaTela = tourDaPagina({ ...local, perfil });
  const trilhas = trilhasDoPerfil(perfil);
  const [tour, setTour] = useState<TourEmCurso | null>(null);
  const [progresso, setProgresso] = useState(() =>
    lerProgressoDasTrilhas(janela),
  );
  const [oferta, setOferta] = useState(false);
  // Convite da primeira visita a esta tela: { chave, titulo } ou null.
  const [convite, setConvite] = useState<{
    chave: string;
    titulo: string;
  } | null>(null);
  const temPrimeirosPassos = trilhas.some(
    (t) => t.id === ID_DOS_PRIMEIROS_PASSOS,
  );

  // Primeira entrada: oferece "Primeiros passos" uma vez, sem abrir nada.
  useEffect(() => {
    if (!local.view || !temPrimeirosPassos || tour || oferta) return;
    if (ofertaDePrimeirosPassosFeita(janela)) return;
    marcarOfertaDePrimeirosPassos(janela);
    setOferta(true);
  }, [local.view, temPrimeirosPassos, tour, oferta, janela]);

  // Primeira visita a uma tela com tour: um convite discreto, uma vez só.
  // Espera a oferta dos Primeiros passos (que vem antes) e nunca durante um tour.
  const chaveDaTela = chaveDoTour(local);
  const temTourNaTela = Boolean(tourDaTela);
  const tituloDoTourDaTela = tourDaTela?.titulo || "";
  const temPerfil = Boolean(perfil);
  useEffect(() => {
    if (!local.view || !temTourNaTela || !temPerfil) return;
    const ocupado =
      Boolean(tour) ||
      oferta ||
      (temPrimeirosPassos && !ofertaDePrimeirosPassosFeita(janela));
    if (
      !deveConvidar({
        chave: chaveDaTela,
        feitos: lerConvitesDeTour(janela),
        ocupado,
      })
    ) {
      if (convite && convite.chave !== chaveDaTela) setConvite(null);
      return;
    }
    marcarConviteDeTour(janela, chaveDaTela);
    setConvite({ chave: chaveDaTela, titulo: tituloDoTourDaTela });
  }, [chaveDaTela, temTourNaTela, temPerfil, tour, oferta]);

  /* Leva à tela do passo da trilha; diz se precisou trocar de tela. */
  const irParaOPasso = useCallback(
    (passo: PassoDoTour) => {
      const [view, secao = ""] = String(passo.pagina || "").split(":");
      const agora = obterPaginaDaAya();
      if (agora.view === view && (!secao || agora.secao === secao))
        return false;
      if (agora.view !== view) navegar(view!);
      if (secao) abrirSecao(secao);
      return true;
    },
    [navegar, abrirSecao],
  );

  function celebrarFimDoTour(concluido: TourEmCurso | null): void {
    if (!concluido) return;
    const nome = String(concluido.rotulo || "").replace(/^(Tour|Trilha): /, "");
    comemorar({
      texto: concluido.trilha
        ? `Parabéns! Você concluiu a trilha "${nome}".`
        : `Parabéns! Você conheceu a tela ${nome}.`,
      // Efeito e intensidade: Configurações › Comemorações (padrão: fogos;
      // festa na trilha).
      marco: concluido.trilha ? "fim-da-trilha" : "fim-do-tour",
      // A trilha inteira ganha uma estrela no céu.
      forma: concluido.trilha ? "estrela" : null,
    });
  }

  function comecarTour(novo: TourEmCurso): void {
    setOferta(false);
    setConvite(null);
    setAberta(false);
    setTour(novo);
  }

  /* O tour da tela e da aba abertas agora (a aba se lê na hora do clique). */
  function mostrarEstaTela() {
    const { aba } = estadoDaTela(janela.document);
    const escolhido = tourDaPagina({ ...local, aba, perfil }) || tourDaTela;
    if (!escolhido) return false;
    // Só os itens que estão na tela agora (ou que aparecem ao abrir a aba
    // do passo), para o "Passo 3 de 9" contar o que a pessoa vai ver.
    const visiveis = escolhido.passos.filter(
      (p) => !p.alvo || p.antes || acharAlvo(p, janela.document),
    );
    comecarTour({
      chave: `tela:${escolhido.chave}`,
      rotulo: `Tour: ${escolhido.titulo}`,
      passos: visiveis.length ? visiveis : escolhido.passos,
      inicio: 0,
    });
    return true;
  }

  function iniciarTrilha(trilha: {
    id: string;
    titulo: string;
    passos: readonly PassoDoTour[];
  }): void {
    comecarTour({
      chave: `trilha:${trilha.id}`,
      trilha: trilha.id,
      rotulo: `Trilha: ${trilha.titulo}`,
      passos: trilha.passos,
      inicio: passoParaRetomar(progresso[trilha.id], trilha.passos.length),
    });
  }

  const aoMudarPassoDoTour = useCallback(
    (indice: number) => {
      if (tour?.trilha)
        setProgresso(salvarPassoDaTrilha(janela, tour.trilha, indice));
    },
    [tour, janela],
  );

  const aoFecharTour = useCallback(
    (motivo: MotivoDoFimDoTour) => {
      if (tour?.trilha && motivo === "concluiu")
        setProgresso(concluirTrilha(janela, tour.trilha));
      // Fim do tour com "Concluir": fogos; fim de uma trilha inteira: a festa.
      if (motivo === "concluiu") celebrarFimDoTour(tour);
      devolverFocoAArara.current = true;
      setTour(null);
    },
    [tour, janela],
  );

  // Ao sair do tour, o foco volta para a arara (depois que o tour sai da tela).
  useEffect(() => {
    if (tour || aberta || !devolverFocoAArara.current) return;
    devolverFocoAArara.current = false;
    refArara.current?.focus();
  }, [tour, aberta]);

  function aceitarOferta() {
    const trilha = trilhas.find((t) => t.id === ID_DOS_PRIMEIROS_PASSOS);
    setOferta(false);
    if (trilha) iniciarTrilha(trilha);
  }

  // A conversa vai para a aba a cada mudança (a apresentação nunca entra).
  useEffect(() => {
    salvarConversa(
      mensagens.map((m) => ({
        role: m.papel === "user" ? "user" : "assistant",
        content: m.texto,
      })),
      janela,
    );
  }, [mensagens, janela]);

  // Rolagem para a última mensagem.
  useLayoutEffect(() => {
    if (!aberta) return;
    // Só o corpo do cartão rola: a página atrás fica onde estava.
    const corpo = refCorpo.current;
    if (corpo) corpo.scrollTop = corpo.scrollHeight;
    // `revelando` volta a vazio quando o texto termina de aparecer: rola de novo.
  }, [aberta, mensagens.length, ocupada, chamadoPara, revelando]);

  useEffect(() => {
    if (aberta) {
      refCampo.current?.focus();
      // A base de verbetes baixa enquanto a pessoa digita.
      preCarregarBase().catch(() => {});
      return;
    }
    if (devolverFocoAArara.current) {
      devolverFocoAArara.current = false;
      refArara.current?.focus();
    }
  }, [aberta]);

  function abrir() {
    setAberta(true);
    setRostoVemDoCorpo(true);
    gravar(janela, CHAVE_OCULTA, "0");
  }

  const fechar = useCallback(() => {
    devolverFocoAArara.current = true;
    setAberta(false);
    gravar(janela, CHAVE_OCULTA, "1");
  }, [janela]);

  function limparConversa() {
    esquecerConversa(janela);
    setMensagens([]);
    setChamadoPara("");
    setRevelando("");
    refCampo.current?.focus();
  }

  const chamadoDe = (mensagem: { id: string; texto: string }): ChamadoDaAya => {
    const encontrado = mensagens.findIndex((m) => m.id === mensagem.id);
    const indice = encontrado < 0 ? mensagens.length : encontrado;
    const pergunta =
      [...mensagens.slice(0, indice)].reverse().find((m) => m.papel === "user")
        ?.texto || "";
    const secao =
      local.view === "config" ? SECOES_DA_AYA[local.secao]?.nome : "";
    return montarChamado({
      email: configuracao("support_email"),
      versao: configuracao("app_version_current"),
      pergunta,
      resposta: mensagem.texto,
      pagina: pagina.nome.split(" · ")[0],
      area: nomeDaAreaAtual,
      secao,
      registro: collectAyaPageContext(janela.document).registroAberto,
    });
  };

  /*
    O "Feedback e suporte" do topo: o registro aberto na tela sai de uma
    varredura do DOM (collectAyaPageContext). Ela roda quando a conversa ou a
    página mudam e de novo no clique, não a cada tecla no campo.
  */
  const ultimaResposta = useMemo(
    () =>
      [...mensagens].reverse().find((m) => m.papel === "assistant") || {
        id: "",
        texto: "",
      },
    [mensagens],
  );
  const hrefDoSuporte = useMemo(
    () => chamadoDe(ultimaResposta).href,
    // chamadoDe lê as mensagens, a página e a configuração do momento.
    [ultimaResposta, local, nomeDaAreaAtual],
  );
  const renovarSuporte = (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.currentTarget.href = chamadoDe(ultimaResposta).href;
  };

  async function enviar(pergunta: string): Promise<void> {
    const limpa = String(pergunta || "").trim();
    if (!limpa || ocupada) return;
    // "Me mostra esta tela", "tour", "item por item": começa o tour da tela.
    if (PEDE_TOUR.test(normalizarPedido(limpa)) && mostrarEstaTela()) {
      setTexto("");
      return;
    }
    const historico = mensagens.map((m): MensagemDaConversa => ({
      role: m.papel === "user" ? "user" : "assistant",
      content: m.texto,
    }));
    setMensagens((atuais) => [
      ...atuais,
      { id: novoId(), papel: "user", texto: limpa },
    ]);
    setTexto("");
    setOcupada(true);
    let resultado: RespostaDoPainel | null;
    try {
      resultado = await perguntar({
        question: limpa,
        section: local.view,
        title: local.titulo,
        area: local.area,
        secao: local.view === "config" ? local.secao : "",
        history: historico,
        doc: janela.document,
        perfil: obterPerfil(),
      });
    } catch {
      resultado = {
        answer:
          "Não consegui encontrar uma resposta. Escolha uma sugestão ou abra um chamado.",
        oferecerChamado: true,
        unavailable: true,
      };
    }
    const id = novoId();
    setMensagens((atuais) => [
      ...atuais,
      {
        id,
        papel: "assistant",
        texto:
          String(resultado?.answer || "").trim() ||
          "Não consegui responder agora.",
        provider: resultado?.provider || "base-monitora",
        fontes: resultado?.sources || [],
        acao: resultado?.acao || "",
        acaoDados: resultado?.acaoDados || null,
        sugestoes: resultado?.sugestoes || [],
        oferecerChamado: !!resultado?.oferecerChamado,
      },
    ]);
    if (resultado?.semResposta)
      setSemResposta(
        guardarSemResposta(janela, {
          pergunta: limpa,
          pagina: pagina.chave,
          motivo: "nao-entendeu",
          quando: new Date().toISOString(),
        }),
      );
    setRevelando(movimentoReduzido(janela) ? "" : id);
    if (pedeSuporte(limpa) || resultado?.oferecerChamado) setChamadoPara(id);
    setOcupada(false);
  }

  function avaliar(mensagem: MensagemDaAya, valor: AvaliacaoDaResposta): void {
    setMensagens((atuais) =>
      atuais.map((m) =>
        m.id === mensagem.id ? { ...m, avaliacao: valor } : m,
      ),
    );
    registrarAvaliacao(janela, {
      quando: new Date().toISOString(),
      pagina: pagina.chave,
      area: local.area,
      util: valor === "sim",
    });
    if (valor === "nao") {
      setChamadoPara(mensagem.id);
      const indice = mensagens.findIndex((m) => m.id === mensagem.id);
      const pergunta = [...mensagens.slice(0, Math.max(0, indice))]
        .reverse()
        .find((m) => m.papel === "user")?.texto;
      if (pergunta)
        setSemResposta(
          guardarSemResposta(janela, {
            pergunta,
            pagina: pagina.chave,
            motivo: "nao-ajudou",
            quando: new Date().toISOString(),
          }),
        );
    }
  }

  async function copiarSemResposta() {
    const texto = textoDasPerguntas(semResposta);
    try {
      await janela.navigator.clipboard.writeText(texto);
      setCopiado(`${semResposta.length} pergunta(s) copiada(s).`);
    } catch {
      setCopiado("Não consegui copiar. Tente de novo.");
    }
  }

  function abrirTela(acao: AcaoDeTela): void {
    if (acao.filtro && Object.keys(acao.filtro).length)
      pedirFiltro(acao.view, acao.filtro);
    if (acao.secao) {
      navegar("config");
      abrirSecao(acao.secao);
    } else {
      navegar(acao.view);
    }
    if (telaPequena(janela)) fechar();
  }

  const terminarRevelacao = useCallback(() => setRevelando(""), []);

  function aoTeclarNoPainel(evento: KeyboardEvent<HTMLElement>): void {
    if (evento.key === "Escape") {
      evento.stopPropagation();
      fechar();
      return;
    }
    prenderFoco(evento, refPainel.current);
  }

  function aoTeclarNoCampo(evento: KeyboardEvent<HTMLTextAreaElement>): void {
    if (
      evento.key !== "Enter" ||
      evento.shiftKey ||
      evento.nativeEvent?.isComposing
    )
      return;
    evento.preventDefault();
    void enviar(texto);
  }

  const semPergunta = !mensagens.some((m) => m.papel === "user");
  // A arara do painel acompanha a resposta: pensa enquanto busca, fala enquanto o texto aparece.
  const estadoDoPainel = ocupada ? "pensando" : revelando ? "falando" : null;
  const estiloDaArara = posicao
    ? {
        left: `${posicao.left}px`,
        top: `${posicao.top}px`,
        right: "auto",
        bottom: "auto",
      }
    : undefined;

  return (
    <div className="aya" data-aberta={aberta ? "sim" : "nao"}>
      {!aberta ? (
        <button
          ref={refArara}
          type="button"
          className="aya-arara"
          style={estiloDaArara}
          data-borda={borda || undefined}
          aria-label="Abrir a Aya, assistente do MONITORA"
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
          title={
            borda
              ? "Clique para abrir a Aya ou arraste para tirá-la da borda"
              : "Clique para abrir a Aya ou arraste para mover"
          }
          onClick={() => {
            if (consumirCliqueDoArraste()) return;
            abrir();
          }}
          {...manipuladores}
        >
          <span className="aya-figura">
            <Mascote
              tamanho={ALTURA_DA_ARARA}
              enquadramento="rosto"
              enquadramentoInicial={rostoVemDoCorpo ? "corpo" : null}
              acenarAoEntrar
              janela={janela}
            />
          </span>
          <span className="aya-arara__etiqueta" aria-hidden="true">
            Fale com a Aya
          </span>
        </button>
      ) : null}

      {convite && !oferta && !aberta && !tour ? (
        <OfertaDePrimeirosPassos
          estilo={estiloDaOferta(posicao)}
          rotulo={`Tour: ${convite.titulo}`}
          destaque={`Primeira vez em ${convite.titulo}?`}
          texto="Posso mostrar a tela item por item."
          aoAceitar={mostrarEstaTela}
          aoRecusar={() => setConvite(null)}
        />
      ) : null}

      {oferta && !aberta && !tour ? (
        <OfertaDePrimeirosPassos
          estilo={estiloDaOferta(posicao)}
          aoAceitar={aceitarOferta}
          aoRecusar={() => setOferta(false)}
        />
      ) : null}

      {tour ? (
        <Tour
          key={tour.chave}
          passos={tour.passos}
          inicio={tour.inicio}
          rotulo={tour.rotulo}
          irPara={irParaOPasso}
          aoMudarPasso={aoMudarPassoDoTour}
          aoFechar={aoFecharTour}
          janela={janela}
          documento={janela.document}
        />
      ) : null}

      {aberta ? (
        <section
          ref={refPainel}
          className="aya-painel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={idDoTitulo}
          aria-busy={ocupada ? "true" : undefined}
          onKeyDown={aoTeclarNoPainel}
        >
          <header className="aya-painel__cabecalho">
            <h2 id={idDoTitulo} className="aya-visualmente-oculto">
              Aya, assistente do MONITORA
            </h2>
            <div className="aya-apresentacao">
              <span className="aya-avatar aya-figura">
                <Mascote
                  tamanho={TAMANHO_NO_PAINEL}
                  enquadramentoInicial="rosto"
                  proprio={estadoDoPainel}
                  momentoInicial={ATENTA_AO_ABRIR}
                  janela={janela}
                />
              </span>
              <div className="aya-apresentacao__textos">
                <p className="aya-apresentacao__nome">
                  <span className="aya-balao">Olá, sou a Aya.</span>
                  <span className="aya-selo-beta aya-selo-beta--nome">
                    Beta
                  </span>
                </p>
                <span className="aya-painel__pagina">{pagina.nome}</span>
              </div>
            </div>
            <div className="aya-painel__acoes">
              {tourDaTela ? (
                <button
                  type="button"
                  className="aya-icone-botao"
                  aria-label="Me mostra esta tela"
                  title="Me mostra esta tela"
                  onClick={mostrarEstaTela}
                >
                  <Icone nome="compass" tamanho={17} />
                </button>
              ) : null}
              <a
                className="aya-icone-botao aya-suporte"
                aria-label="Feedback e suporte"
                title="Feedback e suporte"
                href={hrefDoSuporte}
                onClick={renovarSuporte}
                onAuxClick={renovarSuporte}
                onContextMenu={renovarSuporte}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icone nome="mail" tamanho={16} />
              </a>
              {isAdminGlobal(perfil) && semResposta.length ? (
                <button
                  type="button"
                  className="aya-icone-botao"
                  aria-label="Copiar perguntas sem resposta"
                  title="Copiar perguntas sem resposta"
                  onClick={copiarSemResposta}
                >
                  <Icone nome="copy" tamanho={16} />
                </button>
              ) : null}
              <button
                type="button"
                className="aya-icone-botao"
                aria-label="Limpar conversa"
                title="Limpar conversa"
                onClick={limparConversa}
                disabled={ocupada}
              >
                <Icone nome="rotate-ccw" tamanho={16} />
              </button>
              <button
                type="button"
                className="aya-icone-botao"
                aria-label="Fechar a Aya"
                title="Fechar"
                onClick={fechar}
              >
                <Icone nome="x" tamanho={18} />
              </button>
            </div>
          </header>

          {copiado ? (
            <p className="aya-visualmente-oculto" role="status">
              {copiado}
            </p>
          ) : null}
          <div className="aya-painel__corpo" ref={refCorpo}>
            <ol className="aya-mensagens aya-mensagens--inicio">
              <li className="aya-mensagem aya-mensagem--aya">
                <div className="aya-mensagem__texto">
                  <p>{pagina.intro}</p>
                </div>
              </li>
              <li className="aya-mensagem aya-mensagem--aya">
                <div className="aya-mensagem__texto">
                  <p>{SEGUNDA_MENSAGEM}</p>
                </div>
              </li>
            </ol>

            {oferta && !tour ? (
              <OfertaDePrimeirosPassos
                noPainel
                aoAceitar={aceitarOferta}
                aoRecusar={() => setOferta(false)}
              />
            ) : null}

            {semPergunta && tourDaTela ? (
              <div className="aya-sugestoes aya-sugestoes--inicio">
                <button
                  type="button"
                  className="aya-sugestao"
                  onClick={mostrarEstaTela}
                >
                  <Icone nome="compass" tamanho={14} />
                  Me mostra esta tela, item por item
                </button>
              </div>
            ) : null}

            {semPergunta ? (
              <SecaoAprender
                trilhas={trilhas}
                progresso={progresso}
                aoIniciar={iniciarTrilha}
                desabilitada={ocupada}
              />
            ) : null}

            <ol
              className="aya-mensagens"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label="Conversa com a Aya"
            >
              {mensagens.map((mensagem) => (
                <Mensagem
                  key={mensagem.id}
                  mensagem={mensagem}
                  animar={mensagem.id === revelando}
                  aoTerminarRevelacao={terminarRevelacao}
                  aoAvaliar={avaliar}
                  aoAbrir={abrirTela}
                  aoPerguntar={enviar}
                  chamado={
                    mensagem.id === chamadoPara ? chamadoDe(mensagem) : null
                  }
                />
              ))}
              {ocupada ? (
                <li className="aya-mensagem aya-mensagem--aya aya-mensagem--pendente">
                  <span role="status">Aya está analisando sua pergunta</span>
                  <span className="aya-pontos" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </li>
              ) : null}
            </ol>
          </div>

          <form
            className="aya-painel__rodape"
            onSubmit={(evento) => {
              evento.preventDefault();
              void enviar(texto);
            }}
          >
            <div className="aya-compositor">
              <label htmlFor={idDoCampo} className="aya-visualmente-oculto">
                Pergunte à Aya
              </label>
              <textarea
                id={idDoCampo}
                ref={refCampo}
                rows={1}
                maxLength={1200}
                placeholder="Pergunte à Aya…"
                autoComplete="off"
                value={texto}
                /* Ocupada, o campo fica só leitura (não disabled): disabled
                   tirava o foco de quem digita e a pessoa ia parar no <body>.
                   O envio já recusa enquanto a Aya pensa. */
                readOnly={ocupada}
                aria-disabled={ocupada || undefined}
                onChange={(evento) => setTexto(evento.target.value)}
                onKeyDown={aoTeclarNoCampo}
              />
              <button
                type="submit"
                className="aya-enviar"
                aria-label={ocupada ? "Aya está pensando" : "Enviar pergunta"}
                disabled={ocupada || !texto.trim()}
              >
                <Icone nome="arrow-up" tamanho={18} />
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

export function montarAya({
  elemento = globalThis.document?.getElementById("ayaApp"),
  ...opcoes
}: PropsDaAya & { elemento?: Element | null } = {}) {
  if (!elemento) return { raiz: null, desmontar: () => {} };
  const { raiz, desmontar } = montarModulo(elemento, <Aya {...opcoes} />, {
    nome: "Aya",
  });
  return { raiz, desmontar };
}

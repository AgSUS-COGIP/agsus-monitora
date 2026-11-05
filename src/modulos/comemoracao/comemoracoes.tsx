import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ErrorBoundary } from "../../app/ErrorBoundary.tsx";
import { filaDeComemoracoes } from "../../app/fila-de-comemoracoes.ts";
import { Icone } from "../../componentes/icone.tsx";
import {
  avancarCena,
  cenaAcabou,
  criarCena,
  desenharParticulasDoMotor,
  efeitoChamaAya,
  normalizarDuracao,
  DURACAO_PADRAO_MS,
} from "../../lib/motor-de-efeitos.ts";
import {
  opacidadeDoVeu,
  posicaoDaAya,
  somDoEstouro,
} from "../../lib/fogos-cena.ts";
import {
  definirEstadoDaAya,
  EVENTO_ESTADO_DA_AYA,
} from "../../lib/estado-da-aya.ts";
import { Mascote } from "../aya/mascote/mascote.tsx";
import {
  DPR_MAXIMO,
  amostrarTexto,
  criarHalos,
  desenhar,
  paletaDoTema,
  podeDesenhar,
  semMovimento,
} from "./desenho.ts";
import { criarSom } from "./som.ts";
import { planoDaComemoracao, TEMPO_DO_AVISO_MS } from "./plano.ts";
import "../../styles/comemoracao.css";
import type { TrajetoDaAya } from "../../lib/fogos-cena.ts";
import type { EstadoDaMascote } from "../../lib/estado-da-aya.ts";
import type { JanelaDaComemoracao } from "./desenho.ts";
import type { SomDasComemoracoes } from "./som.ts";
import type { ComemoracaoNaTela, OpcoesDaComemoracao } from "./plano.ts";

/*
  As comemorações em React, filhas da casca (src/app/casca/casca.tsx): o
  aviso no topo (role="status") com "Pular", o botão de som (desligado por
  padrão) e o ×, e o efeito escolhido (fogos, confete, serpentina, estrelas,
  corações, balões, a Aya comemorando ou o combinado — src/lib/motor-de-efeitos.ts)
  num <canvas>, com um véu escuro suave quando há fogos ou estrelas e a Aya
  (a mascote de verdade, src/modulos/aya/mascote/) atravessando a tela nos
  fogos. Com prefers-reduced-motion, só o aviso.

  Tudo vai por portal para o fim do body (como antes: o aviso e o canvas
  ficam por cima de tudo). O laço de quadros (requestAnimationFrame) é de
  `Fogos`: começa no efeito, para na limpeza (fim do show, Pular, ×, ou o
  componente desmontado — também no StrictMode, que monta duas vezes) e não
  desenha depois de parar. O canvas, o véu e a arara saem com o componente.

  Cada comemoração de marco passa `marco` (id do catálogo de
  src/lib/catalogo-de-comemoracoes.ts): Configurações › Comemorações decide
  se aparece, o efeito, a intensidade, a duração, o som e a mensagem; a
  preferência pessoal (neste navegador) também desliga. `teste: true` (botão
  Testar e Palco de testes) passa por cima das duas.

  A mascote comemora junto pelo evento `aya:estado` na janela (detail: {
  estado: "comemorando", duracaoMs }) e, ao terminar, `{ estado: "parada" }`.
*/

export const EVENTO_DA_AYA = EVENTO_ESTADO_DA_AYA;

/** A comemoração aberta: `fechar()` tira o aviso e o efeito. */
export interface ComemoracaoAberta {
  readonly id: number;
  fechar(): void;
}

/**
 * Aviso + efeito. Com `marco`, a configuração decide; desligado, nada
 * aparece (devolve null). `confete` (nome antigo) é a intensidade dos fogos
 * de quem não passa marco (false: só o aviso); `forma`, o marco no céu. Com
 * efeito, o aviso ganha "Pular" (some quando o efeito acaba) e o botão de
 * som; o × também encerra. Sem efeito quando a pessoa pediu menos movimento.
 */
export function comemorar({
  texto = "",
  itens = [],
  tituloDosItens = "",
  confete = "cheio",
  forma = null as ComemoracaoNaTela["forma"],
  marco = "",
  teste = false,
  efeito = null,
  intensidade = null,
  duracaoMs = null,
  som = false,
  doc = globalThis.document,
  janela = globalThis.window,
  aleatorio,
}: OpcoesDaComemoracao = {}): ComemoracaoAberta | null {
  const plano = planoDaComemoracao({
    marco,
    teste,
    confete,
    efeito,
    intensidade,
    duracaoMs,
    som,
    janela,
  });
  if (!plano || !doc?.body) return null;
  const id = filaDeComemoracoes.adicionar({
    texto: plano.mensagem || texto,
    itens,
    tituloDosItens,
    plano,
    animar: Boolean(plano.efeito) && !semMovimento(janela),
    forma: forma ?? null,
    doc,
    janela,
    aleatorio,
  });
  return { id, fechar: () => filaDeComemoracoes.remover(id) };
}

/** As comemorações na tela (a casca desenha enquanto houver alguma). */
export function Comemoracoes() {
  const fila = useSyncExternalStore(
    filaDeComemoracoes.assinar,
    filaDeComemoracoes.obter,
    filaDeComemoracoes.obter,
  );
  return (
    <>
      {fila.map((comemoracao) => (
        <ShowDaComemoracao key={comemoracao.id} comemoracao={comemoracao} />
      ))}
    </>
  );
}

function avisarAya(
  janela: JanelaDaComemoracao | undefined,
  estado: EstadoDaMascote,
  duracaoMs?: number,
) {
  try {
    definirEstadoDaAya(estado, duracaoMs, janela);
  } catch {
    /* sem mascote ou sem eventos: nada a fazer */
  }
}

/* O efeito pode rodar? A Aya só precisa do relógio; os outros, do canvas. */
function temEfeito({ animar, plano, doc, janela }: ComemoracaoNaTela) {
  if (!animar) return false;
  if (plano.efeito === "aya")
    return Boolean(doc.body && janela?.requestAnimationFrame);
  return podeDesenhar(doc, janela);
}

function ShowDaComemoracao({
  comemoracao: c,
}: {
  comemoracao: ComemoracaoNaTela;
}) {
  const fechar = useCallback(() => filaDeComemoracoes.remover(c.id), [c.id]);
  const [inicio] = useState(() => Date.now());
  const [comEfeito] = useState(() => temEfeito(c));
  const [rodando, definirRodando] = useState(comEfeito);
  const [som] = useState<SomDasComemoracoes | null>(() =>
    c.animar ? criarSom(c.janela, { ligadoPorPadrao: c.plano.som }) : null,
  );
  const [somLigado, definirSomLigado] = useState(() => som?.ligado ?? false);
  const terminar = useCallback(() => definirRodando(false), []);

  // Sem efeito, o aviso fecha no tempo de leitura; com efeito, quando ele
  // acaba — mas nunca antes do tempo de leitura (um efeito curto não o corta).
  useEffect(() => {
    if (rodando) return undefined;
    const relogio = setTimeout(
      fechar,
      Math.max(0, TEMPO_DO_AVISO_MS - (Date.now() - inicio)),
    );
    return () => clearTimeout(relogio);
  }, [rodando, fechar, inicio]);

  // O áudio fecha com o aviso (e volta a nascer se o StrictMode remontar).
  useEffect(() => () => som?.fechar(), [som]);

  const rotuloDoSom = somLigado ? "Desligar som" : "Ligar som";
  return createPortal(
    <>
      <div className="comemoracao" role="status" aria-live="polite">
        <div className="comemoracao__corpo">
          <strong>{c.texto}</strong>
          {c.itens.length ? (
            <>
              {c.tituloDosItens ? <span>{c.tituloDosItens}</span> : null}
              <ul>
                {c.itens.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        {comEfeito ? (
          <div className="comemoracao__acoes">
            <button
              type="button"
              className="comemoracao__som"
              aria-pressed={somLigado}
              aria-label={rotuloDoSom}
              title={rotuloDoSom}
              onClick={() => definirSomLigado(Boolean(som?.alternar()))}
            >
              <Icone nome={somLigado ? "volume-2" : "volume-x"} tamanho={16} />
            </button>
            {rodando ? (
              <button
                type="button"
                className="comemoracao__pular"
                onClick={terminar}
              >
                Pular
              </button>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          className="comemoracao__fechar"
          aria-label="Fechar mensagem"
          onClick={fechar}
        >
          ×
        </button>
      </div>
      {rodando ? (
        c.plano.efeito === "aya" ? (
          <SoAAya comemoracao={c} aoTerminar={terminar} />
        ) : (
          <Fogos comemoracao={c} som={som} aoTerminar={terminar} />
        )
      ) : null}
    </>,
    c.doc.body,
  );
}

/* "Aya comemorando": nada a desenhar; o evento e um relógio para o fim. */
function SoAAya({
  comemoracao: { plano, janela },
  aoTerminar,
}: {
  comemoracao: ComemoracaoNaTela;
  aoTerminar: () => void;
}) {
  useEffect(() => {
    const duracao = normalizarDuracao(plano.duracaoMs) ?? DURACAO_PADRAO_MS;
    avisarAya(janela, "comemorando", duracao);
    const relogio = setTimeout(aoTerminar, duracao);
    return () => {
      clearTimeout(relogio);
      avisarAya(janela, "parada");
    };
  }, [plano, janela, aoTerminar]);
  return null;
}

/* A arara dos fogos na posição do quadro (transform, sem redesenhar o React). */
function moverAya(imagem: HTMLElement, trajeto: TrajetoDaAya, t: number) {
  const aya = posicaoDaAya(trajeto, t);
  if (!aya) return;
  const meio = trajeto.tamanho / 2;
  imagem.style.opacity = String(aya.opacidade);
  imagem.style.transform = `translate(${aya.x - meio}px, ${aya.y - meio}px) rotate(${aya.rotacao}rad) scale(${aya.escalaX}, ${aya.escalaY})`;
}

/*
  O efeito no canvas. A cena nasce uma vez (o sorteio é dela); o laço de
  quadros anda no efeito e para na limpeza. Os fogos apagam o quadro
  anterior aos poucos (rastro) e o motor limpa tudo a cada quadro: um canvas
  para cada, quando há os dois. Aba oculta: não avança.
*/
function Fogos({
  comemoracao: c,
  som,
  aoTerminar,
}: {
  comemoracao: ComemoracaoNaTela;
  som: SomDasComemoracoes | null;
  aoTerminar: () => void;
}) {
  const { doc, janela } = c;
  const [montagem] = useState(() => {
    const largura = janela?.innerWidth || 800;
    const altura = janela?.innerHeight || 600;
    const cena = criarCena({
      efeito: c.plano.efeito!,
      intensidade: c.plano.intensidade!,
      duracaoMs: c.plano.duracaoMs,
      largura,
      altura,
      paleta: paletaDoTema(doc, janela!),
      // Com a mascote comemorando, a arara voando dos fogos fica de fora.
      comAya: !efeitoChamaAya(c.plano.efeito!),
      forma: c.forma,
      aleatorio: c.aleatorio ?? Math.random,
      amostrarTexto: (texto) => amostrarTexto(doc, janela!, texto),
    });
    return {
      cena,
      largura,
      altura,
      dpr: Math.min(DPR_MAXIMO, Math.max(1, janela?.devicePixelRatio || 1)),
      halo: criarHalos(doc),
    };
  });
  const { cena, largura, altura, dpr, halo } = montagem;
  const show = cena.show;
  const motorSeparado = Boolean(cena.lotes.length && show);
  const fogosRef = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<HTMLCanvasElement>(null);
  const veuRef = useRef<HTMLDivElement>(null);
  const ayaRef = useRef<HTMLSpanElement>(null);
  const [ayaNoCeu, definirAyaNoCeu] = useState(Boolean(show?.aya));
  const terminarRef = useRef(aoTerminar);
  terminarRef.current = aoTerminar;

  useEffect(() => {
    const contextoDe = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return null;
      canvas.width = Math.round(largura * dpr);
      canvas.height = Math.round(altura * dpr);
      let contexto: CanvasRenderingContext2D | null = null;
      try {
        contexto = canvas.getContext?.("2d") || null;
      } catch {
        contexto = null;
      }
      contexto?.setTransform?.(dpr, 0, 0, dpr, 0, 0);
      return contexto;
    };
    const fogos = contextoDe(fogosRef.current);
    const motor = cena.lotes.length
      ? motorSeparado
        ? contextoDe(motorRef.current)
        : fogos
      : null;
    // A arara do canto (e a do painel) comemora junto, pelo evento global.
    avisarAya(janela, "comemorando", Math.round(cena.duracao * 1000));
    let ativo = true;
    let anterior: number | null = null;
    let ayaFora = !show?.aya;
    const quadro = (agora: number) => {
      if (!ativo) return;
      const dt =
        anterior === null || doc.hidden ? 0 : (agora - anterior) / 1000;
      anterior = agora;
      avancarCena(cena, dt);
      if (show && fogos) desenhar(fogos, show, { largura, altura, dt, halo });
      if (motor) {
        motor.clearRect?.(0, 0, largura, altura);
        desenharParticulasDoMotor(motor, cena);
      }
      if (veuRef.current)
        veuRef.current.style.opacity = String(
          opacidadeDoVeu(cena.t, cena.duracao),
        );
      if (show?.aya && !ayaFora) {
        if (show.t > show.aya.inicio + show.aya.duracao) {
          // Depois do voo, a arara sai da página; o show continua.
          ayaFora = true;
          definirAyaNoCeu(false);
        } else if (ayaRef.current) moverAya(ayaRef.current, show.aya, show.t);
      }
      for (const evento of cena.eventos.splice(0))
        som?.tocar?.(somDoEstouro(evento));
      if (cenaAcabou(cena)) {
        ativo = false;
        terminarRef.current();
      } else janela?.requestAnimationFrame(quadro);
    };
    janela?.requestAnimationFrame(quadro);
    return () => {
      // O quadro que estava na fila não volta a desenhar.
      ativo = false;
      avisarAya(janela, "parada");
    };
  }, [cena, show, motorSeparado, largura, altura, dpr, halo, doc, janela, som]);

  const estiloDaAya = useMemo<CSSProperties | undefined>(
    () =>
      show?.aya
        ? {
            width: `${show.aya.tamanho}px`,
            height: `${show.aya.tamanho}px`,
            opacity: 0,
          }
        : undefined,
    [show],
  );
  const veuApagado = useMemo<CSSProperties>(() => ({ opacity: 0 }), []);

  return (
    <>
      {cena.comVeu ? (
        <div
          ref={veuRef}
          className="comemoracao__veu"
          aria-hidden="true"
          style={veuApagado}
        />
      ) : null}
      <canvas
        ref={fogosRef}
        className="comemoracao__fogos"
        aria-hidden="true"
      />
      {motorSeparado ? (
        <canvas
          ref={motorRef}
          className="comemoracao__fogos comemoracao__motor"
          aria-hidden="true"
        />
      ) : null}
      {show?.aya && ayaNoCeu ? (
        <span
          ref={ayaRef}
          className="comemoracao__aya"
          aria-hidden="true"
          style={estiloDaAya}
        >
          <ErrorBoundary nome="a arara da comemoração">
            <Mascote
              estado="comemorando"
              poleiro={false}
              tamanho={show.aya.tamanho}
              ouvirAya={false}
              atencao={false}
              dormir={false}
            />
          </ErrorBoundary>
        </span>
      ) : null}
    </>
  );
}

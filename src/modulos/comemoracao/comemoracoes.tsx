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
  posicaoNaDanca,
  somDoEstouro,
} from "../../lib/fogos-cena.ts";
import { LIMITE_DE_PARTICULAS } from "../../lib/fogos.ts";
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
import {
  AJUSTE_DA_QUALIDADE,
  criarMedidor,
  registrarQuadro,
} from "./desempenho.ts";
import { planoDaComemoracao, TEMPO_DO_AVISO_MS } from "./plano.ts";
import "../../styles/comemoracao.css";
import type { PosicaoDaAya } from "../../lib/fogos-cena.ts";
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
  fogos e, no Normal e no Festa, voltando no fim para dançar, dar uma
  cambalhota e soltar confete. Com prefers-reduced-motion, só o aviso.

  Tudo vai por portal para o fim do body (como antes: o aviso e o canvas
  ficam por cima de tudo). O laço de quadros (requestAnimationFrame) é de
  `Fogos`: começa no efeito, para na limpeza (fim do show, Pular, ×, ou o
  componente desmontado — também no StrictMode, que monta duas vezes) e não
  desenha depois de parar. O canvas, o véu e a arara saem com o componente.
  Com a aba escondida, nada avança nem desenha. Se o computador não dá
  conta (src/modulos/comemoracao/desempenho.ts), a qualidade cai sozinha.

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
 * de quem não passa marco (false: só o aviso); `forma`, o marco no céu;
 * `letreiro`, o texto escrito no céu no fim dos fogos (sem ele, o do marco
 * ou, no Festa, "Parabéns!"). Com
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
  letreiro,
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
    letreiro,
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
function moverAya(
  imagem: HTMLElement,
  aya: PosicaoDaAya | null,
  tamanho: number,
) {
  if (!aya) return;
  const meio = tamanho / 2;
  imagem.style.opacity = String(aya.opacidade);
  imagem.style.transform = `translate(${aya.x - meio}px, ${aya.y - meio}px) rotate(${aya.rotacao}rad) scale(${aya.escalaX}, ${aya.escalaY})`;
}

/*
  Em que parte do show a arara está: voando (no começo), esperando, dançando
  (no fim, no Normal e no Festa) ou já fora. Cada aparição é um elemento
  próprio: o do voo sai da página antes de a dança começar.
*/
type FaseDaAya = "voo" | "espera" | "danca" | "fora";

function AraraDaComemoracao({
  aoMontar,
  tamanho,
  danca = false,
}: {
  aoMontar: (elemento: HTMLSpanElement | null) => void;
  tamanho: number;
  danca?: boolean;
}) {
  const estilo = useMemo<CSSProperties>(
    () => ({ width: `${tamanho}px`, height: `${tamanho}px`, opacity: 0 }),
    [tamanho],
  );
  return (
    <span
      ref={aoMontar}
      className={
        danca ? "comemoracao__aya comemoracao__aya--danca" : "comemoracao__aya"
      }
      aria-hidden="true"
      style={estilo}
    >
      <ErrorBoundary nome="a arara da comemoração">
        <Mascote
          estado="comemorando"
          poleiro={false}
          tamanho={tamanho}
          ouvirAya={false}
          atencao={false}
          dormir={false}
        />
      </ErrorBoundary>
    </span>
  );
}

/*
  O efeito no canvas. A cena nasce uma vez (o sorteio é dela); o laço de
  quadros anda no efeito e para na limpeza. Os fogos apagam o quadro
  anterior aos poucos (rastro) e o motor limpa tudo a cada quadro: um canvas
  para cada, quando há os dois (o do confete da Aya dançando só entra
  quando ela vai soltá-lo). Aba oculta: não avança nem desenha. Quadros
  lentos baixam a qualidade (menos partículas e halos; no fim, densidade de
  pixels 1).
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
      letreiro: c.plano.letreiro,
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
  const motorSeparado = Boolean(cena.usaMotor && show);
  // Só com o confete da dança, o canvas do motor entra perto da hora.
  const [motorNaTela, definirMotorNaTela] = useState(
    motorSeparado && cena.lotes.length > 0,
  );
  const fogosRef = useRef<HTMLCanvasElement>(null);
  const motorRef = useRef<HTMLCanvasElement>(null);
  const veuRef = useRef<HTMLDivElement>(null);
  const ayaRef = useRef<HTMLSpanElement | null>(null);
  const [fase, definirFase] = useState<FaseDaAya>(
    show?.aya ? "voo" : show?.danca ? "espera" : "fora",
  );
  const terminarRef = useRef(aoTerminar);
  terminarRef.current = aoTerminar;
  const guardarAya = useCallback((elemento: HTMLSpanElement | null) => {
    ayaRef.current = elemento;
  }, []);

  useEffect(() => {
    let dprAtual = dpr;
    const contextoDe = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return null;
      canvas.width = Math.round(largura * dprAtual);
      canvas.height = Math.round(altura * dprAtual);
      let contexto: CanvasRenderingContext2D | null = null;
      try {
        contexto = canvas.getContext?.("2d") || null;
      } catch {
        contexto = null;
      }
      contexto?.setTransform?.(dprAtual, 0, 0, dprAtual, 0, 0);
      return contexto;
    };
    let fogos = contextoDe(fogosRef.current);
    const contextoDoMotor = () =>
      cena.usaMotor
        ? motorSeparado
          ? contextoDe(motorRef.current)
          : fogos
        : null;
    let motor = contextoDoMotor();
    let motorPedido = Boolean(motor);
    // A arara do canto (e a do painel) comemora junto, pelo evento global.
    avisarAya(janela, "comemorando", Math.round(cena.duracao * 1000));
    // O desempenho: o teto e as faíscas de partida, que a qualidade reduz.
    const medidor = criarMedidor();
    const base = {
      limiteDoShow: show?.limite ?? LIMITE_DE_PARTICULAS,
      fator: show?.fator ?? 1,
      limiteDoMotor: cena.limite,
    };
    const baixarQualidade = () => {
      const ajuste = AJUSTE_DA_QUALIDADE[medidor.qualidade];
      if (show) {
        show.limite = Math.round(base.limiteDoShow * ajuste.particulas);
        show.fator = base.fator * ajuste.faiscas;
      }
      cena.limite = Math.round(base.limiteDoMotor * ajuste.particulas);
      // No nível mais baixo, sem a densidade de pixels extra (refaz o canvas).
      if (medidor.qualidade === 0 && dprAtual > 1) {
        dprAtual = 1;
        fogos = contextoDe(fogosRef.current);
        motor = contextoDoMotor();
      }
    };
    let ativo = true;
    let anterior: number | null = null;
    let faseAtual: FaseDaAya = show?.aya
      ? "voo"
      : show?.danca
        ? "espera"
        : "fora";
    const mudarFase = (proxima: FaseDaAya) => {
      if (proxima === faseAtual) return;
      faseAtual = proxima;
      definirFase(proxima);
    };
    const quadro = (agora: number) => {
      if (!ativo) return;
      if (doc.hidden) {
        // Aba escondida: nada anda nem desenha; volta de onde parou.
        anterior = null;
        janela?.requestAnimationFrame(quadro);
        return;
      }
      const dt = anterior === null ? 0 : (agora - anterior) / 1000;
      anterior = agora;
      if (registrarQuadro(medidor, dt * 1000)) baixarQualidade();
      avancarCena(cena, dt);
      if (motorSeparado && !motor) {
        // O canvas do confete: pede um pouco antes e pega quando aparecer.
        if (motorRef.current) motor = contextoDoMotor();
        else if (
          !motorPedido &&
          show?.danca &&
          show.t >= show.danca.confete - 0.3
        ) {
          motorPedido = true;
          definirMotorNaTela(true);
        }
      }
      const qualidade = medidor.qualidade;
      if (show && fogos)
        desenhar(fogos, show, { largura, altura, dt, halo, qualidade });
      if (motor) {
        motor.clearRect?.(0, 0, largura, altura);
        desenharParticulasDoMotor(motor, cena);
      }
      if (veuRef.current)
        veuRef.current.style.opacity = String(
          opacidadeDoVeu(cena.t, cena.duracao),
        );
      if (show?.aya && faseAtual === "voo") {
        if (show.t > show.aya.inicio + show.aya.duracao)
          // Depois do voo, a arara sai da página; o show continua.
          mudarFase(show.danca ? "espera" : "fora");
        else if (ayaRef.current)
          moverAya(
            ayaRef.current,
            posicaoDaAya(show.aya, show.t),
            show.aya.tamanho,
          );
      }
      if (show?.danca && (faseAtual === "espera" || faseAtual === "danca")) {
        const posicao = posicaoNaDanca(show.danca, show.t);
        if (posicao) {
          mudarFase("danca");
          if (ayaRef.current)
            moverAya(ayaRef.current, posicao, show.danca.tamanho);
        } else if (faseAtual === "danca") mudarFase("fora");
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
      {motorSeparado && motorNaTela ? (
        <canvas
          ref={motorRef}
          className="comemoracao__fogos comemoracao__motor"
          aria-hidden="true"
        />
      ) : null}
      {show?.aya && fase === "voo" ? (
        <AraraDaComemoracao
          key="voo"
          aoMontar={guardarAya}
          tamanho={show.aya.tamanho}
        />
      ) : null}
      {show?.danca && fase === "danca" ? (
        <AraraDaComemoracao
          key="danca"
          aoMontar={guardarAya}
          tamanho={show.danca.tamanho}
          danca
        />
      ) : null}
    </>
  );
}

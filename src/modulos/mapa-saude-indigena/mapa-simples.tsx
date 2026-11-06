import type { CSSProperties } from "react";
import type { LeafletDoMapa } from "./tipos-do-leaflet.ts";
import type { MapaDoPainel } from "./tipos-do-painel.ts";
import type {
  ColorirPor,
  IndicadorDoDsei,
  PinturaDoMapaSimples,
} from "../../lib/mapa-saude-indigena/mapa-simples.ts";
import type { ContornoDoDsei } from "../../lib/mapa-saude-indigena/contornos-dos-dseis.ts";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  OPCOES_DE_COLORIR,
  TOKEN_SEM_DADO,
  ZOOM_DO_ROTULO_PEQUENO,
  colorirValido,
  dicaDoDseiSimples,
} from "../../lib/mapa-saude-indigena/mapa-simples.ts";
import { carregarContornosDosDseis } from "../../lib/mapa-saude-indigena/contornos-dos-dseis.ts";
import {
  EVENTO_DO_FUNDO,
  MODO_SIMPLES,
  modoDesejadoDoFundo,
  type ModoDoFundo,
} from "../../modules/map-base-layer-switcher.ts";
import { carregarContornos, podeFlutuar } from "./leaflet.ts";
import { usarUltimo } from "./usar-ultimo.ts";

/*
  O "MAPA DSEIs" NO LEAFLET

  Quando a pessoa escolhe "Mapa DSEIs" no seletor do fundo
  (`map-base-layer-switcher.ts`), o mapa fica sem azulejos e este módulo
  desenha, num pane próprio abaixo das Terras Indígenas: a silhueta do Brasil,
  os 34 DSEIs chapados (contornos locais, `contornos-dos-dseis.ts`) e o número
  de cada um no meio. As regras (números, faixas, cores, dica) estão em
  `src/lib/mapa-saude-indigena/mapa-simples.ts`.

  - A cor é um token por DSEI (`--mapa-simples-*`), posto no `style` do
    caminho: troca de "Colorir por" ou de tema não redesenha nada.
  - Passar o mouse num DSEI realça o polígono e a linha da lista, e
    vice-versa (`realce`); o clique abre o DSEI, como a bolha e a lista.
  - As divisas das UFs e o contorno do Brasil (`desenharContornos`) ficam por
    cima, no pane de sempre, sem clique.
*/

const PANE_DOS_DSEIS = "agsus-mapa-simples";
const PANE_DOS_ROTULOS = "agsus-mapa-simples-rotulos";
const PANE_DO_REALCE = "agsus-mapa-simples-realce";
const CLASSE_DOS_ROTULOS_PEQUENOS = "mapa-simples--rotulos-pequenos";
const CHAVE_DO_COLORIR = "agsus_mapa_simples_colorir_v1";

/* O modo do fundo do mapa: o pedido ao seletor e, depois, cada troca avisada. */
export function usarModoDoFundo(mapa: MapaDoPainel | null): ModoDoFundo {
  const [modo, definirModo] = useState<ModoDoFundo>("map");
  useEffect(() => {
    if (!mapa) return undefined;
    definirModo(modoDesejadoDoFundo(mapa));
    const elemento = mapa.getContainer?.();
    if (!elemento) return undefined;
    const ouvir = (evento: Event) => {
      const novo: unknown = (evento as CustomEvent<{ mode?: unknown }>).detail
        ?.mode;
      if (novo === "map" || novo === "satellite" || novo === MODO_SIMPLES)
        definirModo(novo as ModoDoFundo);
    };
    elemento.addEventListener(EVENTO_DO_FUNDO, ouvir);
    return () => elemento.removeEventListener(EVENTO_DO_FUNDO, ouvir);
  }, [mapa]);
  return modo;
}

/* "Colorir por", lembrado neste navegador (sem armazenamento, vale até recarregar). */
export function usarColorirPor(): [ColorirPor, (valor: ColorirPor) => void] {
  const [valor, definirValor] = useState<ColorirPor>(() => {
    try {
      return colorirValido(localStorage.getItem(CHAVE_DO_COLORIR));
    } catch {
      return colorirValido(null);
    }
  });
  const definir = useCallback((novo: ColorirPor) => {
    definirValor(novo);
    try {
      localStorage.setItem(CHAVE_DO_COLORIR, novo);
    } catch {
      // a escolha vale até recarregar
    }
  }, []);
  return [valor, definir];
}

/* O que este módulo usa de uma camada do Leaflet (polígono, rótulo, grupo). */
interface ElementoDaCamada {
  getElement?(): Element | null | undefined;
}
interface CamadaDoMapaSimples {
  addTo(alvo: unknown): CamadaDoMapaSimples;
  on?(evento: string, ouvinte: () => void): unknown;
  bindTooltip?(conteudo: () => HTMLElement, opcoes?: object): unknown;
  eachLayer?(ouvinte: (camada: ElementoDaCamada) => void): unknown;
  closeTooltip?(): unknown;
}
interface GrupoDoMapaSimples {
  addTo(alvo: unknown): GrupoDoMapaSimples;
  addLayer(camada: unknown): unknown;
  clearLayers(): unknown;
}

function caminhosDe(camada: CamadaDoMapaSimples): Element[] {
  const caminhos: Element[] = [];
  camada.eachLayer?.((filha) => {
    const elemento = filha.getElement?.();
    if (elemento) caminhos.push(elemento);
  });
  return caminhos;
}

function criarPane(
  mapa: MapaDoPainel,
  nome: string,
  zIndex: string,
  { semPonteiro = false } = {},
) {
  const pane = mapa.getPane?.(nome) || mapa.createPane?.(nome);
  if (!pane) return undefined;
  pane.style.zIndex = zIndex;
  if (semPonteiro) pane.style.pointerEvents = "none";
  return nome;
}

/* O conteúdo da dica, montado pelo DOM (sem `innerHTML`). */
function dicaEmElemento(texto: string) {
  const elemento = document.createElement("span");
  elemento.className = "mapa-simples__dica";
  elemento.textContent = texto;
  return elemento;
}

export interface OpcoesDoMapaSimples {
  L: LeafletDoMapa | null;
  mapa: MapaDoPainel | null;
  ativo: boolean;
  indicadores: readonly IndicadorDoDsei[];
  pintura: PinturaDoMapaSimples;
  realce: number | null;
  aoRealcar(numero: number | null): void;
  aoEscolher(numero: number): void;
  /** Só para os testes: os contornos sem o arquivo. */
  carregar?: () => Promise<ContornoDoDsei[]>;
}

/*
  Desenha o Mapa DSEIs enquanto `ativo`; ao sair dele (ou ao desmontar),
  tira tudo do mapa. Os contornos chegam uma vez (`carregarContornosDosDseis`).
*/
export function usarMapaSimples({
  L,
  mapa,
  ativo,
  indicadores,
  pintura,
  realce,
  aoRealcar,
  aoEscolher,
  carregar = carregarContornosDosDseis,
}: OpcoesDoMapaSimples) {
  const poligonos = useRef(new Map<number, CamadaDoMapaSimples>());
  // O contorno de cada número, para o traço do realce (desenhado por cima).
  const formas = useRef(new Map<number, ContornoDoDsei>());
  const [desenhados, definirDesenhados] = useState(0);
  const atuais = usarUltimo({ indicadores, aoRealcar, aoEscolher });

  useEffect(() => {
    if (!L?.geoJSON || !mapa || !ativo) return undefined;
    let cancelado = false;
    const desenhadosAgora = poligonos.current;
    const formasAgora = formas.current;
    const geoJSON = L.geoJSON.bind(L);
    const pane = criarPane(mapa, PANE_DOS_DSEIS, "245");
    const paneDosRotulos = criarPane(mapa, PANE_DOS_ROTULOS, "450");
    const grupo = L.layerGroup() as unknown as GrupoDoMapaSimples;
    grupo.addTo(mapa);
    const comPane = (nome: string | undefined) => (nome ? { pane: nome } : {});

    void Promise.all([carregar(), carregarContornos().catch(() => null)]).then(
      ([contornos, brasil]) => {
        if (cancelado) return;
        if (brasil?.BR_OUTLINE) {
          grupo.addLayer(
            geoJSON(brasil.BR_OUTLINE, {
              ...comPane(pane),
              interactive: false,
              className: "mapa-simples__pais",
            }),
          );
        }
        const flutua = podeFlutuar();
        for (const contorno of contornos) {
          const { numero, rotulo } = contorno.properties;
          const camada = geoJSON(contorno, {
            ...comPane(pane),
            className: "mapa-simples__dsei",
            attribution: "Contornos dos DSEIs: Funai",
          }) as unknown as CamadaDoMapaSimples;
          camada.on?.("mouseover", () => atuais.current.aoRealcar(numero));
          camada.on?.("mouseout", () => atuais.current.aoRealcar(null));
          camada.on?.("click", () => atuais.current.aoEscolher(numero));
          if (flutua) {
            camada.bindTooltip?.(
              () => {
                const ind = atuais.current.indicadores.find(
                  (i) => i.numero === numero,
                );
                return dicaEmElemento(
                  ind
                    ? dicaDoDseiSimples(ind)
                    : `${numero} · ${contorno.properties.nome}`,
                );
              },
              { sticky: true, direction: "top" },
            );
          }
          grupo.addLayer(camada);
          desenhadosAgora.set(numero, camada);
          formasAgora.set(numero, contorno);

          const numeroNoMapa = document.createElement("span");
          numeroNoMapa.className = "mapa-simples__rotulo";
          numeroNoMapa.textContent = String(numero);
          grupo.addLayer(
            L.marker(rotulo, {
              ...comPane(paneDosRotulos),
              icon: L.divIcon({
                className: "mapa-simples__rotulo-caixa",
                html: numeroNoMapa,
                iconSize: [28, 20],
                iconAnchor: [14, 10],
              }),
              interactive: false,
              keyboard: false,
            }),
          );
        }
        definirDesenhados((n) => n + 1);
      },
    );

    // Rótulo menor com o Brasil inteiro à vista.
    const elemento = mapa.getContainer?.();
    const aoZoom = () =>
      elemento?.classList.toggle(
        CLASSE_DOS_ROTULOS_PEQUENOS,
        mapa.getZoom() < ZOOM_DO_ROTULO_PEQUENO,
      );
    aoZoom();
    mapa.on("zoomend", aoZoom);

    return () => {
      cancelado = true;
      mapa.off("zoomend", aoZoom);
      elemento?.classList.remove(CLASSE_DOS_ROTULOS_PEQUENOS);
      grupo.clearLayers();
      mapa.removeLayer(grupo as never);
      desenhadosAgora.clear();
      formasAgora.clear();
    };
  }, [L, mapa, ativo, carregar, atuais]);

  // A cor de cada DSEI: o token no `style` do caminho (o tema muda sozinho).
  useEffect(() => {
    for (const [numero, camada] of poligonos.current) {
      const token = pintura.tokens.get(numero);
      for (const caminho of caminhosDe(camada)) {
        if (!(caminho instanceof SVGElement || caminho instanceof HTMLElement))
          continue;
        caminho.style.setProperty("fill", token ? `var(${token})` : "");
        caminho.setAttribute("data-dsei", String(numero));
        caminho.classList.toggle(
          "mapa-simples__dsei--sem-dado",
          token === TOKEN_SEM_DADO,
        );
      }
    }
  }, [pintura, desenhados]);

  /*
    O realce: o traço do DSEI vai num pane próprio, por cima dos vizinhos e
    sem ponteiro. Antes o próprio polígono subia (`bringToFront`, que
    reanexa o <path>) — no meio do `mouseover` dele. O navegador perdia o
    `mouseout` desse caminho, a dica "sticky" não fechava e, passando o mouse
    pelo mapa, as dicas se acumulavam (dez caixas abertas na produção). Agora
    o polígono não sai do lugar, e só o DSEI realçado fica com a dica aberta.
  */
  useEffect(() => {
    for (const [numero, camada] of poligonos.current) {
      const ativoAgora = numero === realce;
      for (const caminho of caminhosDe(camada))
        caminho.classList.toggle("is-realce", ativoAgora);
      if (!ativoAgora) camada.closeTooltip?.();
    }
    const forma = realce == null ? undefined : formas.current.get(realce);
    if (!L?.geoJSON || !mapa || !forma) return undefined;
    const pane = criarPane(mapa, PANE_DO_REALCE, "246", { semPonteiro: true });
    const traco = L.geoJSON(forma, {
      ...(pane ? { pane } : {}),
      interactive: false,
      className: "mapa-simples__realce",
    }) as unknown as CamadaDoMapaSimples;
    traco.addTo(mapa);
    return () => {
      mapa.removeLayer(traco as never);
    };
  }, [L, mapa, realce, desenhados]);

  return desenhados;
}

/* A amostra da cor de um token (decorativa). */
function AmostraDoToken({ token }: { token: string }) {
  const estilo: CSSProperties & { "--mapa-simples-cor"?: string } = {
    "--mapa-simples-cor": `var(${token})`,
  };
  return (
    <i className="mapa-simples__amostra" style={estilo} aria-hidden="true" />
  );
}

/*
  A legenda do Mapa DSEIs: "Colorir por" (rádios nativos: setas e Tab de
  graça), as faixas da cor com o texto de cada uma, e o interruptor dos pontos
  (sedes dos DSEIs e CASAIs nacionais), desligados de início.
*/
export function LegendaDoMapaSimples({
  pintura,
  aoColorir,
  mostrarPontos,
  aoMostrarPontos,
}: {
  pintura: PinturaDoMapaSimples;
  aoColorir(valor: ColorirPor): void;
  mostrarPontos: boolean;
  aoMostrarPontos(valor: boolean): void;
}) {
  const nome = useId();
  return (
    <div className="mapa-simples__legenda">
      <fieldset className="mapa-simples__colorir">
        <legend className="mapa-si-legenda__subtitulo">Colorir por</legend>
        {OPCOES_DE_COLORIR.map((opcao) => (
          <label key={opcao.valor} className="mapa-simples__opcao">
            <input
              type="radio"
              name={nome}
              value={opcao.valor}
              checked={pintura.colorirPor === opcao.valor}
              onChange={() => aoColorir(opcao.valor)}
            />
            <span>{opcao.rotulo}</span>
          </label>
        ))}
      </fieldset>
      {pintura.legenda.length ? (
        <ul
          className="mapa-simples__faixas"
          aria-label={`Faixas de ${pintura.titulo}`}
        >
          {pintura.legenda.map((item) => (
            <li
              key={item.token + item.rotulo}
              className="mapa-si-legenda__item"
              data-sem-dado={item.semDado ? "true" : undefined}
            >
              <AmostraDoToken token={item.token} />
              {item.rotulo}
            </li>
          ))}
        </ul>
      ) : null}
      {/*
        Liga/desliga legível nos dois estados. Era o chip das fases das
        terras (`.mapa-si-terra-fase`), que desligado sai riscado e esmaecido:
        os pontos, desligados de início, pareciam um item indisponível.
      */}
      <button
        type="button"
        className="mapa-simples__pontos"
        aria-pressed={mostrarPontos}
        onClick={() => aoMostrarPontos(!mostrarPontos)}
      >
        <span className="mapa-simples__interruptor" aria-hidden="true" />
        <span>Sedes e CASAIs</span>
      </button>
    </div>
  );
}

/* A amostra do número do DSEI na lista, com a cor do polígono. */
export function NumeroDoDsei({
  numero,
  token,
}: {
  numero: number;
  token?: string;
}) {
  const estilo: CSSProperties & { "--mapa-simples-cor"?: string } = token
    ? { "--mapa-simples-cor": `var(${token})` }
    : {};
  return (
    <span
      className="mapa-si-territorio__numero"
      style={estilo}
      aria-hidden="true"
    >
      {numero}
    </span>
  );
}

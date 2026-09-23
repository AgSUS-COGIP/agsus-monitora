/*
  O MAPA VETORIAL DENTRO DO LEAFLET

  Ver `src/lib/mapa-vetorial.js` para o porquê. Aqui fica o como: carregar o
  MapLibre só quando há mapa, e pô-lo como uma camada do Leaflet que anda com
  os marcadores.

  Não há plugin: o `maplibre-gl-leaflet` não está no cdnjs, e é código que
  mexe em privados do MapLibre (`_actualCanvas`, `_getTransformForUpdate`) que
  mudam de versão para versão. Esta camada usa só a API pública do MapLibre
  (`jumpTo`, `redraw`, `resize`). Do Leaflet usa um privado, e um só:
  `_latLngBoundsToNewLayerBounds`, que é o que o próprio `L.ImageOverlay` usa
  na animação de zoom — mudaria junto com ele.

  Medido na bancada (`bench/mapa-vetorial-na-bancada.html`), com o MapLibre e
  o OpenFreeMap reais: o fundo fica a menos de 0,6 px dos marcadores parado,
  depois de arrastar, em zoom fracionado e durante a animação de zoom.

  QUANDO FALHA, O MAPA CONTINUA

  Sem WebGL, com o cdnjs bloqueado ou com o estilo a não chegar, `aoFalhar` é
  chamado e quem usa esta camada volta ao OpenStreetMap em imagem, que nunca
  saiu de onde estava — só estava escondido.
*/
import {
  ATRIBUICAO_DO_MAPA,
  ESTILO_DO_MAPA,
  FOLGA_DO_VETORIAL,
  MAPLIBRE_CSS,
  MAPLIBRE_JS,
  caixaDoVetorial,
  zoomDoMapLibre,
} from "../lib/mapa-vetorial.js";

const ESPERA_DO_SCRIPT_MS = 15000;
const ESPERA_DO_ESTILO_MS = 20000;

export function suportaWebGL(documento = globalThis.document) {
  try {
    const tela = documento.createElement("canvas");
    return Boolean(tela.getContext("webgl2") || tela.getContext("webgl"));
  } catch {
    return false;
  }
}

/*
  Uma promessa por página: os dois mapas (o nacional e o do DSEI) partilham o
  mesmo MapLibre, e uma falha também — não se tenta de novo a cada mapa.
*/
let carregamento = null;

export function carregarMaplibre({
  documento = globalThis.document,
  janela = globalThis,
  esperaMs = ESPERA_DO_SCRIPT_MS,
} = {}) {
  if (janela.maplibregl) return Promise.resolve(janela.maplibregl);
  if (carregamento) return carregamento;

  carregamento = new Promise((resolve, reject) => {
    if (!suportaWebGL(documento)) {
      reject(new Error("Este navegador não tem WebGL"));
      return;
    }

    if (!documento.querySelector("link[data-agsus-maplibre]")) {
      const folha = documento.createElement("link");
      folha.rel = "stylesheet";
      folha.href = MAPLIBRE_CSS.url;
      folha.integrity = MAPLIBRE_CSS.integridade;
      folha.crossOrigin = "anonymous";
      folha.referrerPolicy = "no-referrer";
      folha.dataset.agsusMaplibre = "css";
      documento.head.append(folha);
    }

    const script = documento.createElement("script");
    script.src = MAPLIBRE_JS.url;
    script.integrity = MAPLIBRE_JS.integridade;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.async = true;
    script.dataset.agsusMaplibre = "js";

    const relogio = setTimeout(
      () => reject(new Error("O MapLibre não carregou a tempo")),
      esperaMs,
    );
    script.onload = () => {
      clearTimeout(relogio);
      if (janela.maplibregl) resolve(janela.maplibregl);
      else reject(new Error("O MapLibre carregou sem expor maplibregl"));
    };
    script.onerror = () => {
      clearTimeout(relogio);
      reject(new Error("O MapLibre não carregou (cdnjs indisponível?)"));
    };
    documento.head.append(script);
  });
  return carregamento;
}

/** Só para os testes: esquece o carregamento guardado. */
export function esquecerCarregamento() {
  carregamento = null;
}

export function criarCamadaVetorial(L, maplibregl, opcoes = {}) {
  const Camada = L.Layer.extend({
    options: {
      // No painel dos azulejos: herda os filtros de contraste e de tema escuro
      // que o CSS já aplica ao fundo (`health-map-contrast.css`).
      pane: "tilePane",
      attribution: ATRIBUICAO_DO_MAPA,
      estilo: ESTILO_DO_MAPA,
      folga: FOLGA_DO_VETORIAL,
      esperaDoEstiloMs: ESPERA_DO_ESTILO_MS,
    },

    initialize(config) {
      L.setOptions(this, config);
      this._pronto = false;
      this._falhou = false;
    },

    onAdd(map) {
      this._map = map;
      if (!this._container) {
        this._container = L.DomUtil.create("div", "agsus-mapa-vetorial");
        if (map.options.zoomAnimation && L.Browser?.any3d) {
          L.DomUtil.addClass(this._container, "leaflet-zoom-animated");
        }
      }
      map.getPane(this.options.pane).appendChild(this._container);
      if (this._gl) this._atualizar();
      else this._criarMapaDoMapLibre();
    },

    onRemove() {
      // O MapLibre fica vivo: voltar do satélite para o mapa não recarrega nada.
      this._container?.remove();
    },

    getEvents() {
      return {
        moveend: this._atualizar,
        zoomend: this._atualizar,
        viewreset: this._atualizar,
        resize: this._atualizar,
        zoomanim: this._animarZoom,
      };
    },

    getAttribution() {
      return this.options.attribution;
    },

    estaPronta() {
      return this._pronto && !this._falhou;
    },

    _criarMapaDoMapLibre() {
      this._aplicarCaixa();
      const centro = this._map.getCenter();
      try {
        this._gl = new maplibregl.Map({
          container: this._container,
          style: this.options.estilo,
          center: [centro.lng, centro.lat],
          zoom: zoomDoMapLibre(this._map.getZoom()),
          interactive: false,
          attributionControl: false,
        });
      } catch (erro) {
        this._falhar(erro);
        return;
      }
      this._relogio = setTimeout(() => {
        if (!this._pronto)
          this._falhar(new Error("O estilo do mapa não carregou a tempo"));
      }, this.options.esperaDoEstiloMs);
      this._gl.once("load", () => {
        clearTimeout(this._relogio);
        if (this._falhou) return;
        this._pronto = true;
        this.options.aoFicarPronto?.(this);
      });
      // Depois de pronto, um azulejo que falha é passageiro; antes, é o estilo.
      this._gl.on("error", (evento) => {
        if (!this._pronto)
          this._falhar(evento?.error || new Error("Erro do MapLibre"));
      });
    },

    _falhar(erro) {
      if (this._falhou) return;
      this._falhou = true;
      clearTimeout(this._relogio);
      this.options.aoFalhar?.(erro, this);
    },

    /*
      O fundo é maior que o mapa (ver FOLGA_DO_VETORIAL) e fica centrado nele:
      o centro do MapLibre é o centro do Leaflet. Guarda-se a caixa em
      coordenadas geográficas para a animação de zoom.
    */
    _aplicarCaixa({ posicionar = true } = {}) {
      const map = this._map;
      const tamanho = map.getSize();
      const caixa = caixaDoVetorial(tamanho.x, tamanho.y, this.options.folga);
      const estilo = this._container.style;
      const mudouDeTamanho =
        estilo.width !== `${caixa.largura}px` ||
        estilo.height !== `${caixa.altura}px`;
      estilo.width = `${caixa.largura}px`;
      estilo.height = `${caixa.altura}px`;
      const posicao = map
        .containerPointToLayerPoint([caixa.deslocX, caixa.deslocY])
        .round();
      if (posicionar) L.DomUtil.setPosition(this._container, posicao);
      this._caixa = L.latLngBounds(
        map.containerPointToLatLng([caixa.deslocX, caixa.deslocY]),
        map.containerPointToLatLng([
          caixa.deslocX + caixa.largura,
          caixa.deslocY + caixa.altura,
        ]),
      );
      return { mudouDeTamanho, posicao };
    },

    /*
      A ORDEM IMPORTA

      Mover a caixa e pedir o enquadramento novo ao MapLibre em separado faz o
      fundo saltar: a caixa muda já, e o MapLibre só desenha no quadro seguinte
      — durante um quadro a imagem velha aparece no sítio novo. Por isso:
      enquadramento novo, `redraw()` (desenho síncrono), e só então a caixa
      mexe, tudo na mesma tarefa, no mesmo quadro.
    */
    _atualizar() {
      if (!this._map || !this._gl || !this._container.isConnected) return;
      const { mudouDeTamanho, posicao } = this._aplicarCaixa({
        posicionar: false,
      });
      if (mudouDeTamanho) this._gl.resize();
      const centro = this._map.getCenter();
      this._gl.jumpTo({
        center: [centro.lng, centro.lat],
        zoom: zoomDoMapLibre(this._map.getZoom()),
      });
      this._gl.redraw?.();
      L.DomUtil.setPosition(this._container, posicao);
    },

    /*
      Durante a animação de zoom do Leaflet o fundo é escalado por CSS, como o
      `L.ImageOverlay` faz com a imagem dele; no `zoomend` o MapLibre desenha o
      zoom novo de verdade.
    */
    _animarZoom(evento) {
      if (!this._caixa || !this._container.isConnected) return;
      const escala = this._map.getZoomScale(evento.zoom);
      const destino = this._map._latLngBoundsToNewLayerBounds(
        this._caixa,
        evento.zoom,
        evento.center,
      ).min;
      L.DomUtil.setTransform(this._container, destino, escala);
    },
  });

  return new Camada(opcoes);
}

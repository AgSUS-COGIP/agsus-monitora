import { useEffect, useReducer, useRef, useState } from "react";
import { calcularLeque } from "../../lib/leque-de-marcadores.js";
import {
  dicaDaBolha,
  dicaDaCasaiNacional,
  popupDaCasaiNacional,
} from "../../lib/mapa-saude-indigena/mapa-nacional.js";
import {
  formatarNumero,
  plural,
} from "../../lib/mapa-saude-indigena/chaves.js";
import { CORES_DO_MAPA } from "../../lib/mapa-saude-indigena/formas.js";
import { EVENTO_DAS_TERRAS } from "../../modules/indigenous-territories-layer.js";
import { EstadoVazio, classes } from "../../ui/index.js";
import { LegendaNacional } from "./legenda.jsx";
import {
  conteudoEmElemento,
  criarMapaDoBrasil,
  iconeDaCasaiNacional,
  enquadrarNoBrasil,
  ligarDicaEPopup,
  podeFlutuar,
  remedir,
  voltarAoBrasil,
} from "./leaflet.js";
import { usarUltimo } from "./usar-ultimo.js";
import { isAdminGlobal } from "../../lib/access-roles.js";
import { EditorDeCoordenadas } from "./editor-de-coordenadas.jsx";

/* O traço do leque usa o texto secundário do tema; o cinza-azulado é reserva. */
function corDoTraco() {
  try {
    const cor = getComputedStyle(document.documentElement)
      .getPropertyValue("--text-secondary")
      .trim();
    if (cor) return cor;
  } catch {
    // sem estilos computados (teste)
  }
  return CORES_DO_MAPA.traco;
}

/* Redesenha quando a camada de Terras Indígenas avisa que mudou. */
export function usarAvisosDasTerras(mapa) {
  const [vez, avisar] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!mapa?.on) return undefined;
    mapa.on(EVENTO_DAS_TERRAS, avisar);
    return () => mapa.off?.(EVENTO_DAS_TERRAS, avisar);
  }, [mapa]);
  return vez;
}

/*
  Leque das sedes que caem no mesmo pixel (Yanomami e Leste de Roraima em Boa
  Vista): a bolha é desenhada num círculo de 16 px em volta do ponto real, com
  um traço até ele. A coordenada não muda; recalcula a cada zoom.
*/
function aplicarLeque(L, mapa, camada, marcadores, tracos) {
  tracos.forEach((t) => camada.removeLayer(t));
  tracos.length = 0;
  const vivos = marcadores.filter(({ marcador }) => camada.hasLayer(marcador));
  if (!vivos.length) return;
  const pontos = vivos.map(({ lat, lon }) =>
    mapa.latLngToLayerPoint([lat, lon]),
  );
  const cor = corDoTraco();
  calcularLeque(pontos).forEach((desvio, i) => {
    const { marcador, lat, lon } = vivos[i];
    if (!desvio.emLeque) {
      marcador.setLatLng([lat, lon]);
      return;
    }
    const destino = mapa.layerPointToLatLng(
      pontos[i].add(L.point(desvio.dx, desvio.dy)),
    );
    marcador.setLatLng(destino);
    tracos.push(
      L.polyline([[lat, lon], destino], {
        color: cor,
        weight: 1,
        opacity: 0.7,
        interactive: false,
      }),
      L.circleMarker([lat, lon], {
        radius: 2,
        stroke: false,
        fillColor: cor,
        fillOpacity: 0.9,
        interactive: false,
      }),
    );
  });
  if (!tracos.length) return;
  tracos.forEach((t) => camada.addLayer(t));
  vivos.forEach(({ marcador }) => marcador.bringToFront?.());
}

function LinhaDoTerritorio({ territorio, aoEscolher }) {
  const { dsei, vagas, preenchidas, situacao, posicao, detalhe } = territorio;
  return (
    <li>
      <button
        type="button"
        className={classes(
          "mapa-si-territorio",
          !vagas && "mapa-si-territorio--sem-vagas",
        )}
        aria-label={`Abrir o DSEI ${dsei.n}: ${plural(vagas, "vaga", "vagas")}${vagas ? `, ${preenchidas}% preenchidas` : ""}`}
        onClick={() => aoEscolher(dsei)}
      >
        <span className="mapa-si-territorio__posicao" aria-hidden="true">
          {posicao}
        </span>
        <span className="mapa-si-territorio__corpo">
          <strong>{dsei.n}</strong>
          <small>{detalhe}</small>
          {vagas ? (
            <span
              className="mapa-si-territorio__preenchimento"
              data-situacao={situacao}
            >
              <span className="mapa-si-territorio__barra" aria-hidden="true">
                <i style={{ width: `${preenchidas}%` }} />
              </span>
              <span>{preenchidas}% preenchidas</span>
            </span>
          ) : null}
        </span>
        <span className="mapa-si-territorio__vagas">
          <b>{formatarNumero(vagas)}</b> {vagas === 1 ? "vaga" : "vagas"}
        </span>
      </button>
    </li>
  );
}

/*
  A visão nacional: o mapa na proporção que o Brasil preenche e, ao lado, os
  territórios por vagas (a mesma porta de entrada que a bolha).
*/
export function MapaNacional({
  lmap,
  redeCnes,
  perfil,
  supabase,
  aoAtualizarMapa,
  L,
  idDoMapa,
  visivel,
  telaCheia,
  bolhas,
  casais,
  territorios,
  enquadramento,
  resumoDaRede,
  carregando,
  acoes,
  aoEscolherDsei,
  aoFiltrarPorBusca,
}) {
  const [editandoCoordenadas, definirEditandoCoordenadas] = useState(false);
  const podeEditar = isAdminGlobal(perfil);
  const refDoMapa = useRef(null);
  const [mapa, definirMapa] = useState(null);
  const camadas = useRef(null);
  const ultimoEnquadramento = useRef("");
  // Quantas vezes o enquadramento teve de ser refeito (apareceu, mudou de tamanho).
  const [aparecimentos, aparecer] = useReducer((n) => n + 1, 0);
  const chamadas = usarUltimo({ aoEscolherDsei, aoFiltrarPorBusca });
  const avisosDasTerras = usarAvisosDasTerras(mapa);

  // Cria o mapa uma vez; o StrictMode desfaz e refaz, e o `remove` limpa tudo.
  useEffect(() => {
    const elemento = refDoMapa.current;
    if (!L || !elemento) return undefined;
    /*
      Criado escondido (antes do login, noutra tela) o enquadramento usa a
      medida zero: ao aparecer, enquadra de novo. Também ao mudar de tamanho
      (tela cheia, barra lateral), se a pessoa não mexeu no mapa.
    */
    const {
      mapa: novo,
      soltar,
      parar,
    } = criarMapaDoBrasil(L, elemento, {
      aoReenquadrar: () => {
        ultimoEnquadramento.current = "";
        aparecer();
      },
    });
    const dsei = L.layerGroup().addTo(novo);
    const casai = L.layerGroup().addTo(novo);
    novo.__agsusSuspenderCamadasIndigenas?.(false);
    const marcadores = [];
    const tracos = [];
    const leque = () => aplicarLeque(L, novo, dsei, marcadores, tracos);
    novo.on("zoomend", leque);
    camadas.current = { dsei, casai, marcadores, tracos, leque, soltar };
    ultimoEnquadramento.current = "";
    definirMapa(novo);
    return () => {
      parar();
      novo.off("zoomend", leque);
      novo.remove();
      camadas.current = null;
      definirMapa(null);
    };
  }, [L]);

  // Bolhas dos DSEIs e CASAIs nacionais.
  useEffect(() => {
    if (!mapa || !camadas.current) return;
    const { dsei, casai, marcadores, tracos, leque } = camadas.current;
    dsei.clearLayers();
    casai.clearLayers();
    marcadores.length = 0;
    tracos.length = 0;
    const flutua = podeFlutuar();
    for (const bolha of bolhas) {
      const marcador = L.circleMarker([bolha.lat, bolha.lon], bolha.estilo);
      if (flutua) {
        marcador.bindTooltip(
          conteudoEmElemento(
            document,
            dicaDaBolha(bolha, resumoDaRede(bolha.dsei)),
          ),
          { direction: "top" },
        );
      }
      marcador.on("click", () => chamadas.current.aoEscolherDsei?.(bolha.dsei));
      dsei.addLayer(marcador);
      marcadores.push({ marcador, lat: bolha.lat, lon: bolha.lon });
    }
    for (const c of casais) {
      const marcador = L.marker([c.lat, c.lon], {
        icon: iconeDaCasaiNacional(L, document),
        keyboard: true,
        title: c.nome,
      });
      ligarDicaEPopup(marcador, document, {
        dica: dicaDaCasaiNacional(c),
        popup: popupDaCasaiNacional(c),
      });
      marcador.on("click", () =>
        chamadas.current.aoFiltrarPorBusca?.(c.termoDeBusca),
      );
      casai.addLayer(marcador);
    }
    leque();
  }, [L, mapa, bolhas, casais, resumoDaRede, chamadas]);

  /*
    Enquadramento: só quando muda o que enquadrar, e só com o mapa à vista —
    escondido (DSEI aberto) ele não tem tamanho; ao voltar, a chave difere e
    o enquadramento acontece com a medida nova.
  */
  useEffect(() => {
    if (!mapa || !camadas.current || !visivel) return;
    if (enquadramento.chave === ultimoEnquadramento.current) return;
    ultimoEnquadramento.current = enquadramento.chave;
    remedir(mapa);
    try {
      if (enquadramento.modo === "ponto")
        mapa.setView(enquadramento.pontos[0], 7, { animate: false });
      else if (enquadramento.modo === "caixa")
        mapa.fitBounds(L.latLngBounds(enquadramento.pontos), {
          padding: [60, 60],
          maxZoom: 7,
          animate: false,
        });
      else enquadrarNoBrasil(L, mapa);
    } catch {
      // mapa sem tamanho ainda; o ResizeObserver reenquadra
    }
    camadas.current.soltar();
    // Se o enquadramento não mudou o zoom, o `zoomend` não dispara.
    camadas.current.leque();
  }, [L, mapa, enquadramento, visivel, aparecimentos]);

  // Voltou a aparecer, ou mudou para tela cheia: o Leaflet remede.
  useEffect(() => {
    if (!mapa || !visivel) return undefined;
    const quadro = requestAnimationFrame(() => remedir(mapa));
    return () => cancelAnimationFrame(quadro);
  }, [mapa, visivel, telaCheia]);

  const temAbrangencia =
    avisosDasTerras >= 0 &&
    (mapa?.__agsusDseiCoverageLayer?.getLayers?.().length ?? 0) > 0;

  return (
    <section
      className="ui-card mapa-si-painel mapa-si-painel--nacional"
      hidden={!visivel}
      aria-labelledby={`${idDoMapa}-titulo`}
    >
      <header className="mapa-si-painel__topo">
        <div className="mapa-si-painel__titulos">
          <h2 className="ui-titulo" id={`${idDoMapa}-titulo`}>
            DSEIs e CASAIs do Brasil
          </h2>
          <span className="mapa-si-painel__contagem">
            {carregando
              ? "…"
              : plural(bolhas.length, "território", "territórios")}
          </span>
        </div>
        <div
          className="mapa-si-painel__acoes"
          role="group"
          aria-label="Controles do mapa"
        >
          {podeEditar ? (
            <button
              type="button"
              className="btn small"
              aria-pressed={editandoCoordenadas}
              aria-expanded={editandoCoordenadas}
              aria-controls={`${idDoMapa}-painel-lateral`}
              onClick={() => definirEditandoCoordenadas((atual) => !atual)}
            >
              Coordenadas
            </button>
          ) : null}
          <button
            type="button"
            className="btn small"
            onClick={() => {
              voltarAoBrasil(L, mapa);
              camadas.current?.soltar();
            }}
            disabled={!mapa}
            title="Voltar à visão do Brasil inteiro"
          >
            Brasil
          </button>
          {acoes}
        </div>
      </header>
      <div className="mapa-si-painel__corpo">
        <div className="mapa-si-moldura">
          {L ? (
            <div
              ref={refDoMapa}
              id={idDoMapa}
              className="mapa-si-mapa"
              role="img"
              aria-label="Mapa do Brasil com processos seletivos por DSEI e CASAIs nacionais"
            />
          ) : (
            <EstadoVazio className="ui-vazio mapa-si-sem-mapa">
              Mapa indisponível sem conexão: o fundo geográfico precisa de
              internet.
            </EstadoVazio>
          )}
          {mapa ? (
            <LegendaNacional mapa={mapa} temAbrangencia={temAbrangencia} />
          ) : null}
        </div>
        <aside
          className="mapa-si-lista"
          id={`${idDoMapa}-painel-lateral`}
          aria-label={
            editandoCoordenadas && podeEditar
              ? "Coordenadas do mapa"
              : "Territórios por vagas"
          }
        >
          {podeEditar && editandoCoordenadas && visivel ? (
            <EditorDeCoordenadas
              L={L}
              mapa={mapa}
              lmap={lmap}
              redeCnes={redeCnes}
              perfil={perfil}
              supabase={supabase}
              aoAtualizarMapa={aoAtualizarMapa}
              aoFechar={() => definirEditandoCoordenadas(false)}
            />
          ) : (
            <>
              <div className="mapa-si-lista__topo">
                <span id={`${idDoMapa}-lista`}>Territórios por vagas</span>
                <b>{carregando ? "…" : formatarNumero(territorios.length)}</b>
              </div>
              {carregando ? (
                <div className="ui-esqueleto mapa-si-lista__esqueleto" />
              ) : territorios.length ? (
                <ol className="mapa-si-lista__itens">
                  {territorios.map((t) => (
                    <LinhaDoTerritorio
                      key={t.chave}
                      territorio={t}
                      aoEscolher={(d) => chamadas.current.aoEscolherDsei?.(d)}
                    />
                  ))}
                </ol>
              ) : (
                <EstadoVazio>Nenhum território no recorte.</EstadoVazio>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

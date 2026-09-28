import { useEffect, useMemo, useRef } from "react";
import { formatarNumero } from "../../lib/editais-do-nucleo.js";
import {
  pontosDosMunicipios,
  totalDosMunicipios,
} from "../../lib/visao-geral-da-area.js";
import { addResilientBaseLayer } from "../../modules/map-base-layer-switcher.js";
import { Bloco, Vazio } from "./partes.jsx";

/*
  O mapa dos municípios das vagas (Visão geral de Projetos).

  Leaflet é o do \`index.html\` (\`window.L\`), já com as guardas de
  \`src/main.js\` (limites do Brasil, zoom, troca Mapa/Satélite). A camada base é
  a mesma do mapa da Saúde Indígena (\`addResilientBaseLayer\`). Um círculo por
  município, com a área proporcional aos candidatos; o clique abre as
  contagens. A lista ao lado repete os municípios em texto — é por ela que o
  leitor de tela e quem não usa o mapa chegam aos números — e mostra os que
  ainda não têm coordenada.

  A página nasce escondida (\`display: none\`): o mapa reenquadra quando o card
  ganha tamanho (\`ResizeObserver\`), senão abriria com zoom calculado sobre 0 px.
*/

const PADDING = [36, 36];
const ZOOM_MAXIMO_DO_ENQUADRAMENTO = 7;

const plural = (total, um, varios) =>
  `${formatarNumero(total)} ${total === 1 ? um : varios}`;

/* O conteúdo do popup, montado com nós do DOM (sem innerHTML). */
function popupDoMunicipio(documento, ponto) {
  const caixa = documento.createElement("div");
  caixa.className = "visao-da-area__popup";
  const titulo = documento.createElement("strong");
  titulo.textContent = ponto.municipioUf;
  caixa.append(titulo);
  for (const [rotulo, valor] of [
    ["Vagas", ponto.vagas],
    ["Candidatos", ponto.candidatos],
    ["Aprovados", ponto.aprovados],
    ["Reprovados", ponto.reprovados],
  ]) {
    const linha = documento.createElement("span");
    const numero = documento.createElement("b");
    numero.textContent = formatarNumero(valor);
    linha.append(`${rotulo}: `, numero);
    caixa.append(linha);
  }
  return caixa;
}

function MapaLeaflet({ pontos, marcadores }) {
  const elemento = useRef(null);

  useEffect(() => {
    const L = globalThis.L;
    const alvo = elemento.current;
    if (!L?.map || !alvo || !pontos.length) return undefined;

    const mapa = L.map(alvo, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
      zoomSnap: 0.25,
    });
    addResilientBaseLayer(L, mapa);
    const grupo = L.featureGroup().addTo(mapa);
    for (const ponto of pontos) {
      const marcador = L.circleMarker(ponto.coordenadas, {
        radius: ponto.raio,
        weight: 2,
        className: "visao-da-area__ponto",
      })
        .bindPopup(popupDoMunicipio(alvo.ownerDocument, ponto))
        .bindTooltip(ponto.municipioUf, { direction: "top" })
        .addTo(grupo);
      marcadores.current.set(ponto.municipioUf, marcador);
    }

    const enquadrar = () => {
      if (!alvo.clientWidth || !alvo.clientHeight) return;
      mapa.invalidateSize();
      mapa.fitBounds(grupo.getBounds(), {
        padding: PADDING,
        maxZoom: ZOOM_MAXIMO_DO_ENQUADRAMENTO,
      });
    };
    enquadrar();
    const observador =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(enquadrar)
        : null;
    observador?.observe(alvo);

    return () => {
      observador?.disconnect();
      marcadores.current.clear();
      mapa.remove();
    };
  }, [pontos, marcadores]);

  return (
    <div
      ref={elemento}
      className="visao-da-area__mapa"
      role="img"
      aria-label="Mapa do Brasil com os municípios das vagas da área"
    />
  );
}

export function MapaDosMunicipios({ mapa, aoTentarDeNovo }) {
  const pontos = useMemo(
    () => pontosDosMunicipios(mapa.municipios),
    [mapa.municipios],
  );
  const noMapa = useMemo(
    () => pontos.filter((ponto) => ponto.coordenadas),
    [pontos],
  );
  const marcadores = useRef(new Map());
  const candidatos = totalDosMunicipios(pontos, "candidatos");

  function abrirNoMapa(municipioUf) {
    marcadores.current.get(municipioUf)?.openPopup();
  }

  let conteudo;
  if (mapa.indisponivel) {
    conteudo = (
      <Vazio icone="fa-database" titulo="Mapa ainda indisponível">
        O mapa depende de uma atualização do banco que ainda não foi aplicada.
      </Vazio>
    );
  } else if (mapa.erro) {
    conteudo = (
      <div className="visao-da-area__vazio" role="alert">
        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
        <strong>Não foi possível carregar os municípios</strong>
        <span>{mapa.erro}</span>
        <button
          type="button"
          className="btn secondary"
          onClick={aoTentarDeNovo}
        >
          Tentar de novo
        </button>
      </div>
    );
  } else if (!mapa.carregado) {
    conteudo = (
      <Vazio icone="fa-map-location-dot" titulo="Carregando os municípios" />
    );
  } else if (!pontos.length) {
    conteudo = (
      <Vazio icone="fa-map-location-dot" titulo="Nenhum município nas vagas">
        As vagas da área ainda não informam o município (UBS móvel).
      </Vazio>
    );
  } else {
    conteudo = (
      <div className="visao-da-area__mapa-layout">
        {noMapa.length ? (
          <MapaLeaflet pontos={noMapa} marcadores={marcadores} />
        ) : (
          <Vazio
            icone="fa-map-location-dot"
            titulo="Sem coordenadas para desenhar"
          />
        )}
        <aside
          className="visao-da-area__municipios"
          aria-label="Municípios por candidatos"
        >
          <ol>
            {pontos.map((ponto) => (
              <li key={ponto.municipioUf}>
                <button
                  type="button"
                  className="visao-da-area__municipio"
                  disabled={!ponto.coordenadas}
                  onClick={() => abrirNoMapa(ponto.municipioUf)}
                >
                  <span className="visao-da-area__municipio-nome">
                    <strong>{ponto.municipioUf}</strong>
                    <small>
                      {plural(ponto.vagas, "vaga", "vagas")} ·{" "}
                      {formatarNumero(ponto.aprovados)} aprovados ·{" "}
                      {formatarNumero(ponto.reprovados)} reprovados
                      {!ponto.coordenadas && " · sem coordenada"}
                    </small>
                  </span>
                  <b title="Candidatos">{formatarNumero(ponto.candidatos)}</b>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    );
  }

  return (
    <Bloco
      icone="fa-earth-americas"
      titulo="Municípios das vagas"
      contagem={
        pontos.length
          ? `${plural(pontos.length, "município", "municípios")} · ${plural(candidatos, "candidato", "candidatos")}`
          : undefined
      }
      className="visao-da-area__mapa-card"
    >
      {conteudo}
    </Bloco>
  );
}

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { usarTemaEscuro } from "../../app/tema.js";
import {
  MAPA_DOS_MUNICIPIOS,
  TEXTOS_DO_MAPA,
  plural,
  pontosDosMunicipios,
  projetosDosMunicipios,
} from "../../lib/visao-geral-da-area.js";
import { EstadoVazio, classes } from "../../ui/index.js";
import { LegendaFlutuante } from "../mapa-saude-indigena/legenda.jsx";
import {
  criarMapaDoBrasil,
  enquadrarNoBrasil,
  ligarDicaEPopup,
  obterLeaflet,
  remedir,
  voltarAoBrasil,
} from "../mapa-saude-indigena/leaflet.js";
import { usarTelaCheia } from "../mapa-saude-indigena/tela-cheia.jsx";
import { usarUltimo } from "../mapa-saude-indigena/usar-ultimo.js";
import { balaoDoLugar } from "./balao.js";
import { ESCOLHA_INICIAL } from "./carregador.js";
import { CorDoProjeto, ListaDeMunicipios } from "./lista.jsx";

/*
  MAPA DE PROJETOS (React)

  O mapa da Visão geral da área Projetos, irmão do da Saúde Indígena
  (src/modulos/mapa-saude-indigena/, de onde vêm o Leaflet, os contornos, as
  dicas que não saem do mapa, a legenda flutuante e a tela cheia): um ponto
  por lugar das vagas de todos os projetos — município, ou o meio do estado
  quando o edital só diz a UF —, na cor do projeto, com o tamanho pelas
  vagas, e a lista "Municípios por vagas" ao lado, com filtro e agrupamento
  por projeto. Lógica pura em src/lib/visao-geral-da-area.js.

  Busca os lugares pelo `carregador` (carregador.js, um por Visão geral, com
  cache), só depois da primeira carga da página (`carregadoEm`: antes do
  login não há sessão); `carregadoEm` novo (Atualizar dados) pede de novo, e
  o cache decide se vai ao banco.
*/

const TEXTOS = TEXTOS_DO_MAPA[MAPA_DOS_MUNICIPIOS];

/*
  Os lugares da área: `null` enquanto carrega. O cache fresco responde já
  (recarga sem piscar o "carregando"); senão, o último resultado desta área.
*/
function usarLugares(carregador, area, carregadoEm) {
  const pronto = Boolean(carregador && area && carregadoEm);
  const [lidos, definirLidos] = useState({ area: "", resultado: null });

  useEffect(() => {
    if (!pronto) return undefined;
    let vale = true;
    carregador.carregar(area).then((resultado) => {
      if (vale) definirLidos({ area, resultado });
    });
    return () => {
      vale = false;
    };
  }, [carregador, area, carregadoEm, pronto]);

  if (!pronto) return null;
  return (
    carregador.emCache(area) ?? (lidos.area === area ? lidos.resultado : null)
  );
}

export function MapaDeProjetos({
  area = "projetos",
  carregador,
  carregadoEm = 0,
  tema,
  idDoMapa = "mapaDosProjetos",
}) {
  const escuroDoApp = usarTemaEscuro();
  const escuro = tema ? tema === "escuro" : escuroDoApp;
  const L = obterLeaflet();
  const [telaCheia, botaoDeTelaCheia] = usarTelaCheia();
  const resultado = usarLugares(carregador, area, carregadoEm);
  const carregando = !resultado;
  const municipios = resultado?.municipios;

  const [escolhaGuardada, definirEscolha] = useState(
    () => carregador?.obterEscolha?.() ?? ESCOLHA_INICIAL,
  );
  const mudarEscolha = (mudanca) => {
    carregador?.guardarEscolha?.(mudanca);
    definirEscolha((atual) => ({ ...atual, ...mudanca }));
  };

  const projetos = useMemo(
    () => projetosDosMunicipios(municipios),
    [municipios],
  );
  // Projeto que sumiu dos dados volta a "todos".
  const escolha = projetos.some(
    (projeto) => projeto.nome === escolhaGuardada.projeto,
  )
    ? escolhaGuardada
    : { ...escolhaGuardada, projeto: "" };
  const pontos = useMemo(
    () => pontosDosMunicipios(municipios, { projeto: escolha.projeto }),
    [municipios, escolha.projeto],
  );

  // ── Leaflet ────────────────────────────────────────────────────────────
  const refDoMapa = useRef(null);
  const [mapa, definirMapa] = useState(null);
  const camada = useRef(null);
  const marcadores = useRef(new Map());
  const ultimoEnquadramento = useRef("");
  // pegar/soltar do criarMapaDoBrasil: acompanhar ou não o tamanho do contêiner.
  const controle = useRef({ pegar() {}, soltar() {} });
  // Quantas vezes o enquadramento teve de ser refeito (apareceu, mudou de tamanho).
  const [aparecimentos, aparecer] = useReducer((n) => n + 1, 0);

  // Cria o mapa uma vez; o StrictMode desfaz e refaz, e o `remove` limpa tudo.
  useEffect(() => {
    const elemento = refDoMapa.current;
    if (!L || !elemento) return undefined;
    const {
      mapa: novo,
      pegar,
      soltar,
      parar,
    } = criarMapaDoBrasil(L, elemento, {
      aoReenquadrar: () => {
        ultimoEnquadramento.current = "";
        aparecer();
      },
    });
    camada.current = L.layerGroup().addTo(novo);
    controle.current = { pegar, soltar };
    ultimoEnquadramento.current = "";
    definirMapa(novo);
    return () => {
      parar();
      novo.remove();
      camada.current = null;
      definirMapa(null);
    };
  }, [L]);

  // Um ponto por lugar com coordenada, na cor do projeto.
  useEffect(() => {
    if (!mapa || !camada.current) return;
    camada.current.clearLayers();
    marcadores.current = new Map();
    for (const ponto of pontos) {
      if (!ponto.coordenadas) continue;
      const marcador = L.circleMarker(ponto.coordenadas, {
        radius: ponto.raio,
        weight: 2,
        fillOpacity: 0.78,
        className: classes(
          "marcador-de-projeto",
          `marcador-de-projeto--${ponto.serie}`,
          ponto.variosProjetos && "is-varios-projetos",
        ),
      });
      ligarDicaEPopup(marcador, document, {
        dica: balaoDoLugar(document, ponto),
        popup: balaoDoLugar(document, ponto),
      });
      camada.current.addLayer(marcador);
      marcadores.current.set(ponto.chave, marcador);
    }
  }, [L, mapa, pontos]);

  /*
    Enquadramento: na primeira carga e ao trocar o projeto (não ao agrupar),
    só quando muda o que enquadrar; ao reaparecer ou mudar de tamanho sem a
    pessoa ter mexido (`criarMapaDoBrasil`), de novo.
  */
  const noMapa = useMemo(
    () => pontos.filter((ponto) => ponto.coordenadas),
    [pontos],
  );
  const chaveDoEnquadramento = carregando
    ? ""
    : `${escolha.projeto}|${noMapa.map((ponto) => ponto.chave).join(";")}`;
  useEffect(() => {
    if (!mapa || !chaveDoEnquadramento) return;
    if (chaveDoEnquadramento === ultimoEnquadramento.current) return;
    ultimoEnquadramento.current = chaveDoEnquadramento;
    remedir(mapa);
    try {
      if (noMapa.length)
        mapa.fitBounds(
          L.latLngBounds(noMapa.map((ponto) => ponto.coordenadas)),
          {
            padding: [60, 60],
            maxZoom: 7,
            animate: false,
          },
        );
      else enquadrarNoBrasil(L, mapa);
    } catch {
      // mapa sem tamanho ainda; o ResizeObserver reenquadra
    }
    controle.current.soltar();
  }, [L, mapa, chaveDoEnquadramento, noMapa, aparecimentos]);

  // Mudou para tela cheia (ou voltou): o Leaflet remede.
  useEffect(() => {
    if (!mapa) return undefined;
    const quadro = requestAnimationFrame(() => remedir(mapa));
    return () => cancelAnimationFrame(quadro);
  }, [mapa, telaCheia]);

  const chamadas = usarUltimo({
    aoEscolher: (ponto) => {
      const marcador = marcadores.current.get(ponto?.chave);
      if (!mapa || !marcador) return;
      controle.current.pegar();
      mapa.setView(ponto.coordenadas, Math.max(mapa.getZoom(), 7), {
        animate: true,
      });
      marcador.openPopup?.();
    },
  });

  return (
    <div
      className={classes(
        "mapa-si",
        "mapa-projetos",
        escuro && "mapa-si--escuro",
        telaCheia && "mapa-si--tela-cheia",
      )}
      aria-label={TEXTOS.area}
      role="region"
    >
      <section
        className="ui-card mapa-si-painel mapa-si-painel--nacional"
        aria-labelledby={`${idDoMapa}-titulo`}
      >
        <header className="mapa-si-painel__topo">
          <h2 className="ui-titulo" id={`${idDoMapa}-titulo`}>
            {TEXTOS.titulo}
          </h2>
          <span className="mapa-si-painel__contagem">
            {carregando
              ? "…"
              : plural(pontos.length, "município", "municípios")}
          </span>
          <div className="mapa-si-painel__acoes">
            <button
              type="button"
              className="btn small"
              onClick={() => {
                voltarAoBrasil(L, mapa);
                controle.current.soltar();
              }}
              disabled={!mapa}
              title="Voltar à visão do Brasil inteiro"
            >
              Brasil
            </button>
            {botaoDeTelaCheia}
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
                aria-label={TEXTOS.mapa}
              />
            ) : (
              <EstadoVazio className="ui-vazio mapa-si-sem-mapa">
                Mapa indisponível sem conexão: o fundo geográfico precisa de
                internet.
              </EstadoVazio>
            )}
            {mapa ? (
              <LegendaFlutuante>
                {projetos.map((projeto) => (
                  <span key={projeto.nome} className="mapa-si-legenda__item">
                    <CorDoProjeto serie={projeto.serie} />
                    {projeto.nome}
                  </span>
                ))}
                <span className="mapa-si-legenda__item">
                  tamanho = nº de vagas
                </span>
                <span className="mapa-si-legenda__item">
                  <span
                    className="mapa-projeto__cor mapa-projeto__cor--varios"
                    aria-hidden="true"
                  />
                  mais de um projeto
                </span>
              </LegendaFlutuante>
            ) : null}
          </div>
          <ListaDeMunicipios
            id={`${idDoMapa}-lista`}
            titulo={TEXTOS.lista}
            carregando={carregando}
            indisponivel={resultado?.indisponivel}
            erro={resultado?.erro}
            pontos={pontos}
            projetos={projetos}
            escolha={escolha}
            aoMudarEscolha={mudarEscolha}
            aoEscolher={(ponto) => chamadas.current.aoEscolher(ponto)}
          />
        </div>
      </section>
    </div>
  );
}

import type {
  PropsDaVisaoNacional,
  TerritorioDoMapa,
  DseiDoMapa,
} from "../../lib/mapa-saude-indigena/tipos.ts";
import type { MapaDoPainel } from "./tipos-do-painel.ts";
import type { LequeDoMapa } from "./tipos-do-leaflet.ts";
import { useEffect, useReducer, useRef } from "react";
import {
  dicaDaBolha,
  dicaDaCasaiNacional,
  popupDaCasaiNacional,
} from "../../lib/mapa-saude-indigena/mapa-nacional.ts";
import {
  formatarNumero,
  plural,
} from "../../lib/mapa-saude-indigena/chaves.ts";
import { EVENTO_DAS_TERRAS } from "../../modules/indigenous-territories-layer.js";
import { classes } from "../../ui/index.js";
import { LegendaNacional } from "./legenda.tsx";
import {
  DURACAO_DA_VOLTA_AO_BRASIL,
  conteudoEmElemento,
  criarLeque,
  enquadrar,
  iconeDaCasaiNacional,
  ligarDicaEPopup,
  podeFlutuar,
  podeVoar,
  remedir,
} from "./leaflet.js";
import {
  ListaDoMapa,
  MolduraDoMapa,
  TopoDoMapa,
  classesDoPainel,
  propsDoEditor,
  usarMapaDoBrasil,
} from "./painel-do-mapa.tsx";
import { usarUltimo } from "./usar-ultimo.ts";
import { podeEditarCoordenadas } from "../../lib/access-roles.js";
import { EditorDeCoordenadas } from "./editor-de-coordenadas.tsx";
import {
  PainelDoEditor,
  usarModoDeEdicao,
} from "../editor-de-coordenadas/modo-de-edicao.tsx";

/*
  A volta de um DSEI parte da sede, no zoom em que o mapa do distrito costuma
  estar, e voa até o enquadramento do recorte (`enquadrar`, leaflet.js).
*/
const ZOOM_DE_PARTIDA_DA_VOLTA = 7;

/* Redesenha quando a camada de Terras Indígenas avisa que mudou. */
export function usarAvisosDasTerras(mapa: MapaDoPainel | null) {
  const [vez, avisar] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!mapa?.on) return undefined;
    mapa.on(EVENTO_DAS_TERRAS, avisar);
    return () => {
      mapa.off?.(EVENTO_DAS_TERRAS, avisar);
    };
  }, [mapa]);
  return vez;
}

function LinhaDoTerritorio({
  territorio,
  aoEscolher,
}: {
  territorio: TerritorioDoMapa;
  aoEscolher(dsei: DseiDoMapa): void;
}) {
  const { dsei, vagas, preenchidas, situacao, posicao, detalhe } = territorio;
  return (
    <li>
      <button
        type="button"
        className={classes(
          "mapa-si-territorio",
          !vagas && "mapa-si-territorio--sem-vagas",
        )}
        data-dsei={dsei.k}
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
  territórios por vagas (a mesma porta de entrada que a bolha). O painel, o
  topo, a moldura, a lista, o leque e o enquadramento são os comuns aos dois
  mapas nacionais (painel-do-mapa.tsx, leaflet.js); o de Projetos usa os
  mesmos.
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
  voltaDoDsei = null,
  resumoDaRede,
  carregando,
  acoes,
  aoEscolherDsei,
  aoFiltrarPorBusca,
}: PropsDaVisaoNacional) {
  const podeEditar = podeEditarCoordenadas(perfil);
  const refDaLista = useRef<HTMLElement | null>(null);
  // Enquanto voa de volta ao Brasil, o "apareceu" do ResizeObserver não salta.
  const voando = useRef<(() => void) | null>(null);
  const { refDoMapa, mapa, camadas, ultimoEnquadramento, aparecimentos } =
    usarMapaDoBrasil(L, {
      emVoo: voando,
      visivel,
      telaCheia,
      aoCriar: (novo) => {
        if (!L) throw new Error("Mapa indisponível.");
        const dsei = L.layerGroup().addTo(novo);
        const casai = L.layerGroup().addTo(novo);
        novo.__agsusSuspenderCamadasIndigenas?.(false);
        const leque: LequeDoMapa = criarLeque(L, novo, dsei);
        return {
          dsei,
          casai,
          leque,
          parar: () => {
            voando.current?.();
            leque.parar();
          },
        };
      },
    });
  const modo = usarModoDeEdicao({
    mapa,
    permitido: podeEditar && visivel,
    pegar: () => camadas.current?.pegar(),
  });
  const idDoPainel = `${idDoMapa}-painel-lateral`;
  // A última volta de DSEI já enquadrada e já com o foco devolvido (`vez`).
  const voltaEnquadrada = useRef(0);
  const voltaFocada = useRef(0);
  const chamadas = usarUltimo({ aoEscolherDsei, aoFiltrarPorBusca });
  const avisosDasTerras = usarAvisosDasTerras(mapa);

  // Bolhas dos DSEIs e CASAIs nacionais.
  useEffect(() => {
    if (!L || !mapa || !camadas.current) return;
    const { dsei, casai, leque } = camadas.current;
    dsei.clearLayers();
    casai.clearLayers();
    leque.limpar();
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
      leque.adicionar(marcador, bolha.lat, bolha.lon);
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
    leque.aplicar();
  }, [L, mapa, camadas, bolhas, casais, resumoDaRede, chamadas]);

  /*
    Enquadramento: só quando muda o que enquadrar, e só com o mapa à vista —
    escondido (DSEI aberto) ele não tem tamanho e enquadra com a medida nova
    ao voltar. A volta de um DSEI (`voltaDoDsei`, uma `vez` nova a cada saída)
    sempre reenquadra: parte do distrito e voa em ~0,8 s até o enquadramento
    (o Brasil, ou o recorte dos filtros que ficaram). Com menos movimento
    (prefers-reduced-motion), salta direto, sem animação.
  */
  useEffect(() => {
    if (!mapa || !camadas.current || !visivel) return;
    const volta =
      voltaDoDsei && voltaDoDsei.vez !== voltaEnquadrada.current
        ? voltaDoDsei
        : null;
    if (!volta && enquadramento.chave === ultimoEnquadramento.current) return;
    if (volta) voltaEnquadrada.current = volta.vez;
    ultimoEnquadramento.current = enquadramento.chave;
    remedir(mapa);
    const voar = Boolean(volta) && podeVoar(mapa);
    try {
      if (voar) {
        voando.current?.();
        mapa.stop?.();
        if (volta?.partida)
          mapa.setView(volta.partida, ZOOM_DE_PARTIDA_DA_VOLTA, {
            animate: false,
          });
        let prazo: ReturnType<typeof setTimeout> | undefined;
        const pousar = () => {
          clearTimeout(prazo);
          mapa.off("moveend", pousar);
          voando.current = null;
        };
        // Se a animação for interrompida sem `moveend`, o prazo solta.
        prazo = setTimeout(pousar, DURACAO_DA_VOLTA_AO_BRASIL * 1000 + 400);
        mapa.on("moveend", pousar);
        voando.current = pousar;
      }
      enquadrar(L, mapa, enquadramento, { voar });
    } catch {
      // mapa sem tamanho ainda; o ResizeObserver reenquadra
      voando.current?.();
    }
    camadas.current.soltar();
    // Se o enquadramento não mudou o zoom, o `zoomend` não dispara.
    camadas.current.leque.aplicar();
  }, [
    L,
    mapa,
    camadas,
    ultimoEnquadramento,
    enquadramento,
    visivel,
    aparecimentos,
    voltaDoDsei,
  ]);

  /*
    Quem saiu do DSEI pelo mapa ("Voltar ao Brasil" ou Esc) não perde o
    foco: ele volta à linha do DSEI em "Territórios por vagas" ou, se ela não
    estiver na lista, ao mapa. Pelo chip da página, o foco fica onde está.
  */
  useEffect(() => {
    if (!visivel || !voltaDoDsei?.focar) return;
    if (voltaDoDsei.vez === voltaFocada.current) return;
    voltaFocada.current = voltaDoDsei.vez;
    const linha = [
      ...(refDaLista.current?.querySelectorAll<HTMLButtonElement>(
        ".mapa-si-territorio",
      ) || []),
    ].find((botao) => botao.dataset.dsei === voltaDoDsei.k);
    const alvo = linha || refDoMapa.current;
    alvo?.focus?.({ preventScroll: true });
    linha?.scrollIntoView?.({ block: "nearest" });
  }, [visivel, voltaDoDsei, refDoMapa]);

  const temAbrangencia =
    avisosDasTerras >= 0 &&
    (mapa?.__agsusDseiCoverageLayer?.getLayers?.().length ?? 0) > 0;

  return (
    <section
      className={classesDoPainel(modo)}
      hidden={!visivel}
      aria-labelledby={`${idDoMapa}-titulo`}
    >
      <TopoDoMapa
        L={L}
        mapa={mapa}
        camadas={camadas}
        idDoMapa={idDoMapa}
        titulo="DSEIs e CASAIs do Brasil"
        contagem={
          carregando ? "…" : plural(bolhas.length, "território", "territórios")
        }
        podeEditar={podeEditar}
        modo={modo}
        idDoPainel={idDoPainel}
        acoes={acoes}
      />
      <div className="mapa-si-painel__corpo">
        <MolduraDoMapa
          L={L}
          refDoMapa={refDoMapa}
          idDoMapa={idDoMapa}
          rotulo="Mapa do Brasil com processos seletivos por DSEI e CASAIs nacionais"
        >
          {mapa ? (
            <LegendaNacional mapa={mapa} temAbrangencia={temAbrangencia} />
          ) : null}
        </MolduraDoMapa>
        {modo.editando ? (
          <PainelDoEditor
            id={idDoPainel}
            rotulo="Coordenadas do mapa"
            modo={modo}
          >
            <EditorDeCoordenadas
              L={L}
              mapa={mapa}
              lmap={lmap}
              redeCnes={redeCnes}
              perfil={perfil}
              supabase={supabase}
              aoAtualizarMapa={aoAtualizarMapa}
              {...propsDoEditor(modo, idDoPainel)}
            />
          </PainelDoEditor>
        ) : (
          <ListaDoMapa
            refDaLista={refDaLista}
            id={idDoPainel}
            idDoTitulo={`${idDoMapa}-lista`}
            titulo="Territórios por vagas"
            total={territorios.length}
            carregando={carregando}
            vazio="Nenhum território no recorte."
          >
            {territorios.length ? (
              <ol className="mapa-si-lista__itens">
                {territorios.map((t) => (
                  <LinhaDoTerritorio
                    key={t.chave}
                    territorio={t}
                    aoEscolher={(d) => chamadas.current.aoEscolherDsei?.(d)}
                  />
                ))}
              </ol>
            ) : null}
          </ListaDoMapa>
        )}
      </div>
    </section>
  );
}

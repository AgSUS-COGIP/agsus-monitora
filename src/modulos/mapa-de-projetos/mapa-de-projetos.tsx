import type {
  CarregadorDeMunicipios,
  ResultadoDosMunicipios,
  EscolhaDoMapa,
  MunicipioDoMapa,
  PontoDoMunicipio,
  PropsDoMapaDeProjetos,
  CorrecaoDoLugar,
  PontoEditavelDoProjeto,
} from "./tipos.ts";
import type { MapaNacional, MarcadorDoMapa } from "../../lib/tipos-do-mapa.ts";
import { useEffect, useMemo, useState } from "react";
import { usarTemaEscuro } from "../../app/tema.js";
import { podeEditarCoordenadas } from "../../lib/access-roles.js";
import { aplicarCoordenada } from "../../lib/coordenadas-dos-projetos.js";
import { enquadramentoDoRecorte } from "../../lib/enquadramento-do-brasil.js";
import { OPACIDADE_DA_BOLHA } from "../../lib/mapa-render.js";
import {
  MAPA_DOS_MUNICIPIOS,
  TEXTOS_DO_MAPA,
  lugaresDoRecorte,
  plural,
  pontosDosMunicipios,
  projetosDosMunicipios,
} from "../../lib/visao-geral-da-area.ts";
import { classes } from "../../ui/index.js";
import { LegendaFlutuante } from "../mapa-saude-indigena/legenda.jsx";
import {
  criarLeque,
  enquadrar,
  ligarDicaEPopup,
  obterLeaflet,
  remedir,
} from "../mapa-saude-indigena/leaflet.js";
import {
  MolduraDoMapa,
  TopoDoMapa,
  classesDoPainel,
  propsDoEditor,
  usarMapaDoBrasil,
} from "../mapa-saude-indigena/painel-do-mapa.jsx";
import { usarTelaCheia } from "../mapa-saude-indigena/tela-cheia.jsx";
import { usarUltimo } from "../mapa-saude-indigena/usar-ultimo.js";
import { balaoDoLugar } from "./balao.ts";
import { ESCOLHA_INICIAL } from "./carregador.ts";
import { EditorDeCoordenadasDosProjetos } from "./editor-de-coordenadas.tsx";
import {
  PainelDoEditor,
  usarModoDeEdicao,
} from "../editor-de-coordenadas/modo-de-edicao.jsx";
import { CorDoProjeto, ListaDeMunicipios } from "./lista.tsx";

/*
  MAPA DE PROJETOS (React)

  O mapa da Visão geral da área Projetos, com as MESMAS regras do da Saúde
  Indígena (src/modulos/mapa-saude-indigena/): o painel, o topo (Coordenadas,
  Brasil, Tela cheia), a moldura, a lista lateral, o leque, o enquadramento e
  o observador de tamanho são as peças comuns de painel-do-mapa.jsx e
  leaflet.js. Muda o que vai no mapa: um ponto por lugar das vagas de todos
  os projetos — município, ou o meio do estado quando o edital só diz a UF —,
  na cor do projeto, com o tamanho pelas vagas (a regra da bolha do DSEI), e a
  lista "Municípios por vagas", com filtro e agrupamento por projeto. Lógica
  pura em src/lib/visao-geral-da-area.ts.

  Os filtros da Visão geral valem aqui como na Saúde Indígena: com recorte
  (`filtroAtivo`), só os lugares com algum edital das `linhas` recortadas
  (`lugaresDoRecorte`). Enquadramento (`enquadramentoDoRecorte`): sem filtro
  — nem da página, nem o "Projeto" da lista —, o Brasil; com filtro, o ponto
  ou a caixa dos pontos que sobraram.

  Busca os lugares pelo `carregador` (carregador.js, um por Visão geral, com
  cache), só depois da primeira carga da página (`carregadoEm`: antes do
  login não há sessão); `carregadoEm` novo (Atualizar dados) pede de novo, e
  o cache decide se vai ao banco.

  As coordenadas vêm do banco (public."TB_COORDENADA_LOCAL_VAGA", na resposta da
  RPC). O administrador global e o Gestor veem "Coordenadas": o editor comum
  (src/modulos/editor-de-coordenadas/, aqui com as regras de
  src/lib/coordenadas-dos-projetos.js) toma o lugar da lista; o que ele grava
  vale na hora no mapa e no cache do carregador.
*/

const TEXTOS = TEXTOS_DO_MAPA[MAPA_DOS_MUNICIPIOS];
const SEM_LINHAS = Object.freeze([]);
// Clicar num lugar da lista aproxima até, no mínimo, o zoom do ponto do recorte.
const ZOOM_DO_LUGAR = 7;

/*
  Os lugares da área: `null` enquanto carrega. O cache fresco responde já
  (recarga sem piscar o "carregando"); senão, o último resultado desta área.
*/
function usarLugares(
  carregador: CarregadorDeMunicipios,
  area: string,
  carregadoEm: number,
) {
  const pronto = Boolean(carregador && area && carregadoEm);
  const [lidos, definirLidos] = useState<{
    area: string;
    resultado: ResultadoDosMunicipios | null;
  }>({ area: "", resultado: null });

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

/**
 * @param {{area?: string, carregador: ReturnType<typeof import("./carregador.ts").criarCarregadorDeMunicipios>, carregadoEm?: number, linhas?: readonly object[], filtroAtivo?: boolean, tema?: string, idDoMapa?: string, perfil?: object | null, supabase?: import("@supabase/supabase-js").SupabaseClient | null}} props
 */
export function MapaDeProjetos({
  area = "projetos",
  carregador,
  carregadoEm = 0,
  linhas = SEM_LINHAS,
  filtroAtivo = false,
  tema,
  idDoMapa = "mapaDosProjetos",
  perfil,
  supabase,
}: PropsDoMapaDeProjetos) {
  const escuroDoApp = usarTemaEscuro();
  const escuro = tema ? tema === "escuro" : escuroDoApp;
  const L = obterLeaflet();
  const [telaCheia, botaoDeTelaCheia] = usarTelaCheia();
  const resultado = usarLugares(carregador, area, carregadoEm);
  const carregando = !resultado;
  const podeEditar = podeEditarCoordenadas(perfil);
  // O que o editor gravou nesta montagem, por cima do que o carregador leu.
  const [corrigidas, definirCorrigidas] = useState<
    { lugar: string; latitude: number; longitude: number }[]
  >([]);
  const lidos = resultado?.municipios;
  const municipios = useMemo<readonly MunicipioDoMapa[] | undefined>(
    () =>
      corrigidas.reduce(
        (lista, c) =>
          aplicarCoordenada(lista, c.lugar, c.latitude, c.longitude),
        lidos,
      ),
    [lidos, corrigidas],
  );
  const noRecorte = useMemo(
    () => (filtroAtivo ? lugaresDoRecorte(municipios, linhas) : municipios),
    [municipios, linhas, filtroAtivo],
  );

  const [escolhaGuardada, definirEscolha] = useState(
    () => carregador?.obterEscolha?.() ?? ESCOLHA_INICIAL,
  );
  const mudarEscolha = (mudanca: Partial<EscolhaDoMapa>) => {
    carregador?.guardarEscolha?.(mudanca);
    definirEscolha((atual) => ({ ...atual, ...mudanca }));
  };

  const projetos = useMemo(() => projetosDosMunicipios(noRecorte), [noRecorte]);
  // Projeto que sumiu dos dados (ou do recorte) volta a "todos".
  const escolha = projetos.some(
    (projeto) => projeto.nome === escolhaGuardada.projeto,
  )
    ? escolhaGuardada
    : { ...escolhaGuardada, projeto: "" };
  const pontos = useMemo(
    () =>
      pontosDosMunicipios(noRecorte, {
        projeto: escolha.projeto,
        todos: municipios,
      }),
    [noRecorte, municipios, escolha.projeto],
  );
  const enquadramento = useMemo(
    () =>
      enquadramentoDoRecorte({
        pontos: pontos.flatMap((ponto) =>
          ponto.coordenadas ? [ponto.coordenadas] : [],
        ),
        filtroAtivo: filtroAtivo || Boolean(escolha.projeto),
      }),
    [pontos, filtroAtivo, escolha.projeto],
  );

  // ── Leaflet (as peças comuns aos dois mapas nacionais) ─────────────────
  const { refDoMapa, mapa, camadas, ultimoEnquadramento, aparecimentos } =
    usarMapaDoBrasil(L, {
      telaCheia,
      aoCriar: (novo: MapaNacional) => {
        const lugares = L.layerGroup().addTo(novo);
        const leque = criarLeque(L, novo, lugares);
        return {
          lugares,
          leque,
          marcadores: new Map<string, MarcadorDoMapa>(),
          parar: leque.parar,
        };
      },
    });
  const modo = usarModoDeEdicao({
    mapa,
    permitido: podeEditar,
    pegar: () => camadas.current?.pegar(),
  });
  const idDoPainel = `${idDoMapa}-painel-lateral`;

  // Um ponto por lugar com coordenada, na cor do projeto.
  useEffect(() => {
    if (!mapa || !camadas.current) return;
    const { lugares, leque } = camadas.current;
    lugares.clearLayers();
    leque.limpar();
    const marcadores = new Map<string, MarcadorDoMapa>();
    for (const ponto of pontos) {
      if (!ponto.coordenadas) continue;
      const marcador = L.circleMarker(ponto.coordenadas, {
        radius: ponto.raio,
        weight: 2,
        fillOpacity: OPACIDADE_DA_BOLHA,
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
      lugares.addLayer(marcador);
      leque.adicionar(marcador, ...ponto.coordenadas);
      marcadores.set(ponto.chave, marcador);
    }
    camadas.current.marcadores = marcadores;
    leque.aplicar();
  }, [L, mapa, camadas, pontos]);

  /*
    Enquadramento: só quando muda o que enquadrar (filtro da página, "Projeto"
    da lista — não ao agrupar) e, ao reaparecer ou mudar de tamanho sem a
    pessoa ter mexido (`usarMapaDoBrasil`), de novo. Enquanto carrega, fica
    no Brasil da criação.
  */
  useEffect(() => {
    if (!mapa || !camadas.current || carregando) return;
    if (enquadramento.chave === ultimoEnquadramento.current) return;
    ultimoEnquadramento.current = enquadramento.chave;
    remedir(mapa);
    try {
      enquadrar(L, mapa, enquadramento);
    } catch {
      // mapa sem tamanho ainda; o ResizeObserver reenquadra
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
    carregando,
    aparecimentos,
  ]);

  const chamadas = usarUltimo({
    aoAtualizarCoordenada: (
      data: CorrecaoDoLugar,
      ponto: PontoEditavelDoProjeto,
    ) => {
      const lugar = data?.lugar || ponto?.alvo?.lugar;
      const latitude = Number(data?.latitude);
      const longitude = Number(data?.longitude);
      if (!lugar || !Number.isFinite(latitude) || !Number.isFinite(longitude))
        return;
      carregador?.corrigirCoordenada?.(lugar, latitude, longitude);
      definirCorrigidas((atual) => [
        ...atual.filter((c) => c.lugar !== lugar),
        { lugar, latitude, longitude },
      ]);
    },
    // A lista leva ao ponto: aproxima e abre o popup (Projetos não tem o
    // nível do DSEI; o popup é o detalhe do lugar).
    aoEscolher: (ponto: PontoDoMunicipio) => {
      const marcador = camadas.current?.marcadores.get(ponto?.chave);
      if (!mapa || !marcador || !camadas.current || !ponto.coordenadas) return;
      camadas.current.pegar();
      mapa.setView(ponto.coordenadas, Math.max(mapa.getZoom(), ZOOM_DO_LUGAR), {
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
        className={classesDoPainel(modo)}
        aria-labelledby={`${idDoMapa}-titulo`}
      >
        <TopoDoMapa
          L={L}
          mapa={mapa}
          camadas={camadas}
          idDoMapa={idDoMapa}
          titulo={TEXTOS.titulo}
          contagem={
            carregando ? "…" : plural(pontos.length, "município", "municípios")
          }
          podeEditar={podeEditar}
          modo={modo}
          idDoPainel={idDoPainel}
          acoes={botaoDeTelaCheia}
        />
        <div className="mapa-si-painel__corpo">
          <MolduraDoMapa
            L={L}
            refDoMapa={refDoMapa}
            idDoMapa={idDoMapa}
            rotulo={TEXTOS.mapa}
          >
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
          </MolduraDoMapa>
          {modo.editando ? (
            <PainelDoEditor
              id={idDoPainel}
              rotulo="Coordenadas do mapa"
              modo={modo}
            >
              <EditorDeCoordenadasDosProjetos
                L={L}
                mapa={mapa}
                municipios={municipios}
                perfil={perfil}
                supabase={supabase}
                aoAtualizarMapa={(
                  data: CorrecaoDoLugar,
                  ponto: PontoEditavelDoProjeto,
                ) => chamadas.current.aoAtualizarCoordenada(data, ponto)}
                {...propsDoEditor(modo, idDoPainel)}
              />
            </PainelDoEditor>
          ) : (
            <ListaDeMunicipios
              id={idDoPainel}
              idDoTitulo={`${idDoMapa}-lista`}
              titulo={TEXTOS.lista}
              carregando={carregando}
              indisponivel={resultado?.indisponivel}
              erro={resultado?.erro}
              noRecorte={filtroAtivo}
              pontos={pontos}
              projetos={projetos}
              escolha={escolha}
              aoMudarEscolha={mudarEscolha}
              aoEscolher={(ponto: PontoDoMunicipio) =>
                chamadas.current.aoEscolher(ponto)
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

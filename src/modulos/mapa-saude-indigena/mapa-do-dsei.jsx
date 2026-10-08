import { useEffect, useMemo, useRef, useState } from "react";
import {
  agruparPorProximidadeNaTela,
  posicoesSpiderfy,
} from "../../lib/mapa-render.js";
import { formatarNumero } from "../../lib/mapa-saude-indigena/chaves.js";
import {
  CORES_DO_MAPA,
  ESTILO_DA_LINHA_DE_VINCULO,
  TEXTO_DA_LINHA_DE_VINCULO,
} from "../../lib/mapa-saude-indigena/formas.ts";
import {
  classificarRegistros,
  dicaDoRegistro,
  limitesDoDsei,
  linhaDaTerra,
  pontosDoDistrito,
  popupDaSede,
  popupDoRegistro,
  registroDaSede,
  registrosDoDsei,
  registrosExternos,
  textoDosVinculosExternos,
  tiposDoTerritorio,
  visiveis,
} from "../../lib/mapa-saude-indigena/mapa-do-dsei.js";
import { EstadoVazio, classes } from "../../ui/index.js";
import { Forma, LegendaDoDsei } from "./legenda.tsx";
import {
  adicionarFundo,
  conteudoEmElemento,
  criarMapa,
  desenharContornos,
  iconeDoRegistro,
  ligarDicaEPopup,
  observarTamanho,
  remedir,
} from "./leaflet.js";
import { usarUltimo } from "./usar-ultimo.ts";
import { podeEditarCoordenadas } from "../../lib/access-roles.js";
import { EditorDeCoordenadas } from "./editor-de-coordenadas.tsx";
import {
  BotaoDeRecolher,
  PainelDoEditor,
  usarModoDeEdicao,
} from "../editor-de-coordenadas/modo-de-edicao.tsx";

const OPCOES_DO_ENQUADRAMENTO = Object.freeze({
  padding: [34, 34],
  maxZoom: 9,
});

/*
  O território de um DSEI: o mapa à esquerda, à direita as unidades (com os
  filtros por tipo) e as Terras Indígenas e povos. Monta uma vez por DSEI
  (`key` no pai): trocar de distrito começa sem tipo escondido. "Voltar ao
  Brasil", no topo, pede a saída ao pai (o Esc faz o mesmo; volta-ao-brasil.js).
*/
export function MapaDoDsei({
  L,
  idDoMapa,
  dsei,
  redeCnes,
  telaCheia,
  acoes,
  aoVoltarAoBrasil,
  aoEscolherUnidade,
  lmap,
  perfil,
  supabase,
  aoAtualizarMapa,
}) {
  const refDoMapa = useRef(null);
  const [mapa, definirMapa] = useState(null);
  const camada = useRef(null);
  const escopo = useRef("territorio");
  const [comExternos, definirComExternos] = useState(false);
  const [ocultos, definirOcultos] = useState(() => new Set());
  const [terras, definirTerras] = useState([]);
  const podeEditar = podeEditarCoordenadas(perfil);
  const modo = usarModoDeEdicao({ mapa, permitido: podeEditar });
  const idDoPainel = `${idDoMapa}-painel-lateral`;
  const chamadas = usarUltimo({ aoEscolherUnidade });

  const classificados = useMemo(
    () => classificarRegistros(registrosDoDsei(dsei, redeCnes), dsei),
    [dsei, redeCnes],
  );
  const externos = useMemo(
    () => registrosExternos(classificados),
    [classificados],
  );
  const tipos = useMemo(
    () => tiposDoTerritorio(classificados),
    [classificados],
  );
  const mostrados = useMemo(
    () => visiveis(classificados, ocultos),
    [classificados, ocultos],
  );
  const limites = useMemo(
    () => limitesDoDsei(dsei, classificados),
    [dsei, classificados],
  );

  const enquadrar = (alvo, qual, { animar = false } = {}) => {
    if (!alvo) return;
    const pontos = limites[qual]?.length ? limites[qual] : limites.territorio;
    if (!pontos.length) return;
    escopo.current = qual;
    const oficial =
      qual === "territorio" ? alvo.__agsusDseiCoverageBounds : null;
    const caixa =
      oficial?.isValid?.() === true ? oficial : L.latLngBounds(pontos);
    try {
      alvo.fitBounds(caixa, { ...OPCOES_DO_ENQUADRAMENTO, animate: animar });
    } catch {
      alvo.setView(pontos[0], 7);
    }
  };
  const ultimoEnquadrar = usarUltimo(enquadrar);

  // Cria o mapa do distrito; o `remove` do cleanup desfaz camada, ouvintes e terras.
  useEffect(() => {
    const elemento = refDoMapa.current;
    if (!L || !elemento) return undefined;
    const novo = criarMapa(L, elemento);
    adicionarFundo(L, novo, elemento);
    // Aberto com a página escondida, reenquadra quando ela aparecer.
    const pararDeObservar = observarTamanho(novo, elemento, {
      aoAparecer: () => ultimoEnquadrar.current(novo, escopo.current),
    });
    const base = L.layerGroup().addTo(novo);
    const unidades = L.layerGroup().addTo(novo);
    desenharContornos(L, base, "detalhe");
    camada.current = unidades;

    /*
      A camada de Terras Indígenas recorta as terras pelas unidades do
      distrito (a Funai deixou de publicar a abrangência) e devolve a lista que
      sobrou; quando a abrangência oficial chega, ela enquadra o território.
    */
    novo.__agsusAoMudarTerras = (lista) =>
      definirTerras(Array.isArray(lista) ? lista : []);
    novo.__agsusSetDseiCoverage?.(
      dsei.n,
      pontosDoDistrito(dsei, classificados),
      dsei.ufs || [],
    );
    const aoChegarAbrangencia = (evento) => {
      if (escopo.current !== "territorio") return;
      if (evento?.bounds?.isValid?.() !== true) return;
      try {
        novo.fitBounds(evento.bounds, {
          ...OPCOES_DO_ENQUADRAMENTO,
          animate: false,
        });
      } catch {
        // mapa sem tamanho
      }
    };
    novo.on("agsus:dsei-coverage-ready", aoChegarAbrangencia);

    ultimoEnquadrar.current(novo, "territorio");
    /*
      A troca para o mapa do DSEI muda a largura: o `fitBounds` feito antes
      do layout calcula o zoom com a medida antiga. Remede e reenquadra depois.
    */
    const quadro = requestAnimationFrame(() => {
      remedir(novo);
      ultimoEnquadrar.current(novo, escopo.current);
    });
    const espera = setTimeout(() => {
      remedir(novo);
      ultimoEnquadrar.current(novo, escopo.current);
    }, 80);
    definirMapa(novo);
    return () => {
      cancelAnimationFrame(quadro);
      clearTimeout(espera);
      pararDeObservar();
      novo.off("agsus:dsei-coverage-ready", aoChegarAbrangencia);
      novo.__agsusAoMudarTerras = null;
      novo.__agsusSetDseiCoverage?.("");
      novo.remove();
      camada.current = null;
      definirMapa(null);
    };
    // Um mapa por DSEI: o pai troca a `key` quando o distrito muda.
  }, [L]);

  /*
    As unidades. Pontos que caem a menos de 14 px na tela abrem em leque, com
    uma linha até a coordenada verdadeira (que nunca muda); a sede (estrela)
    volta a cada redesenho, acima de tudo; as linhas de vínculo saem dela.
    Reagrupa a cada zoom, porque a proximidade é em pixels.
  */
  useEffect(() => {
    if (!mapa || !camada.current) return undefined;
    const unidades = camada.current;
    const sede = registroDaSede(dsei);
    const marcadorDe = (registro, posicao) => {
      const marcador = L.marker(posicao || [registro.lat, registro.lon], {
        icon: iconeDoRegistro(L, document, registro),
        keyboard: true,
        title: registro.name,
        ...(registro.type?.key === "sede" ? { zIndexOffset: 400 } : {}),
      });
      return ligarDicaEPopup(marcador, document, {
        dica:
          registro.type?.key === "sede" ? null : dicaDoRegistro(registro, dsei),
        popup:
          registro.type?.key === "sede"
            ? popupDaSede(dsei)
            : popupDoRegistro(registro),
      });
    };
    const desenhar = () => {
      unidades.clearLayers();
      if (sede) unidades.addLayer(marcadorDe(sede));
      if (sede) {
        for (const r of visiveis(externos, ocultos)) {
          unidades.addLayer(
            L.polyline(
              [
                [sede.lat, sede.lon],
                [r.lat, r.lon],
              ],
              { ...ESTILO_DA_LINHA_DE_VINCULO },
            ).bindTooltip(
              conteudoEmElemento(document, {
                linhas: [TEXTO_DA_LINHA_DE_VINCULO],
              }),
              { sticky: true },
            ),
          );
        }
      }
      agruparPorProximidadeNaTela(mostrados, (r) =>
        mapa.latLngToLayerPoint([r.lat, r.lon]),
      ).forEach((grupo) => {
        if (grupo.registros.length === 1) {
          unidades.addLayer(marcadorDe(grupo.registros[0]));
          return;
        }
        const centro = mapa.latLngToLayerPoint([grupo.lat, grupo.lon]);
        posicoesSpiderfy(grupo.registros.length).forEach((pos, i) => {
          const destino = mapa.layerPointToLatLng(
            centro.add(L.point(pos.x, pos.y)),
          );
          unidades.addLayer(
            L.polyline([[grupo.lat, grupo.lon], destino], {
              color: CORES_DO_MAPA.traco,
              weight: 1.1,
              opacity: 0.55,
              interactive: false,
            }),
          );
          unidades.addLayer(marcadorDe(grupo.registros[i], destino));
        });
      });
    };
    desenhar();
    mapa.on("zoomend", desenhar);
    return () => mapa.off("zoomend", desenhar);
  }, [L, mapa, dsei, mostrados, externos, ocultos]);

  // Tela cheia muda o tamanho: remede.
  useEffect(() => {
    if (!mapa) return undefined;
    const quadro = requestAnimationFrame(() => remedir(mapa));
    return () => cancelAnimationFrame(quadro);
  }, [mapa, telaCheia]);

  const alternarExternos = () => {
    const proximo = !comExternos;
    definirComExternos(proximo);
    enquadrar(mapa, proximo ? "completo" : "territorio", { animar: true });
  };

  const alternarTipo = (chave) =>
    definirOcultos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const irParaUnidade = (registro) => {
    if (mapa) {
      mapa.flyTo([registro.lat, registro.lon], Math.max(mapa.getZoom(), 11), {
        duration: 0.45,
      });
    }
    chamadas.current.aoEscolherUnidade?.(registro);
  };

  const irParaTerra = (terra) => {
    if (!terra.caixa) return;
    mapa?.__agsusEnquadrarTerra?.(terra.nome, terra.caixa);
  };

  const linhasDasTerras = terras.map(linhaDaTerra);
  const tituloId = `${idDoMapa}-titulo`;

  return (
    <section
      className={classes(
        "ui-card mapa-si-painel mapa-si-painel--dsei",
        modo.editando && "mapa-si-painel--editando",
      )}
      aria-labelledby={tituloId}
    >
      <header className="mapa-si-painel__topo">
        <div className="mapa-si-painel__titulos">
          <button
            type="button"
            className="btn small mapa-si-voltar"
            data-tour="visao-geral-mapa-voltar-ao-brasil"
            title="Voltar ao mapa do Brasil (Esc)"
            onClick={() => aoVoltarAoBrasil?.()}
          >
            <span aria-hidden="true">←</span> Voltar ao Brasil
          </button>
          <h2 className="ui-titulo" id={tituloId}>
            Mapa do DSEI {dsei.n}
          </h2>
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
              aria-pressed={modo.editando}
              aria-expanded={modo.editando}
              aria-controls={idDoPainel}
              title={modo.editando ? "Sair da edição (Esc)" : undefined}
              onClick={modo.alternar}
            >
              Coordenadas
            </button>
          ) : null}
          {externos.length ? (
            <>
              <span className="mapa-si-chip-externo">
                {textoDosVinculosExternos(externos.length)}
              </span>
              <button
                type="button"
                className="btn small"
                aria-pressed={comExternos}
                onClick={alternarExternos}
              >
                {comExternos
                  ? "Voltar ao território"
                  : "Mostrar vínculos externos"}
              </button>
            </>
          ) : null}
          {modo.editando ? null : acoes}
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
              aria-label={`Mapa dos polos e unidades do DSEI ${dsei.n}`}
            />
          ) : (
            <EstadoVazio className="ui-vazio mapa-si-sem-mapa">
              Mapa indisponível sem conexão: o fundo geográfico precisa de
              internet.
            </EstadoVazio>
          )}
        </div>
        {modo.editando ? (
          <PainelDoEditor
            id={idDoPainel}
            rotulo={`Coordenadas do DSEI ${dsei.n}`}
            modo={modo}
          >
            <EditorDeCoordenadas
              L={L}
              mapa={mapa}
              lmap={lmap}
              redeCnes={redeCnes}
              dsei={dsei.k}
              perfil={perfil}
              supabase={supabase}
              aoAtualizarMapa={aoAtualizarMapa}
              aoFechar={modo.fechar}
              areaLivre={modo.areaLivre}
              versaoDaArea={modo.versaoDaArea}
              botaoDeRecolher={
                <BotaoDeRecolher
                  modo={modo}
                  idDoConteudo={`${idDoPainel}-conteudo`}
                />
              }
            />
          </PainelDoEditor>
        ) : (
          <aside
            className="mapa-si-lista"
            id={idDoPainel}
            aria-label={`Polos e unidades do DSEI ${dsei.n}`}
          >
            <>
              <div className="mapa-si-lista__topo">
                <span>Polos e unidades</span>
                <b>{formatarNumero(mostrados.length)}</b>
              </div>
              {tipos.length > 1 ? (
                <div
                  className="mapa-si-filtros"
                  role="group"
                  aria-label="Filtrar as unidades por tipo"
                >
                  {tipos.map(({ tipo, quantidade }) => (
                    <button
                      key={tipo.key}
                      type="button"
                      aria-pressed={!ocultos.has(tipo.key)}
                      onClick={() => alternarTipo(tipo.key)}
                    >
                      <Forma tipo={tipo.key} tamanho={12} />
                      {tipo.label} <b>{formatarNumero(quantidade)}</b>
                    </button>
                  ))}
                </div>
              ) : null}
              {mostrados.length ? (
                <ul className="mapa-si-lista__itens">
                  {mostrados.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="mapa-si-unidade"
                        aria-label={`Localizar ${r.name} no mapa`}
                        onClick={() => irParaUnidade(r)}
                      >
                        <Forma tipo={r.type.key} tamanho={16} />
                        <span className="mapa-si-unidade__corpo">
                          <strong title={r.name}>{r.name}</strong>
                          <small>
                            {r.city || "Localidade não informada"}
                            {r.ufAdministrativa
                              ? ` · ${r.ufAdministrativa}`
                              : ""}
                            {r.vinculo === "externo" ? (
                              <b className="mapa-si-unidade__externo">
                                {" "}
                                · fora da área
                              </b>
                            ) : null}
                          </small>
                        </span>
                        <span className="mapa-si-unidade__tipo">
                          {r.type.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EstadoVazio>
                  {ocultos.size
                    ? "Nada a mostrar com estes filtros."
                    : "Nenhuma unidade georreferenciada."}
                </EstadoVazio>
              )}
              <div className="mapa-si-lista__topo">
                <span>Terras Indígenas e povos</span>
                <b>{formatarNumero(linhasDasTerras.length)}</b>
              </div>
              {linhasDasTerras.length ? (
                <ul className="mapa-si-lista__itens">
                  {linhasDasTerras.map((t, i) => (
                    <li key={`${t.nome}|${i}`}>
                      <button
                        type="button"
                        className="mapa-si-terra"
                        aria-label={`Localizar a Terra Indígena ${t.nome} no mapa`}
                        disabled={!t.caixa}
                        onClick={() => irParaTerra(t)}
                      >
                        <strong>{t.nome}</strong>
                        <span
                          className={classes(
                            "mapa-si-terra__povos",
                            !t.povoDeclarado && "mapa-si-terra__povos--ausente",
                          )}
                        >
                          {t.povos}
                        </span>
                        {t.detalhe ? <small>{t.detalhe}</small> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EstadoVazio>Nenhuma Terra Indígena no recorte.</EstadoVazio>
              )}
            </>
          </aside>
        )}
      </div>
      <LegendaDoDsei mapa={mapa} />
    </section>
  );
}

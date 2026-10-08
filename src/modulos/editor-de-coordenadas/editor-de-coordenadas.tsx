import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  AlteracaoDoPonto,
  PontoDoEditor,
  SugestaoDoEditor,
  FiltroDeGravidade,
  FolgaDoEditor,
} from "../../lib/tipos-do-editor-de-coordenadas.ts";
import type { CoordenadasDoMapa } from "../../lib/tipos-do-mapa.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PropsDoEditor,
  PinDoEditor,
  CorrecaoDoEditor,
  AcaoDoEditor,
  ArgumentosDaRpc,
} from "./tipos.ts";
import { eLeafletDoEditor, eMapaDoEditor } from "./leaflet-do-editor.ts";
import {
  registroDoEditor,
  pendenciasDoEditor,
  historicoDoEditor,
  correcaoDoEditor,
} from "../../lib/respostas-do-editor-de-coordenadas.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { podeEditarCoordenadas } from "../../lib/access-roles.js";
import {
  formatarCoordenada,
  formatarDistancia,
  lerCoordenada,
  validarCorrecaoDoMapa,
} from "../../lib/editor-de-coordenadas.ts";
import { CORES_DO_MAPA } from "../../lib/mapa-saude-indigena/formas.js";
import { Aviso, Campo, Selo, classes } from "../../ui/index.js";
import { usarUltimo } from "../mapa-saude-indigena/usar-ultimo.js";
import { FilaDeCoordenadas } from "./fila-de-coordenadas.tsx";
import { HistoricoDoPonto } from "./historico-do-ponto.tsx";
import { SugestoesDoPonto } from "./sugestoes-do-ponto.tsx";

export const LIMITE_DO_HISTORICO = 5;

/* Sugestões desenhadas em azul (posição oficial); as outras, em laranja. */
const FONTES_EM_AZUL = new Set(["CNES", "MUNICIPIO", "UF"]);

const textoDaPosicao = (valor: number | null | undefined) =>
  valor == null ? "" : String(valor);
const mensagemDoErro = (erro: unknown, reserva: string) =>
  registroDoEditor(erro) && typeof erro.message === "string"
    ? erro.message || reserva
    : reserva;

/* Lê uma RPC de lista (pendências, histórico) com o estado de carga. */
interface EstadoDaLista<T> {
  lista: T[];
  carregando: boolean;
  erro: string;
}
function usarLista<T>(
  ultimos: RefObject<{ supabase?: SupabaseClient | null }>,
  ativo: boolean,
  nome: string,
  argumentos: (() => ArgumentosDaRpc) | null,
  chave: string,
  erroPadrao: string,
  normalizar: (valor: unknown) => T[],
): [EstadoDaLista<T>, Dispatch<SetStateAction<EstadoDaLista<T>>>] {
  const [estado, definirEstado] = useState<EstadoDaLista<T>>(() => ({
    lista: [],
    carregando: Boolean(ativo),
    erro: "",
  }));
  useEffect(() => {
    if (!ativo) {
      definirEstado({ lista: [], carregando: false, erro: "" });
      return undefined;
    }
    const cliente = ultimos.current.supabase;
    if (!cliente?.rpc) {
      definirEstado({ lista: [], carregando: false, erro: "" });
      return undefined;
    }
    let vivo = true;
    definirEstado((atual) => ({ ...atual, carregando: true, erro: "" }));
    Promise.resolve(cliente.rpc(nome, argumentos?.()))
      .then((resposta) => {
        if (resposta?.error) throw resposta.error;
        if (vivo)
          definirEstado({
            lista: normalizar(resposta?.data),
            carregando: false,
            erro: "",
          });
      })
      .catch((falha) => {
        if (vivo)
          definirEstado({
            lista: [],
            carregando: false,
            erro: mensagemDoErro(falha, erroPadrao),
          });
      });
    return () => {
      vivo = false;
    };
    // `argumentos` é derivado de `chave` (só ela dispara nova leitura).
  }, [ativo, nome, chave, ultimos, erroPadrao, normalizar]);
  return [estado, definirEstado];
}

/*
  O EDITOR DE COORDENADAS (administrador global e Gestor), comum aos dois mapas: a
  fila de pontos com busca, "Só pendentes" e gravidade, o formulário da
  prévia (pin arrastável), as sugestões do ponto pendente, "Conferido" (com ou
  sem mudar a posição) e o histórico com "Desfazer". Tudo grava por RPC; o
  mapa recebe a resposta da RPC (`aoAtualizarMapa(data, ponto)`).

  O que é de cada mapa vem em `fonte` (montada por quem usa: o editor da
  Saúde Indígena e o de Projetos), sempre a mesma referência:
  - `rpc`: { salvar, desfazer, pendencias, historico } — os nomes das RPCs;
  - `fila(pontos, pendencias, opcoes)`, `chaveDoPonto(ponto)`,
    `chaveDaPendencia(p)`, `sugestoes(pendencia, ponto)`,
    `gravidade(pendencia, ponto)` e `pendenteSemPendencia?(ponto)`: as regras;
  - `argumentosDoSalvar({ ponto, latitude, longitude, motivo, conferir })` e
    `argumentosDoHistorico(ponto, limite)`;
  - `textos`: { busca, lista } e `detalheDoItem(item)` para a fila.

  No modo de edição (modo-de-edicao.tsx) o editor flutua sobre o mapa:
  `areaLivre()` devolve os paddings do Leaflet que descontam o painel (o
  enquadramento do ponto e da sugestão cai na parte visível), `versaoDaArea`
  muda quando o painel recolhe ou abre (o pin volta para a área livre) e
  `botaoDeRecolher` vai no topo, ao lado de "Voltar à lista".
*/
const FOLGA_PADRAO: FolgaDoEditor = Object.freeze({
  padding: [48, 48] as [number, number],
});

export function EditorDeCoordenadas<P extends PontoDoEditor>({
  L: recebidoL,
  mapa: recebidoMapa,
  pontos,
  fonte,
  perfil,
  supabase,
  aoAtualizarMapa,
  aoFechar,
  areaLivre,
  versaoDaArea = 0,
  botaoDeRecolher = null,
}: PropsDoEditor<P>) {
  const L = eLeafletDoEditor(recebidoL) ? recebidoL : null;
  const mapa = eMapaDoEditor(recebidoMapa) ? recebidoMapa : null;
  const permitido = podeEditarCoordenadas(perfil);
  const ultimos = usarUltimo({
    permitido,
    supabase,
    aoAtualizarMapa,
    fonte,
    areaLivre,
  });
  const folga = () => ultimos.current.areaLivre?.() || FOLGA_PADRAO;
  const [pendencias, definirPendencias] = usarLista(
    ultimos,
    permitido,
    fonte.rpc.pendencias,
    null,
    "pendencias",
    "Não foi possível carregar as pendências.",
    pendenciasDoEditor,
  );
  const [busca, definirBusca] = useState("");
  const [soPendentes, definirSoPendentes] = useState(true);
  const [gravidade, definirGravidade] = useState<FiltroDeGravidade>("");
  const fila = useMemo(
    () =>
      fonte.fila(pontos, pendencias.lista, {
        busca,
        soPendentes,
        gravidade: soPendentes ? gravidade : "",
      }),
    [fonte, pontos, pendencias.lista, busca, soPendentes, gravidade],
  );
  const [id, definirId] = useState("");
  const ponto = (pontos || []).find((p) => p.id === id) || null;
  const pendencia = ponto
    ? pendencias.lista.find(
        (p) => fonte.chaveDaPendencia(p) === fonte.chaveDoPonto(ponto),
      ) || null
    : null;
  // Conferível: tem pendência no banco ainda não conferida. Pendente também
  // quando o mapa diz que o ponto precisa de atenção sem pendência gravada
  // (Projetos: lugar sem coordenada) — aí só "Salvar coordenada".
  const conferivel = Boolean(pendencia && !pendencia.conferido);
  const pendente =
    conferivel ||
    Boolean(ponto && !pendencia && fonte.pendenteSemPendencia?.(ponto));
  const sugestoes = useMemo(
    () => (ponto && pendente ? fonte.sugestoes(pendencia, ponto) : []),
    [fonte, pendente, pendencia, ponto],
  );
  const gravidadeDoPonto = useMemo(
    () => (ponto && pendente ? fonte.gravidade(pendencia, ponto) : null),
    [fonte, pendente, pendencia, ponto],
  );
  const idDaMelhor = gravidadeDoPonto?.melhor?.id || "";
  const [versaoDoHistorico, definirVersaoDoHistorico] = useState(0);
  const [historico] = usarLista(
    ultimos,
    permitido && Boolean(ponto),
    fonte.rpc.historico,
    () =>
      ponto ? fonte.argumentosDoHistorico(ponto, LIMITE_DO_HISTORICO) : {},
    `${id}#${versaoDoHistorico}`,
    "Não foi possível carregar o histórico.",
    historicoDoEditor,
  );
  const [latitude, definirLatitude] = useState("");
  const [longitude, definirLongitude] = useState("");
  const [motivo, definirMotivo] = useState("");
  const [erro, definirErro] = useState("");
  const [mensagem, definirMensagem] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const [confirmando, definirConfirmando] = useState<AcaoDoEditor | null>(null);
  const marcador = useRef<PinDoEditor | null>(null);
  const montado = useRef(true);
  const latitudeNumero = lerCoordenada(latitude);
  const longitudeNumero = lerCoordenada(longitude);
  const mudou =
    ponto &&
    (latitudeNumero !== ponto.latitude || longitudeNumero !== ponto.longitude);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  useEffect(() => {
    definirLatitude(textoDaPosicao(ponto?.latitude));
    definirLongitude(textoDaPosicao(ponto?.longitude));
    definirErro("");
    definirConfirmando(null);
  }, [ponto]);
  useEffect(() => {
    definirMotivo("");
  }, [id]);

  useEffect(() => {
    if (!permitido || !mapa || !L || !ponto) return undefined;
    const posicao =
      ponto.latitude != null &&
      ponto.longitude != null &&
      Number.isFinite(ponto.latitude) &&
      Number.isFinite(ponto.longitude)
        ? ([ponto.latitude, ponto.longitude] as CoordenadasDoMapa)
        : mapa.getCenter();
    const pin = L.marker(posicao, {
      draggable: true,
      keyboard: true,
      title: `Prévia de ${ponto.nome}`,
      alt: `Prévia de ${ponto.nome}`,
      zIndexOffset: 800,
    }).addTo(mapa);
    const dica = document.createElement("span");
    dica.textContent = "Prévia · arraste para corrigir";
    pin.bindTooltip(dica, { permanent: true, direction: "top" });
    const aoArrastar = () => {
      const posicaoAtual = pin.getLatLng();
      definirLatitude(posicaoAtual.lat.toFixed(6));
      definirLongitude(posicaoAtual.lng.toFixed(6));
      definirConfirmando(null);
      definirErro("");
      definirMensagem("");
    };
    pin.on("dragend", aoArrastar);
    marcador.current = pin;
    return () => {
      pin.off("dragend", aoArrastar);
      mapa.removeLayer(pin);
      marcador.current = null;
    };
  }, [permitido, mapa, L, ponto]);

  /*
    As sugestões do ponto no mapa: um círculo por posição candidata (aldeia
    em laranja, CNES em azul; a mais provável maior), com a dica da fonte e
    da distância; clicar usa a posição na prévia. A mais provável liga-se à
    posição atual por uma linha tracejada e o mapa enquadra as duas — senão,
    vai até o ponto. O enquadramento desconta o painel do editor (`folga`):
    o ponto sozinho também vai por `flyToBounds`, que centra na área livre.
  */
  useEffect(() => {
    if (!permitido || !mapa || !L || !ponto) return undefined;
    const atual: CoordenadasDoMapa | null =
      ponto.latitude != null &&
      ponto.longitude != null &&
      Number.isFinite(ponto.latitude) &&
      Number.isFinite(ponto.longitude)
        ? [ponto.latitude, ponto.longitude]
        : null;
    const camada = L.layerGroup().addTo(mapa);
    let melhor: SugestaoDoEditor | null = null;
    for (const s of sugestoes) {
      const destaque = s.id === idDaMelhor;
      if (destaque) melhor = s;
      const circulo = L.circleMarker([s.latitude, s.longitude], {
        radius: destaque ? 9 : 6,
        weight: destaque ? 3 : 2,
        color: FONTES_EM_AZUL.has(s.fonte)
          ? CORES_DO_MAPA.sugestaoDoCnes
          : CORES_DO_MAPA.sugestaoDeAldeia,
        fillOpacity: 0.3,
      });
      // Texto, não HTML: o nome vem de bases externas (OSM é editável).
      const dicaDaSugestao = document.createElement("span");
      dicaDaSugestao.textContent = [
        destaque ? "Mais provável" : "",
        s.rotulo,
        s.nome,
        formatarDistancia(s.distanciaKm),
      ]
        .filter(Boolean)
        .join(" · ");
      circulo.bindTooltip(dicaDaSugestao);
      circulo.on("click", () => {
        definirLatitude(s.latitude.toFixed(6));
        definirLongitude(s.longitude.toFixed(6));
        definirConfirmando(null);
        definirErro("");
        definirMensagem("");
      });
      camada.addLayer(circulo);
    }
    if (atual && melhor) {
      const destino: CoordenadasDoMapa = [melhor.latitude, melhor.longitude];
      camada.addLayer(
        L.polyline([atual, destino], {
          color: CORES_DO_MAPA.traco,
          weight: 2,
          dashArray: "6 6",
        }),
      );
      mapa.flyToBounds(L.latLngBounds([atual, destino]), {
        ...folga(),
        maxZoom: 13,
      });
    } else {
      const centro = atual || mapa.getCenter();
      mapa.flyToBounds(L.latLngBounds([centro, centro]), {
        ...folga(),
        maxZoom: Math.max(mapa.getZoom(), 11),
      });
    }
    return () => {
      mapa.removeLayer(camada);
    };
    // `folga` lê o último `areaLivre` (ref): não redesenha a cada renderização.
  }, [permitido, mapa, L, ponto, sugestoes, idDaMelhor]);

  // O painel recolheu ou abriu: o pin volta para dentro da área livre.
  const versaoVista = useRef(versaoDaArea);
  useEffect(() => {
    if (versaoVista.current === versaoDaArea) return;
    versaoVista.current = versaoDaArea;
    const posicao = marcador.current?.getLatLng?.();
    if (posicao) mapa?.panInside?.(posicao, folga());
  }, [versaoDaArea, mapa]);

  useEffect(() => {
    if (Number.isFinite(latitudeNumero) && Number.isFinite(longitudeNumero))
      marcador.current?.setLatLng([latitudeNumero, longitudeNumero]);
  }, [latitudeNumero, longitudeNumero]);
  useEffect(() => {
    if (salvando) marcador.current?.dragging?.disable();
    else marcador.current?.dragging?.enable();
  }, [salvando]);

  if (!permitido) return null;
  const limparAvisos = () => {
    definirConfirmando(null);
    definirErro("");
    definirMensagem("");
  };
  const editar = (definir: Dispatch<SetStateAction<string>>, valor: string) => {
    definir(valor);
    limparAvisos();
  };
  const usarSugestao = (sugestao: SugestaoDoEditor) => {
    definirLatitude(sugestao.latitude.toFixed(6));
    definirLongitude(sugestao.longitude.toFixed(6));
    limparAvisos();
  };
  const desfazerPrevia = () => {
    definirLatitude(textoDaPosicao(ponto?.latitude));
    definirLongitude(textoDaPosicao(ponto?.longitude));
    limparAvisos();
  };
  const aplicarResposta = (data: CorrecaoDoEditor, alvo: P) => {
    ultimos.current.aoAtualizarMapa?.(data, alvo);
    if (typeof data?.conferido === "boolean") {
      const conferido = data.conferido;
      const { chaveDoPonto, chaveDaPendencia } = ultimos.current.fonte;
      const chave = chaveDoPonto(alvo);
      definirPendencias((atual) => ({
        ...atual,
        lista: atual.lista.map((p) =>
          chaveDaPendencia(p) === chave ? { ...p, conferido } : p,
        ),
      }));
    }
    definirVersaoDoHistorico((v) => v + 1);
  };
  const chamar = async (
    nome: string,
    argumentos: ArgumentosDaRpc,
    sucesso: string,
  ) => {
    const alvo = ponto;
    if (!alvo) return;
    definirSalvando(true);
    definirErro("");
    try {
      if (!ultimos.current.supabase?.rpc)
        throw new Error("Conexão indisponível. Tente novamente.");
      const { data, error } = await ultimos.current.supabase.rpc(
        nome,
        argumentos,
      );
      if (error) throw error;
      if (!ultimos.current.permitido) return;
      const resposta = correcaoDoEditor(data);
      if (!resposta) throw new Error("Resposta inválida ao salvar coordenada.");
      aplicarResposta(resposta, alvo);
      if (!montado.current) return;
      definirConfirmando(null);
      definirMotivo("");
      definirMensagem(sucesso);
    } catch (falha) {
      if (montado.current)
        definirErro(
          mensagemDoErro(falha, "Não foi possível salvar. Tente novamente."),
        );
    } finally {
      if (montado.current) definirSalvando(false);
    }
  };
  const enviar = async (acao: AcaoDoEditor) => {
    if (salvando || !ponto || !ultimos.current.permitido) return;
    const falha = validarCorrecaoDoMapa(
      latitudeNumero,
      longitudeNumero,
      motivo,
    );
    if (falha) {
      definirErro(falha);
      return;
    }
    if (acao === "corrigir" && !mudou) {
      definirErro("A coordenada não mudou.");
      return;
    }
    if (confirmando !== acao) {
      definirConfirmando(acao);
      return;
    }
    const conferir = acao === "conferir";
    await chamar(
      fonte.rpc.salvar,
      fonte.argumentosDoSalvar({
        ponto,
        latitude: latitudeNumero,
        longitude: longitudeNumero,
        motivo: motivo.trim(),
        conferir,
      }),
      conferir ? "Ponto conferido." : "Coordenada salva.",
    );
  };
  const desfazerAlteracao = async (
    alteracao: AlteracaoDoPonto,
    motivoDoDesfazer: string,
  ) => {
    if (salvando || !ponto || !alteracao || !ultimos.current.permitido) return;
    await chamar(
      fonte.rpc.desfazer,
      { p_historico: alteracao.id, p_motivo: motivoDoDesfazer },
      "Alteração desfeita.",
    );
  };
  const textoDoBotao = (
    acao: AcaoDoEditor,
    rotulo: string,
    confirmacao: string,
  ) => (confirmando === acao ? (salvando ? "Salvando…" : confirmacao) : rotulo);

  return (
    <form
      className={classes(
        "mapa-si-coordenadas",
        ponto && "mapa-si-coordenadas--com-ponto",
      )}
      onSubmit={(evento) => {
        evento.preventDefault();
        enviar("corrigir");
      }}
      aria-label="Corrigir coordenadas"
    >
      <div className="mapa-si-coordenadas__topo">
        <h3 className="ui-titulo">Corrigir coordenadas</h3>
        <div className="mapa-si-coordenadas__topo-acoes">
          {botaoDeRecolher}
          {aoFechar ? (
            <button
              type="button"
              className="btn small"
              disabled={salvando}
              onClick={aoFechar}
            >
              Voltar à lista
            </button>
          ) : null}
        </div>
      </div>
      <FilaDeCoordenadas
        placeholder={fonte.textos.busca}
        rotuloDaLista={fonte.textos.lista}
        detalheDoItem={fonte.detalheDoItem}
        itens={fila.itens}
        pendentes={fila.pendentes}
        porGravidade={fila.porGravidade}
        gravidade={gravidade}
        busca={busca}
        soPendentes={soPendentes}
        escolhido={id}
        carregando={pendencias.carregando}
        erro={pendencias.erro}
        desabilitado={salvando}
        aoBuscar={definirBusca}
        aoAlternarPendentes={definirSoPendentes}
        aoFiltrarGravidade={definirGravidade}
        aoEscolher={(novo) => {
          definirId(novo);
          definirMensagem("");
        }}
      />
      {ponto ? (
        <>
          <div className="mapa-si-coordenadas__escolhido">
            <b>{ponto.nome}</b>
            {pendente ? (
              <Selo tom="pendente">Pendente</Selo>
            ) : pendencia ? (
              <Selo tom="aprovado">Conferido</Selo>
            ) : null}
          </div>
          {pendente ? (
            <SugestoesDoPonto
              sugestoes={sugestoes}
              motivo={pendencia?.motivo}
              gravidade={gravidadeDoPonto}
              desabilitado={salvando}
              aoUsar={usarSugestao}
            />
          ) : null}
          <details
            className="mapa-si-coordenadas__bloco mapa-si-coordenadas__secao"
            aria-label="Correção"
            open
          >
            <summary className="mapa-si-coordenadas__subtitulo">
              Correção
            </summary>
            <div className="mapa-si-coordenadas__par">
              <Campo rotulo="Latitude" obrigatorio>
                <input
                  inputMode="decimal"
                  value={latitude}
                  disabled={salvando}
                  onChange={(e) => editar(definirLatitude, e.target.value)}
                />
              </Campo>
              <Campo rotulo="Longitude" obrigatorio>
                <input
                  inputMode="decimal"
                  value={longitude}
                  disabled={salvando}
                  onChange={(e) => editar(definirLongitude, e.target.value)}
                />
              </Campo>
            </div>
            <dl>
              <dt>Atual</dt>
              <dd>
                {formatarCoordenada(ponto.latitude)},{" "}
                {formatarCoordenada(ponto.longitude)}
              </dd>
              <dt>Prévia</dt>
              <dd>
                {formatarCoordenada(latitudeNumero)},{" "}
                {formatarCoordenada(longitudeNumero)}
              </dd>
            </dl>
            <Campo rotulo="Motivo e fonte da correção" obrigatorio>
              <textarea
                value={motivo}
                disabled={salvando}
                maxLength={1000}
                onChange={(e) => editar(definirMotivo, e.target.value)}
              />
            </Campo>
            {erro ? (
              <Aviso tom="danger" papel="alert">
                {erro}
              </Aviso>
            ) : null}
            {mensagem ? <Aviso papel="status">{mensagem}</Aviso> : null}
            {confirmando === "corrigir" ? (
              <Aviso tom="warning">
                Confirme a nova posição para {ponto.nome}.
              </Aviso>
            ) : null}
            {confirmando === "conferir" ? (
              <Aviso tom="warning">
                {mudou
                  ? `Confirme a nova posição e a conferência de ${ponto.nome}.`
                  : `Confirme que a posição atual de ${ponto.nome} está certa.`}
              </Aviso>
            ) : null}
            <div className="mapa-si-coordenadas__acoes">
              <button
                className="btn"
                type="button"
                disabled={salvando || !mudou}
                onClick={desfazerPrevia}
              >
                Desfazer prévia
              </button>
              <button
                className={conferivel ? "btn" : "btn primary"}
                type="submit"
                disabled={salvando || !mudou}
              >
                {textoDoBotao(
                  "corrigir",
                  "Salvar coordenada",
                  "Confirmar correção",
                )}
              </button>
              {conferivel ? (
                <button
                  className="btn primary"
                  type="button"
                  disabled={salvando}
                  onClick={() => enviar("conferir")}
                >
                  {textoDoBotao(
                    "conferir",
                    "Conferido",
                    "Confirmar conferência",
                  )}
                </button>
              ) : null}
            </div>
          </details>
          <HistoricoDoPonto
            historico={historico.lista}
            carregando={historico.carregando}
            erro={historico.erro}
            desabilitado={salvando}
            aoDesfazer={desfazerAlteracao}
          />
        </>
      ) : null}
    </form>
  );
}

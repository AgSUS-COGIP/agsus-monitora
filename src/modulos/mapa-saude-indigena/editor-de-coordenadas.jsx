import { useEffect, useMemo, useRef, useState } from "react";
import { isAdminGlobal } from "../../lib/access-roles.js";
import {
  chaveDaPendencia,
  filaDeCoordenadas,
  formatarCoordenada,
  lerCoordenada,
  pontosEditaveisDoMapa,
  validarCorrecaoDoMapa,
} from "../../lib/coordenadas-do-mapa.js";
import { Aviso, Campo, Selo } from "../../ui/index.js";
import { FilaDeCoordenadas } from "./fila-de-coordenadas.jsx";
import { HistoricoDoPonto } from "./historico-do-ponto.jsx";
import { SugestoesDoPonto } from "./sugestoes-do-ponto.jsx";
import { usarUltimo } from "./usar-ultimo.js";

const RPC_SALVAR = "salvar_coordenada_mapa_saude_indigena";
const RPC_DESFAZER = "desfazer_coordenada_mapa_saude_indigena";
const RPC_PENDENCIAS = "listar_pendencias_coordenada_mapa_saude_indigena";
const RPC_HISTORICO = "listar_historico_coordenada_mapa_saude_indigena";
const LIMITE_DO_HISTORICO = 5;

const textoDaPosicao = (valor) => (valor == null ? "" : String(valor));
const mensagemDoErro = (erro, reserva) => erro?.message || reserva;

/* Lê uma RPC de lista (pendências, histórico) com o estado de carga. */
function usarLista(ultimos, ativo, nome, argumentos, chave, erroPadrao) {
  const [estado, definirEstado] = useState(() => ({
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
            lista: Array.isArray(resposta?.data) ? resposta.data : [],
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
  }, [ativo, nome, chave, ultimos, erroPadrao]);
  return [estado, definirEstado];
}

/*
  O editor de coordenadas (só administrador global): a fila de pontos com
  busca e "Só pendentes", o formulário da prévia (pin arrastável), as
  sugestões do ponto pendente, "Conferido" (com ou sem mudar a posição) e o
  histórico com "Desfazer". Tudo grava por RPC; o mapa recebe o lmap e o
  rede_cnes que a RPC devolve (`aoAtualizarMapa`).
*/
export function EditorDeCoordenadas({
  L,
  mapa,
  lmap,
  redeCnes,
  dsei,
  perfil,
  supabase,
  aoAtualizarMapa,
  aoFechar,
}) {
  const permitido = isAdminGlobal(perfil);
  const ultimos = usarUltimo({ permitido, supabase, aoAtualizarMapa });
  const pontos = useMemo(
    () => pontosEditaveisDoMapa(lmap, redeCnes, dsei),
    [lmap, redeCnes, dsei],
  );
  const [pendencias, definirPendencias] = usarLista(
    ultimos,
    permitido,
    RPC_PENDENCIAS,
    null,
    "pendencias",
    "Não foi possível carregar as pendências.",
  );
  const [busca, definirBusca] = useState("");
  const [soPendentes, definirSoPendentes] = useState(true);
  const fila = useMemo(
    () => filaDeCoordenadas(pontos, pendencias.lista, { busca, soPendentes }),
    [pontos, pendencias.lista, busca, soPendentes],
  );
  const [id, definirId] = useState("");
  const ponto = pontos.find((p) => p.id === id) || null;
  const pendencia = ponto
    ? pendencias.lista.find(
        (p) => chaveDaPendencia(p) === chaveDaPendencia(ponto.alvo),
      ) || null
    : null;
  const pendente = Boolean(pendencia && !pendencia.conferido);
  const [versaoDoHistorico, definirVersaoDoHistorico] = useState(0);
  const [historico] = usarLista(
    ultimos,
    permitido && Boolean(id),
    RPC_HISTORICO,
    () => ({ p_alvo: JSON.parse(id), p_limite: LIMITE_DO_HISTORICO }),
    `${id}#${versaoDoHistorico}`,
    "Não foi possível carregar o histórico.",
  );
  const [latitude, definirLatitude] = useState("");
  const [longitude, definirLongitude] = useState("");
  const [motivo, definirMotivo] = useState("");
  const [erro, definirErro] = useState("");
  const [mensagem, definirMensagem] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const [confirmando, definirConfirmando] = useState(null);
  const marcador = useRef(null);
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
      Number.isFinite(ponto.latitude) && Number.isFinite(ponto.longitude)
        ? [ponto.latitude, ponto.longitude]
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
    mapa.flyTo(posicao, Math.max(mapa.getZoom(), 11));
    return () => {
      pin.off("dragend", aoArrastar);
      mapa.removeLayer(pin);
      marcador.current = null;
    };
  }, [permitido, mapa, L, ponto]);

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
  const editar = (definir, valor) => {
    definir(valor);
    limparAvisos();
  };
  const usarSugestao = (sugestao) => {
    definirLatitude(sugestao.latitude.toFixed(6));
    definirLongitude(sugestao.longitude.toFixed(6));
    limparAvisos();
  };
  const desfazerPrevia = () => {
    definirLatitude(textoDaPosicao(ponto?.latitude));
    definirLongitude(textoDaPosicao(ponto?.longitude));
    limparAvisos();
  };
  const aplicarResposta = (data, alvo) => {
    ultimos.current.aoAtualizarMapa?.(data);
    if (typeof data?.conferido === "boolean") {
      const chave = chaveDaPendencia(alvo);
      definirPendencias((atual) => ({
        ...atual,
        lista: atual.lista.map((p) =>
          chaveDaPendencia(p) === chave
            ? { ...p, conferido: data.conferido }
            : p,
        ),
      }));
    }
    definirVersaoDoHistorico((v) => v + 1);
  };
  const chamar = async (nome, argumentos, sucesso) => {
    const alvo = ponto.alvo;
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
      aplicarResposta(data, alvo);
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
  const enviar = async (acao) => {
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
      RPC_SALVAR,
      {
        p_alvo: ponto.alvo,
        p_latitude: latitudeNumero,
        p_longitude: longitudeNumero,
        p_latitude_anterior: ponto.latitude,
        p_longitude_anterior: ponto.longitude,
        p_motivo: motivo.trim(),
        p_conferido: conferir,
      },
      conferir ? "Ponto conferido." : "Coordenada salva.",
    );
  };
  const desfazerAlteracao = async (alteracao, motivoDoDesfazer) => {
    if (salvando || !ponto || !alteracao || !ultimos.current.permitido) return;
    await chamar(
      RPC_DESFAZER,
      { p_historico: alteracao.id, p_motivo: motivoDoDesfazer },
      "Alteração desfeita.",
    );
  };
  const textoDoBotao = (acao, rotulo, confirmacao) =>
    confirmando === acao ? (salvando ? "Salvando…" : confirmacao) : rotulo;

  return (
    <form
      className="mapa-si-coordenadas"
      onSubmit={(evento) => {
        evento.preventDefault();
        enviar("corrigir");
      }}
      aria-label="Corrigir coordenadas"
    >
      <div className="mapa-si-coordenadas__topo">
        <h3 className="ui-titulo">Corrigir coordenadas</h3>
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
      <FilaDeCoordenadas
        itens={fila.itens}
        pendentes={fila.pendentes}
        busca={busca}
        soPendentes={soPendentes}
        escolhido={id}
        carregando={pendencias.carregando}
        erro={pendencias.erro}
        desabilitado={salvando}
        aoBuscar={definirBusca}
        aoAlternarPendentes={definirSoPendentes}
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
          {pendente ? (
            <SugestoesDoPonto
              ponto={ponto}
              pendencia={pendencia}
              desabilitado={salvando}
              aoUsar={usarSugestao}
            />
          ) : null}
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
              className={pendente ? "btn" : "btn primary"}
              type="submit"
              disabled={salvando || !mudou}
            >
              {textoDoBotao(
                "corrigir",
                "Salvar coordenada",
                "Confirmar correção",
              )}
            </button>
            {pendente ? (
              <button
                className="btn primary"
                type="button"
                disabled={salvando}
                onClick={() => enviar("conferir")}
              >
                {textoDoBotao("conferir", "Conferido", "Confirmar conferência")}
              </button>
            ) : null}
          </div>
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

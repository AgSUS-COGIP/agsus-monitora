import { useEffect, useMemo, useRef, useState } from "react";
import { isAdminGlobal } from "../../lib/access-roles.js";
import {
  formatarCoordenada,
  lerCoordenada,
  pontosEditaveisDoMapa,
  validarCorrecaoDoMapa,
} from "../../lib/coordenadas-do-mapa.js";
import { Aviso, Campo } from "../../ui/index.js";
import { usarUltimo } from "./usar-ultimo.js";

export function EditorDeCoordenadas({
  L,
  mapa,
  lmap,
  redeCnes,
  dsei,
  perfil,
  supabase,
  aoAtualizarMapa,
}) {
  const permitido = isAdminGlobal(perfil);
  const pontos = useMemo(
    () => pontosEditaveisDoMapa(lmap, redeCnes, dsei),
    [lmap, redeCnes, dsei],
  );
  const [id, definirId] = useState("");
  const ponto = pontos.find((p) => p.id === id) || null;
  const [latitude, definirLatitude] = useState("");
  const [longitude, definirLongitude] = useState("");
  const [motivo, definirMotivo] = useState("");
  const [erro, definirErro] = useState("");
  const [mensagem, definirMensagem] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const [confirmando, definirConfirmando] = useState(false);
  const marcador = useRef(null);
  const montado = useRef(true);
  const latitudeNumero = lerCoordenada(latitude);
  const longitudeNumero = lerCoordenada(longitude);
  const mudou =
    ponto &&
    (latitudeNumero !== ponto.latitude || longitudeNumero !== ponto.longitude);
  const ultimos = usarUltimo({ permitido, supabase, aoAtualizarMapa });

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  useEffect(() => {
    definirLatitude(ponto?.latitude == null ? "" : String(ponto.latitude));
    definirLongitude(ponto?.longitude == null ? "" : String(ponto.longitude));
    definirMotivo("");
    definirErro("");
    definirConfirmando(false);
  }, [ponto]);

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
      definirConfirmando(false);
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
  const editar = (definir, valor) => {
    definir(valor);
    definirConfirmando(false);
    definirErro("");
    definirMensagem("");
  };
  const desfazer = () => {
    definirLatitude(ponto?.latitude == null ? "" : String(ponto.latitude));
    definirLongitude(ponto?.longitude == null ? "" : String(ponto.longitude));
    definirConfirmando(false);
    definirErro("");
    definirMensagem("");
  };
  const salvar = async (evento) => {
    evento.preventDefault();
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
    if (!mudou) {
      definirErro("A coordenada não mudou.");
      return;
    }
    if (!confirmando) {
      definirConfirmando(true);
      return;
    }
    definirSalvando(true);
    definirErro("");
    try {
      if (!ultimos.current.supabase?.rpc)
        throw new Error("Conexão indisponível. Tente novamente.");
      const { data, error } = await ultimos.current.supabase.rpc(
        "salvar_coordenada_mapa_saude_indigena",
        {
          p_alvo: ponto.alvo,
          p_latitude: latitudeNumero,
          p_longitude: longitudeNumero,
          p_latitude_anterior: ponto.latitude,
          p_longitude_anterior: ponto.longitude,
          p_motivo: motivo.trim(),
        },
      );
      if (error) throw error;
      ultimos.current.aoAtualizarMapa?.(data);
      if (!montado.current || !ultimos.current.permitido) return;
      definirConfirmando(false);
      definirMensagem("Coordenada salva.");
    } catch (falhaAoSalvar) {
      if (montado.current)
        definirErro(
          falhaAoSalvar?.message || "Não foi possível salvar. Tente novamente.",
        );
    } finally {
      if (montado.current) definirSalvando(false);
    }
  };
  return (
    <form
      className="mapa-si-coordenadas"
      onSubmit={salvar}
      aria-label="Corrigir coordenadas"
    >
      <Campo rotulo="Ponto do mapa">
        <select
          value={id}
          disabled={salvando}
          onChange={(e) => {
            definirId(e.target.value);
            definirMensagem("");
          }}
        >
          <option value="">Escolha o ponto</option>
          {pontos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
              {p.localidade ? ` · ${p.localidade}` : ""}
            </option>
          ))}
        </select>
      </Campo>
      {ponto ? (
        <>
          <p className="ui-campo-dica">
            Arraste o pin de prévia ou altere os campos. A posição atual só muda
            ao confirmar.
          </p>
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
          {confirmando ? (
            <Aviso tom="warning">
              Confirme a nova posição para {ponto.nome}.
            </Aviso>
          ) : null}
          <div className="mapa-si-coordenadas__acoes">
            <button
              className="btn"
              type="button"
              disabled={salvando || !mudou}
              onClick={desfazer}
            >
              Desfazer prévia
            </button>
            <button
              className="btn primary"
              type="submit"
              disabled={salvando || !mudou}
            >
              {salvando
                ? "Salvando…"
                : confirmando
                  ? "Confirmar correção"
                  : "Salvar coordenada"}
            </button>
          </div>
        </>
      ) : null}
    </form>
  );
}

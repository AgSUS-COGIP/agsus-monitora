import { useEffect, useState } from "react";
import {
  correcaoDesfazivel,
  formatarCoordenada,
  rotuloDaAcao,
} from "../../lib/coordenadas-do-mapa.js";
import { Aviso, Campo, Carregando, EstadoVazio } from "../../ui/index.js";

const quando = (valor) => {
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? ""
    : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};
const posicao = (latitude, longitude) =>
  latitude == null || longitude == null
    ? "Sem coordenada"
    : `${formatarCoordenada(latitude)}, ${formatarCoordenada(longitude)}`;

/*
  As últimas alterações do ponto (quem, quando, de → para, motivo) e o
  "Desfazer" da mais recente, que pede motivo e vira uma alteração nova.
*/
export function HistoricoDoPonto({
  historico,
  carregando,
  erro,
  desabilitado,
  aoDesfazer,
}) {
  const [aberto, definirAberto] = useState(false);
  const [motivo, definirMotivo] = useState("");
  const [falha, definirFalha] = useState("");
  const desfazivel = correcaoDesfazivel(historico);
  const idDesfazivel = desfazivel?.id ?? null;
  useEffect(() => {
    definirAberto(false);
    definirMotivo("");
    definirFalha("");
  }, [idDesfazivel]);

  const confirmar = async () => {
    if (motivo.trim().length < 10) {
      definirFalha("Descreva o motivo (mínimo de 10 caracteres).");
      return;
    }
    definirFalha("");
    await aoDesfazer(desfazivel, motivo.trim());
  };
  return (
    <section
      className="mapa-si-coordenadas__bloco"
      aria-label="Histórico do ponto"
    >
      <h4 className="mapa-si-coordenadas__subtitulo">Histórico</h4>
      {carregando ? (
        <Carregando />
      ) : erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : !historico.length ? (
        <EstadoVazio>Sem alterações.</EstadoVazio>
      ) : (
        <ol className="mapa-si-coordenadas__historico">
          {historico.map((h) => (
            <li key={h.id}>
              <span>
                <b>{rotuloDaAcao(h.acao)}</b>
                {h.desfeito ? " (desfeita)" : ""} · {h.por || "—"} ·{" "}
                {quando(h.em)}
              </span>
              <small>
                {posicao(h.latitude_anterior, h.longitude_anterior)} →{" "}
                {posicao(h.latitude, h.longitude)}
              </small>
              <small>{h.motivo}</small>
            </li>
          ))}
        </ol>
      )}
      {desfazivel && !carregando ? (
        aberto ? (
          <div className="mapa-si-coordenadas__desfazer">
            <Campo rotulo="Motivo do desfazer" obrigatorio>
              <textarea
                value={motivo}
                maxLength={1000}
                disabled={desabilitado}
                onChange={(e) => {
                  definirMotivo(e.target.value);
                  definirFalha("");
                }}
              />
            </Campo>
            {falha ? (
              <Aviso tom="danger" papel="alert">
                {falha}
              </Aviso>
            ) : null}
            <div className="mapa-si-coordenadas__acoes">
              <button
                type="button"
                className="btn"
                disabled={desabilitado}
                onClick={() => definirAberto(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={desabilitado}
                onClick={confirmar}
              >
                Confirmar desfazer
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn small"
            disabled={desabilitado}
            onClick={() => definirAberto(true)}
          >
            Desfazer última alteração
          </button>
        )
      ) : null}
    </section>
  );
}

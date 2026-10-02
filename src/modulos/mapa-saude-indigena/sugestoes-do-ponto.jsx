import {
  formatarDistancia,
  sugestoesDaPendencia,
} from "../../lib/coordenadas-do-mapa.js";
import { EstadoVazio } from "../../ui/index.js";

/*
  Posições candidatas de um ponto pendente (CNES/DATASUS, aldeias, sede do
  município), com a distância até a posição atual. "Usar esta" só preenche a
  prévia; gravar continua com Salvar/Conferido.
*/
export function SugestoesDoPonto({ ponto, pendencia, desabilitado, aoUsar }) {
  if (!pendencia) return null;
  const sugestoes = sugestoesDaPendencia(pendencia, ponto);
  return (
    <section className="mapa-si-coordenadas__bloco" aria-label="Sugestões">
      <h4 className="mapa-si-coordenadas__subtitulo">Sugestões</h4>
      {pendencia.motivo ? (
        <small className="mapa-si-coordenadas__motivo">
          {pendencia.motivo}
        </small>
      ) : null}
      {sugestoes.length ? (
        <ul className="mapa-si-coordenadas__sugestoes">
          {sugestoes.map((s) => (
            <li key={s.id}>
              <span>
                <b>{s.rotulo}</b> {s.nome}
                {s.terra ? ` · TI ${s.terra}` : ""}
                <small>
                  {formatarDistancia(s.distanciaKm)}
                  {Number.isFinite(s.distanciaKm) ? " da atual" : ""}
                </small>
              </span>
              <button
                type="button"
                className="btn small"
                disabled={desabilitado}
                aria-label={`Usar esta: ${s.rotulo} ${s.nome}`}
                onClick={() => aoUsar(s)}
              >
                Usar esta
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio>Sem posição candidata.</EstadoVazio>
      )}
    </section>
  );
}

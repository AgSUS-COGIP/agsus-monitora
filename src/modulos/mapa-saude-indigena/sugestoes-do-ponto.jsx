import {
  formatarDistancia,
  GRAVIDADES,
  sugestoesDaPendencia,
} from "../../lib/coordenadas-do-mapa.js";
import { EstadoVazio, Selo } from "../../ui/index.js";

/*
  Posições candidatas de um ponto pendente (CNES/DATASUS, aldeias, sede do
  município), com a distância até a posição atual. No alto, a gravidade
  (selo e resumo); a mais provável vem primeiro, marcada. "Usar esta" só
  preenche a prévia; gravar continua com Salvar/Conferido.
*/
export function SugestoesDoPonto({
  ponto,
  pendencia,
  gravidade,
  desabilitado,
  aoUsar,
}) {
  if (!pendencia) return null;
  const idDaMelhor = gravidade?.melhor?.id || "";
  const sugestoes = sugestoesDaPendencia(pendencia, ponto).sort(
    (a, b) => (b.id === idDaMelhor) - (a.id === idDaMelhor),
  );
  return (
    <section className="mapa-si-coordenadas__bloco" aria-label="Sugestões">
      <h4 className="mapa-si-coordenadas__subtitulo">Sugestões</h4>
      {gravidade ? (
        <p className="mapa-si-coordenadas__gravidade">
          <Selo tom={GRAVIDADES[gravidade.nivel].tom}>
            {GRAVIDADES[gravidade.nivel].rotulo}
          </Selo>
          <small>{gravidade.resumo}</small>
        </p>
      ) : null}
      {pendencia.motivo ? (
        <small className="mapa-si-coordenadas__motivo">
          {pendencia.motivo}
        </small>
      ) : null}
      {sugestoes.length ? (
        <ul className="mapa-si-coordenadas__sugestoes">
          {sugestoes.map((s) => (
            <li key={s.id} data-melhor={s.id === idDaMelhor || undefined}>
              <span>
                {s.id === idDaMelhor ? (
                  <Selo tom="aprovado">Mais provável</Selo>
                ) : null}
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

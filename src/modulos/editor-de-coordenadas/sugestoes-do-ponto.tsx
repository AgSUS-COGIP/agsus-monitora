import type {
  SugestaoDoEditor,
  GravidadeDoPonto,
} from "../../lib/tipos-do-editor-de-coordenadas.ts";
import {
  formatarDistancia,
  GRAVIDADES,
} from "../../lib/editor-de-coordenadas.ts";
import { EstadoVazio, Selo } from "../../ui/index.js";

/*
  Posições candidatas de um ponto (as `sugestoes` já prontas, de
  `listaDeSugestoes`: CNES, aldeias e sede do município na Saúde Indígena;
  sede do município, centro da UF e sede do DSEI em Projetos), com a
  distância até a posição atual. No alto, a gravidade (selo e resumo) e o
  motivo da pendência; a mais provável vem primeiro, marcada. "Usar esta" só
  preenche a prévia; gravar continua com Salvar/Conferido. Seção recolhível
  (aberta), como a Correção e o Histórico, para caber no painel do editor.
*/
export function SugestoesDoPonto({
  sugestoes,
  motivo = "",
  gravidade,
  desabilitado,
  aoUsar,
}: {
  sugestoes: readonly SugestaoDoEditor[];
  motivo?: string;
  gravidade?: GravidadeDoPonto | null;
  desabilitado?: boolean;
  aoUsar(sugestao: SugestaoDoEditor): void;
}) {
  const idDaMelhor = gravidade?.melhor?.id || "";
  const ordenadas = [...(sugestoes || [])].sort(
    (a, b) => Number(b.id === idDaMelhor) - Number(a.id === idDaMelhor),
  );
  return (
    <details
      className="mapa-si-coordenadas__bloco mapa-si-coordenadas__secao"
      aria-label="Sugestões"
      open
    >
      <summary className="mapa-si-coordenadas__subtitulo">
        Sugestões <b>{ordenadas.length}</b>
      </summary>
      {gravidade ? (
        <p className="mapa-si-coordenadas__gravidade">
          <Selo tom={GRAVIDADES[gravidade.nivel].tom}>
            {GRAVIDADES[gravidade.nivel].rotulo}
          </Selo>
          <small>{gravidade.resumo}</small>
        </p>
      ) : null}
      {motivo ? (
        <small className="mapa-si-coordenadas__motivo">{motivo}</small>
      ) : null}
      {ordenadas.length ? (
        <ul className="mapa-si-coordenadas__sugestoes">
          {ordenadas.map((s) => (
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
    </details>
  );
}

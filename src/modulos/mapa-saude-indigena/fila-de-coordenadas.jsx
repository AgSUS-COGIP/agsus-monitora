import { textoDePendentes } from "../../lib/coordenadas-do-mapa.js";
import { Aviso, Campo, Carregando, EstadoVazio, Selo } from "../../ui/index.js";

/* Quantos itens a lista desenha de uma vez (a visão nacional tem milhares). */
export const LIMITE_DA_FILA = 200;

/*
  A fila do editor de coordenadas: busca, "Só pendentes" (ligado por padrão),
  a contagem de pendentes e a lista ordenada por DSEI. Escolher um item é com
  o pai (centraliza o mapa e abre o formulário).
*/
export function FilaDeCoordenadas({
  itens,
  pendentes,
  busca,
  soPendentes,
  escolhido,
  carregando,
  erro,
  desabilitado,
  aoBuscar,
  aoAlternarPendentes,
  aoEscolher,
}) {
  const mostrados = itens.slice(0, LIMITE_DA_FILA);
  return (
    <div className="mapa-si-coordenadas__fila">
      <Campo rotulo="Buscar ponto">
        <input
          type="search"
          value={busca}
          placeholder="Nome, CNES, município ou DSEI"
          disabled={desabilitado}
          onChange={(e) => aoBuscar(e.target.value)}
        />
      </Campo>
      <div className="mapa-si-coordenadas__filtro">
        <label className="mapa-si-coordenadas__caixa">
          <input
            type="checkbox"
            checked={soPendentes}
            disabled={desabilitado}
            onChange={(e) => aoAlternarPendentes(e.target.checked)}
          />
          Só pendentes
        </label>
        <b className="mapa-si-coordenadas__contagem" aria-live="polite">
          {carregando ? "…" : textoDePendentes(pendentes)}
        </b>
      </div>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      {carregando && soPendentes ? (
        <Carregando />
      ) : mostrados.length ? (
        <ul className="mapa-si-coordenadas__lista" aria-label="Pontos do mapa">
          {mostrados.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="mapa-si-coordenadas__item"
                aria-pressed={item.id === escolhido}
                disabled={desabilitado}
                onClick={() => aoEscolher(item.id)}
              >
                <span className="mapa-si-coordenadas__nome">{item.nome}</span>
                <small>
                  {[item.alvo.dsei, item.localidade]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                {item.pendente ? (
                  <Selo tom="pendente">Pendente</Selo>
                ) : item.pendencia ? (
                  <Selo tom="aprovado">Conferido</Selo>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio>
          {soPendentes && !busca ? "Nenhum ponto pendente." : "Nenhum ponto."}
        </EstadoVazio>
      )}
      {itens.length > mostrados.length ? (
        <small className="mapa-si-coordenadas__mais">
          {mostrados.length} de {itens.length} — refine a busca.
        </small>
      ) : null}
    </div>
  );
}

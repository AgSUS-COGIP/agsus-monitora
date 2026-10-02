import {
  GRAVIDADES,
  textoDePendentes,
} from "../../lib/editor-de-coordenadas.js";
import { Aviso, Campo, Carregando, EstadoVazio, Selo } from "../../ui/index.js";

/* Quantos itens a lista desenha de uma vez (a visão nacional tem milhares). */
export const LIMITE_DA_FILA = 200;

/*
  A fila do editor de coordenadas: busca, "Só pendentes" (ligado por padrão),
  a contagem de pendentes, o filtro por gravidade (Provável erro, Revisar,
  Sem sugestão, Só confirmar, com a contagem de cada) e a lista — o provável
  erro primeiro, cada pendente com o selo da gravidade e o resumo (motivo e
  sugestão que serve de régua). Escolher um item é com o pai (centraliza o
  mapa e abre o formulário). Serve aos dois mapas: o texto da busca, o rótulo
  da lista e a linha de detalhe de cada item vêm de quem usa.
*/
export function FilaDeCoordenadas({
  itens,
  pendentes,
  porGravidade = {},
  gravidade = "",
  busca,
  soPendentes,
  escolhido,
  placeholder = "Nome ou município",
  rotuloDaLista = "Pontos do mapa",
  detalheDoItem = (item) => item.localidade || "",
  carregando,
  erro,
  desabilitado,
  aoBuscar,
  aoAlternarPendentes,
  aoFiltrarGravidade,
  aoEscolher,
}) {
  const mostrados = itens.slice(0, LIMITE_DA_FILA);
  return (
    <div className="mapa-si-coordenadas__fila">
      <Campo rotulo="Buscar ponto">
        <input
          type="search"
          value={busca}
          placeholder={placeholder}
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
      {soPendentes && pendentes ? (
        <div
          className="mapa-si-coordenadas__niveis"
          role="group"
          aria-label="Filtrar por gravidade"
        >
          {Object.entries(GRAVIDADES).map(([nivel, info]) => (
            <button
              key={nivel}
              type="button"
              className="mapa-si-coordenadas__nivel"
              data-nivel={nivel}
              aria-pressed={gravidade === nivel}
              disabled={desabilitado || !porGravidade[nivel]}
              onClick={() =>
                aoFiltrarGravidade?.(gravidade === nivel ? "" : nivel)
              }
            >
              {info.rotulo} <b>{porGravidade[nivel] || 0}</b>
            </button>
          ))}
        </div>
      ) : null}
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      {carregando && soPendentes ? (
        <Carregando />
      ) : mostrados.length ? (
        <ul className="mapa-si-coordenadas__lista" aria-label={rotuloDaLista}>
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
                <small>{detalheDoItem(item)}</small>
                {item.gravidade ? (
                  <>
                    <Selo tom={GRAVIDADES[item.gravidade.nivel].tom}>
                      {GRAVIDADES[item.gravidade.nivel].rotulo}
                    </Selo>
                    <small className="mapa-si-coordenadas__resumo">
                      {item.gravidade.resumo}
                    </small>
                  </>
                ) : item.pendente ? (
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

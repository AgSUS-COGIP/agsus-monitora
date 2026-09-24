import { indicadoresDoResumo } from "../../lib/editais-do-nucleo.js";

/*
  "Cronogramas e alertas": os indicadores do resumo, que também filtram a
  tabela. Classes de `nucleo-operational-enhancements.css`.

  Os estados seguem o DESIGN.md: carregando não é zero (a grade fica vazia até
  o primeiro pedido e mostra "carregando" depois dele), vazio explica o
  contexto, e erro oferece "Tentar de novo" sem despejar a mensagem do banco —
  o detalhe fica no console.
*/

const classes = (...lista) => lista.filter(Boolean).join(" ");

const ESTADOS = {
  loading: {
    classe: "nucleo-summary-loading",
    icone: "fa-spinner fa-spin",
    titulo: "Carregando os alertas da Equipe Núcleo",
    texto: "Os indicadores aparecem assim que o resumo chegar.",
  },
  empty: {
    classe: "nucleo-summary-empty",
    icone: "fa-folder-open",
    titulo: "Nenhum edital ativo na Equipe Núcleo",
    texto:
      "Quando um edital for cadastrado, os indicadores e os alertas de cronograma aparecem aqui.",
  },
  error: {
    classe: "nucleo-summary-error",
    icone: "fa-triangle-exclamation",
    titulo: "Não foi possível carregar os alertas",
    texto: "Verifique a conexão e tente novamente.",
  },
};

function EstadoDoResumo({ chave, aoRepetir }) {
  const estado = ESTADOS[chave];
  return (
    <div className={estado.classe} role="status">
      <i className={`fa-solid ${estado.icone}`} aria-hidden="true" />
      <span className="nucleo-summary-text">
        <strong>{estado.titulo}</strong>
        {estado.texto}
      </span>
      {chave === "error" ? (
        <button
          type="button"
          className="nucleo-summary-retry"
          id="nucleoSummaryRetry"
          onClick={aoRepetir}
        >
          Tentar de novo
        </button>
      ) : null}
    </div>
  );
}

export function PainelOperacional({ estado, nucleo }) {
  const { resumo, statusDoResumo, filtro, atualizandoResumo } = nucleo;
  const atualizar = () =>
    void estado.carregarResumo({ force: true }).catch(() => {});
  const indicadores = resumo.length ? indicadoresDoResumo(resumo) : null;

  let conteudo = null;
  if (statusDoResumo === "error")
    conteudo = <EstadoDoResumo chave="error" aoRepetir={atualizar} />;
  else if (!indicadores) {
    if (statusDoResumo === "loading")
      conteudo = <EstadoDoResumo chave="loading" />;
    else if (statusDoResumo === "ready")
      conteudo = <EstadoDoResumo chave="empty" />;
  } else
    conteudo = indicadores.map((cartao) => {
      const ativo = filtro === cartao.key;
      return (
        <button
          key={cartao.key}
          type="button"
          className={classes(
            "nucleo-kpi-card",
            `tone-${cartao.tone}`,
            ativo && "is-active",
          )}
          data-alert-filter={cartao.key}
          aria-pressed={ativo}
          onClick={() => estado.filtrarPor(cartao.key)}
        >
          <span className="nucleo-kpi-icon">
            <i className={`fa-solid ${cartao.icon}`} aria-hidden="true" />
          </span>
          <span>
            <small>{cartao.label}</small>
            <strong>{cartao.value.toLocaleString("pt-BR")}</strong>
          </span>
        </button>
      );
    });

  const filtroAtivo =
    indicadores && statusDoResumo !== "error" && filtro !== "todos"
      ? indicadores.find((cartao) => cartao.key === filtro)?.label || filtro
      : "";

  return (
    <section id="nucleoOperationalKpis" className="nucleo-operational-panel">
      <div className="nucleo-operational-heading">
        <div>
          <span>Acompanhamento operacional</span>
          <h3>Cronogramas e alertas</h3>
          <p>Clique nos indicadores para filtrar a fila da Equipe Núcleo.</p>
        </div>
        <button
          id="nucleoOperationalRefresh"
          type="button"
          className="btn outline"
          disabled={atualizandoResumo}
          onClick={atualizar}
        >
          <i className="fa-solid fa-rotate" aria-hidden="true" /> Atualizar
        </button>
      </div>
      <div id="nucleoKpiGrid" className="nucleo-kpi-grid">
        {conteudo}
      </div>
      <div
        id="nucleoActiveAlertFilter"
        className="nucleo-active-alert-filter"
        role="status"
        hidden={!filtroAtivo}
      >
        {filtroAtivo ? (
          <>
            <span>
              Filtro operacional ativo: <strong>{filtroAtivo}</strong>
            </span>
            <button
              type="button"
              id="clearNucleoAlertFilter"
              onClick={() => estado.filtrarPor("todos")}
            >
              Limpar
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

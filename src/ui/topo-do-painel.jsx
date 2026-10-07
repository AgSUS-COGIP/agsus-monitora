/*
  O topo de uma tela (`.ui-topo`): as visões (um <Segmentado>, opcional), a
  data da última carga, discreta e uma vez só (`.status-discreto`), e as ações
  (Atualizar, Exportar e os botões da tela, que entram como filhos, depois de
  Exportar).

  O título e a área já estão no cabeçalho do app, e tema e tela cheia são do
  app (barra lateral e menu da conta): o topo não os repete.
*/

/**
 * Sem `aoExportar`, o botão Exportar não aparece.
 * @param {{ status: import("react").ReactNode, aoAtualizar: () => void, atualizarDesativado?: boolean, aoExportar?: () => void, exportarDesativado?: boolean, visoes?: import("react").ReactNode, idDaAtualizacao?: string, tour?: string, children?: import("react").ReactNode }} props
 */
export function TopoDoPainel({
  visoes = null,
  status,
  aoAtualizar,
  idDaAtualizacao,
  atualizarDesativado,
  aoExportar,
  exportarDesativado,
  tour,
  children,
}) {
  return (
    <header className="ui-topo" data-tour={tour}>
      {visoes ? <div className="ui-topo-titulo">{visoes}</div> : null}
      <div className="ui-topo-acoes">
        <span className="status-discreto" data-status-da-carga="">
          {status}
        </span>
        <button
          id={idDaAtualizacao}
          type="button"
          className="btn secondary"
          data-acao="atualizar"
          disabled={atualizarDesativado}
          onClick={aoAtualizar}
        >
          <i className="fa-solid fa-rotate" aria-hidden="true" /> Atualizar
        </button>
        {aoExportar ? (
          <button
            type="button"
            className="btn secondary"
            data-acao="exportar"
            disabled={exportarDesativado}
            onClick={aoExportar}
          >
            <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
          </button>
        ) : null}
        {children}
      </div>
    </header>
  );
}

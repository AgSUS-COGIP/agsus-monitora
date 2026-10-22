/*
  "Mais opções" dos filtros (Recursos, Análises curriculares): o botão que
  mostra e esconde os filtros adicionais, com a contagem dos que estão em uso,
  e o bloco deles (os campos vêm como filhos, numa `.ui-grade-de-campos`).
  Controlado: a tela guarda `aberto` (para fechar junto com o "Ocultar
  filtros").
*/
export function MaisOpcoes({
  id,
  aberto,
  aoAlternar,
  quantos = 0,
  titulo,
  children,
}) {
  return (
    <>
      <div className="ui-mais-opcoes">
        <button
          type="button"
          className="btn secondary small"
          data-acao="mais-opcoes"
          aria-expanded={aberto}
          aria-controls={id}
          title={aberto ? "Ocultar filtros adicionais" : titulo}
          onClick={aoAlternar}
        >
          <i
            className={`fa-solid ${aberto ? "fa-chevron-up" : "fa-sliders"}`}
            aria-hidden="true"
          />{" "}
          {aberto ? "Menos opções" : "Mais opções"}
          {quantos ? <span className="ui-contagem">{quantos}</span> : null}
        </button>
      </div>
      <div id={id} className="ui-grade-de-campos" hidden={!aberto}>
        {children}
      </div>
    </>
  );
}

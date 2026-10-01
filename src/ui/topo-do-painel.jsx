import { useLayoutEffect, useRef } from "react";

/*
  O cabeçalho fixo dos painéis (`.topbar`, desenho do painel de análises):
  título, subtítulo da área, abas de visão opcionais, a data da última carga
  discreta (`.status-discreto`) e os botões de tema, tela cheia, atualizar e
  exportar. Botões próprios do painel entram como filhos, depois de Exportar.
  Os ids (topbar, updatedText, themeBtn, fullBtn, refreshBtn, exportBtn) são
  contrato do CSS de src/analises/ e dos testes.
*/

/*
  O `.topbar` é fixo; a altura dele vira `--topbar-height`, que empurra o
  conteúdo (`.shell`) e o cabeçalho da tabela — como o `setupFixedTopbar` do
  painel de análises, acompanhando também a quebra de linha dos botões.
*/
export function usarAlturaDoTopo(topo) {
  useLayoutEffect(() => {
    const barra = topo.current;
    if (!barra) return undefined;
    const medir = () =>
      document.documentElement.style.setProperty(
        "--topbar-height",
        `${barra.offsetHeight}px`,
      );
    medir();
    if (typeof ResizeObserver === "function") {
      const observador = new ResizeObserver(medir);
      observador.observe(barra);
      return () => observador.disconnect();
    }
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [topo]);
}

/**
 * Sem `aoExportar`, o botão Exportar não aparece.
 */
export function TopoDoPainel({
  titulo,
  subtitulo,
  visoes = null,
  status,
  escuro,
  aoTema,
  aoTelaCheia,
  aoAtualizar,
  atualizarDesativado,
  aoExportar,
  exportarDesativado,
  children,
}) {
  const topo = useRef(null);
  usarAlturaDoTopo(topo);
  const rotuloDoTema = escuro ? "Usar tema claro" : "Usar tema escuro";
  return (
    <header className="topbar" id="topbar" ref={topo}>
      <div className="brand">
        <div>
          <h1>{titulo}</h1>
          <p className="sub">{subtitulo}</p>
          {visoes}
        </div>
      </div>
      <div className="top-actions">
        <span id="updatedText" className="status-discreto">
          {status}
        </span>
        <button
          type="button"
          className="btn secondary icon"
          id="themeBtn"
          title={rotuloDoTema}
          aria-label={rotuloDoTema}
          onClick={aoTema}
        >
          <i
            className={`fa-solid ${escuro ? "fa-sun" : "fa-moon"}`}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          className="btn secondary icon"
          id="fullBtn"
          title="Tela cheia"
          aria-label="Alternar tela cheia"
          onClick={aoTelaCheia}
        >
          <i className="fa-solid fa-expand" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn"
          id="refreshBtn"
          disabled={atualizarDesativado}
          onClick={aoAtualizar}
        >
          <i className="fa-solid fa-rotate" aria-hidden="true" /> Atualizar
        </button>
        {aoExportar ? (
          <button
            type="button"
            className="btn green"
            id="exportBtn"
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

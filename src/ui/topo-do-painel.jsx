import { useLayoutEffect, useRef } from "react";
import { usarNoQuadro } from "./no-quadro.jsx";

/*
  O topo de uma tela: a data da última carga, discreta e uma vez só
  (`.status-discreto`), e as ações (Atualizar, Exportar e os botões da tela,
  que entram como filhos, depois de Exportar).

  Dentro do app (`.ui-topo`) o título e a área já estão no cabeçalho do app:
  `titulo` é opcional e, sem ele, o topo é só a faixa de ações. Tema e tela
  cheia são do app (barra lateral e menu da conta): sem `aoTema` e
  `aoTelaCheia`, os botões não aparecem.

  No quadro (<PainelNoQuadro>, Entrevistas e Seleção): o cabeçalho fixo do
  painel de análises (`.topbar`), com título, subtítulo, visões e os botões
  de tema e tela cheia; os ids (topbar, updatedText, themeBtn, fullBtn,
  refreshBtn, exportBtn) são contrato do CSS de src/analises/ e dos testes.
*/

/*
  No quadro, o `.topbar` é fixo; a altura dele vira `--topbar-height`, que
  empurra o conteúdo (`.shell`) e o cabeçalho da tabela — acompanhando também
  a quebra de linha dos botões. `ligado` falso não mede nada.
*/
export function usarAlturaDoTopo(topo, ligado = true) {
  useLayoutEffect(() => {
    const barra = topo.current;
    if (!ligado || !barra) return undefined;
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
  }, [topo, ligado]);
}

function BotaoDeTema({ escuro, aoTema, id }) {
  const rotulo = escuro ? "Usar tema claro" : "Usar tema escuro";
  return (
    <button
      type="button"
      className="btn secondary icon"
      id={id}
      title={rotulo}
      aria-label={rotulo}
      onClick={aoTema}
    >
      <i
        className={`fa-solid ${escuro ? "fa-sun" : "fa-moon"}`}
        aria-hidden="true"
      />
    </button>
  );
}

function BotaoDeTelaCheia({ aoTelaCheia, id }) {
  return (
    <button
      type="button"
      className="btn secondary icon"
      id={id}
      title="Tela cheia"
      aria-label="Alternar tela cheia"
      onClick={aoTelaCheia}
    >
      <i className="fa-solid fa-expand" aria-hidden="true" />
    </button>
  );
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
  const noQuadro = usarNoQuadro();
  const topo = useRef(null);
  usarAlturaDoTopo(topo, noQuadro);

  if (noQuadro)
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
          <BotaoDeTema escuro={escuro} aoTema={aoTema} id="themeBtn" />
          <BotaoDeTelaCheia aoTelaCheia={aoTelaCheia} id="fullBtn" />
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

  return (
    <header className="ui-topo" ref={topo}>
      {titulo || visoes ? (
        <div className="ui-topo-titulo">
          {titulo ? <h2>{titulo}</h2> : null}
          {titulo && subtitulo ? <p>{subtitulo}</p> : null}
          {visoes}
        </div>
      ) : null}
      <div className="ui-topo-acoes">
        <span className="status-discreto" data-status-da-carga="">
          {status}
        </span>
        {aoTema ? <BotaoDeTema escuro={escuro} aoTema={aoTema} /> : null}
        {aoTelaCheia ? <BotaoDeTelaCheia aoTelaCheia={aoTelaCheia} /> : null}
        <button
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

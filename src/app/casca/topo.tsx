import type { MouseEvent } from "react";
import { chamarAcaoDaCasca, fecharMenuDaConta } from "./acoes.ts";

/*
  O cabeçalho do app (`header.top`): o título da página e, à direita, Pessoas
  online e o menu da conta. No celular, uma linha só, com o ☰ da gaveta antes
  do título.

  Os textos são escritos de fora, como antes: o título por
  `navegacao.definirTitulo`, nome, e-mail e perfil por `src/app/perfil.ts`, os
  rótulos configuráveis por `src/app/configuracao.ts` e a foto por
  `google-profile-photo.ts`. Por isso o React desenha o cabeçalho uma vez e
  não volta a mexer nele (ver `casca.tsx`).

  `#pessoasOnlineApp`, `#seloNoAvatarApp` e `#selosDoEditalApp` são pontos de
  montagem de outras ilhas React; o ☰ (`#globalSidebarToggle`) é da barra
  lateral e entra por portal no `.title-row` até 900px (`alca-de-recolher.tsx`).
*/
export function Topo() {
  return (
    <header className="top">
      <div className="title-row">
        <div className="page-title">
          <h1 id="pageTitle"></h1>
          <p id="pageSubtitle"></p>
        </div>
      </div>
      <div className="actions">
        {/* Pessoas online (React: src/componentes/pessoas-online/) */}
        <div id="pessoasOnlineApp" className="pessoas-online-app"></div>
        <MenuDaConta />
      </div>
    </header>
  );
}

/** Fecha o menu e então chama a ação (ou o contrário, na ordem de antes). */
function aoClicar(
  primeiro: "acao" | "fechar",
  acao: Parameters<typeof chamarAcaoDaCasca>[0],
) {
  return (evento: MouseEvent<HTMLButtonElement>) => {
    const botao = evento.currentTarget;
    if (primeiro === "acao") {
      void chamarAcaoDaCasca(acao);
      fecharMenuDaConta(botao);
    } else {
      fecharMenuDaConta(botao);
      void chamarAcaoDaCasca(acao);
    }
  };
}

function MenuDaConta() {
  return (
    <details id="topUserMenu" className="top-user-menu">
      <summary
        className="top-user-button"
        aria-label="Abrir informações da conta"
      >
        <span id="topUserAvatar" className="top-user-avatar" aria-hidden="true">
          <i className="fa-solid fa-user"></i>
        </span>
        {/* Selo do edital no avatar (React: src/modulos/encerramento-do-edital/) */}
        <span id="seloNoAvatarApp" className="selo-no-avatar"></span>
        <span className="top-user-compact-copy">
          <strong id="userName">-</strong>{" "}
          <small id="userProfileBadge" className="user-profile-badge"></small>
        </span>
        <i
          className="fa-solid fa-chevron-down top-user-chevron"
          aria-hidden="true"
        ></i>
      </summary>
      <div className="top-user-popover">
        <strong id="topUserPopoverName">-</strong>{" "}
        <small id="userEmail">-</small> <span id="topUserPopoverProfile"></span>
        {/* Selos de editais (React: src/modulos/encerramento-do-edital/) */}
        <div id="selosDoEditalApp"></div>
        {/* Ações da conta. Tema e Sair ficam no rodapé da barra lateral. */}
        <div className="top-user-popover-actions">
          <button type="button" onClick={aoClicar("acao", "refreshData")}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true"></i>{" "}
            <span id="refreshActionText">Atualizar dados</span>
          </button>
          <button
            type="button"
            onClick={aoClicar("fechar", "toggleBrowserFullscreen")}
          >
            <i
              id="fullscreenActionIcon"
              className="fa-solid fa-expand"
              aria-hidden="true"
            ></i>{" "}
            <span id="fullscreenActionText">Tela cheia</span>
          </button>
          <button type="button" onClick={aoClicar("fechar", "exportPDF")}>
            <i className="fa-solid fa-file-pdf" aria-hidden="true"></i>{" "}
            <span id="exportPdfActionText">Exportar relatório (PDF)</span>
          </button>
        </div>
      </div>
    </details>
  );
}

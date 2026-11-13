import type { MouseEvent } from "react";
import { chamarAcaoDaCasca, fecharMenuDaConta } from "./acoes.ts";
import { usarEstadoDaNavegacao } from "../contexto-do-app.ts";
import { telaDaRota } from "../../lib/rotas.ts";
import { SininhoDoResumo } from "../../modulos/resumo-do-dia/resumo-do-dia.tsx";
import {
  IconeDaTelaCheia,
  PessoasOnlineDoApp,
  SeloNoAvatarDoApp,
  SelosDoEditalDoApp,
} from "./pecas.tsx";

/*
  O cabeçalho do app (`header.top`): o título da página e, à direita, Pessoas
  online, o sininho do resumo do dia e o menu da conta. No celular, uma linha só, com o ☰ da gaveta antes
  do título.

  O título da página vem da navegação (src/app/navegacao.ts), pelo contexto
  da raiz. Os outros textos ainda são escritos de fora: nome, e-mail e perfil
  por `src/app/perfil.ts`, os rótulos configuráveis por
  `src/app/configuracao.ts` e a foto por `google-profile-photo.ts`. Por isso
  só o título se redesenha; o resto o React desenha uma vez.

  Pessoas online e os selos do edital (`pecas.tsx`) leem o estado do sistema
  pelo contexto da raiz; o ☰ (`#globalSidebarToggle`) é da barra
  lateral e entra por portal no `.title-row` até 900px (`alca-de-recolher.tsx`).
*/
export function Topo() {
  return (
    <header className="top">
      <div className="title-row">
        <TituloDaPagina />
      </div>
      <div className="actions">
        {/* Pessoas online (React: src/componentes/pessoas-online/) */}
        <div id="pessoasOnlineApp" className="pessoas-online-app">
          <PessoasOnlineDoApp />
        </div>
        {/* Resumo do dia do responsável (src/modulos/resumo-do-dia/) */}
        <SininhoDoResumo />
        <MenuDaConta />
      </div>
    </header>
  );
}

/* Nas telas com título próprio (`tituloNaTela`), o daqui fica só para o leitor de tela. */
function TituloDaPagina() {
  const { titulo, subtitulo, view, aviso } = usarEstadoDaNavegacao();
  // Com um aviso no lugar da página, a tela não está lá: o título fica à vista.
  const naTela = !aviso && Boolean(telaDaRota(view)?.tituloNaTela);
  return (
    <div className={naTela ? "page-title sr-only" : "page-title"}>
      <h1 id="pageTitle">{titulo}</h1>
      <p id="pageSubtitle">{subtitulo}</p>
    </div>
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
        <span id="seloNoAvatarApp" className="selo-no-avatar">
          <SeloNoAvatarDoApp />
        </span>
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
        <div id="selosDoEditalApp">
          <SelosDoEditalDoApp />
        </div>
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
            <IconeDaTelaCheia />{" "}
            <span id="fullscreenActionText">Tela cheia</span>
          </button>
          <button type="button" onClick={aoClicar("fechar", "exportPDF")}>
            <i className="fa-solid fa-file-export" aria-hidden="true"></i>{" "}
            <span id="exportPdfActionText">Montar relatório</span>
          </button>
        </div>
      </div>
    </details>
  );
}

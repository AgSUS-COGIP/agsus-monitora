import { useState } from "react";
import type { MouseEvent } from "react";
import { chamarAcaoDaCasca, fecharMenuDaConta } from "./acoes.ts";
import { GavetaDosMeusAcessosDoApp } from "./meus-acessos.tsx";
import { usarEstadoDaNavegacao } from "../contexto-do-app.ts";
import { telaDaRota } from "../../lib/navegacao/rotas.ts";
import { definirDestinoDoTitulo } from "./destino-do-titulo.ts";
import { usarLogoDaMarca } from "../../componentes/barra-lateral/barra-lateral.tsx";
import { Icone } from "../../componentes/icone.tsx";
import { SininhoDoResumo } from "../../modulos/resumo-do-dia/resumo-do-dia.tsx";
import {
  IconeDaTelaCheia,
  PessoasOnlineDoApp,
  SeloNoAvatarDoApp,
  SelosDoEditalDoApp,
} from "./pecas.tsx";
import "./topo.css";

/*
  O cabeçalho do app (`header.top`), numa linha só, em duas partes:

    à esquerda  -> o ☰ e a marca (só com a barra em gaveta, até 900px) e o
                   nome da tela: "● Área › Tela" nas telas das áreas
                   (`CabecalhoDaTela` o põe ali, por portal, no
                   `.topo-tela-destino`) e o título da página em Aviso e
                   Administração;
    à direita   -> o sininho do resumo do dia e a foto com o menu da conta
                   (Pessoas online, Meus acessos, Atualizar dados, Tela
                   cheia).

  Nada repetido: o nome da tela só aparece aqui (o conteúdo começa pelas
  ações e indicadores), a área só na trilha e no seletor da barra lateral, a
  Aya na arara e a busca global no Ctrl+K.

  As ações da direita e o ☰ são `.btn.ghost.ui-botao-icone` com a mesma caixa
  (`.topo-acao`, topo.css). No celular (até 640px) ficam o ☰, o nome da tela
  (ou a marca, fora das áreas), o sininho e a foto.

  Nas telas das áreas, o h1 da página (`#pageTitle`) fica só para o leitor de
  tela e a faixa leva `data-compacto`. O título vem da navegação
  (src/app/navegacao.ts), pelo contexto da raiz. Nome, e-mail e perfil são
  escritos de fora (`src/app/perfil.ts`) e a foto por
  `google-profile-photo.ts`, nos ids de sempre. Pessoas online e os selos do
  edital (`pecas.tsx`) leem o estado do sistema pelo contexto da raiz; o ☰
  (`#globalSidebarToggle`) é da barra lateral e entra por portal no
  `.title-row` até 900px (`alca-de-recolher.tsx`).
*/
export function Topo() {
  const naTela = usarTituloNaTela();
  return (
    <header className="top" data-compacto={naTela ? "" : undefined}>
      <div className="title-row">
        <MarcaDoTopo />
        <span className="topo-tela-destino" ref={definirDestinoDoTitulo} />
        <TituloDaPagina naTela={naTela} />
      </div>
      <div className="actions">
        {/* Resumo do dia do responsável (src/modulos/resumo-do-dia/) */}
        <SininhoDoResumo />
        <MenuDaConta />
      </div>
    </header>
  );
}

/* Nas telas das áreas o nome vem do CabecalhoDaTela. Aviso e Administração mantêm o título da casca. */
function usarTituloNaTela() {
  const { view, aviso } = usarEstadoDaNavegacao();
  return !aviso && Boolean(telaDaRota(view));
}

/* A marca, com a barra em gaveta (o CSS a mostra só até 900px; acima, a barra tem a dela). */
function MarcaDoTopo() {
  const imagem = usarLogoDaMarca();
  return (
    <span className="topo-marca">
      <img className="topo-marca__logo" alt="" {...imagem} />
      <strong className="topo-marca__nome">Yeendé</strong>
    </span>
  );
}

/* Nas telas das áreas, o h1 daqui fica só para o leitor de tela. */
function TituloDaPagina({ naTela }: { naTela: boolean }) {
  const { titulo, subtitulo } = usarEstadoDaNavegacao();
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
  const [meusAcessos, setMeusAcessos] = useState(false);
  return (
    <>
      <details id="topUserMenu" className="top-user-menu">
        <summary
          className="btn ghost ui-botao-icone topo-acao top-user-button"
          aria-label="Abrir informações da conta"
          title="Conta"
        >
          <span
            id="topUserAvatar"
            className="top-user-avatar"
            aria-hidden="true"
          >
            <Icone nome="user-round" tamanho={18} />
          </span>
          {/* Selo do edital no avatar (React: src/modulos/encerramento-do-edital/) */}
          <span id="seloNoAvatarApp" className="selo-no-avatar">
            <SeloNoAvatarDoApp />
          </span>
        </summary>
        <div className="top-user-popover ui-popover-painel" data-lado="direita">
          <strong id="topUserPopoverName">-</strong>{" "}
          <small id="userEmail">-</small>{" "}
          <span id="topUserPopoverProfile"></span>
          {/* Selos de editais (React: src/modulos/encerramento-do-edital/) */}
          <div id="selosDoEditalApp">
            <SelosDoEditalDoApp />
          </div>
          {/* Pessoas online (React: src/componentes/pessoas-online/) */}
          <div id="pessoasOnlineApp" className="pessoas-online-app">
            <PessoasOnlineDoApp />
          </div>
          {/* Ações da conta. Tema e Sair ficam no rodapé da barra lateral. */}
          <div className="top-user-popover-actions">
            <button
              type="button"
              onClick={(evento) => {
                fecharMenuDaConta(evento.currentTarget);
                setMeusAcessos(true);
              }}
            >
              <i className="fa-solid fa-id-card" aria-hidden="true"></i>{" "}
              <span>Meus acessos</span>
            </button>
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
          </div>
        </div>
      </details>
      {/* "Meus acessos": a gaveta, por portal (src/app/casca/meus-acessos.tsx). */}
      {meusAcessos ? (
        <GavetaDosMeusAcessosDoApp aoFechar={() => setMeusAcessos(false)} />
      ) : null}
    </>
  );
}

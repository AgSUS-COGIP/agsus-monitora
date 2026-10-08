import type { ReactNode } from "react";
import { alternarTemaPelaJanela } from "./integracao.ts";
import { Icone } from "../icone.jsx";
import {
  deveAlternarTema,
  OPCOES_DE_TEMA,
  performExplicitLogout,
  themeControlState,
} from "../../modules/nielsen-shell-ux.js";
import { temaEscuro, usarTemaEscuro } from "../../app/tema.js";

/*
  Rodapé da barra, de cima para baixo: o seletor Claro/Escuro (único controle
  de tema do app), o botão de recolher (`alca`, de `alca-de-recolher.tsx`; na
  gaveta do celular ele mora no cabeçalho e não vem), o Sair (único logout —
  `nielsen-shell-ux.js` tira o do menu do perfil) e a versão. Recolhida, o CSS
  troca os dois segmentos por um botão que alterna e deixa o recolher e o Sair
  só com o ícone; o nome de cada um aparece na dica (`data-dica`) no ponteiro
  e no foco.

  O tema vale em `html[data-theme]`, e quem o troca é `window.toggleDarkMode`
  (legado, embrulhado por `nielsen-shell-ux.js`; `applyDarkMode` mantém o
  espelho `body.dark-mode`). Ela inverte o tema, então o segmento já ativo não
  a chama.
  O Sair abre a confirmação de `nielsen-shell-ux.js` antes de encerrar.
*/
export function Rodape({ alca = null }: { alca?: ReactNode }) {
  const escuro = usarTemaEscuro();
  const tema = themeControlState(escuro);
  const pedirTema = (pedido: string) => {
    if (deveAlternarTema(pedido, temaEscuro())) alternarTemaPelaJanela();
  };

  return (
    <div className="side-footer" data-tour="barra-rodape">
      <div className="side-tema" data-tema={tema.tema} data-tour="barra-tema">
        <div className="side-tema__opcoes" role="group" aria-label="Tema">
          {OPCOES_DE_TEMA.map((opcao) => (
            <button
              key={opcao.tema}
              type="button"
              className="side-tema__opcao"
              data-tema={opcao.tema}
              aria-pressed={opcao.tema === tema.tema}
              onClick={() => pedirTema(opcao.tema)}
            >
              <Icone nome={opcao.icone} tamanho={16} />
              <span>{opcao.rotulo}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="side-tema__alternar"
          aria-label={tema.label}
          data-dica={`Alternar para tema ${escuro ? "claro" : "escuro"}`}
          onClick={() => alternarTemaPelaJanela()}
        >
          <Icone nome={tema.icon} />
        </button>
      </div>
      {alca}
      <button
        id="sidebarLogoutBtn"
        type="button"
        className="side-logout"
        data-tour="barra-sair"
        aria-label="Sair da sessão atual"
        data-dica="Sair"
        onClick={() => void performExplicitLogout()}
      >
        <Icone nome="log-out" />
        <span>Sair</span>
      </button>
      {/*
        O texto da versão é do legado: `applyConfigToUi` o escreve pelos ids.
        O React cria os dois nós vazios e nunca põe filhos neles.
      */}
      <div className="side-version">
        <span id="sidebarVersionLabel" />
        <b id="sidebarVersion" />
      </div>
    </div>
  );
}

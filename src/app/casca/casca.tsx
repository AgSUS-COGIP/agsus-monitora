import { memo } from "react";
import { montarModulo } from "../montar-modulo.tsx";
import { chamarAcaoDaCasca } from "./acoes.ts";
import { AreasDasTelas } from "./areas-das-telas.tsx";
import { GavetaDoCelular } from "./gaveta-do-celular.tsx";
import { usarTabelasEmCartoes } from "./tabelas-em-cartoes.ts";
import { Topo } from "./topo.tsx";

/*
  A casca do app depois de entrar, dentro de `#appScreen`: a volta do painel
  externo, o `<aside>` da barra lateral, o cabeçalho, os pontos de montagem do
  topo (aviso de versão, Aya, encerramento do edital), a faixa de aviso global
  e as áreas das telas. Antes era marcação fixa do index.html; os ids e as
  classes são os mesmos (CSS, testes, tours da Aya e o resto do app os usam).

  Desenha UMA vez, síncrona, no começo de src/main.ts — antes de
  `ligarSistema()` e de qualquer ilha que monte aqui dentro. Depois disso o
  React não mexe mais nesta árvore: não há estado nem props que mudem (`memo`
  sem props), e quem escreve nela continua escrevendo como antes (título,
  perfil, textos configuráveis, `.active` das seções, a faixa de manutenção).
  A exceção é o celular: o véu da gaveta (`gaveta-do-celular.tsx`) se
  redesenha sozinho ao abrir e fechar, e as tabelas viram cartões
  (`tabelas-em-cartoes.ts`).
  As ilhas (barra lateral, Pessoas online, Aya…) são raízes React próprias que
  montam nos elementos vazios daqui.

  O `#appScreen` em si fica no index.html: é a raiz, e a classe `hidden` dele
  é de `perfil.mostrarApp()`/`esconderApp()` desde o primeiro quadro.
*/
export const Casca = memo(function Casca() {
  usarTabelasEmCartoes();
  return (
    <>
      <RetornoDoPainelExterno />
      {/*
        Barra lateral em React (src/componentes/barra-lateral/): o conteúdo
        inteiro, e o botão de recolher, são montados por montarBarraLateral().
      */}
      <aside className="sidebar" aria-label="Navegação principal"></aside>
      <GavetaDoCelular />

      <main className="main" id="conteudoPrincipal" tabIndex={-1}>
        <Topo />
        {/* Aviso de versão nova (React: src/componentes/aviso-de-versao/) */}
        <div id="avisoDeVersaoApp"></div>
        <div id="ayaApp"></div>
        {/* Tela de encerramento do edital (React: src/modulos/encerramento-do-edital/) */}
        <div id="encerramentoDoEditalApp"></div>

        {/* Aviso global de Configurações (src/app/configuracao.ts). */}
        <div
          id="broadcastBar"
          className="alert broadcast-bar"
          role="status"
          hidden
        ></div>

        <AreasDasTelas />
      </main>
    </>
  );
});

/* Painel externo em tela limpa: o botão de volta (texto de configuracao.ts). */
function RetornoDoPainelExterno() {
  return (
    <div id="externalReturnBar">
      <button
        id="externalBackBtn"
        type="button"
        onClick={() => void chamarAcaoDaCasca("exitExternalPanel")}
        title=""
        aria-label=""
      >
        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>{" "}
        <span id="externalBackText"></span>
      </button>
    </div>
  );
}

/**
 * Desenha a casca em `#appScreen`, na hora (`flushSync`): o código seguinte
 * de src/main.ts procura os elementos dela pelo id.
 */
export function montarCasca(
  elemento: HTMLElement | null = globalThis.document?.getElementById(
    "appScreen",
  ),
) {
  if (!elemento) return null;
  return montarModulo(elemento, <Casca />, {
    flushSync: true,
    nome: "a casca do app",
  });
}

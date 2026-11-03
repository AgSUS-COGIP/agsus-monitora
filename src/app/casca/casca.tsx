import { memo } from "react";
import { BarraLateral } from "../../componentes/barra-lateral/barra-lateral.tsx";
import { Telas } from "../telas.tsx";
import { chamarAcaoDaCasca } from "./acoes.ts";
import { GavetaDoCelular } from "./gaveta-do-celular.tsx";
import { usarTabelasEmCartoes } from "./tabelas-em-cartoes.ts";
import { Topo } from "./topo.tsx";

/*
  A casca do app depois de entrar, dentro de `#appScreen`: a volta do painel
  externo, o `<aside>` da barra lateral (com a barra), o cabeçalho, os pontos
  de montagem do topo (aviso de versão, Aya, encerramento do edital), a faixa
  de aviso global e as telas (src/app/telas.tsx). Os ids e as classes são os
  de antes (CSS, testes, tours da Aya e o resto do app os usam).

  Entra por portal da raiz do app (src/app/raiz.tsx), desenhada na hora no
  começo de src/main.ts — antes de `ligarSistema()` e de qualquer ilha que
  monte aqui dentro. A casca em si não tem estado nem props (`memo`): quem
  muda são as filhas que leem estado — a barra lateral, o título do
  cabeçalho e as telas (pela navegação). O resto ainda é escrito de fora
  (perfil, textos configuráveis, a faixa de manutenção). No celular, o véu
  da gaveta (`gaveta-do-celular.tsx`) se redesenha ao abrir e fechar, e as
  tabelas viram cartões (`tabelas-em-cartoes.ts`).
  As ilhas que ainda montam sozinhas (Pessoas online, Aya…) usam os
  elementos vazios daqui (docs/arquitetura/raiz-react.md, passo 2).

  O `#appScreen` em si fica no index.html: a classe `hidden` dele é de
  `perfil.mostrarApp()`/`esconderApp()` desde o primeiro quadro.
*/
export const Casca = memo(function Casca() {
  usarTabelasEmCartoes();
  return (
    <>
      <RetornoDoPainelExterno />
      {/* Barra lateral (src/componentes/barra-lateral/): marca, menu e rodapé. */}
      <aside className="sidebar" aria-label="Navegação principal">
        <BarraLateral />
      </aside>
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

        <Telas />
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

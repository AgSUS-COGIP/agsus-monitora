import { AvisoDeConexao } from "./aviso-de-conexao.tsx";
import { ConfirmacaoDeSaida } from "./confirmacao-de-saida.tsx";
import { CaixaDeNotificacoes } from "./notificacoes.tsx";
import { TelaDeCarregamento } from "./tela-de-carregamento.tsx";

/*
  Os avisos por cima de tudo, na entrada e no sistema: as notificações curtas
  (`#toastBox`), a tela de carregamento dos salvamentos (`#loader`) e o aviso
  de conexão (`#connectivityStatusNotice`). Antes eram marcação fixa do
  index.html e três módulos do legado (`notificacao.js`,
  `loading-experience.js`, `connectivity-status.js`); os ids e as classes são
  os mesmos (CSS em app.css, loading-experience.css e connectivity-status.css).
  Também a confirmação do Sair e a tela de "Saindo do sistema…"
  (`confirmacao-de-saida.tsx`, antes injetadas por `nielsen-shell-ux.js`):
  ficam fora do `#appScreen`, que se esconde ao sair.

  Quem abre é src/app/avisos.ts (`avisar`, `mostrarCarregamento`), em
  `window.monitoraToast`/`window.monitoraLoader`; a conexão se vigia sozinha.
  Fica no próprio `#raiz` (src/app/raiz.tsx), em `#avisosApp`, fora do
  `#appScreen`, porque a tela de acesso também usa.
*/
export function Avisos() {
  return (
    <>
      <CaixaDeNotificacoes />
      <TelaDeCarregamento />
      <AvisoDeConexao />
      <ConfirmacaoDeSaida />
    </>
  );
}

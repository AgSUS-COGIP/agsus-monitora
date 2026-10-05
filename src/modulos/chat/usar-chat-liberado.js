import { useSyncExternalStore } from "react";
import { FASES, sessaoDoApp } from "../../app/sessao.js";
import { podeUsarChat } from "../../lib/access-roles.js";

/*
  A pessoa conectada pode usar as Mensagens? Para as telas que mostram o botão
  "Conversa" (Editais, Classificação). Lê a sessão do app.
*/
const liberado = (sessao) => {
  const { fase, perfil } = sessao.obter();
  return fase === FASES.CONECTADO && podeUsarChat(perfil);
};

export function usarChatLiberado(sessao = sessaoDoApp) {
  return useSyncExternalStore(sessao.assinar, () => liberado(sessao));
}

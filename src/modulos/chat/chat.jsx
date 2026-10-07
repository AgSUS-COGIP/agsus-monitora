import { lazy, Suspense, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { FASES, sessaoDoApp } from "../../app/sessao.js";
import { paginasPermitidas, podeUsarChat } from "../../lib/access-roles.js";
import { totalDeNaoLidas } from "../../lib/chat.js";
import { importarComRecarga } from "../../lib/importar-com-recarga.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { AvisosDoChat } from "./avisos.jsx";
import { criarEstadoDoChat } from "./estado.js";
import { EVENTO_ABRIR_CONVERSA, EVENTO_COMPARTILHAR } from "./ponte.js";

/*
  Chat do MONITORA (painel "Mensagens"), módulo do app.

  Monta no `#chatHost` do cabeçalho (ao lado de Pessoas online): o ícone com o
  contador de não lidas e os avisos de mensagem nova (avisos.jsx, por portal).
  O painel lateral (painel.jsx) só é baixado na primeira abertura (import sob
  demanda) e vai para o `body` por portal.

  Liga e desliga pela sessão do app: conectado e com o recurso "chat" na matriz
  (`podeUsarChat`). Sem o recurso, nada aparece.

  De fora, a conversa abre pelo evento EVENTO_ABRIR_CONVERSA (ponte.js) e pelo
  botão "Mensagem" de Pessoas online (`[data-chat-usuario]`, marcação do
  legado); o cartão de "Compartilhar esta ficha" chega pelo EVENTO_COMPARTILHAR.
*/

// Versão nova publicada com a página aberta: recarrega em vez de quebrar a ilha.
const PainelDoChat = lazy(importarComRecarga(() => import("./painel.jsx")));

const ID_DO_PAINEL = "chatPainel";

function rotuloDoBotao(total) {
  if (!total) return "Mensagens";
  return `Mensagens, ${total} não ${total === 1 ? "lida" : "lidas"}`;
}

export function Chat({ estado }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const total = totalDeNaoLidas(e.conversas);

  if (!e.ligado) return null;
  return (
    <>
      <button
        type="button"
        className={`chat-botao${e.aberto ? " is-aberto" : ""}`}
        aria-label={rotuloDoBotao(total)}
        title="Mensagens"
        data-tour="chat-botao"
        aria-expanded={e.aberto ? "true" : "false"}
        aria-controls={ID_DO_PAINEL}
        onClick={() => estado.alternar()}
      >
        <i className="fa-solid fa-comments" aria-hidden="true" />
        {total ? (
          <span className="chat-botao__contador" aria-hidden="true">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>
      {e.aberto
        ? createPortal(
            <Suspense fallback={null}>
              <PainelDoChat estado={estado} id={ID_DO_PAINEL} />
            </Suspense>,
            document.body,
          )
        : null}
      {createPortal(
        <AvisosDoChat estado={estado} avisos={e.avisos} comPainel={e.aberto} />,
        document.body,
      )}
    </>
  );
}

/* Liga o estado à sessão do app e escuta quem pede para abrir uma conversa. */
function usarLigacoes(estado, sessao, documento) {
  useEffect(() => {
    const aplicar = () => {
      const { fase, usuario, perfil } = sessao.obter();
      if (fase === FASES.CONECTADO && usuario?.id && podeUsarChat(perfil)) {
        estado.ligar(usuario.id);
        estado.definirPaginas(paginasPermitidas(perfil));
      } else estado.desligar();
    };
    aplicar();
    const desassinar = sessao.assinar(aplicar);
    return () => {
      desassinar?.();
      estado.desligar();
    };
  }, [estado, sessao]);

  useEffect(() => {
    const aoPedir = (evento) => {
      const pedido = evento.detail || {};
      if (pedido.tipo === "EDITAL")
        void estado.abrirConversaDoEdital(pedido.edital);
      if (pedido.tipo === "DIRETA")
        void estado.abrirConversaDireta(pedido.usuario);
    };
    const aoClicar = (evento) => {
      const botao = evento.target?.closest?.("[data-chat-usuario]");
      if (!botao) return;
      evento.preventDefault();
      void estado.abrirConversaDireta(botao.getAttribute("data-chat-usuario"));
    };
    const aoCompartilhar = (evento) =>
      void estado.compartilhar(evento.detail?.link);
    documento.addEventListener(EVENTO_ABRIR_CONVERSA, aoPedir);
    documento.addEventListener(EVENTO_COMPARTILHAR, aoCompartilhar);
    documento.addEventListener("click", aoClicar);
    return () => {
      documento.removeEventListener(EVENTO_ABRIR_CONVERSA, aoPedir);
      documento.removeEventListener(EVENTO_COMPARTILHAR, aoCompartilhar);
      documento.removeEventListener("click", aoClicar);
    };
  }, [estado, documento]);
}

function ChatLigado({ estado, sessao, documento }) {
  usarLigacoes(estado, sessao, documento);
  return <Chat estado={estado} />;
}

/**
 * Monta o chat no `#chatHost` do cabeçalho. Devolve `{ estado, raiz, desmontar }`.
 */
export function montarChat({
  elemento = document.getElementById("chatHost"),
  supabase = getSupabaseClient(),
  toast,
  sessao = sessaoDoApp,
  documento = document,
  ...opcoes
} = {}) {
  const estado = criarEstadoDoChat({ supabase, toast, documento, ...opcoes });
  if (!elemento) return { estado, raiz: null, desmontar: () => {} };
  const { raiz, desmontar } = montarModulo(
    elemento,
    <ChatLigado estado={estado} sessao={sessao} documento={documento} />,
    { nome: "as mensagens" },
  );
  return { estado, raiz, desmontar };
}

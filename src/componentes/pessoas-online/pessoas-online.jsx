import { useEffect, useReducer, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { podeUsarChat } from "../../lib/access-roles.js";
import { situacaoDaPresenca } from "../../lib/online-presence.js";

/*
  "Pessoas online" no cabeçalho (moldura do app): o botão com a contagem e a
  lista de quem está com o MONITORA aberto, com o lugar de cada um. O estado é
  de src/app/presenca.js; aqui só se desenha.

  "Mensagem" abre a conversa direta: src/modulos/chat/ escuta o clique em
  `[data-chat-usuario]`. Os ids (`#onlinePresence`, `#onlinePresenceBtn`,
  `#onlinePresenceList`…) são os de antes: o CSS e os testes de ponta a ponta
  continuam valendo.
*/

function assinarConexao(avisar) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}
const conectado = () => globalThis.navigator?.onLine !== false;

function Avatar({ pessoa }) {
  return (
    <span className="online-presence-avatar">
      {pessoa.avatarUrl ? (
        <img
          src={pessoa.avatarUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span aria-hidden="true">{pessoa.initials}</span>
      )}
      <i aria-hidden="true" />
    </span>
  );
}

function Pessoa({ pessoa, comMensagem }) {
  return (
    <div className="online-presence-person">
      <Avatar pessoa={pessoa} />
      <span className="online-presence-texto">
        <strong title={pessoa.fullName}>{pessoa.fullName}</strong>
        <small>
          {pessoa.profileLabel}
          {pessoa.currentView ? ` · ${pessoa.currentView}` : ""}
        </small>
      </span>
      {comMensagem ? (
        <button
          type="button"
          className="online-presence-mensagem"
          data-chat-usuario={pessoa.userId}
          aria-label={`Mensagem para ${pessoa.fullName}`}
        >
          Mensagem
        </button>
      ) : null}
    </div>
  );
}

export function PessoasOnline({ presenca, agora = () => Date.now() }) {
  const estado = useSyncExternalStore(presenca.assinar, presenca.obter);
  const online = useSyncExternalStore(assinarConexao, conectado);
  const [, redesenhar] = useReducer((n) => n + 1, 0);
  const esperaMs = Math.max(0, agora() - estado.desde);
  const situacao = situacaoDaPresenca({
    sincronizado: estado.sincronizado,
    quantos: estado.pessoas.length,
    online,
    esperaMs,
  });

  // "Sincronizando" vira "Presença indisponível" se a espera passar do limite.
  useEffect(() => {
    if (situacao.estado !== "loading" || !estado.visivel) return undefined;
    const relogio = setTimeout(redesenhar, 1_000);
    return () => clearTimeout(relogio);
  });

  // Esc fecha a lista aberta.
  useEffect(() => {
    if (!estado.aberto) return undefined;
    const aoTeclar = (evento) => {
      if (evento.key === "Escape") presenca.fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [estado.aberto, presenca]);

  const perfil = presenca.perfilAtual();
  const euId = presenca.usuarioAtual()?.id;
  const comChat = podeUsarChat(perfil);
  const semPessoas =
    situacao.estado === "error" || situacao.estado === "offline"
      ? situacao.detalhe
      : estado.sincronizado
        ? "Ninguém mais com a plataforma aberta agora."
        : "Sincronizando presença…";

  return (
    <div
      id="onlinePresence"
      className={estado.visivel ? "online-presence" : "online-presence hidden"}
      data-presence-state={situacao.estado}
      aria-busy={situacao.estado === "loading" ? "true" : "false"}
    >
      <button
        id="onlinePresenceBtn"
        className="online-presence-button"
        type="button"
        onClick={() => presenca.alternar()}
        aria-expanded={estado.aberto ? "true" : "false"}
        aria-controls="onlinePresencePopover"
        aria-label={`${situacao.detalhe} Ver lista.`}
        title={situacao.detalhe}
      >
        <span
          id="onlinePresenceDot"
          className={
            estado.sincronizado
              ? "online-presence-dot is-online"
              : "online-presence-dot"
          }
        />
        <i className="fa-solid fa-user-group" aria-hidden="true" />
        <span id="onlinePresenceLabel" aria-live="polite">
          {situacao.rotulo}
        </span>
      </button>
      <div
        id="onlinePresencePopover"
        className="online-presence-popover"
        hidden={!estado.aberto}
      >
        <div className="online-presence-heading">
          <strong>Pessoas online</strong>
        </div>
        <div id="onlinePresenceList" className="online-presence-list">
          {estado.pessoas.length && situacao.estado === "ready" ? (
            estado.pessoas.map((pessoa) => (
              <Pessoa
                key={pessoa.userId}
                pessoa={pessoa}
                comMensagem={comChat && pessoa.userId !== euId}
              />
            ))
          ) : (
            <p>{semPessoas}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Monta "Pessoas online" no cabeçalho (`#pessoasOnlineApp`). */
export function montarPessoasOnline({
  elemento = document.getElementById("pessoasOnlineApp"),
  presenca,
} = {}) {
  if (!elemento || !presenca) return null;
  return montarModulo(elemento, <PessoasOnline presenca={presenca} />, {
    nome: "Pessoas online",
  });
}

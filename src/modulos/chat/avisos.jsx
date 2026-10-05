import { useEffect, useState } from "react";
import { DURACAO_DO_AVISO_MS } from "../../lib/avisos-do-chat.js";
import { Avatar } from "./avatar.jsx";

/*
  Avisos de mensagem nova na tela (canto inferior direito, acima da Aya; com o
  painel aberto, à esquerda dele). Vêm de `estado.avisos` (estado.js decide
  quando, pelas regras de src/lib/avisos-do-chat.js): no máximo 3, um por
  conversa. Clicar abre a conversa; some sozinho depois de alguns segundos,
  com pausa enquanto o mouse ou o foco estão nele. Região `status` educada:
  o leitor de tela anuncia sem tirar o foco de onde a pessoa está.
*/

function AvisoDeMensagem({ aviso, estado }) {
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado) return undefined;
    const fim = setTimeout(
      () => estado.dispensarAviso(aviso.id),
      DURACAO_DO_AVISO_MS,
    );
    return () => clearTimeout(fim);
  }, [estado, aviso.id, pausado]);

  return (
    <li
      className="chat-aviso"
      data-aviso={aviso.conversa}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={(ev) => {
        if (!ev.currentTarget.contains(ev.relatedTarget)) setPausado(false);
      }}
    >
      <button
        type="button"
        className="chat-aviso__abrir"
        onClick={() => void estado.abrirDoAviso(aviso.id)}
      >
        {aviso.autor ? (
          <Avatar pessoa={aviso.autor} />
        ) : (
          <Avatar grupo={aviso.tipo !== "DIRETA"} />
        )}
        <span className="chat-aviso__corpo">
          <span className="sr-only">Nova mensagem: </span>
          <strong>{aviso.titulo}</strong>
          <span className="chat-aviso__previa">
            {aviso.remetente ? `${aviso.remetente}: ` : ""}
            {aviso.previa}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="chat-icone chat-aviso__fechar"
        aria-label="Dispensar aviso"
        onClick={() => estado.dispensarAviso(aviso.id)}
      >
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </li>
  );
}

export function AvisosDoChat({ estado, avisos, comPainel }) {
  return (
    <div
      className={`chat-avisos${comPainel ? " com-painel" : ""}`}
      role="status"
      aria-live="polite"
    >
      {avisos.length ? (
        <ul className="chat-avisos__lista">
          {avisos.map((aviso) => (
            <AvisoDeMensagem key={aviso.id} aviso={aviso} estado={estado} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

import { safeHttpUrl } from "../../lib/sanitize.js";

/*
  Avatar de pessoa (ou de grupo) do chat: foto, se houver endereço seguro, ou
  as iniciais; o ponto de presença (presencaDe, src/lib/chat.js): verde
  (online e Disponível), vermelho (Ocupado), âmbar (Ausente); sem ponto, fora
  do MONITORA. Fica fora do painel para o aviso de mensagem nova (avisos.jsx)
  usar sem baixar o painel.
*/

const iniciais = (nome) =>
  String(nome || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() || "")
    .join("") || "?";

export function Avatar({ pessoa, online = false, presenca, grupo = false }) {
  const foto = pessoa?.avatar ? safeHttpUrl(pessoa.avatar) : "";
  const ponto = presenca ?? (online ? "disponivel" : "offline");
  return (
    <span className="chat-avatar" aria-hidden="true">
      {grupo ? (
        <i className="fa-solid fa-users" />
      ) : foto ? (
        <img src={foto} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span>{iniciais(pessoa?.nome)}</span>
      )}
      {ponto !== "offline" ? (
        <i className="chat-avatar__online" data-presenca={ponto} />
      ) : null}
    </span>
  );
}

import { useState } from "react";
import {
  copiarTexto,
  linkDoEmailDoConvite,
  mensagemDoConvite,
} from "../../lib/convite-de-acesso.js";
import { Icone } from "../../componentes/icone.jsx";

/*
  Mensagem do convite com "Copiar mensagem" e "Abrir no e-mail": no passo
  "Convite pronto" de Adicionar pessoa e em "Reenviar convite" na gaveta de
  quem ainda não entrou. O link só leva à tela de entrada; quem dá o acesso é
  o e-mail cadastrado.
*/

const origemAtual = () => globalThis.location?.origin || "";

export function AcoesDoConvite({ nome, email }) {
  const [copiado, setCopiado] = useState(null);
  const dados = { nome, email, origem: origemAtual() };
  const mensagem = mensagemDoConvite(dados);
  return (
    <div className="acessos-convite">
      <p className="acessos-convite-mensagem">{mensagem}</p>
      <p className="acessos-secundario">Só funciona com {email}.</p>
      <div className="ui-acoes">
        <button
          type="button"
          className="btn secondary"
          onClick={async () => setCopiado(await copiarTexto(mensagem))}
        >
          <Icone nome="copy" tamanho={16} /> Copiar mensagem
        </button>
        <a className="btn outline" href={linkDoEmailDoConvite(dados)}>
          <Icone nome="mail" tamanho={16} /> Abrir no e-mail
        </a>
      </div>
      {copiado === null ? null : (
        <small
          role="status"
          className={copiado ? "acessos-secundario" : "acessos-erro"}
        >
          {copiado
            ? "Mensagem copiada."
            : "Não foi possível copiar. Selecione o texto acima e copie."}
        </small>
      )}
    </div>
  );
}

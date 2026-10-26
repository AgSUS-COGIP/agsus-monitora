import { useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.tsx";
import { Icone } from "../icone.tsx";
import { Aviso } from "../../ui/aviso.tsx";
import {
  AVISO_DE_PENDENCIA,
  type AvisoDeVersao as Controle,
} from "../../app/aviso-de-versao.ts";
import "./aviso-de-versao.css";

/*
  A faixa de versão nova no topo da página (moldura do app). O estado e a
  regra são de src/app/aviso-de-versao.ts; aqui só se desenha.

  Discreta (tom informativo) quando há versão nova; com a novidade que importa
  ("Novo: …") quando o build marcou uma; forte ("Atualize para continuar",
  sem fechar) quando uma chamada ao banco falhou por ser da versão anterior.
*/

export function AvisoDeVersao({ aviso }: { aviso: Controle }) {
  const estado = useSyncExternalStore(aviso.assinar, aviso.obter);
  if (!estado.versaoNova) return null;
  if (estado.fechado && !estado.telaAntiga) return null;
  const forte = estado.telaAntiga;
  return (
    <Aviso
      tom={forte ? "warning" : "info"}
      papel={forte ? "alert" : "status"}
      className="aviso-de-versao"
    >
      <p className="aviso-de-versao-texto">
        {forte ? (
          <strong>
            Esta tela é de uma versão anterior do MONITORA. Atualize para
            continuar.
          </strong>
        ) : (
          "Há uma versão nova do MONITORA."
        )}
        {estado.novidade ? (
          <span className="aviso-de-versao-novidade">
            {" "}
            Novo: {estado.novidade}
          </span>
        ) : null}
      </p>
      {estado.pendencia ? (
        <p className="aviso-de-versao-pendencia" role="alert">
          {AVISO_DE_PENDENCIA}
        </p>
      ) : null}
      <div className="aviso-de-versao-acoes">
        <button
          type="button"
          className={forte ? "btn small" : "btn small secondary"}
          data-acao="atualizar-versao"
          onClick={() => aviso.atualizarAgora()}
        >
          <Icone nome="refresh-cw" tamanho={16} /> Atualizar agora
        </button>
        {forte ? null : (
          <button
            type="button"
            className="btn small ghost aviso-de-versao-fechar"
            data-acao="fechar-aviso-de-versao"
            aria-label="Fechar aviso de versão nova"
            title="Fechar"
            onClick={() => aviso.fechar()}
          >
            <Icone nome="x" tamanho={16} />
          </button>
        )}
      </div>
    </Aviso>
  );
}

export function montarAvisoDeVersao({
  elemento = globalThis.document?.getElementById("avisoDeVersaoApp"),
  aviso,
}: {
  elemento?: HTMLElement | null;
  aviso: Controle;
}) {
  if (!elemento) return null;
  return montarModulo(elemento, <AvisoDeVersao aviso={aviso} />, {
    nome: "Aviso de versão nova",
  });
}

import { useId, useSyncExternalStore } from "react";
import { Icone } from "../icone.tsx";
import {
  AVISO_DE_PENDENCIA,
  type AvisoDeVersao as Controle,
} from "../../app/aviso-de-versao.ts";
import "./aviso-de-versao.css";

/*
  O cartão de versão nova, no canto de baixo (moldura do app; no celular,
  embaixo e na largura da tela, acima da arara da Aya). O estado e a regra são
  de src/app/aviso-de-versao.ts; aqui só se desenha.

  Discreto (tom informativo, `role="status"`) quando há versão nova, com a
  novidade que importa ("Novo: …") quando o build marcou uma; forte ("Atualize
  para continuar", `role="alert"`, sem "Agora não") quando uma chamada ao
  banco falhou por ser da versão anterior. "Atualizar" aceito vira
  "Atualizando…" com o ícone girando até a página recarregar.
*/

export function AvisoDeVersao({ aviso }: { aviso: Controle }) {
  const estado = useSyncExternalStore(aviso.assinar, aviso.obter);
  const idDoTitulo = useId();
  if (!estado.versaoNova) return null;
  if (estado.fechado && !estado.telaAntiga) return null;
  const forte = estado.telaAntiga;
  const atualizando = estado.atualizando;
  return (
    <section
      className="aviso-de-versao"
      data-tone={forte ? "warning" : "info"}
      role={forte ? "alert" : "status"}
      aria-labelledby={idDoTitulo}
    >
      <span className="aviso-de-versao-icone">
        <Icone nome={forte ? "triangle-alert" : "refresh-cw"} tamanho={18} />
      </span>
      <div className="aviso-de-versao-corpo">
        <p className="aviso-de-versao-titulo" id={idDoTitulo}>
          {forte ? "Atualize para continuar" : "O Yeendé foi atualizado"}
        </p>
        <p className="aviso-de-versao-texto">
          {forte
            ? "Esta tela é de uma versão anterior do Yeendé."
            : "A página será recarregada com a versão mais recente."}
        </p>
        {estado.novidade ? (
          <p className="aviso-de-versao-novidade">Novo: {estado.novidade}</p>
        ) : null}
        {estado.pendencia ? (
          <p className="aviso-de-versao-pendencia" role="alert">
            {AVISO_DE_PENDENCIA}
          </p>
        ) : null}
        <div className="aviso-de-versao-acoes">
          {forte ? null : (
            <button
              type="button"
              className="btn small ghost"
              data-acao="fechar-aviso-de-versao"
              disabled={atualizando}
              onClick={() => aviso.fechar()}
            >
              Agora não
            </button>
          )}
          <button
            type="button"
            className="btn small"
            data-acao="atualizar-versao"
            disabled={atualizando}
            aria-busy={atualizando || undefined}
            onClick={() => aviso.atualizarAgora()}
          >
            <Icone
              nome="refresh-cw"
              tamanho={16}
              className={atualizando ? "aviso-de-versao-girando" : undefined}
            />
            {atualizando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
    </section>
  );
}

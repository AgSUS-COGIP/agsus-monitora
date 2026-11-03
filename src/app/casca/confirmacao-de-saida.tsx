import { useEffect, useRef, useSyncExternalStore } from "react";
import { Icone } from "../../componentes/icone.tsx";
import { assinarSaida, obterSaida, responderASaida } from "./saida.ts";

/*
  "Deseja realmente sair?" e a tela de "Saindo do sistema…", abertos pelo Sair
  da barra lateral (`sairDoSistema`, em `saida.ts`). Era marcação injetada pelo
  legado `nielsen-shell-ux.js`; os ids, as classes (nielsen-shell-ux.css) e os
  `data-shell-logout-*` são os mesmos.

  Aberto, o foco vai para "Continuar no sistema" (a opção segura), Esc e o
  fundo cancelam, e ao fechar o foco volta para quem abriu.
*/
export function ConfirmacaoDeSaida() {
  const { perguntando, comRascunho, saindo } = useSyncExternalStore(
    assinarSaida,
    obterSaida,
  );
  const continuar = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!perguntando) return undefined;
    const anterior = document.activeElement;
    continuar.current?.focus({ preventScroll: true });
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      evento.preventDefault();
      responderASaida(false);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      if (anterior instanceof HTMLElement)
        anterior.focus({ preventScroll: true });
    };
  }, [perguntando]);

  return (
    <>
      <div
        id="shellLogoutDialog"
        className="shell-confirm-layer"
        hidden={!perguntando}
      >
        <div
          className="shell-confirm-backdrop"
          data-shell-logout-cancel=""
          onClick={() => responderASaida(false)}
        ></div>
        <section
          className="shell-confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shellLogoutTitle"
          aria-describedby="shellLogoutDescription"
        >
          <div className="shell-confirm-icon" aria-hidden="true">
            <Icone nome="log-out" />
          </div>
          <h2 id="shellLogoutTitle">Deseja realmente sair?</h2>
          <p id="shellLogoutDescription">
            Sua sessão será encerrada neste navegador. Dados já salvos serão
            preservados.
          </p>
          <p
            id="shellLogoutUnsavedWarning"
            className="shell-confirm-warning"
            hidden={!comRascunho}
          >
            Existem alterações não salvas em Configurações. Se sair agora, elas
            serão descartadas.
          </p>
          <div className="shell-confirm-actions">
            <button
              ref={continuar}
              type="button"
              className="shell-confirm-cancel"
              data-shell-logout-cancel=""
              onClick={() => responderASaida(false)}
            >
              Continuar no sistema
            </button>
            <button
              type="button"
              className="shell-confirm-submit"
              data-shell-logout-confirm=""
              onClick={() => responderASaida(true)}
            >
              Sair
            </button>
          </div>
        </section>
      </div>
      <div
        id="shellSignoutBusy"
        className="shell-signout-busy"
        role="status"
        aria-live="assertive"
        aria-busy="true"
        hidden={!saindo}
      >
        <div className="shell-signout-card">
          <span className="shell-signout-spinner" aria-hidden="true"></span>
          <strong>Saindo do sistema…</strong>
          <span>Encerrando sua sessão neste navegador.</span>
        </div>
      </div>
    </>
  );
}

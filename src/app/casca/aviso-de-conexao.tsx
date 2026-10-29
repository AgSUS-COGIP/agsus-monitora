import { useEffect, useState } from "react";

/*
  O aviso de conexão (`#connectivityStatusNotice`): ao cair a internet, "Sem
  conexão" com "Tentar novamente"; ao voltar, "Conexão restabelecida" por 3,2s.
  Só aparece depois de uma queda (ou se a página já abriu sem rede).
*/

/** Quanto tempo "Conexão restabelecida" fica à vista. */
export const VISIVEL_DEPOIS_DE_VOLTAR_MS = 3200;

type Situacao = "offline" | "online";
type Estado = { situacao: Situacao; oculto: boolean } | null;

/** A situação da rede, desde a primeira queda (`null` antes dela). */
export function usarConexao(): Estado {
  const [estado, definirEstado] = useState<Estado>(() =>
    globalThis.navigator?.onLine === false
      ? { situacao: "offline", oculto: false }
      : null,
  );

  useEffect(() => {
    const aoCair = () => definirEstado({ situacao: "offline", oculto: false });
    const aoVoltar = () =>
      definirEstado((atual) =>
        atual?.situacao === "offline"
          ? { situacao: "online", oculto: false }
          : atual,
      );
    window.addEventListener("offline", aoCair);
    window.addEventListener("online", aoVoltar);
    return () => {
      window.removeEventListener("offline", aoCair);
      window.removeEventListener("online", aoVoltar);
    };
  }, []);

  // Uma queda nova antes do prazo cancela o sumiço (o efeito limpa o temporizador).
  const voltouAgora = estado?.situacao === "online" && !estado.oculto;
  useEffect(() => {
    if (!voltouAgora) return;
    const temporizador = window.setTimeout(
      () =>
        definirEstado((atual) =>
          atual?.situacao === "online" ? { ...atual, oculto: true } : atual,
        ),
      VISIVEL_DEPOIS_DE_VOLTAR_MS,
    );
    return () => window.clearTimeout(temporizador);
  }, [voltouAgora]);

  return estado;
}

export function AvisoDeConexao() {
  const estado = usarConexao();
  if (!estado) return null;
  const caiu = estado.situacao === "offline";
  return (
    <aside
      id="connectivityStatusNotice"
      className={
        estado.oculto ? "connectivity-status hidden" : "connectivity-status"
      }
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-state={estado.situacao}
    >
      <div className="connectivity-status__content">
        <strong className="connectivity-status__title">
          {caiu ? "Sem conexão com a internet" : "Conexão restabelecida"}
        </strong>
        <span className="connectivity-status__message">
          {caiu
            ? "Algumas informações podem estar desatualizadas até a conexão voltar."
            : "O sistema voltou a ficar online."}
        </span>
      </div>
      {caiu && (
        <button
          type="button"
          className="connectivity-status__action"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      )}
    </aside>
  );
}

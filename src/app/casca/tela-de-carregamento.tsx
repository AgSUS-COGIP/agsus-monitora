import { useEffect, useState, useSyncExternalStore } from "react";
import { carregamento } from "../avisos.ts";
import { getLoadingStage, isGenericLoadingCopy } from "../../lib/loading-copy";

/*
  A tela de carregamento dos salvamentos (`#loader`), aberta por
  `window.monitoraLoader` (src/app/avisos.ts). Título e subtítulo genéricos
  ("Carregando", "Aguarde...") dão lugar à etapa do percentual; o pé mostra
  "Etapa X de Y", o aviso de demora aos 12s e "Tentar novamente" aos 25s
  (`getLoadingStage`). O relógio só corre com a tela à vista.
*/

const INTERVALO_MS = 1_000;

/** Milissegundos desde `desde` (0 = parado), atualizado a cada segundo. */
function usarDecorrido(desde: number) {
  const [agora, definirAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!desde) return;
    const relogio = window.setInterval(
      () => definirAgora(Date.now()),
      INTERVALO_MS,
    );
    return () => window.clearInterval(relogio);
  }, [desde]);
  return desde ? Math.max(0, agora - desde) : 0;
}

export function TelaDeCarregamento() {
  const { visivel, titulo, subtitulo, percentual, desde } =
    useSyncExternalStore(carregamento.assinar, carregamento.obter);
  const decorrido = usarDecorrido(desde);

  useEffect(() => {
    const corpo = globalThis.document.body;
    corpo.setAttribute("aria-busy", String(visivel));
    return () => corpo.removeAttribute("aria-busy");
  }, [visivel]);

  const etapa = getLoadingStage({
    progress: Math.round(percentual),
    elapsedMs: decorrido,
  });
  const textoDaEtapa = (texto: string, daEtapa: string) =>
    visivel && isGenericLoadingCopy(texto) ? daEtapa : texto;

  return (
    <div
      id="loader"
      className={visivel ? "loader show" : "loader"}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-hidden={!visivel}
    >
      <div className="loader-card">
        <div className="loader-brand" aria-hidden="true">
          <img src="/assets/agsus-logo.webp" alt="" />
          <span></span>
          <div>
            <strong>MONITORA</strong>
            <small>Ambiente institucional AgSUS</small>
          </div>
        </div>
        <div className="loader-status">
          <div className="loader-spin"></div>
          <div className="loader-copy">
            <div id="loaderTitle" className="loader-title">
              {textoDaEtapa(titulo, etapa.title)}
            </div>
            <div id="loaderSub" className="loader-sub">
              {textoDaEtapa(subtitulo, etapa.detail)}
            </div>
          </div>
          <div id="loaderPct" className="loader-pct">
            {Math.round(percentual) + "%"}
          </div>
        </div>
        <div className="loader-bar">
          <span
            id="loaderBar"
            style={{ width: Math.max(0, Math.min(100, percentual)) + "%" }}
          ></span>
        </div>
        <div className="loader-safe">
          <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>{" "}
          Carregamento seguro dos painéis autorizados
        </div>
        {visivel && (
          <>
            <div
              id="loaderMeta"
              className={
                etapa.delayed ? "loader-meta is-delayed" : "loader-meta"
              }
              aria-live="polite"
            >
              {etapa.delayMessage ||
                `Etapa ${etapa.step} de ${etapa.totalSteps}`}
            </div>
            <button
              id="loaderRetry"
              className="loader-retry"
              type="button"
              hidden={!etapa.canRetry}
              onClick={() => window.location.reload()}
            >
              Tentar novamente
            </button>
          </>
        )}
      </div>
    </div>
  );
}

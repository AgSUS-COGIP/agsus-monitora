import { lazy, Suspense, useState } from "react";
import type { RecursoDoPainel } from "../../../lib/tipos-dos-recursos.ts";
import { Secao, Selo } from "../../../ui/index.ts";

/*
  "Montar parecer" na gaveta do recurso — PROTÓTIPO, desligado por padrão: só
  aparece com `?prototipo-parecer` no endereço ou com
  localStorage["monitora:prototipo-parecer"] = "1". A montagem (e os dados
  fictícios) só baixa ao abrir. Nada lê nem grava no banco.
*/

const MontagemDoPrototipo = lazy(() => import("./montar-parecer.tsx"));

export const CHAVE_DO_PROTOTIPO = "monitora:prototipo-parecer";

export function prototipoDoParecerLigado(): boolean {
  try {
    return (
      globalThis.localStorage?.getItem(CHAVE_DO_PROTOTIPO) === "1" ||
      new URLSearchParams(globalThis.location?.search ?? "").has(
        "prototipo-parecer",
      )
    );
  } catch {
    return false;
  }
}

export function SecaoMontarParecer({ recurso }: { recurso: RecursoDoPainel }) {
  const [aberto, setAberto] = useState(false);
  if (!prototipoDoParecerLigado()) return null;
  return (
    <Secao
      icone="fa-file-signature"
      titulo="Montar parecer"
      secao="montar-parecer"
    >
      <div className="ui-acoes">
        <button
          type="button"
          className="btn small"
          data-acao="montar-parecer"
          onClick={() => setAberto(true)}
        >
          <i className="fa-solid fa-file-signature" aria-hidden="true" /> Montar
          parecer
        </button>
        <Selo tom="pendente" titulo="Dados fictícios; nada é gravado">
          Protótipo
        </Selo>
      </div>
      {aberto ? (
        <Suspense fallback={null}>
          <MontagemDoPrototipo
            recursoId={recurso.id}
            aoFechar={() => setAberto(false)}
          />
        </Suspense>
      ) : null}
    </Secao>
  );
}

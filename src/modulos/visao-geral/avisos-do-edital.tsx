import type { ClienteDosAvisos } from "../conferencias/tipos.ts";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { criarEstadoDosAvisos } from "../conferencias/estado.ts";
import { ListaDeAvisos } from "../conferencias/avisos-de-conferencia.tsx";
import { avisosDoEdital } from "../../lib/visao-geral/avisos-do-edital.ts";
import { EstadoVazio } from "../../ui/index.ts";

/*
  Os avisos de conferência abertos do edital, na gaveta da Visão geral. Este
  arquivo (e a central de avisos que ele usa) chega por import() quando a
  gaveta abre: fica fora do pacote de entrada (orçamento de bundle). A lista
  é a da área, recortada pelo edital (src/lib/visao-geral/avisos-do-edital.ts);
  cada aviso tem os casos, o tratamento e o histórico, como na central. Quem
  administra (o administrador global) também vai à central inteira.
*/
export default function AvisosDoEdital({
  editalId,
  area,
  supabase,
  aoAbrirCentral,
}: {
  editalId: string;
  area: string;
  supabase: ClienteDosAvisos | null;
  /** Leva à central de avisos (só para quem a abre). */
  aoAbrirCentral?: (() => void) | null;
}) {
  const estado = useMemo(() => criarEstadoDosAvisos({ supabase }), [supabase]);
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  useEffect(() => {
    if (area) void estado.carregar({ area });
  }, [estado, area]);
  const lista = avisosDoEdital(atual.lista, editalId);
  const vazia =
    atual.status === "ready" &&
    lista &&
    !lista.abertos.length &&
    !lista.dispensados.length;
  return (
    <div className="visao-geral-avisos-do-edital" data-avisos-do-edital="">
      {vazia ? (
        <EstadoVazio>Nenhum aviso aberto neste edital.</EstadoVazio>
      ) : (
        <ListaDeAvisos estado={estado} lista={lista} mostrarModulo />
      )}
      {aoAbrirCentral ? (
        <button
          type="button"
          className="btn secondary small"
          data-acao="abrir-central-de-avisos"
          onClick={aoAbrirCentral}
        >
          <i className="fa-solid fa-list-check" aria-hidden="true" /> Abrir na
          central de avisos
        </button>
      ) : null}
    </div>
  );
}

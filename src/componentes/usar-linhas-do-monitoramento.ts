import type { SnapshotDoMonitoramento } from "./tipos-do-monitoramento.ts";
import { useEffect, useSyncExternalStore } from "react";
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
  pedirLinhasDoMonitoramento,
} from "./dados-do-monitoramento.ts";

/*
  Para o componente que usa as linhas do monitoramento fora das páginas que já
  as pedem (src/lib/telas-com-linhas.ts) — a busca global e o editor de
  Coordenações: enquanto ele está montado, a carga sabe que alguém precisa
  delas e as lê (uma vez; depois, só o Realtime). Devolve os dados do store.
*/
export function usarLinhasDoMonitoramento(): SnapshotDoMonitoramento {
  useEffect(() => pedirLinhasDoMonitoramento(), []);
  return useSyncExternalStore(
    assinarDadosDoMonitoramento,
    obterDadosDoMonitoramento,
  );
}

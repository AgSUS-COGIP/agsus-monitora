import { useMemo, useSyncExternalStore } from "react";
import {
  assinarDadosDoMonitoramento,
  idsDasLinhas,
  linhasDaArea,
  obterDadosDoMonitoramento,
} from "./dados-do-monitoramento.js";
import { nomeDaArea } from "../lib/menu-lateral.js";

/*
  A área atual e o recorte dela, para as telas de Editais, Cronograma e Lista
  de aprovados. `linhas` são os editais da área; `ids`, os ids deles — é por
  eles que o cronograma e as listas, que não trazem a área, são recortados.
*/
export function usarAreaAtual() {
  const { linhas, carregado, areaAtual } = useSyncExternalStore(
    assinarDadosDoMonitoramento,
    obterDadosDoMonitoramento,
  );
  const daArea = useMemo(
    () => linhasDaArea(linhas, areaAtual),
    [linhas, areaAtual],
  );
  const ids = useMemo(() => idsDasLinhas(daArea), [daArea]);
  return {
    area: areaAtual,
    nome: nomeDaArea(areaAtual),
    linhas: daArea,
    ids,
    carregado,
  };
}

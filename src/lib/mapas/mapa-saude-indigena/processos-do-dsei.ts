/*
  OS PROCESSOS SELETIVOS DE UM DSEI (o cartão do painel do DSEI na aba Mapa)

  Os mesmos números da Visão geral, com as mesmas contas
  (`indicadoresDoMonitoramento`), só das linhas do DSEI: a linha é do DSEI
  quando a chave da unidade (`chaveDoDsei`) é a do distrito. Assim o cartão e
  a Visão geral filtrada pelas unidades do DSEI dizem o mesmo.

  - Editais abertos: nem concluídos nem cancelados.
  - Aguardando chamada: soma do `cadastro_reserva` (aprovados da lista vigente
    ainda sem status) dos editais não cancelados que têm lista. Nenhum edital
    com lista é dado ausente (`null`, "—"), não zero.
  - `unidades`: os nomes das unidades das linhas, para a Visão geral abrir
    filtrada por elas (o filtro Unidade).
*/
import type { LinhaDoMonitoramento } from "../../../componentes/tipos-do-monitoramento.ts";
import type { Indicadores } from "../../../modulos/visao-geral/tipos.ts";
import { chaveDoDsei } from "./chaves.ts";
import {
  ehCancelado,
  ehEditalEncerrado,
  indicadoresDoMonitoramento,
  temNumero,
} from "../../visao-geral/indicadores-do-monitoramento.ts";

export interface ProcessosDoDsei {
  indicadores: Indicadores;
  editaisAbertos: number;
  aguardandoChamada: number | null;
  unidades: string[];
}

export function linhasDoDsei(
  linhas: readonly LinhaDoMonitoramento[] | null | undefined,
  dsei: string | null | undefined,
): LinhaDoMonitoramento[] {
  const chave = chaveDoDsei(dsei);
  if (!chave || !Array.isArray(linhas)) return [];
  return linhas.filter((linha) => chaveDoDsei(linha?.unidade) === chave);
}

export function processosDoDsei(
  linhas: readonly LinhaDoMonitoramento[] | null | undefined,
  dsei: string | null | undefined,
): ProcessosDoDsei {
  const doDsei = linhasDoDsei(linhas, dsei);
  let aguardando = 0;
  let comLista = 0;
  for (const linha of doDsei) {
    if (ehCancelado(linha) || !temNumero(linha.cadastro_reserva)) continue;
    comLista += 1;
    aguardando += Math.max(0, Number(linha.cadastro_reserva));
  }
  const unidades = [
    ...new Set(
      doDsei.map((linha) => String(linha.unidade ?? "").trim()).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    indicadores: indicadoresDoMonitoramento(doDsei),
    editaisAbertos: doDsei.filter((linha) => !ehEditalEncerrado(linha)).length,
    aguardandoChamada: comLista ? aguardando : null,
    unidades,
  };
}

/*
  A CONTAGEM DOS EDITAIS POR DSEI

  Editais, vagas, contratadas e ociosas por DSEI (chave de `chaveDoDsei`),
  pela regra dos indicadores da Visão geral (indicadores-do-monitoramento.ts):
  o edital cancelado conta como processo, mas as vagas dele não entram; ociosa
  é a vaga sem contratação de edital com resultado — a de edital ainda em
  seleção não é ociosa. Antes a bolha somava `vagas_ociosas` de todo edital
  (cancelado e em seleção também) e o mapa dizia mais ociosas que o KPI.

  Arquivo próprio, sem nada de desenho: o mapa (bolhas, "Territórios por
  vagas") e o cartão do mapa na Visão geral contam do mesmo jeito, e o cartão,
  que está no pacote de entrada, não puxa o resto do mapa.
*/
import type { LinhaDoMonitoramento } from "../../../componentes/tipos-do-monitoramento.ts";
import type { ContagemDoDsei } from "./tipos.ts";
import { chaveDoDsei } from "./chaves.ts";
import {
  contratadasImediatas,
  ehCancelado,
  temResultado,
  vagasEfetivas,
  vagasSemContratacao,
} from "../../visao-geral/indicadores-do-monitoramento.ts";

export const CONTAGEM_VAZIA: Readonly<ContagemDoDsei> = Object.freeze({
  editais: 0,
  vagas: 0,
  contratadas: 0,
  ociosas: 0,
});

export function contarPorDsei(
  linhas: readonly LinhaDoMonitoramento[],
): Map<string, ContagemDoDsei> {
  const contagens = new Map<string, ContagemDoDsei>();
  const lista: readonly LinhaDoMonitoramento[] = Array.isArray(linhas)
    ? linhas
    : [];
  for (const linha of lista) {
    const chave = chaveDoDsei(linha?.unidade);
    if (!chave) continue;
    const atual = contagens.get(chave) || { ...CONTAGEM_VAZIA };
    atual.editais += 1;
    if (!ehCancelado(linha)) {
      // A vaga reaberta em edital mais novo do DSEI conta só no novo.
      atual.vagas += vagasEfetivas(linha);
      atual.contratadas += contratadasImediatas(linha);
      if (temResultado(linha)) atual.ociosas += vagasSemContratacao(linha);
    }
    contagens.set(chave, atual);
  }
  return contagens;
}

/*
  A composição de um número da Visão geral (revisão de 17/11/2026; o "Ver a
  composição dos 56 contratados" do SIGEPSI: 51 regulares + 2 substituições
  + 3 temporários). Clicar no número abre as parcelas que o formam, quando os
  dados permitem; sem parcela que explique (um número só), nada.

  Cada composição é uma lista de passos: o primeiro é a base, os seguintes
  somam (+) ou tiram (−), e o último (=) é o número mostrado. As contas são
  as mesmas dos indicadores (indicadores-do-monitoramento.ts), para fechar.
*/
import {
  contratacoesAlemDasVagas,
  contratadasImediatas,
  ehCancelado,
  temNumero,
  temResultado,
  vagasEfetivas,
  vagasSemContratacao,
} from "./indicadores-do-monitoramento.ts";
import type { LinhaDoMonitoramento } from "../../modulos/visao-geral/tipos.ts";

export type Operacao = "" | "+" | "−" | "=";
export type PassoDaComposicao = {
  rotulo: string;
  valor: number;
  operacao: Operacao;
};
export type Composicao = readonly PassoDaComposicao[];

type Linha = LinhaDoMonitoramento;

const num = (valor: unknown) => {
  const n = Number(valor || 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
const passo = (
  operacao: Operacao,
  rotulo: string,
  valor: number,
): PassoDaComposicao => ({ operacao, rotulo, valor });

/* Contratados = dentro das vagas imediatas + além delas. */
function contratadosEmPartes(dentro: number, alem: number, total: string) {
  return [
    passo("", "Dentro das vagas imediatas", dentro),
    passo("+", "Além das vagas imediatas", alem),
    passo("=", total, dentro + alem),
  ];
}

/* Vagas = publicadas − reabertas em edital mais novo. */
function vagasEmPartes(publicadas: number, reabertas: number, total: string) {
  return [
    passo("", "Publicadas no edital", publicadas),
    passo("−", "Reabertas em edital mais novo", reabertas),
    passo("=", total, publicadas - reabertas),
  ];
}

export type CampoComComposicao =
  "vagas_total" | "contratados" | "vagas_ociosas" | "aprovados";

/** A composição de um número da linha do edital, ou `null`. */
export function composicaoDaLinha(
  linha: Linha | null | undefined,
  campo: CampoComComposicao,
): Composicao | null {
  if (!linha) return null;
  const reabertas = num(linha.vagas_total) - vagasEfetivas(linha);
  switch (campo) {
    case "vagas_total":
      return reabertas > 0
        ? vagasEmPartes(num(linha.vagas_total), reabertas, "Vagas que contam")
        : null;
    case "contratados": {
      const alem = contratacoesAlemDasVagas(linha);
      return alem > 0
        ? contratadosEmPartes(
            contratadasImediatas(linha),
            alem,
            "Contratados no total",
          )
        : null;
    }
    case "vagas_ociosas": {
      const contratadas = contratadasImediatas(linha);
      if (!(contratadas > 0 || reabertas > 0)) return null;
      return [
        passo("", "Vagas publicadas", num(linha.vagas_total)),
        ...(reabertas > 0
          ? [passo("−", "Reabertas em edital mais novo", reabertas)]
          : []),
        passo("−", "Contratadas dentro das vagas", contratadas),
        passo("=", "Sem contratação", vagasSemContratacao(linha)),
      ];
    }
    case "aprovados": {
      if (!temNumero(linha.aprovados) || !temNumero(linha.cadastro_reserva))
        return null;
      const aprovados = num(linha.aprovados);
      const aguardando = Math.min(aprovados, num(linha.cadastro_reserva));
      if (!aprovados) return null;
      return [
        passo("", "Já chamados (com status)", aprovados - aguardando),
        passo("+", "Aguardando chamada (sem status)", aguardando),
        passo("=", "Aprovados na lista vigente", aprovados),
      ];
    }
    default:
      return null;
  }
}

export type IndicadorComComposicao =
  "vagas" | "contratadas" | "emSelecao" | "ociosas" | "alemDasVagas";

/**
 * A composição de um indicador da faixa, das linhas do recorte (as mesmas
 * dos indicadores): `null` quando não há parcela que explique.
 */
export function composicaoDoIndicador(
  linhas: readonly Linha[] | null | undefined,
  chave: IndicadorComComposicao,
): Composicao | null {
  const validas = (Array.isArray(linhas) ? linhas : []).filter(
    (linha) => !ehCancelado(linha),
  );
  let publicadas = 0;
  let efetivas = 0;
  let dentro = 0;
  let alem = 0;
  // Vagas que contam e vagas sem contratação, por editais com e sem resultado.
  const com = { vagas: 0, sem: 0 };
  const sem = { vagas: 0, sem: 0 };
  for (const linha of validas) {
    publicadas += num(linha.vagas_total);
    efetivas += vagasEfetivas(linha);
    dentro += contratadasImediatas(linha);
    alem += contratacoesAlemDasVagas(linha);
    const parte = temResultado(linha) ? com : sem;
    parte.vagas += vagasEfetivas(linha);
    parte.sem += vagasSemContratacao(linha);
  }
  if (!validas.length) return null;
  switch (chave) {
    case "vagas":
      return [
        passo("", "Contratadas", efetivas - com.sem - sem.sem),
        passo("+", "Em seleção", sem.sem),
        passo("+", "Ociosas", com.sem),
        passo("=", "Vagas imediatas", efetivas),
        ...(publicadas > efetivas
          ? [
              passo("", "Publicadas nos editais", publicadas),
              passo(
                "−",
                "Reabertas em edital mais novo",
                publicadas - efetivas,
              ),
              passo("=", "Vagas imediatas", efetivas),
            ]
          : []),
      ];
    case "contratadas":
    case "alemDasVagas":
      return alem > 0
        ? contratadosEmPartes(dentro, alem, "Contratados no total")
        : null;
    case "emSelecao":
    case "ociosas": {
      // A conta da faixa: vagas que contam − contratadas dentro delas.
      const grupo = chave === "ociosas" ? com : sem;
      if (!grupo.vagas) return null;
      return [
        passo(
          "",
          chave === "ociosas"
            ? "Vagas dos editais com resultado"
            : "Vagas dos editais sem resultado",
          grupo.vagas,
        ),
        passo("−", "Contratadas nesses editais", grupo.vagas - grupo.sem),
        passo("=", chave === "ociosas" ? "Ociosas" : "Em seleção", grupo.sem),
      ];
    }
    default:
      return null;
  }
}

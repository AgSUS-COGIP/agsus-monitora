/*
  As frases de exemplo de cada marco do catálogo (Configurações ›
  Comemorações): o que o "Testar" mostra no aviso e o que o campo
  "Mensagem" sugere. Saem das mesmas funções que montam a frase de verdade,
  com dados de exemplo, para o teste mostrar o que a pessoa vai ler.
*/

import { mensagemDaComemoracao } from "../acessos/acesso-liberado.ts";
import {
  mensagemDaFilaZerada,
  mensagemDaVagaPronta,
  mensagemDoEditalConcluido,
  mensagemDoMarcoDoAno,
} from "./comemoracao.ts";
import { mensagemDeQuemFechou } from "../encerramento-do-edital/encerramento-do-edital.ts";

const AREA = "Saúde Indígena";
const EDITAL = "114/2026";

const EXEMPLOS: Readonly<Record<string, () => string>> = {
  "edital-concluido": () =>
    mensagemDoEditalConcluido({
      edital: EDITAL,
      unidade: "Rio de Janeiro",
      total: 1512,
    }),
  "edital-fechado": () => mensagemDeQuemFechou(EDITAL),
  "fila-zerada": () => mensagemDaFilaZerada("SEDE"),
  "vaga-pronta": () =>
    mensagemDaVagaPronta({ vaga: "179698", cargo: "Químico" }),
  "marco-do-ano": () =>
    mensagemDoMarcoDoAno({
      nomeDaArea: AREA,
      marco: 7500,
      ano: new Date().getFullYear(),
    }),
  "acesso-liberado": () => mensagemDaComemoracao("liberado", "Ana Souza"),
};

/** A frase de exemplo do marco do catálogo; sem exemplo, o próprio rótulo. */
export function exemploDoMarco(id: string, rotulo: string): string {
  return EXEMPLOS[id]?.() ?? rotulo;
}

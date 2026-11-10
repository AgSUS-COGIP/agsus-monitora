/*
  As frases de exemplo de cada marco do catálogo (Configurações ›
  Comemorações): o que o "Testar" mostra no aviso e o que o campo
  "Mensagem" sugere. Saem das mesmas funções que montam a frase de verdade,
  com dados de exemplo, para o teste mostrar o que a pessoa vai ler.
*/

import { mensagemDaComemoracao } from "./acesso-liberado.ts";
import {
  agradecimentoDoMarco,
  letreiroDoMarcoDoAno,
  mensagemDaFilaZerada,
  mensagemDaVagaPronta,
  mensagemDoEditalConcluido,
  mensagemDoFimDoTour,
} from "./comemoracao.ts";
import { tituloDeQuemFechou } from "./encerramento-do-edital.ts";
import { TEXTO_DA_META_BATIDA } from "./ritmo-da-analise.ts";

const AREA = "Saúde Indígena";
const EDITAL = "12/2026";
const MARCO = 1000;

export interface ExemploDoMarco {
  texto: string;
  /** O letreiro do exemplo, quando o marco calcula o seu (marco do ano). */
  letreiro?: string;
}

const EXEMPLOS: Readonly<Record<string, () => ExemploDoMarco>> = {
  "edital-concluido": () => ({
    texto: mensagemDoEditalConcluido({ edital: EDITAL, unidade: "DSEI Xingu" }),
  }),
  "edital-fechado": () => ({
    texto: `Você ${tituloDeQuemFechou(EDITAL)}! A última ficha do edital foi sua.`,
  }),
  "fila-zerada": () => ({ texto: mensagemDaFilaZerada(AREA) }),
  "meta-do-dia": () => ({ texto: TEXTO_DA_META_BATIDA }),
  "vaga-pronta": () => ({
    texto: mensagemDaVagaPronta({ vaga: "V10", cargo: "Enfermeiro" }),
  }),
  "marco-do-ano": () => ({
    texto: agradecimentoDoMarco({
      nomeDaArea: AREA,
      marco: MARCO,
      ano: new Date().getFullYear(),
    }),
    letreiro: letreiroDoMarcoDoAno(MARCO),
  }),
  "acesso-liberado": () => ({
    texto: mensagemDaComemoracao("liberado", "Ana Souza"),
  }),
  "fim-do-tour": () => ({
    texto: mensagemDoFimDoTour({ trilha: false, nome: "Editais" }),
  }),
  "fim-da-trilha": () => ({
    texto: mensagemDoFimDoTour({ trilha: true, nome: "Primeiros passos" }),
  }),
};

/** O exemplo do marco do catálogo; sem exemplo, o próprio rótulo. */
export function exemploDoMarco(id: string, rotulo: string): ExemploDoMarco {
  return EXEMPLOS[id]?.() ?? { texto: rotulo };
}

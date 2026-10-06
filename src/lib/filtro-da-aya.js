/*
  O botão "Abrir" de uma resposta com número da Aya leva à tela já
  recortada: o pedido (`{ edital: "93/2026", metrica: "pendente" }`, de
  src/lib/intencoes-da-aya.js) vira os filtros que cada tela já tem. Sem DOM:
  a tela passa as opções dos filtros dela e recebe os filtros novos.

  O edital casa pelo número ("93/2026" ou só "93"); a métrica, pelo filtro
  que o indicador da tela aplica quando é clicado. O que não casa fica como
  estava (a tela abre sem aquele recorte, nunca com um recorte errado).
*/
import { mesmoEdital } from "./intencoes-da-aya.js";

const valorDe = (opcao) =>
  typeof opcao === "string" ? opcao : String(opcao?.valor ?? "");
const rotuloDe = (opcao) =>
  typeof opcao === "string"
    ? opcao
    : String(opcao?.rotulo ?? opcao?.valor ?? "");

/** Os valores das opções cujo rótulo é o edital pedido. */
export function opcoesDoEdital(opcoes, edital) {
  if (!edital) return [];
  return (opcoes || [])
    .filter((opcao) => mesmoEdital(rotuloDe(opcao), edital))
    .map(valorDe);
}

/* O filtro que o indicador clicado aplica em cada tela. */
const METRICA_DE_RECURSOS = Object.freeze({
  aguardandoParecer: ["situacao", "EM_ANALISE_JURIDICA"],
  atrasados: ["pendencia", "prazo_vencido"],
  deferidos: ["situacao", "deferidos"],
  indeferidos: ["situacao", "INDEFERIDO"],
});
const METRICA_DE_ENTREVISTAS = Object.freeze({
  aptos: ["parecer", "APTO"],
  inaptos: ["parecer", "INAPTO"],
  compareceram: ["comparecimento", "S"],
});

/** Recursos: um edital (pelo id) e o filtro do indicador. */
export function filtrosDeRecursos(atuais, pedido, opcoes) {
  const proximos = { ...atuais };
  const [edital] = opcoesDoEdital(opcoes?.editais, pedido?.edital);
  if (edital) proximos.edital = edital;
  const metrica = METRICA_DE_RECURSOS[pedido?.metrica];
  if (metrica) proximos[metrica[0]] = metrica[1];
  return proximos;
}

/** Entrevistas (Resultados): um edital e o parecer ou comparecimento. */
export function filtrosDeEntrevistas(atuais, pedido, opcoes) {
  const proximos = { ...atuais };
  const [edital] = opcoesDoEdital(opcoes?.editais, pedido?.edital);
  if (edital) proximos.edital = edital;
  const metrica = METRICA_DE_ENTREVISTAS[pedido?.metrica];
  if (metrica) proximos[metrica[0]] = metrica[1];
  return proximos;
}

/** Seleção: os editais (escolha múltipla) com o número pedido. */
export function filtrosDaSelecao(atuais, pedido, opcoes) {
  const editais = opcoesDoEdital(opcoes?.editais, pedido?.edital);
  return editais.length ? { ...atuais, editais } : { ...atuais };
}

/* Análises: o indicador clicado (`kpi` da tela) para cada métrica da Aya. */
const KPI_DAS_ANALISES = Object.freeze({
  pendente: "pendente",
  revisar: "revisar",
  aprovado: "aprovado",
  reprovado: "reprovado",
  analisado: "analisado",
});

/**
 * Análises: os editais (escolha múltipla, pelo valor da linha), o KPI e a
 * busca (o caso de um aviso de conferência busca pelo nome do candidato).
 * Devolve `{ filtros, kpi }`; o KPI fica como estava se a métrica não tem um.
 */
export function filtrosDasAnalises(atuais, pedido, linhas, kpiAtual = "") {
  const editais = [
    ...new Set(
      (linhas || [])
        .map((linha) => String(linha?.edital ?? "").trim())
        .filter(Boolean),
    ),
  ];
  const escolhidos = opcoesDoEdital(editais, pedido?.edital);
  const filtros = escolhidos.length
    ? { ...atuais, edital: escolhidos }
    : { ...atuais };
  const busca = String(pedido?.busca ?? "").trim();
  if (busca) filtros.busca = busca;
  return {
    filtros,
    kpi: KPI_DAS_ANALISES[pedido?.metrica] ?? kpiAtual,
  };
}

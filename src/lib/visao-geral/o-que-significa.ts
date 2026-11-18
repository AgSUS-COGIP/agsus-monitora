/*
  O ⓘ "O que significa" de cada indicador da Visão geral (revisão de
  17/11/2026): a pergunta que vai para a Aya, igual a uma das "perguntas" do
  verbete do indicador em docs/aya/regras-da-visao-geral.md (o teste confere).
  A explicação mora na Aya; a tela só tem o botão.
*/
export const PERGUNTA_DO_INDICADOR = Object.freeze({
  vagas: "o que significa vagas imediatas na visao geral",
  contratadas: "o que significa contratadas na visao geral",
  emSelecao: "o que significa em selecao na visao geral",
  ociosas: "o que significa ociosas na visao geral",
  alemDasVagas:
    "o que significa contratacoes alem das vagas imediatas na visao geral",
  inscritos: "o que significa inscritos na visao geral",
} as const);

export type IndicadorComSignificado = keyof typeof PERGUNTA_DO_INDICADOR;

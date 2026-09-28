/*
  Data de análise no futuro.

  A data vem digitada na planilha; um 29 no lugar de 28 vira uma análise
  "feita amanhã". O painel trata isso como dado a corrigir (pendência
  prioritária e ponto vermelho no gráfico), não como análise válida.
  Compara só a data do calendário, no fuso de quem abre o painel.
*/
export function dataDeAnaliseNoFuturo(data, agora = new Date()) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return false;
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  return dia > hoje;
}

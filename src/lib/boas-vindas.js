/*
  Mensagem de boas-vindas da Visão geral: saudação pelo primeiro nome e uma
  informação do dia tirada dos próprios editais — nada de frase genérica.

  Funções puras; o componente fica em `src/modulos/visao-geral/boas-vindas.jsx`.
*/

const texto = (valor) => String(valor ?? "").trim();

export function saudacao(hora) {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** "YASSURY SOUSA" → "Yassury"; "maria de fátima" → "Maria". */
export function primeiroNome(nome) {
  const primeiro = texto(nome).split(/\s+/)[0] || "";
  if (!primeiro) return "";
  const minusculo = primeiro.toLocaleLowerCase("pt-BR");
  return minusculo.charAt(0).toLocaleUpperCase("pt-BR") + minusculo.slice(1);
}

/** Data local no formato AAAA-MM-DD (a do banco, sem fuso). */
export function chaveDoDia(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Editais cuja próxima etapa cai de hoje até daqui a `dias` dias. */
export function editaisComEtapaNaSemana(linhas, hoje = new Date(), dias = 7) {
  const inicio = chaveDoDia(hoje);
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + dias);
  const fim = chaveDoDia(limite);
  return (Array.isArray(linhas) ? linhas : []).filter((linha) => {
    const data = texto(linha?.cronograma_proxima_data).slice(0, 10);
    return data && data >= inicio && data <= fim;
  }).length;
}

export function resumoDoDia(quantidade) {
  if (!quantidade) return "Nenhum edital com etapa nos próximos 7 dias.";
  if (quantidade === 1) return "1 edital tem etapa nos próximos 7 dias.";
  return `${quantidade.toLocaleString("pt-BR")} editais têm etapa nos próximos 7 dias.`;
}

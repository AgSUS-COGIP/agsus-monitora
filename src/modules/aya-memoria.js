/*
  Memória de conversa da Aya.

  O PROBLEMA

  O histórico vivia só em memória do objeto. Recarregar a página, trocar de
  seção ou fechar o painel apagava tudo, e a pessoa recomeçava a conversa do
  zero — inclusive depois de já ter nomeado o distrito sobre o qual estava
  perguntando.

  ONDE GUARDAR, E POR QUE AQUI

  `sessionStorage`, não `localStorage`. A conversa carrega contexto de trabalho
  de um órgão público — territórios, editais, indicadores. Em máquina
  compartilhada, `localStorage` deixaria isso disponível para o próximo turno
  por tempo indeterminado. `sessionStorage` morre quando a aba fecha, que é o
  limite defensável: resolve o recarregamento sem virar arquivo permanente.

  O QUE NÃO FAZEMOS

  Não há resumo automático das conversas antigas. Resumir exigiria chamar o
  modelo, e o modelo local já demonstrou inventar número ao redigir — um resumo
  errado contaminaria todos os turnos seguintes, sem ninguém perceber. Cortar
  pelas mais recentes é pior em capacidade e melhor em confiabilidade.
*/

const CHAVE = "agsus_aya_conversa_v1";
const MAX_TURNOS = 40;
const MAX_CARACTERES = 4000;

function armazenamento(win) {
  try {
    return win?.sessionStorage || null;
  } catch {
    // Navegador com armazenamento bloqueado. A Aya continua funcionando, só
    // sem memória entre recarregamentos.
    return null;
  }
}

function turnoValido(item) {
  return (
    item &&
    ["user", "assistant"].includes(item.role) &&
    typeof item.content === "string" &&
    item.content.trim()
  );
}

/*
  Corta pelos mais antigos, por dois limites ao mesmo tempo. O de turnos evita
  uma lista sem fim; o de caracteres evita que poucas respostas longas encham
  tudo sozinhas.
*/
export function limitarConversa(historico) {
  const validos = (Array.isArray(historico) ? historico : []).filter(
    turnoValido,
  );
  const recentes = validos.slice(-MAX_TURNOS);

  let total = 0;
  const mantidos = [];
  for (let i = recentes.length - 1; i >= 0; i -= 1) {
    total += recentes[i].content.length;
    if (total > MAX_CARACTERES && mantidos.length) break;
    mantidos.unshift(recentes[i]);
  }
  return mantidos;
}

export function lerConversa(win = globalThis) {
  const loja = armazenamento(win);
  if (!loja) return [];
  try {
    const bruto = loja.getItem(CHAVE);
    if (!bruto) return [];
    return limitarConversa(JSON.parse(bruto));
  } catch {
    // Conteúdo corrompido não pode derrubar o painel inteiro.
    return [];
  }
}

export function salvarConversa(historico, win = globalThis) {
  const loja = armazenamento(win);
  if (!loja) return false;
  try {
    loja.setItem(CHAVE, JSON.stringify(limitarConversa(historico)));
    return true;
  } catch {
    // Cota estourada ou modo privativo. Perder a memória é aceitável; quebrar
    // a conversa em andamento não é.
    return false;
  }
}

export function esquecerConversa(win = globalThis) {
  const loja = armazenamento(win);
  if (!loja) return;
  try {
    loja.removeItem(CHAVE);
  } catch {
    // Nada a fazer: o pedido de recomeçar já limpou a tela.
  }
}

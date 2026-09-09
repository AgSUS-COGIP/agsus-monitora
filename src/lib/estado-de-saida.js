/*
  Por que a sessão terminou — e quem tem o direito de dizer isso à pessoa.

  O problema que este módulo resolve: sair pelo botão mostrava, depois da
  confirmação, um alerta amarelo de "Sessão encerrada. Faça login novamente." —
  transformando uma saída normal em aparência de falha.

  A causa era um booleano com dono duplicado. `logout()` marcava
  `manualLogoutInProgress = true`, chamava `signOut()` e já aplicava o estado
  deslogado; o listener de `onAuthStateChange` recebia `SIGNED_OUT`, aplicava o
  estado deslogado **de novo** e — pior — zerava o booleano nesse primeiro
  evento. Qualquer `SIGNED_OUT` seguinte encontrava o valor já em `false` e era
  lido como expiração.

  Duas mudanças de modelo:

  1. **A causa é explícita**, não um sim/não: `manual`, `expired`, `revoked` ou
     `unknown`. Saída voluntária e sessão inválida são estados diferentes e
     merecem mensagens diferentes.

  2. **A causa dura até a transição terminar** — até um novo `SIGNED_IN`. Não é
     consumida no primeiro evento. Um segundo `SIGNED_OUT` depois de uma saída
     manual continua sendo a mesma saída manual, não uma expiração nova.

  Falha temporária de rede não passa por aqui: não produz `SIGNED_OUT`, e a
  classificação de erro vive em `lib/sessao.js`.
*/

export const SAIDA_MANUAL = "manual";
export const SAIDA_EXPIRADA = "expired";
export const SAIDA_REVOGADA = "revoked";
export const SAIDA_DESCONHECIDA = "unknown";

const CAUSAS = new Set([
  SAIDA_MANUAL,
  SAIDA_EXPIRADA,
  SAIDA_REVOGADA,
  SAIDA_DESCONHECIDA,
]);

const MENSAGENS = {
  // Saída voluntária é sucesso, não aviso. A pessoa acabou de confirmar que quer sair.
  [SAIDA_MANUAL]: "",
  [SAIDA_EXPIRADA]: "Sessão encerrada. Faça login novamente.",
  [SAIDA_REVOGADA]: "Seu acesso foi encerrado. Fale com a administração.",
  [SAIDA_DESCONHECIDA]: "Sessão encerrada. Faça login novamente.",
};

let causaAtual = SAIDA_DESCONHECIDA;
let saidaAplicada = false;

/** Declara por que a sessão vai terminar, antes de pedir o `signOut()`. */
export function declararSaida(causa) {
  causaAtual = CAUSAS.has(causa) ? causa : SAIDA_DESCONHECIDA;
}

export function causaDaSaida() {
  return causaAtual;
}

export function mensagemDaSaida(causa = causaAtual) {
  return MENSAGENS[CAUSAS.has(causa) ? causa : SAIDA_DESCONHECIDA];
}

/**
 * Marca que o estado deslogado já foi aplicado nesta transição.
 * @returns {boolean} `true` na primeira vez; `false` nas repetições.
 */
export function reivindicarSaida() {
  if (saidaAplicada) return false;
  saidaAplicada = true;
  return true;
}

export function saidaJaAplicada() {
  return saidaAplicada;
}

/*
  Entrar encerra a transição: a partir daqui, um `SIGNED_OUT` é um evento novo e
  merece a sua própria causa. É o único ponto que devolve o estado ao início.
*/
export function encerrarTransicaoDeSaida() {
  causaAtual = SAIDA_DESCONHECIDA;
  saidaAplicada = false;
}

export function reiniciarEstadoDeSaidaParaTestes() {
  encerrarTransicaoDeSaida();
}

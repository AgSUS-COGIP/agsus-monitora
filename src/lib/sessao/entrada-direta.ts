/*
  Entrar direto com a conta Google já aberta no computador.

  Este navegador lembra só o e-mail da última conta que entrou no Yeendé
  (`localStorage`, chave própria). Na próxima entrada ele vai ao Google como
  `login_hint`: com essa conta aberta, o Google devolve sem tela de escolha.
  O e-mail não vai para URL do Yeendé, log nem telemetria; sai do navegador
  só no pedido de login (Supabase → Google).

  A entrada automática (sem clique) acontece uma vez por aba (marca em
  `sessionStorage`) e nunca depois de um "Sair" voluntário: aí a próxima
  entrada é pelo botão, que já leva o e-mail como sugestão. "Usar outra conta"
  esquece o e-mail e pede a escolha de conta (`prompt=select_account`).

  Sem `prompt=consent`: no Google ele só serve para obter o refresh token do
  provedor (`provider_refresh_token`), que o Yeendé não usa; a sessão do
  Supabase se renova com o token dela.
*/

/** O armazenamento do navegador, no que esta regra usa. */
export type ArmazenamentoDaEntrada = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

/** `localStorage`: a última conta que entrou neste navegador. */
export const CHAVE_DA_ULTIMA_CONTA = "yeende_ultima_conta_v1";
/** `sessionStorage`: esta aba já tentou entrar sozinha. */
export const CHAVE_DA_ENTRADA_AUTOMATICA = "yeende_entrada_automatica_v1";

/** A última conta lembrada; `saiu` = a pessoa clicou em Sair depois. */
export type UltimaConta = { email: string; saiu: boolean };

const FORMA_DE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** O e-mail em minúsculas, ou "" se não tiver forma de e-mail. */
export function normalizarEmail(valor: unknown): string {
  const email = String(valor ?? "")
    .trim()
    .toLowerCase();
  return email.length <= 254 && FORMA_DE_EMAIL.test(email) ? email : "";
}

/** A conta lembrada neste navegador (ou `null`: nenhuma, ou ilegível). */
export function lerUltimaConta(
  armazenamento: ArmazenamentoDaEntrada | null | undefined,
): UltimaConta | null {
  try {
    const bruto = armazenamento?.getItem(CHAVE_DA_ULTIMA_CONTA);
    if (!bruto) return null;
    const lido: unknown = JSON.parse(bruto);
    if (!lido || typeof lido !== "object") return null;
    const { email, saiu } = lido as Record<string, unknown>;
    const normalizado = normalizarEmail(email);
    return normalizado ? { email: normalizado, saiu: saiu === true } : null;
  } catch {
    return null;
  }
}

function gravar(
  armazenamento: ArmazenamentoDaEntrada | null | undefined,
  conta: UltimaConta,
) {
  try {
    armazenamento?.setItem(CHAVE_DA_ULTIMA_CONTA, JSON.stringify(conta));
  } catch {
    /* Armazenamento bloqueado: entra pelo botão, como antes. */
  }
}

/** Entrou: lembra o e-mail (e a entrada automática volta a valer). */
export function lembrarConta(
  armazenamento: ArmazenamentoDaEntrada | null | undefined,
  email: unknown,
): void {
  const normalizado = normalizarEmail(email);
  if (normalizado) gravar(armazenamento, { email: normalizado, saiu: false });
}

/** "Sair" voluntário: o e-mail fica como sugestão, sem entrada automática. */
export function marcarSaidaVoluntaria(
  armazenamento: ArmazenamentoDaEntrada | null | undefined,
): void {
  const conta = lerUltimaConta(armazenamento);
  if (conta) gravar(armazenamento, { ...conta, saiu: true });
}

/** "Usar outra conta": esquece o e-mail lembrado. */
export function esquecerConta(
  armazenamento: ArmazenamentoDaEntrada | null | undefined,
): void {
  try {
    armazenamento?.removeItem(CHAVE_DA_ULTIMA_CONTA);
  } catch {
    /* Armazenamento bloqueado: não havia o que esquecer. */
  }
}

/**
 * Reserva a única tentativa automática desta aba. `true` só se ela ainda
 * não foi feita e a marca ficou gravada: sem `sessionStorage` (bloqueado) não
 * há como saber se já tentou, e a resposta é `false` (nunca um laço).
 */
export function reservarEntradaAutomatica(
  armazenamentoDaAba: ArmazenamentoDaEntrada | null | undefined,
): boolean {
  try {
    if (!armazenamentoDaAba) return false;
    if (armazenamentoDaAba.getItem(CHAVE_DA_ENTRADA_AUTOMATICA)) return false;
    armazenamentoDaAba.setItem(CHAVE_DA_ENTRADA_AUTOMATICA, "1");
    return armazenamentoDaAba.getItem(CHAVE_DA_ENTRADA_AUTOMATICA) === "1";
  } catch {
    return false;
  }
}

/** O que decide se a tela de entrada entra sozinha ao abrir. */
export type SituacaoDaEntrada = {
  conta: UltimaConta | null;
  /** Login Google ligado nas configurações. */
  googleAtivo: boolean;
  /** Algo já está na tela (erro no retorno, sessão incompleta, recuperação…). */
  temMensagem: boolean;
};

/**
 * Entra sozinha? Só com conta lembrada, sem "Sair" depois dela, com o Google
 * ligado e sem nada a mostrar. A tentativa por aba é reservada à parte
 * (`reservarEntradaAutomatica`), depois desta resposta.
 */
export function deveEntrarSozinho({
  conta,
  googleAtivo,
  temMensagem,
}: SituacaoDaEntrada): boolean {
  return Boolean(conta?.email && !conta.saiu && googleAtivo && !temMensagem);
}

/** O domínio de um e-mail ("" sem domínio). */
function dominioDe(email: string): string {
  return email.split("@")[1] || "";
}

/**
 * Os parâmetros que vão ao Google (`queryParams` do `signInWithOAuth`).
 *
 * - `escolherConta`: `prompt=select_account` (o "Usar outra conta").
 * - com e-mail lembrado: `login_hint` (o Google pula a escolha de conta).
 * - `hd` (a dica de domínio das configurações) vai junto, menos quando
 *   contradiz o e-mail lembrado (conta de outro domínio permitido): aí o
 *   Google descartaria a sugestão.
 */
export function parametrosDoGoogle({
  dicaDeDominio = "",
  email = "",
  escolherConta = false,
}: {
  dicaDeDominio?: string;
  email?: string;
  escolherConta?: boolean;
}): Record<string, string> {
  const hd = String(dicaDeDominio || "").trim();
  const sugestao = escolherConta ? "" : normalizarEmail(email);
  const parametros: Record<string, string> = {};
  if (escolherConta) parametros.prompt = "select_account";
  if (sugestao) parametros.login_hint = sugestao;
  if (hd && (!sugestao || dominioDe(sugestao) === hd.toLowerCase()))
    parametros.hd = hd;
  return parametros;
}

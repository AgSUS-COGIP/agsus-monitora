/*
  A lista calculada pelo Python (Classificação em Python, etapa 2b; migration
  20261023200000), sem DOM e sem rede: a leitura das respostas das RPCs e a
  conferência do retrato do Python com o da tela.

  Com a chave "Gerar listas pelo Python" ligada, o "Gerar" pede o cálculo
  (pedir_calculo_classificacao), espera o job (obter_calculo_classificacao),
  recebe o retrato que o Python calculou e só registra a lista quando o retrato
  que a tela calcula com o motor.ts é IGUAL (diferencasDosRetratos = 0; o banco
  confere de novo em registrar_lista_calculada). Diferente, a tela avisa, não
  registra e grava só os caminhos das diferenças (nunca os valores:
  registrar_divergencia_do_calculo recusa caminho com valor). Desligada, a
  resposta é { ligada: false } e o "Gerar" segue como antes.
*/

/* De quanto em quanto tempo a tela relê o pedido e quanto espera o job. */
export const INTERVALO_DO_CALCULO_MS = 3000;
export const PRAZO_DO_CALCULO_MS = 5 * 60 * 1000;
/* Quantos caminhos de diferença vão ao banco (o banco aceita até 20). */
export const MAXIMO_DE_CAMINHOS = 20;

export type SituacaoDoPedido =
  | "PEDIDO"
  | "CALCULANDO"
  | "PRONTO"
  | "FALHOU"
  | "NAO_CONFERE"
  | "REGISTRADO"
  | "SEM_DISPARO"
  | "SUBSTITUIDO";
const SITUACOES: readonly SituacaoDoPedido[] = [
  "PEDIDO",
  "CALCULANDO",
  "PRONTO",
  "FALHOU",
  "NAO_CONFERE",
  "REGISTRADO",
  "SEM_DISPARO",
  "SUBSTITUIDO",
];

export interface PedidoDeCalculo {
  pedido: string;
  situacao: SituacaoDoPedido;
  mensagem: string;
}
export interface CalculoLido extends PedidoDeCalculo {
  retrato: Record<string, unknown> | null;
}

type Registro = Record<string, unknown>;
const registro = (valor: unknown): Registro | null =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Registro)
    : null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const situacao = (valor: unknown): SituacaoDoPedido | null =>
  SITUACOES.find((s) => s === valor) ?? null;

function pedidoDe(r: Registro): PedidoDeCalculo {
  const pedido = typeof r.pedido === "string" ? r.pedido : "";
  const s = situacao(r.situacao);
  if (!UUID.test(pedido) || !s)
    throw new Error("O banco respondeu o pedido de cálculo fora do formato.");
  return {
    pedido,
    situacao: s,
    mensagem: typeof r.mensagem === "string" ? r.mensagem.trim() : "",
  };
}

/**
 * A resposta de pedir_calculo_classificacao: o pedido, com a chave ligada; ou
 * `null` (chave desligada, resposta vazia): o "Gerar" segue com o cálculo da tela.
 */
export function respostaDoPedido(bruto: unknown): PedidoDeCalculo | null {
  const r = registro(bruto);
  if (!r || r.ligada !== true) return null;
  return pedidoDe(r);
}

/** A resposta de obter_calculo_classificacao (o retrato só quando pedido e pronto). */
export function calculoLido(bruto: unknown): CalculoLido {
  const r = registro(bruto);
  if (!r) throw new Error("O banco não devolveu o pedido de cálculo.");
  return { ...pedidoDe(r), retrato: registro(r.retrato) };
}

/** O job ainda não terminou este pedido. */
export const esperaOJob = (s: SituacaoDoPedido) =>
  s === "PEDIDO" || s === "CALCULANDO";

/* O que dizer quando o pedido parou sem retrato (a mensagem do banco vem antes). */
const TEXTO_DA_SITUACAO: Partial<Record<SituacaoDoPedido, string>> = {
  FALHOU: "O cálculo em Python falhou.",
  SEM_DISPARO: "O pedido do cálculo não chegou ao GitHub.",
  SUBSTITUIDO: "Outra geração desta lista começou depois desta.",
  NAO_CONFERE: "O cálculo em Python não conferiu com o da tela.",
  REGISTRADO: "Esta lista já foi registrada.",
};
export function textoDoPedidoParado(p: PedidoDeCalculo) {
  return p.mensagem || TEXTO_DA_SITUACAO[p.situacao] || "O cálculo parou.";
}

/* ── A conferência: o retrato do Python × o da tela ───────────────────── */

/* Caminho que pode ir ao banco: só nomes de campo e posições, sem valores. */
const CAMINHO_SEGURO = /^[A-Za-z0-9_.[\]-]{1,200}$/;
export const caminhoSeguro = (caminho: string) =>
  CAMINHO_SEGURO.test(caminho) && !/[0-9]{11}/.test(caminho);

/* A chave de um objeto no caminho: o que não for letra, dígito ou _ vira _. */
const parteDoCaminho = (chave: string) =>
  chave.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60) || "_";

/** O valor como fica num json (sem `undefined`; 3.0 e 3 são o mesmo número). */
const comoJson = (valor: unknown): unknown =>
  valor === undefined ? undefined : JSON.parse(JSON.stringify(valor));

/**
 * As diferenças entre o retrato da tela e o do Python (o mesmo critério do
 * banco: json a json, sem ordem de chave): o total e os primeiros caminhos,
 * no formato `vagas[0].geral[1].posicao`. Total 0 = é a mesma lista.
 */
export function diferencasDosRetratos(
  tela: unknown,
  python: unknown,
  maximo = MAXIMO_DE_CAMINHOS,
) {
  const caminhos: string[] = [];
  let total = 0;
  const anotar = (caminho: string) => {
    total += 1;
    const seguro = caminho || "retrato";
    if (caminhos.length < maximo && caminhoSeguro(seguro))
      caminhos.push(seguro);
  };
  const comparar = (a: unknown, b: unknown, caminho: string) => {
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i += 1)
        if (i >= a.length || i >= b.length) anotar(`${caminho}[${i}]`);
        else comparar(a[i], b[i], `${caminho}[${i}]`);
      return;
    }
    const ra = registro(a);
    const rb = registro(b);
    if (ra && rb) {
      const chaves = [...new Set([...Object.keys(ra), ...Object.keys(rb)])];
      for (const chave of chaves.sort()) {
        const aqui = caminho
          ? `${caminho}.${parteDoCaminho(chave)}`
          : parteDoCaminho(chave);
        if (!Object.hasOwn(ra, chave) || !Object.hasOwn(rb, chave))
          anotar(aqui);
        else comparar(ra[chave], rb[chave], aqui);
      }
      return;
    }
    if (a !== b) anotar(caminho);
  };
  comparar(comoJson(tela), comoJson(python), "");
  return { total, caminhos };
}

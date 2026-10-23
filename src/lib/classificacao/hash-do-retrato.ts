/*
  O HASH DO RETRATO de uma lista da Classificação (TB_LISTA_CLASSIFICACAO.
  "DS_HASH" e TB_PEDIDO_CALCULO_CLASSIFICACAO."DS_HASH"), na mesma conta do
  banco (private."FC_HASH_RETRATO_CLASSIFICACAO", 20261024130000).

  O hash depende só do CONTEÚDO do retrato, não da forma dos números: o Python
  grava a nota inteira como 35.0 e a tela como 35 — o mesmo valor, o mesmo
  hash. A forma canônica é o texto do jsonb do PostgreSQL (jsonb::text) com
  cada número sem os zeros à direita da vírgula (trim_scale: 35.0 → 35,
  7.50 → 7.5); o retrato gravado não muda (o do Python continua com 35.0).

  O texto do jsonb, igual ao do PostgreSQL:
    - objeto: {"chave": valor, ...}, as chaves em ordem de tamanho (bytes em
      UTF-8) e, no mesmo tamanho, de bytes; vazio {};
    - lista: [a, b, ...]; vazia [];
    - texto: entre aspas, com \" \\ \b \f \n \r \t e \u00xx (minúsculo) para os
      outros controles; o resto como está (acentos em UTF-8);
    - número: decimal, sem expoente nem zeros à direita (1e-7 → 0.0000001).
  O mesmo em Python: python/monitora/classificacao/hash_do_retrato.py; o teste
  cruzado (tests/fixtures/classificacao/hash-dos-retratos.json) cobra os dois.
*/
import { sha256Hex } from "./sorteio.ts";

type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [chave: string]: Json };

const ESCAPES: Readonly<Record<string, string>> = {
  '"': '\\"',
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
};

function textoDoJsonb(texto: string) {
  return `"${texto.replace(
    // eslint-disable-next-line no-control-regex
    /["\\\u0000-\u001f]/g,
    (c) => ESCAPES[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  )}"`;
}

/** Um número no texto do jsonb, sem expoente e sem zeros à direita. */
export function numeroCanonico(valor: number) {
  if (!Number.isFinite(valor)) throw new Error("Número inválido no retrato.");
  if (valor === 0) return "0";
  const [mantissa = "", expoente = "0"] = String(Math.abs(valor)).split("e");
  const [inteiro = "", fracao = ""] = mantissa.split(".");
  const digitos = inteiro + fracao;
  // Posição da vírgula a partir do começo dos dígitos.
  const virgula = inteiro.length + Number(expoente);
  let parteInteira: string;
  let parteFracao: string;
  if (virgula <= 0) {
    parteInteira = "0";
    parteFracao = "0".repeat(-virgula) + digitos;
  } else if (virgula >= digitos.length) {
    parteInteira = digitos + "0".repeat(virgula - digitos.length);
    parteFracao = "";
  } else {
    parteInteira = digitos.slice(0, virgula);
    parteFracao = digitos.slice(virgula);
  }
  parteInteira = parteInteira.replace(/^0+(?=\d)/, "");
  parteFracao = parteFracao.replace(/0+$/, "");
  return `${valor < 0 ? "-" : ""}${parteInteira}${parteFracao ? `.${parteFracao}` : ""}`;
}

const bytes = new TextEncoder();
function ordemDoJsonb(a: string, b: string) {
  const x = bytes.encode(a);
  const y = bytes.encode(b);
  if (x.length !== y.length) return x.length - y.length;
  for (let i = 0; i < x.length; i += 1)
    if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/** O texto canônico do retrato (jsonb::text com os números em trim_scale). */
export function textoCanonicoDoRetrato(valor: unknown): string {
  if (valor === null || valor === undefined) return "null";
  if (typeof valor === "boolean") return valor ? "true" : "false";
  if (typeof valor === "number") return numeroCanonico(valor);
  if (typeof valor === "string") return textoDoJsonb(valor);
  if (Array.isArray(valor))
    return `[${valor
      .map((v: unknown) =>
        // Como no JSON.stringify: o undefined da lista vira null.
        v === undefined || typeof v === "function"
          ? "null"
          : textoCanonicoDoRetrato(v),
      )
      .join(", ")}]`;
  if (typeof valor === "object") {
    const pares = Object.entries(valor as Record<string, unknown>)
      // Como no JSON.stringify: a chave undefined some.
      .filter(([, v]) => v !== undefined && typeof v !== "function")
      .sort(([a], [b]) => ordemDoJsonb(a, b));
    return `{${pares
      .map(([k, v]) => `${textoDoJsonb(k)}: ${textoCanonicoDoRetrato(v)}`)
      .join(", ")}}`;
  }
  throw new Error("Valor inválido no retrato.");
}

/** O hash (SHA-256 hex) do retrato, igual ao que o banco grava em DS_HASH. */
export function hashDoRetrato(retrato: Json | object) {
  return sha256Hex(textoCanonicoDoRetrato(retrato));
}

/*
  O nome das versões das regras (avaliação documental, classificação e roteiro
  de entrevista). Banco: supabase/migrations/20261008180000_nome_das_versoes_das_regras.sql
  (NO_VERSAO, 3 a 80 caracteres; nulo = sem nome).

  A tela mostra o nome em destaque e o número discreto ("Decisão CORES · v7");
  sem nome, "Versão 7". Ao salvar, o campo "Nome desta versão" vem com uma
  sugestão editável (sugerirNomeDaVersao); vazio grava sem nome.
*/

export const TAMANHO_MINIMO_DO_NOME = 3;
export const TAMANHO_MAXIMO_DO_NOME = 80;

export type VersaoComNome = {
  versao?: number | string | null;
  nome?: string | null;
};

const numeroDa = (versao: unknown): number | null => {
  const n = Number(versao);
  return versao === null ||
    versao === undefined ||
    versao === "" ||
    !Number.isFinite(n) ||
    n < 1
    ? null
    : n;
};

/** Sem espaço nas pontas e sem espaços seguidos (o banco normaliza igual). */
export function normalizarNomeDaVersao(texto: unknown): string {
  return typeof texto === "string" ? texto.replace(/\s+/g, " ").trim() : "";
}

/** "" quando o nome serve (vazio também serve: grava sem nome). */
export function erroDoNomeDaVersao(texto: unknown): string {
  const nome = normalizarNomeDaVersao(texto);
  if (!nome) return "";
  return nome.length < TAMANHO_MINIMO_DO_NOME ||
    nome.length > TAMANHO_MAXIMO_DO_NOME
    ? `De ${TAMANHO_MINIMO_DO_NOME} a ${TAMANHO_MAXIMO_DO_NOME} caracteres.`
    : "";
}

/** O que vai para o banco: o nome normalizado ou null (sem nome). */
export function nomeParaGravar(texto: unknown): string | null {
  return normalizarNomeDaVersao(texto) || null;
}

/**
 * As duas partes que a tela desenha: o nome (destaque) e o número (discreto).
 * Sem nome, o número vira o texto principal: "Versão 7".
 */
export function partesDaVersao(v: VersaoComNome | null | undefined): {
  nome: string | null;
  numero: string;
} {
  const n = numeroDa(v?.versao);
  const nome = normalizarNomeDaVersao(v?.nome) || null;
  if (nome) return { nome, numero: n ? `v${n}` : "" };
  return { nome: null, numero: n ? `Versão ${n}` : "" };
}

/** Em texto corrido (opções de <select>, avisos, documentos): "Decisão CORES · v7" ou "Versão 7". */
export function rotuloDaVersao(v: VersaoComNome | null | undefined): string {
  const { nome, numero } = partesDaVersao(v);
  if (!nome) return numero;
  return numero ? `${nome} · ${numero}` : nome;
}

/** O nome de uma versão pelo número, no histórico que a tela já tem. */
export function nomeDaVersaoNaLista(
  versoes: ReadonlyArray<VersaoComNome> | null | undefined,
  numero: unknown,
): string | null {
  const n = numeroDa(numero);
  if (!n || !Array.isArray(versoes)) return null;
  const achada = versoes.find((v) => numeroDa(v?.versao) === n);
  return normalizarNomeDaVersao(achada?.nome) || null;
}

/** rotuloDaVersao de uma versão que só se conhece pelo número (fila, listas, ficha). */
export function rotuloDaVersaoNaLista(
  versoes: ReadonlyArray<VersaoComNome> | null | undefined,
  numero: unknown,
): string {
  return rotuloDaVersao({
    versao: numeroDa(numero),
    nome: nomeDaVersaoNaLista(versoes, numero),
  });
}

const TAMANHO_DO_TRECHO = 40;

function cortarNaPalavra(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  const corte = texto.slice(0, limite + 1);
  const espaco = corte.lastIndexOf(" ");
  return (
    espaco > limite / 2 ? corte.slice(0, espaco) : texto.slice(0, limite)
  ).replace(/[\s,–-]+$/, "");
}

/**
 * O começo do motivo, para o nome: a primeira frase (até ".", ";", ":" ou
 * travessão), curta, com a inicial minúscula — menos sigla ("CORES decidiu").
 */
export function trechoDoMotivo(motivo: unknown): string {
  const texto = normalizarNomeDaVersao(motivo);
  if (!texto) return "";
  const frase = texto.split(/[.;:!?\n]|\s[–—-]\s/)[0]?.trim() ?? "";
  if (!frase) return "";
  const curto = cortarNaPalavra(frase, TAMANHO_DO_TRECHO);
  const primeira = curto.split(" ")[0] ?? "";
  const sigla =
    primeira.length > 1 && primeira === primeira.toLocaleUpperCase("pt-BR");
  return sigla
    ? curto
    : curto.charAt(0).toLocaleLowerCase("pt-BR") + curto.slice(1);
}

export type TipoDaRegra = "regra" | "classificacao" | "roteiro";

const BASES: Record<TipoDaRegra, { comEdital: string; semEdital: string }> = {
  regra: { comEdital: "Regra do edital", semEdital: "Regra da avaliação" },
  classificacao: {
    comEdital: "Classificação do edital",
    semEdital: "Regra de classificação",
  },
  roteiro: { comEdital: "Roteiro do edital", semEdital: "Roteiro" },
};

const dataBr = (data: Date) =>
  data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * A sugestão do campo "Nome desta versão": o edital e o começo do motivo
 * ("Regra do edital 93/2026 – decisão CORES"); o roteiro, sem motivo, leva o
 * nome dele e a data. Sempre de 3 a 80 caracteres (ou "" sem o que sugerir).
 */
export function sugerirNomeDaVersao({
  tipo,
  edital,
  motivo,
  roteiro,
  data,
}: {
  tipo: TipoDaRegra;
  /** Número do edital ("93/2026"). */
  edital?: string | null;
  motivo?: string | null;
  /** Nome do roteiro (só no roteiro de entrevista). */
  roteiro?: string | null;
  data?: Date;
}): string {
  const numero = normalizarNomeDaVersao(edital);
  const nomeDoRoteiro = normalizarNomeDaVersao(roteiro);
  const base =
    tipo === "roteiro" && nomeDoRoteiro
      ? nomeDoRoteiro
      : numero
        ? `${BASES[tipo].comEdital} ${numero}`
        : BASES[tipo].semEdital;
  const trecho =
    trechoDoMotivo(motivo) || (tipo === "roteiro" && data ? dataBr(data) : "");
  const cabeca = cortarNaPalavra(base, TAMANHO_MAXIMO_DO_NOME);
  if (!trecho) return cabeca.length >= TAMANHO_MINIMO_DO_NOME ? cabeca : "";
  const sobra = TAMANHO_MAXIMO_DO_NOME - cabeca.length - 3;
  if (sobra < TAMANHO_MINIMO_DO_NOME) return cabeca;
  return `${cabeca} – ${cortarNaPalavra(trecho, sobra)}`;
}

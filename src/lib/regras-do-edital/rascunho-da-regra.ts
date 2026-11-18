/*
  Rascunho guardado de uma regra (da avaliação documental ou de
  classificação), sem DOM e sem estado: o formato que vai ao banco
  (TB_RASCUNHO_REGRA, migration 20261013120000) e à cópia deste computador,
  qual dos dois vale ao abrir, o aviso de recuperação e o texto do indicador.
  O estado (gravação, temporizador, cópia local) é src/app/rascunho-da-regra.ts.
*/

export type TipoDeRegra = "ANALISE" | "CLASSIFICACAO";

/** O rascunho como a tela o guarda: o conteúdo é da tela (a regra e o que mais ela precise). */
export type RascunhoGuardado = {
  conteudo: Record<string, unknown>;
  /** Versão vigente da regra quando o rascunho começou (0 = sem regra). */
  versaoBase: number;
  /** ISO da última gravação. */
  atualizadoEm: string;
  /** true: só neste computador (o banco ainda não confirmou). */
  local: boolean;
};

/**
 * Como o indicador do assistente está. guardado: o banco confirmou; local: sem conexão, ficou neste computador;
 * neste-computador: o banco recusou (ex.: RPC ainda não publicada), ficou
 * neste computador; falhou: nem o banco nem este computador guardaram.
 */
export type GravacaoDoRascunho =
  "ocioso" | "guardando" | "guardado" | "local" | "neste-computador" | "falhou";

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const ehDataValida = (v: unknown): v is string =>
  typeof v === "string" && !Number.isNaN(Date.parse(v));

/** A resposta de obter_rascunho_regra (null = sem rascunho ou formato estranho). */
export function rascunhoDoBanco(dados: unknown): RascunhoGuardado | null {
  if (!ehObjeto(dados) || !ehObjeto(dados.conteudo)) return null;
  const versao = Number(dados.versao_base);
  if (!Number.isInteger(versao) || versao < 0) return null;
  if (!ehDataValida(dados.atualizado_em)) return null;
  return {
    conteudo: dados.conteudo,
    versaoBase: versao,
    atualizadoEm: new Date(dados.atualizado_em).toISOString(),
    local: false,
  };
}

/** Chave da cópia deste computador: por tipo, edital e pessoa. */
export function chaveDoRascunhoLocal(
  tipo: TipoDeRegra,
  editalId: string,
  usuario: string,
): string {
  return `monitora:rascunho-regra:${tipo}:${editalId}:${usuario}`;
}

export function rascunhoParaLocal(rascunho: RascunhoGuardado): string {
  return JSON.stringify({
    conteudo: rascunho.conteudo,
    versao_base: rascunho.versaoBase,
    atualizado_em: rascunho.atualizadoEm,
    local: rascunho.local,
  });
}

/** A cópia deste computador (null = sem cópia ou texto estragado). */
export function rascunhoDoLocal(texto: string | null): RascunhoGuardado | null {
  if (!texto) return null;
  try {
    const dados: unknown = JSON.parse(texto);
    const r = rascunhoDoBanco(dados);
    if (!r || !ehObjeto(dados)) return null;
    return { ...r, local: dados.local !== false };
  } catch {
    return null;
  }
}

/**
 * Qual rascunho vale ao abrir: a cópia deste computador que o banco ainda não
 * confirmou ganha quando é mais nova (ficou sem conexão); senão, a do banco.
 */
export function escolherRascunho(
  doBanco: RascunhoGuardado | null,
  doLocal: RascunhoGuardado | null,
): RascunhoGuardado | null {
  const local = doLocal?.local ? doLocal : null;
  if (!doBanco) return local;
  if (!local) return doBanco;
  return Date.parse(local.atualizadoEm) > Date.parse(doBanco.atualizadoEm)
    ? local
    : doBanco;
}

/** O que o aviso de recuperação diz: quando foi guardado e se a vigente mudou. */
export function recuperacaoDoRascunho(
  rascunho: RascunhoGuardado,
  versaoVigente: number,
): { quando: string; versaoBase: number; versaoMudou: boolean } {
  return {
    quando: dataEHoraCurtas(rascunho.atualizadoEm),
    versaoBase: rascunho.versaoBase,
    versaoMudou: rascunho.versaoBase !== versaoVigente,
  };
}

/** "13/10 14:05" (hora local). */
export function dataEHoraCurtas(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${horaCurta(iso)}`;
}

/** "14:05" (hora local). */
export function horaCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** O texto discreto do indicador ("" = nada a mostrar). */
export function textoDaGravacao(
  gravacao: GravacaoDoRascunho,
  guardadoEm: string | null,
): string {
  if (gravacao === "guardando") return "Guardando…";
  if (gravacao === "local") return "Sem conexão — guardado neste computador";
  if (gravacao === "neste-computador") return "Guardado neste computador";
  if (gravacao === "falhou") return "Não foi possível guardar o rascunho";
  if (gravacao === "guardado" && guardadoEm)
    return `Rascunho guardado às ${horaCurta(guardadoEm)}`;
  return "";
}

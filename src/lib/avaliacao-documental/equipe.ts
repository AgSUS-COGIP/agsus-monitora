/*
  A equipe da avaliação documental de um edital (RL_ANALISTA_EDITAL): quem
  analisa, quem revisa e quem coordena, no edital todo ou numa vaga. Sem DOM e
  sem estado.

  O gestor do edital (grupo edital_gestor que vê o edital) já é coordenação,
  sem linha na tabela; o banco o devolve em `gestores` e não aceita linha para
  ele. O banco confere a permissão de cada pessoa (Editor em
  avaliacao_documental para analisar ou revisar, Administrador para
  coordenar) em salvar_equipe_edital.
*/
import { PAPEIS_DA_EQUIPE } from "./catalogo.ts";

export type PapelDaEquipe = "ANALISTA" | "REVISOR" | "COORDENADOR";

/** A linha como a tela a edita (campos de formulário, ainda sem conferir). */
export interface EntradaDaEquipe {
  usuario?: unknown;
  papel?: unknown;
  vaga?: unknown;
  limite?: unknown;
}

/** A linha no formato de salvar_equipe_edital. */
export interface LinhaDaEquipe {
  usuario: string;
  papel: string;
  vaga: string | null;
  limite: number | null;
}

/** O gestor do edital (já coordena, sem linha na tabela). */
export interface GestorDoEdital {
  usuario: string;
}

export type ResumoDaEquipe = Record<PapelDaEquipe, number>;

const PAPEIS = new Set(PAPEIS_DA_EQUIPE.map(([v]) => v));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const VAGA = /^[0-9]{1,20}$/;

const texto = (v: unknown): string => String(v ?? "").trim();

/** A linha da tela no formato que salvar_equipe_edital recebe. */
export function linhaDaEquipe(
  linha: EntradaDaEquipe | null | undefined,
): LinhaDaEquipe {
  const vaga = texto(linha?.vaga);
  const limite = texto(linha?.limite);
  return {
    usuario: texto(linha?.usuario),
    papel: texto(linha?.papel).toUpperCase(),
    vaga: vaga || null,
    limite: limite === "" ? null : Number(limite),
  };
}

/**
 * Confere a equipe antes de enviar (o banco confere de novo, com as
 * permissões). Devolve a lista de erros (vazia = pode salvar).
 */
export function validarEquipe(
  linhas: ReadonlyArray<EntradaDaEquipe> | null | undefined,
  { gestores = [] }: { gestores?: ReadonlyArray<GestorDoEdital> } = {},
): string[] {
  const erros: string[] = [];
  const vistos = new Set<string>();
  const ehGestor = new Set(gestores.map((g) => g.usuario));
  (Array.isArray(linhas) ? linhas : []).forEach((bruta, i) => {
    const l = linhaDaEquipe(bruta);
    const onde = `Linha ${i + 1}`;
    if (!UUID.test(l.usuario)) erros.push(`${onde}: escolha a pessoa.`);
    if (!PAPEIS.has(l.papel)) erros.push(`${onde}: escolha o papel.`);
    if (l.vaga !== null && !VAGA.test(l.vaga))
      erros.push(`${onde}: código da vaga só com dígitos.`);
    if (
      l.limite !== null &&
      (!Number.isInteger(l.limite) || l.limite < 1 || l.limite > 5000)
    )
      erros.push(`${onde}: limite de fichas de 1 a 5.000.`);
    if (l.papel === "COORDENADOR" && l.vaga !== null)
      erros.push(`${onde}: a coordenação é do edital todo, sem vaga.`);
    if (l.papel === "COORDENADOR" && ehGestor.has(l.usuario))
      erros.push(`${onde}: o gestor do edital já coordena.`);
    const chave = `${l.usuario}|${l.papel}|${l.vaga ?? ""}`;
    if (vistos.has(chave)) erros.push(`${onde}: repetida.`);
    vistos.add(chave);
  });
  return erros;
}

/** Quantas pessoas por papel (gestores contam como coordenação). */
export function resumoDaEquipe(
  linhas: ReadonlyArray<EntradaDaEquipe> | null | undefined,
  gestores: ReadonlyArray<GestorDoEdital> = [],
): ResumoDaEquipe {
  const resumo: ResumoDaEquipe = { ANALISTA: 0, REVISOR: 0, COORDENADOR: 0 };
  // Indexado pelo papel da linha (texto livre): papel desconhecido dá undefined.
  const porPapel: Record<PapelDaEquipe, Set<string>> &
    Partial<Record<string, Set<string>>> = {
    ANALISTA: new Set(),
    REVISOR: new Set(),
    COORDENADOR: new Set(),
  };
  for (const g of gestores) porPapel.COORDENADOR.add(g.usuario);
  for (const bruta of Array.isArray(linhas) ? linhas : []) {
    const l = linhaDaEquipe(bruta);
    if (porPapel[l.papel] && l.usuario) porPapel[l.papel]!.add(l.usuario);
  }
  for (const papel of Object.keys(resumo) as PapelDaEquipe[])
    resumo[papel] = porPapel[papel].size;
  return resumo;
}

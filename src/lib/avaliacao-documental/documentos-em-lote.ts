/*
  DOCUMENTOS EM LOTE (Avaliação documental › Documentos): as listas
  pesquisáveis de quem pode receber um documento, sem DOM e sem banco.

  - Espelhos das avaliações concluídas: as fichas CONCLUIDA da fila
    (obter_fila_avaliacao, o núcleo já carregado na tela).
  - Comunicados de eliminação antes da análise (Triagem): os
    ELIMINADO da triagem gravada, marcados nas listas em páginas
    (listar_pre_classificacao) e conferidos antes de emitir só pelas chaves
    marcadas (conferir_eliminados_pre_classificacao).

  A busca acha pelo código OU pelo nome (sem acento, sem caixa); a chave de
  cada pessoa é vaga + código, porque o mesmo código pode estar em duas vagas.
*/
import type { Espelho } from "./espelho-de-nota.ts";
import { espelhoDaEliminacaoPreAnalise } from "./espelho-da-pre-classificacao.ts";

export type PessoaDoDocumento = {
  /** "vaga|código": única no edital. */
  chave: string;
  codigo: string;
  nome: string;
  vaga: string;
  /** O que a lista mostra ao lado (motivo da eliminação ou resultado da ficha). */
  detalhe: string;
};

const texto = (v: unknown) => String(v ?? "").trim();

export const chaveDaPessoa = (vaga: unknown, codigo: unknown) =>
  `${texto(vaga)}|${texto(codigo)}`;

/** Sem acento e sem caixa, para comparar nomes. */
export function normalizar(valor: unknown): string {
  return texto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const porVagaENome = (a: PessoaDoDocumento, b: PessoaDoDocumento) =>
  a.vaga.localeCompare(b.vaga, "pt-BR", { numeric: true }) ||
  a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) ||
  a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true });

const ROTULO_DO_RESULTADO: Readonly<Record<string, string>> = Object.freeze({
  APTO: "Apto",
  INAPTO_NOTA: "Inapto pela nota",
  INAPTO_REQUISITO: "Inapto por requisito",
});

type InscritoDaFila = {
  vaga?: string | number | null;
  codigo?: string | number | null;
  nome?: string | null;
  ficha?: { situacao?: string | null; resultado?: string | null } | null;
};

/** As fichas concluídas da fila, por vaga e nome. */
export function concluidosDaFila(
  candidatos: ReadonlyArray<InscritoDaFila> | null | undefined,
): PessoaDoDocumento[] {
  return (candidatos || [])
    .filter((c) => c.ficha?.situacao === "CONCLUIDA" && texto(c.codigo))
    .map((c) => ({
      chave: chaveDaPessoa(c.vaga, c.codigo),
      codigo: texto(c.codigo),
      nome: texto(c.nome),
      vaga: texto(c.vaga),
      detalhe:
        ROTULO_DO_RESULTADO[texto(c.ficha?.resultado)] ??
        texto(c.ficha?.resultado),
    }))
    .sort(porVagaENome);
}

type InscritoDaPre = {
  vaga?: string | number | null;
  codigo?: string | number | null;
  nome?: string | null;
  situacao?: string | null;
  motivo?: string | null;
};

/** Um eliminado da triagem como pessoa da lista (a linha da página ou da leitura inteira). */
export const pessoaEliminada = (c: InscritoDaPre): PessoaDoDocumento => ({
  chave: chaveDaPessoa(c.vaga, c.codigo),
  codigo: texto(c.codigo),
  nome: texto(c.nome),
  vaga: texto(c.vaga),
  detalhe: texto(c.motivo) || "Sem justificativa registrada",
});

/** As pessoas por vaga e nome (a ordem das listas). */
export const ordenarPessoas = (
  pessoas: Iterable<PessoaDoDocumento>,
): PessoaDoDocumento[] => [...pessoas].sort(porVagaENome);

/** Os eliminados antes da análise documental, por vaga e nome. */
export function eliminadosDaPre(
  candidatos: ReadonlyArray<InscritoDaPre> | null | undefined,
): PessoaDoDocumento[] {
  return ordenarPessoas(
    (candidatos || [])
      .filter((c) => c.situacao === "ELIMINADO" && texto(c.codigo))
      .map(pessoaEliminada),
  );
}

/**
 * As pessoas que batem com a busca (código exato no começo, ou qualquer
 * parte do nome, sem acento) e com a vaga ("" = todas).
 */
export function filtrarPessoas(
  pessoas: ReadonlyArray<PessoaDoDocumento>,
  busca: string,
  vaga = "",
): PessoaDoDocumento[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  return pessoas.filter((p) => {
    if (vaga && p.vaga !== vaga) return false;
    if (!termos.length) return true;
    const nome = normalizar(p.nome);
    const codigo = normalizar(p.codigo);
    return termos.every((t) => codigo.startsWith(t) || nome.includes(t));
  });
}

/** As pessoas marcadas, na ordem da lista. */
export function marcadas(
  pessoas: ReadonlyArray<PessoaDoDocumento>,
  selecao: ReadonlySet<string>,
): PessoaDoDocumento[] {
  return pessoas.filter((p) => selecao.has(p.chave));
}

type EliminadoParaComunicado = {
  vaga: string;
  codigo: string;
  nome: string;
  situacao: string;
  motivo: string | null;
  motivo_codigo?: string | null;
  modalidade?: string | null;
  art?: number | null;
  declarada?: number | null;
  nota?: number | null;
  origem_nota?: string | null;
};

/**
 * Os comunicados de eliminação das pessoas marcadas, a partir da
 * triagem LIDA AGORA (quem deixou de estar eliminado fica de fora).
 * Sem justificativa registrada não há comunicado: o código volta em
 * `semMotivo`, para verificar antes de emitir.
 */
export function comunicadosDosEliminados(
  candidatos: ReadonlyArray<EliminadoParaComunicado>,
  vagas: ReadonlyArray<{ codigo: unknown; cargo?: unknown }>,
  escolhidas: ReadonlyArray<PessoaDoDocumento>,
  { edital, unidade = "" }: { edital: string; unidade?: string },
): { documentos: Espelho[]; semMotivo: string[]; foraDaSituacao: string[] } {
  const porChave = new Map(
    candidatos.map((c) => [chaveDaPessoa(c.vaga, c.codigo), c]),
  );
  const cargos = new Map(
    vagas.map((v) => [texto(v.codigo), texto(v.cargo) || null]),
  );
  const documentos: Espelho[] = [];
  const semMotivo: string[] = [];
  const foraDaSituacao: string[] = [];
  for (const p of escolhidas) {
    const c = porChave.get(p.chave);
    if (!c || c.situacao !== "ELIMINADO") {
      foraDaSituacao.push(p.codigo);
      continue;
    }
    if (!texto(c.motivo)) {
      semMotivo.push(c.codigo);
      continue;
    }
    documentos.push(
      espelhoDaEliminacaoPreAnalise({
        codigo: c.codigo,
        nome: c.nome,
        vaga: c.vaga,
        cargo: cargos.get(texto(c.vaga)) ?? null,
        edital,
        unidade,
        modalidade: c.modalidade ?? null,
        situacao: c.situacao,
        motivo: c.motivo,
        motivo_codigo: c.motivo_codigo ?? null,
        art: c.art ?? null,
        declarada: c.declarada ?? null,
        nota: c.nota ?? null,
        origem_nota: c.origem_nota ?? null,
      }),
    );
  }
  return { documentos, semMotivo, foraDaSituacao };
}

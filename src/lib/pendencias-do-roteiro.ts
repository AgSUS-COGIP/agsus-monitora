/*
  O editor do roteiro de entrevista (src/modulos/entrevistas/roteiros.tsx) em
  seções recolhíveis e a lista do que falta perto do Salvar — como o
  assistente da regra da Avaliação documental. Sem React: as seções, a seção
  de cada erro de `errosDoRoteiro` (src/lib/roteiro-de-entrevista.ts) e a
  frase de cada erro com o lugar dele ("Competência 2 (Escuta): Nota
  máxima: maior que 0 e até 100.").
*/

export type IdDaSecao =
  | "identificacao"
  | "competencias"
  | "escala"
  | "aprovacao"
  | "resultado"
  | "banca";

export const SECOES_DO_ROTEIRO: readonly {
  id: IdDaSecao;
  titulo: string;
  icone: string;
}[] = Object.freeze([
  { id: "identificacao", titulo: "Identificação", icone: "fa-file-lines" },
  {
    id: "competencias",
    titulo: "Competências e aspectos",
    icone: "fa-list-check",
  },
  { id: "escala", titulo: "Escala e níveis", icone: "fa-sliders" },
  {
    id: "aprovacao",
    titulo: "Aprovação, eliminação e ausência",
    icone: "fa-user-check",
  },
  {
    id: "resultado",
    titulo: "Resultado e desempate",
    icone: "fa-ranking-star",
  },
  { id: "banca", titulo: "Banca padrão", icone: "fa-users" },
]);

export type PendenciaDoRoteiro = {
  chave: string;
  secao: IdDaSecao;
  texto: string;
};

type ComChave = { chave: string; nome?: string | null };
export type RascunhoParaPendencias = {
  competencias?: ComChave[] | null;
  aspectos?: ComChave[] | null;
  niveis?: ComChave[] | null;
  banca?: (ComChave & { origem?: string | null })[] | null;
};

const texto = (valor: unknown) => String(valor ?? "").trim();

/** A seção de cada campo com erro. */
export function secaoDoErro(chave: string): IdDaSecao {
  if (/^(nome|etapa|descricao)$/.test(chave)) return "identificacao";
  if (/^(competencia|competencias|aspecto|aspectos)\b/.test(chave))
    return "competencias";
  if (/^(escala|passo|notas_permitidas|niveis|nivel)\b/.test(chave))
    return "escala";
  if (/^(nota_minima_total|notas_eliminatorias|ausencia)/.test(chave))
    return "aprovacao";
  if (/^(desempate|soma_analise)/.test(chave)) return "resultado";
  if (/^banca\b/.test(chave)) return "banca";
  return "identificacao";
}

function lugar(
  lista: ComChave[] | null | undefined,
  chave: string,
  rotulo: string,
  nome?: (item: ComChave) => string,
): string {
  const itens = lista || [];
  const i = itens.findIndex((x) => x.chave === chave);
  if (i < 0) return rotulo;
  const item = itens[i] as ComChave;
  const quem = nome ? nome(item) : texto(item.nome);
  return `${rotulo} ${i + 1}${quem ? ` (${quem})` : ""}`;
}

/**
 * Os erros do rascunho ({ campo: mensagem }) em frases com o lugar, na ordem
 * das seções do editor.
 */
export function pendenciasDoRoteiro(
  erros: Record<string, string>,
  r: RascunhoParaPendencias,
): PendenciaDoRoteiro[] {
  const ordem = SECOES_DO_ROTEIRO.map((s) => s.id);
  return Object.entries(erros)
    .map(([chave, mensagem]): PendenciaDoRoteiro => {
      const secao = secaoDoErro(chave);
      const [tipo, id] = chave.split(".");
      let onde = "";
      if (tipo === "competencia" && id)
        onde = lugar(r.competencias, id, "Competência");
      else if (tipo === "aspecto" && id)
        onde = lugar(r.aspectos, id, "Aspecto");
      else if (tipo === "nivel" && id) onde = lugar(r.niveis, id, "Nível");
      else if (tipo === "banca" && id)
        onde = lugar(r.banca, id, "Origem", (b) =>
          texto((b as { origem?: string | null }).origem),
        );
      return { chave, secao, texto: onde ? `${onde}: ${mensagem}` : mensagem };
    })
    .sort((a, b) => ordem.indexOf(a.secao) - ordem.indexOf(b.secao));
}

/** Quantos erros em cada seção (o selo no título da seção). */
export function errosPorSecao(
  pendencias: PendenciaDoRoteiro[],
): Record<IdDaSecao, number> {
  const contagem = Object.fromEntries(
    SECOES_DO_ROTEIRO.map((s) => [s.id, 0]),
  ) as Record<IdDaSecao, number>;
  for (const p of pendencias) contagem[p.secao] += 1;
  return contagem;
}

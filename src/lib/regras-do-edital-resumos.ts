/*
  Os resumos só-leitura das Regras do edital (Avaliação documental e
  Classificação), separados de regras-do-edital.ts porque puxam o código das
  duas regras: as telas e a página os carregam por import(), fora do pacote
  de entrada.
*/
import {
  COMPONENTES_DA_NOTA,
  CRITERIO_POR_CODIGO,
  METODOS_DE_EMPATE_FINAL,
} from "./classificacao/catalogo.ts";
import { ACUMULOS, normalizarRegra } from "./classificacao/regra.ts";
import { resumoDaRegra } from "./avaliacao-documental/resumo-da-regra.ts";
import type { RegraAnalise } from "./avaliacao-documental/tipos-da-regra.ts";
import type { LinhaDoResumo } from "./regras-do-edital.ts";

/*
  Critérios de desempate que usam o que a Avaliação documental comprovou
  (pontuações, experiência, nota documental, critério étnico validado).
*/
const DA_AVALIACAO = new Set([
  "INDIGENA_COMPROVADO",
  "EXP_SAUDE_INDIGENA",
  "EXP_ATENCAO_BASICA",
  "EXP_PROFISSIONAL_TEMPO",
  "EXP_ALTA_COMPLEXIDADE",
  "EXP_SAUDE_DIGITAL",
  "NOTA_DOCUMENTAL",
  "PONTUACAO_ETNICA",
  "PONTUACAO_EXPERIENCIA",
  "PONTUACAO_FORMACAO",
  "PONTUACAO_CURSOS",
  "MAIOR_ESCOLARIDADE",
]);

/** O critério de desempate usa dado comprovado na Avaliação documental? */
export function desempateDaAvaliacao(codigo: string): boolean {
  return DA_AVALIACAO.has(String(codigo || "").toUpperCase());
}

const numero = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v).replace(".", ",");
const rotuloDe = (
  lista: ReadonlyArray<readonly [string, string]>,
  valor: string,
) => lista.find(([v]) => v === valor)?.[1] ?? valor;

/**
 * O resumo da regra da Classificação em linhas curtas: composição da nota,
 * notas mínimas, desempate (na ordem, marcando o que vem da Avaliação
 * documental), empate final e cotas. Sem regra: lista vazia.
 */
export function resumoDaRegraDaClassificacao(
  configuracao: unknown,
): LinhaDoResumo[] {
  if (!configuracao || typeof configuracao !== "object") return [];
  const r = normalizarRegra(configuracao);
  const linhas: LinhaDoResumo[] = [];
  const componentes = r.composicao.componentes.map((c) => {
    const nome = rotuloDe(COMPONENTES_DA_NOTA, c.codigo);
    return r.composicao.componentes.length > 1
      ? `${nome} (peso ${numero(c.peso)})`
      : nome;
  });
  linhas.push({
    rotulo: "Composição da nota",
    valor: `${componentes.join(" + ") || "—"}; ${r.composicao.casas} casas decimais`,
  });
  const minimos = [
    r.documental.nota_minima !== null
      ? `documental ${numero(r.documental.nota_minima)}`
      : "",
    r.entrevista.nota_minima !== null
      ? `entrevista ${numero(r.entrevista.nota_minima)}`
      : "",
  ].filter(Boolean);
  linhas.push({
    rotulo: "Notas mínimas",
    valor: minimos.length ? minimos.join("; ") : "sem nota mínima",
  });
  const desempate = r.desempate.map((d, i) => {
    const criterio = CRITERIO_POR_CODIGO[d.criterio];
    const nome = criterio?.rotuloCurto || criterio?.nome || d.criterio;
    return `${i + 1}º ${nome}${desempateDaAvaliacao(d.criterio) ? " (comprovado na Avaliação documental)" : ""}`;
  });
  linhas.push({
    rotulo: "Desempate",
    valor: desempate.length ? desempate.join("; ") : "sem critérios",
  });
  linhas.push({
    rotulo: "Empate depois dos critérios",
    valor: rotuloDe(METODOS_DE_EMPATE_FINAL, r.empate_final.metodo),
  });
  const cotas = r.modalidades
    .filter((m) => m.codigo !== "AC")
    .map((m) =>
      m.percentual !== null && m.percentual !== undefined
        ? `${m.codigo} ${numero(m.percentual)}%`
        : m.codigo,
    );
  linhas.push({
    rotulo: "Cotas",
    valor: cotas.length
      ? `${cotas.join(", ")}; ${rotuloDe(ACUMULOS as unknown as ReadonlyArray<readonly [string, string]>, r.cotas.acumulo).toLowerCase()}`
      : "só ampla concorrência",
  });
  return linhas;
}

/**
 * O resumo da regra da Avaliação documental em linhas curtas: documentos que
 * eliminam, o que pontua, como a experiência conta (e em que categorias, com
 * as que valem no desempate) e a nota mínima. Requisitos da inscrição, nota
 * declarada e lote ficam de fora: são da regra da Triagem.
 */
export function resumoDaRegraDaAvaliacao(
  regra: RegraAnalise | null | undefined,
  notaMinima?: number | null,
): LinhaDoResumo[] {
  if (!regra) return [];
  const blocos = regra.blocos ?? [];
  const linhas: LinhaDoResumo[] = [];
  const documentos = blocos.filter((b) => b.tipo === "DOCUMENTO");
  if (documentos.length)
    linhas.push({
      rotulo: "Documentos exigidos",
      valor: documentos.map((b) => b.titulo).join("; "),
    });
  const pontuam = blocos.filter((b) =>
    ["PONTUACAO", "TITULOS", "CURSOS", "VINCULOS"].includes(b.tipo),
  );
  if (pontuam.length)
    linhas.push({
      rotulo: "O que pontua",
      valor: pontuam
        .map((b) =>
          b.teto !== null && b.teto !== undefined
            ? `${b.titulo} (até ${numero(b.teto)})`
            : b.titulo,
        )
        .join("; "),
    });
  for (const b of blocos.filter((x) => x.tipo === "VINCULOS")) {
    const conta =
      resumoDaRegra({
        ...regra,
        blocos: [b],
        por_cargo: [],
      }).secoes.find((s) => s.titulo === "Quanto vale cada item")?.itens ?? [];
    const categorias = (b.categorias ?? []).map(
      (c) =>
        `${c.rotulo}${c.pontua === false ? " (não pontua)" : ""}${c.desempate !== null && c.desempate !== undefined ? " (vale no desempate)" : ""}`,
    );
    const minimo =
      Number(b.minimo_meses) > 0
        ? `mínimo de ${numero(b.minimo_meses)} meses${b.efeito_minimo === "SO_REGISTRO" ? " (só registra)" : " (abaixo, elimina)"}`
        : "";
    linhas.push({
      rotulo: b.titulo,
      valor: [
        conta.map((t) => t.replace(`${b.titulo}: `, "")).join(" "),
        categorias.length
          ? `Comprovada nas categorias: ${categorias.join(", ")}.`
          : "",
        minimo ? `${minimo.charAt(0).toUpperCase()}${minimo.slice(1)}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  linhas.push({
    rotulo: "Nota mínima",
    valor:
      notaMinima === null || notaMinima === undefined
        ? "sem nota mínima (regra da Classificação)"
        : `${numero(notaMinima)} pontos (regra da Classificação)`,
  });
  return linhas;
}

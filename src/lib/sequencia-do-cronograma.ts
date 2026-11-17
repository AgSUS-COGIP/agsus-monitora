import { normalizarTexto } from "./etapas-de-edital.ts";

/*
  A sequência entre etapas que dependem umas das outras (conferência de
  17/11/2026). Conferir só início ≤ fim de cada etapa deixava passar o 120/2026:
  o "Recurso das entrevistas" vai de 14/01 a 25/02/2027, depois do resultado
  final (21/01). Regras, por fase (avaliação documental/curricular, de títulos,
  de conhecimentos, entrevista):
    - o recurso não começa antes do resultado preliminar;
    - o recurso e a análise dos recursos terminam até o resultado final;
    - o resultado final não vem antes do preliminar.
  E nenhum recurso termina depois do resultado final do processo seletivo.
  Só avisos: a etapa pode ter nome fora do padrão, e quem decide é a equipe.
*/

export interface EtapaParaSequencia {
  atividade?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
}

type Fase =
  "documental" | "titulos" | "conhecimento" | "entrevista" | "processo";
type Papel = "preliminar" | "recurso" | "analise-recurso" | "final";

interface Marcada {
  numero: number;
  fase: Fase | null;
  papel: Papel;
  inicio: string;
  fim: string;
}

const ROTULO_DO_PAPEL: Record<Papel, string> = {
  preliminar: "resultado preliminar",
  recurso: "recurso",
  "analise-recurso": "análise dos recursos",
  final: "resultado final",
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}/;

/*
  A fase é a da primeira palavra-chave do texto: "Resultado final da Avaliação
  Curricular e convocação para a Entrevista" é da avaliação curricular, e
  "Avaliação Documental e de Títulos" é da documental. "Títulos" sozinho é a
  avaliação de títulos, fase própria em editais que a separam da documental.
*/
const PALAVRAS_DA_FASE: [RegExp, Fase][] = [
  [/entrevist/, "entrevista"],
  [/conhecimento/, "conhecimento"],
  [/documental|curricular/, "documental"],
  [/titulos/, "titulos"],
  [/processo seletivo/, "processo"],
];

function faseDa(texto: string): Fase | null {
  let melhor: { posicao: number; fase: Fase } | null = null;
  for (const [palavra, fase] of PALAVRAS_DA_FASE) {
    const posicao = texto.search(palavra);
    if (posicao >= 0 && (!melhor || posicao < melhor.posicao))
      melhor = { posicao, fase };
  }
  return melhor?.fase ?? null;
}

function papelDa(texto: string): Papel | null {
  if (/^resultado (preliminar|provisorio)/.test(texto)) return "preliminar";
  if (texto.includes("recurso"))
    return /^analise|resposta/.test(texto) ? "analise-recurso" : "recurso";
  if (/resultado (preliminar|provisorio)/.test(texto)) return "preliminar";
  if (texto.includes("resultado final")) return "final";
  return null;
}

/** Fase e papel de cada etapa com datas; as outras ficam de fora. */
export function marcarEtapas(etapas: readonly EtapaParaSequencia[]): Marcada[] {
  const marcadas: Marcada[] = [];
  etapas.forEach((etapa, indice) => {
    const texto = normalizarTexto(etapa.atividade);
    const papel = papelDa(texto);
    const inicio = String(etapa.data_inicio ?? "").slice(0, 10);
    const fim = String(etapa.data_fim ?? etapa.data_inicio ?? "").slice(0, 10);
    if (!papel || !DATA_ISO.test(inicio) || !DATA_ISO.test(fim)) return;
    marcadas.push({
      numero: indice + 1,
      fase: faseDa(texto),
      papel,
      inicio,
      fim,
    });
  });
  return marcadas;
}

const dataBr = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const nome = (etapa: Marcada) =>
  `etapa ${etapa.numero} (${ROTULO_DO_PAPEL[etapa.papel]})`;
/** "etapa 12 (resultado final, 21/01/2027)" */
const referencia = (etapa: Marcada, data: string) =>
  `etapa ${etapa.numero} (${ROTULO_DO_PAPEL[etapa.papel]}, ${dataBr(data)})`;

/** Os avisos de sequência, em frases curtas; vazio quando está tudo em ordem. */
export function avisosDeSequencia(
  etapas: readonly EtapaParaSequencia[],
): string[] {
  const marcadas = marcarEtapas(etapas);
  const avisos: string[] = [];
  const primeira = (fase: Fase | null, papel: Papel) =>
    marcadas.find((e) => e.fase === fase && e.papel === papel);
  const finalDoProcesso = primeira("processo", "final");

  for (const fase of [
    "documental",
    "titulos",
    "conhecimento",
    "entrevista",
  ] as const) {
    const preliminar = primeira(fase, "preliminar");
    const final = primeira(fase, "final");
    if (preliminar && final && final.inicio < preliminar.fim)
      avisos.push(
        `A ${nome(final)} vem em ${dataBr(final.inicio)}, antes da ${referencia(preliminar, preliminar.fim)}.`,
      );
    for (const etapa of marcadas) {
      if (etapa.fase !== fase) continue;
      if (etapa.papel !== "recurso" && etapa.papel !== "analise-recurso")
        continue;
      if (
        etapa.papel === "recurso" &&
        preliminar &&
        etapa.inicio < preliminar.inicio
      )
        avisos.push(
          `A ${nome(etapa)} começa em ${dataBr(etapa.inicio)}, antes da ${referencia(preliminar, preliminar.inicio)}.`,
        );
      const limite = final ?? finalDoProcesso;
      if (limite && etapa.fim > limite.inicio)
        avisos.push(
          `A ${nome(etapa)} termina em ${dataBr(etapa.fim)}, depois da ${referencia(limite, limite.inicio)}.`,
        );
      else if (final && finalDoProcesso && etapa.fim > finalDoProcesso.inicio)
        avisos.push(
          `A ${nome(etapa)} termina em ${dataBr(etapa.fim)}, depois da ${referencia(finalDoProcesso, finalDoProcesso.inicio)}.`,
        );
    }
  }
  return avisos;
}

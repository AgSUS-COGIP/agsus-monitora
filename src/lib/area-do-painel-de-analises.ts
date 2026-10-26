/*
  A área de Análises curriculares.

  Saúde Indígena, SEDE e Projetos usam a MESMA tela; o que muda é a área (a
  área atual do app). Código desconhecido vira a Saúde Indígena.

  Aqui só há regra pura: a área normalizada, os rótulos, as chaves de cache
  (áreas nunca se misturam no cache) e o que o detalhe e o CSV mostram de
  diferente fora da Saúde Indígena (a planilha de Projetos e a da SEDE não
  têm critério étnico nem experiência em saúde indígena/atenção básica; têm
  o tempo de experiência profissional).
*/
import { AREAS_DO_SISTEMA, nomeDaArea } from "./menu-lateral.ts";

export const AREA_PADRAO_DO_PAINEL = "saude-indigena";

export const AREAS_DO_PAINEL_DE_ANALISES: readonly string[] = Object.freeze(
  AREAS_DO_SISTEMA.map((area) => area.id),
);

const texto = (valor: unknown) => String(valor ?? "").trim();

/* Só um dos três códigos conhecidos; o resto vira a Saúde Indígena. */
export function normalizarAreaDoPainel(valor: unknown): string {
  const codigo = texto(valor).toLowerCase();
  return AREAS_DO_PAINEL_DE_ANALISES.includes(codigo)
    ? codigo
    : AREA_PADRAO_DO_PAINEL;
}

export function ehAreaSaudeIndigena(area: unknown): boolean {
  return normalizarAreaDoPainel(area) === AREA_PADRAO_DO_PAINEL;
}

export function rotuloDaAreaDoPainel(area: unknown): string {
  return nomeDaArea(normalizarAreaDoPainel(area));
}

/* Chave do cache em memória do transporte consolidado. */
export function chaveDoCacheDoPayload(area: unknown, escopo: unknown): string {
  return `${normalizarAreaDoPainel(area)}:${texto(escopo).toLowerCase()}`;
}

/* Parâmetros de área para as RPCs de Análises curriculares. */
export function parametroDeAreaDaRpc(area: unknown): { p_area: string } {
  return { p_area: normalizarAreaDoPainel(area) };
}

const plural = (quantidade: number, singular: string, varios: string) =>
  `${quantidade.toLocaleString("pt-BR")} ${quantidade === 1 ? singular : varios}`;

const inteiro = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || texto(valor) === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : null;
};

/*
  Tempo de experiência profissional da linha: anos, meses e dias quando a
  planilha trouxe as partes; senão o total (em dias); sem nada, "-".
*/
export function experienciaProfissionalDaLinha(
  linha: Readonly<Record<string, unknown>> | null | undefined,
): string {
  const anos = inteiro(linha?.experiencia_profissional_anos);
  const meses = inteiro(linha?.experiencia_profissional_meses);
  const dias = inteiro(linha?.experiencia_profissional_dias);
  if (anos !== null || meses !== null || dias !== null) {
    const partes = [
      anos ? plural(anos, "ano", "anos") : "",
      meses ? plural(meses, "mês", "meses") : "",
      dias ? plural(dias, "dia", "dias") : "",
    ].filter(Boolean);
    if (!partes.length) return "0 dias";
    if (partes.length === 1) return partes[0]!;
    return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
  }
  const total = inteiro(linha?.experiencia_profissional_total);
  return total === null ? "-" : plural(total, "dia", "dias");
}

/*
  Colunas a mais do CSV fora da Saúde Indígena: o tempo de experiência
  profissional e o município/UF da UBS móvel (lido do nome da vaga).
*/
export const COLUNAS_EXTRAS_DO_CSV = Object.freeze([
  "experiencia_profissional_anos",
  "experiencia_profissional_meses",
  "experiencia_profissional_dias",
  "experiencia_profissional_total",
  "municipio_uf",
]);

export function colunasDoCsvDeAnalises(
  colunasBase: readonly string[] | null | undefined,
  area: unknown,
): string[] {
  const base = Array.isArray(colunasBase) ? [...colunasBase] : [];
  return ehAreaSaudeIndigena(area) ? base : [...base, ...COLUNAS_EXTRAS_DO_CSV];
}

/* Nome do arquivo do CSV: o da Saúde Indígena fica como sempre foi. */
export function nomeDoCsvDeAnalises(area: unknown): string {
  const codigo = normalizarAreaDoPainel(area);
  return ehAreaSaudeIndigena(codigo)
    ? "agsus_analises_curriculares_v3.csv"
    : `agsus_analises_curriculares_${codigo}.csv`;
}

/*
  Mensagem da tabela quando a área não tem análise nenhuma. Só a SEDE tem
  texto próprio (a planilha dela ainda não envia); nas outras, `""` deixa a
  mensagem de sempre.
*/
export function mensagemDeAreaSemAnalises(area: unknown): string {
  return normalizarAreaDoPainel(area) === "sede"
    ? "Ainda não há análises da SEDE. Elas aparecem quando a planilha da SEDE começar a enviar."
    : "";
}

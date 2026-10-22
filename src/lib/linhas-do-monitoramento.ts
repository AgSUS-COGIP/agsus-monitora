import type {
  LinhaDoMonitoramento,
  UnidadeDoCatalogo,
} from "../componentes/tipos-do-monitoramento.ts";

const CAMPOS_TEXTUAIS = [
  "CO_AREA",
  "edital",
  "unidade",
  "etapa",
  "status",
  "uf",
  "risco",
  "ciclo",
  "responsavel",
  "observacoes",
] as const;

function registro(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

export function identificacaoDoMonitoramento(
  valor: unknown,
): string | number | undefined {
  if (typeof valor === "string" && valor.trim()) return valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  return undefined;
}

/** Valida os campos usados pelo menu e pela busca, mantendo colunas extras como unknown. */
export function normalizarLinhaDoMonitoramento(
  valor: unknown,
): LinhaDoMonitoramento | null {
  const dados = registro(valor);
  if (!dados) return null;
  const campos: { [campo in (typeof CAMPOS_TEXTUAIS)[number]]?: string } = {};
  for (const campo of CAMPOS_TEXTUAIS) {
    const valorDoCampo = dados[campo];
    if (valorDoCampo != null && typeof valorDoCampo !== "string") return null;
    campos[campo] = typeof valorDoCampo === "string" ? valorDoCampo : undefined;
  }
  if (dados.id != null && identificacaoDoMonitoramento(dados.id) === undefined)
    return null;
  return { ...dados, ...campos, id: identificacaoDoMonitoramento(dados.id) };
}

export function normalizarLinhasDoMonitoramento(
  valor: unknown,
): LinhaDoMonitoramento[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item: unknown) => {
    const linha = normalizarLinhaDoMonitoramento(item);
    return linha ? [linha] : [];
  });
}

export function normalizarUnidadesDoCatalogo(
  valor: unknown,
): UnidadeDoCatalogo[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item: unknown) => {
    const unidade = registro(item);
    return unidade ? [{ ...unidade }] : [];
  });
}

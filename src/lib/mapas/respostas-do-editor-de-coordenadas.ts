import type {
  AlteracaoDoPonto,
  CorrecaoDoEditor,
  PendenciaDoEditor,
} from "./tipos-do-editor-de-coordenadas.ts";

export function registroDoEditor(
  valor: unknown,
): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
const texto = (valor: unknown) =>
  typeof valor === "string" ? valor : undefined;
const coordenada = (valor: unknown) =>
  typeof valor === "number" && Number.isFinite(valor) ? valor : null;
function candidato(valor: unknown) {
  if (
    !registroDoEditor(valor) ||
    typeof valor.f !== "string" ||
    (typeof valor.lat !== "number" && typeof valor.lat !== "string") ||
    (typeof valor.lon !== "number" && typeof valor.lon !== "string")
  )
    return [];
  return [
    {
      f: valor.f,
      n: texto(valor.n),
      ti: texto(valor.ti),
      lat: valor.lat,
      lon: valor.lon,
    },
  ];
}
export function pendenciasDoEditor(valor: unknown): PendenciaDoEditor[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(registroDoEditor).map((item) => ({
    ...item,
    conferido: item.conferido === true,
    motivo: texto(item.motivo),
    candidatos: Array.isArray(item.candidatos)
      ? item.candidatos.flatMap(candidato)
      : [],
  }));
}
export function correcaoDoEditor(valor: unknown): CorrecaoDoEditor | null {
  if (!registroDoEditor(valor)) return null;
  if (valor.conferido != null && typeof valor.conferido !== "boolean")
    return null;
  if (valor.lugar !== undefined && typeof valor.lugar !== "string") return null;
  const resposta: CorrecaoDoEditor = { ...valor };
  if (typeof valor.conferido === "boolean" || valor.conferido === null)
    resposta.conferido = valor.conferido;
  if (typeof valor.lugar === "string") resposta.lugar = valor.lugar;
  for (const campo of ["latitude", "longitude"] as const) {
    const posicao = valor[campo];
    if (posicao === undefined) continue;
    if (
      posicao !== null &&
      typeof posicao !== "number" &&
      typeof posicao !== "string"
    )
      return null;
    if (typeof posicao === "number" && !Number.isFinite(posicao)) return null;
    resposta[campo] = posicao;
  }
  return resposta;
}
export function historicoDoEditor(valor: unknown): AlteracaoDoPonto[] {
  if (!Array.isArray(valor)) return [];
  // Não promover uma alteração antiga a "última" ao descartar a mais recente.
  if (
    valor.some(
      (item: unknown) =>
        !registroDoEditor(item) ||
        (typeof item.id !== "string" && typeof item.id !== "number") ||
        typeof item.acao !== "string" ||
        (item.desfeito != null && typeof item.desfeito !== "boolean"),
    )
  )
    return [];
  return valor.filter(registroDoEditor).flatMap((item) => {
    if (
      (typeof item.id !== "string" && typeof item.id !== "number") ||
      typeof item.acao !== "string"
    )
      return [];
    return [
      {
        id: item.id,
        acao: item.acao,
        desfeito: item.desfeito === true,
        latitude_anterior: coordenada(item.latitude_anterior),
        longitude_anterior: coordenada(item.longitude_anterior),
        latitude: coordenada(item.latitude),
        longitude: coordenada(item.longitude),
        por: texto(item.por),
        em: texto(item.em),
        motivo: texto(item.motivo),
      },
    ];
  });
}

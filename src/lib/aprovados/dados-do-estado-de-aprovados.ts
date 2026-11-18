import type {
  AnexoDoAprovado,
  CandidatoAprovado,
  ListaDeAprovados,
} from "./tipos-do-estado-de-aprovados.ts";
import { expandirCandidatosCompactos } from "./candidatos-aprovados-compactos.ts";

export function ehRegistroDosAprovados(
  valor: unknown,
): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}
export function registroDosAprovados(valor: unknown): Record<string, unknown> {
  return ehRegistroDosAprovados(valor) ? valor : {};
}
const identificador = (valor: unknown): valor is string =>
  typeof valor === "string" && Boolean(valor.trim());
const textoOpcional = (valor: unknown) =>
  valor === undefined || typeof valor === "string";
const textoNulo = (valor: unknown) =>
  valor == null || typeof valor === "string";
const booleanoOpcional = (valor: unknown) =>
  valor === undefined || typeof valor === "boolean";

function candidatoValido(c: unknown): c is CandidatoAprovado {
  if (!ehRegistroDosAprovados(c)) return false;
  return (
    identificador(c.candidato_id) &&
    typeof c.nome === "string" &&
    [c.edital_id, c.cargo, c.edital, c.unidade, c.lotacao].every(textoNulo) &&
    [c.modalidade, c.status, c.matricula, c.processo_sei].every(textoNulo) &&
    [c.lista_ativa, c.sub_judice].every(
      (v) => v == null || typeof v === "boolean",
    ) &&
    (c.codigo_vaga == null ||
      typeof c.codigo_vaga === "string" ||
      typeof c.codigo_vaga === "number") &&
    (c.classificacao == null ||
      typeof c.classificacao === "string" ||
      typeof c.classificacao === "number")
  );
}
function listaValida(l: unknown): l is ListaDeAprovados {
  return (
    ehRegistroDosAprovados(l) &&
    identificador(l.edital_id) &&
    textoOpcional(l.lista_id) &&
    booleanoOpcional(l.ativo) &&
    [l.origem, l.arquivo_nome, l.arquivo_path].every(textoNulo)
  );
}
function anexoValido(a: unknown): a is AnexoDoAprovado {
  return (
    ehRegistroDosAprovados(a) &&
    identificador(a.anexo_id) &&
    identificador(a.candidato_id) &&
    textoOpcional(a.arquivo_nome) &&
    textoNulo(a.incluido_em)
  );
}
function colecao<T>(
  valor: unknown,
  valido: (item: unknown) => item is T,
  nome: string,
): T[] {
  if (valor == null) return [];
  if (!Array.isArray(valor) || !valor.every(valido))
    throw new Error(
      `Dados de ${nome} inválidos. Atualize a lista e tente novamente.`,
    );
  return valor;
}
/** Uma linha inválida não pode apagar pessoas nem publicar uma lista parcial. */
export const candidatosDoEstado = (valor: unknown) =>
  colecao(valor, candidatoValido, "candidatos");
export const listasDoEstado = (valor: unknown) =>
  colecao(valor, listaValida, "listas");
export function candidatosDoPacote(valor: unknown) {
  const p = registroDosAprovados(valor);
  if (
    !Array.isArray(p.colunas) ||
    !p.colunas.every((c) => typeof c === "string") ||
    !Array.isArray(p.colunas_da_lista) ||
    !p.colunas_da_lista.every((c) => typeof c === "string") ||
    !Array.isArray(p.linhas) ||
    !p.linhas.every(Array.isArray) ||
    p.listas === null ||
    typeof p.listas !== "object"
  )
    throw new Error(
      "Pacote de candidatos inválido. Atualize a lista e tente novamente.",
    );
  return candidatosDoEstado(expandirCandidatosCompactos(valor));
}
export function anexosDoEstado(valor: unknown) {
  const mapa = new Map<string, AnexoDoAprovado[]>();
  for (const anexo of colecao(valor, anexoValido, "anexos")) {
    const grupo = mapa.get(anexo.candidato_id) ?? [];
    grupo.push(anexo);
    mapa.set(anexo.candidato_id, grupo);
  }
  return mapa;
}

export function convocacoesDoEstado(valor: unknown) {
  const mapa = new Map<
    string,
    { data: string; cartas: number; ultimaCarta: string }
  >();
  if (valor == null) return mapa;
  if (!Array.isArray(valor)) throw new Error("Dados de convocação inválidos.");
  for (const v of valor) {
    const linha = registroDosAprovados(v);
    if (!identificador(linha.candidato_id))
      throw new Error("Dados de convocação inválidos.");
    mapa.set(linha.candidato_id, {
      data: String(linha.data_convocacao ?? "").trim(),
      cartas: Number(linha.cartas) || 0,
      ultimaCarta: String(linha.ultima_carta ?? "").trim(),
    });
  }
  return mapa;
}

/** A confirmação precisa dar conta de todos os IDs distintos do pedido. */
export function resultadoDaMarcacao(valor: unknown, ids: readonly string[]) {
  const r = registroDosAprovados(valor);
  const pedidos = new Set(ids);
  if (
    typeof r.marcados !== "number" ||
    !Number.isSafeInteger(r.marcados) ||
    r.marcados < 0 ||
    !Array.isArray(r.ignorados)
  )
    return null;
  const vistos = new Set<string>();
  const ignorados: {
    candidato_id: string;
    nome: string | null;
    motivo: string;
  }[] = [];
  for (const v of r.ignorados) {
    const i = registroDosAprovados(v);
    if (
      !identificador(i.candidato_id) ||
      !pedidos.has(i.candidato_id) ||
      vistos.has(i.candidato_id) ||
      !textoNulo(i.nome) ||
      typeof i.motivo !== "string"
    )
      return null;
    vistos.add(i.candidato_id);
    ignorados.push({
      candidato_id: i.candidato_id,
      nome: typeof i.nome === "string" ? i.nome : null,
      motivo: i.motivo,
    });
  }
  return r.marcados + ignorados.length === pedidos.size
    ? { marcados: r.marcados, ignorados }
    : null;
}

import type { RegraNormalizada } from "./regra.ts";
export type NumeroEmEdicao = number | string | null;
type ParaEdicao<T> = T extends number
  ? NumeroEmEdicao
  : T extends readonly (infer U)[]
    ? ParaEdicao<U>[]
    : T extends object
      ? { [K in keyof T]: ParaEdicao<T[K]> }
      : T;
export type RegraEmEdicao = ParaEdicao<RegraNormalizada>;
export function alterarCampoDaRegra<K extends keyof RegraEmEdicao>(
  regra: RegraEmEdicao,
  campo: K,
  valor: RegraEmEdicao[K],
): RegraEmEdicao {
  return { ...regra, [campo]: valor };
}
export function alterarGrupoDaRegra<
  K extends
    | "etapas"
    | "documental"
    | "entrevista"
    | "composicao"
    | "empate_final"
    | "cotas"
    | "convocacao",
>(
  regra: RegraEmEdicao,
  grupo: K,
  campos: Partial<RegraEmEdicao[K]>,
): RegraEmEdicao {
  return { ...regra, [grupo]: { ...regra[grupo], ...campos } };
}
export function alterarListaDaRegra(
  regra: RegraEmEdicao,
  tipo: keyof RegraEmEdicao["listas"],
  campos: { empate: string },
): RegraEmEdicao {
  return {
    ...regra,
    listas: { ...regra.listas, [tipo]: { ...regra.listas[tipo], ...campos } },
  };
}
export const numeroOuNulo = (texto: string): NumeroEmEdicao => {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : texto;
};
export const lista = (texto: string) =>
  texto
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
export const textoDaLista = (valores: string[]) => valores.join(", ");
export const listaEmMaiusculas = (texto: string) => lista(texto.toUpperCase());
export const textoDoNumero = (valor: NumeroEmEdicao) =>
  valor == null ? "" : String(valor).replace(".", ",");
export const niveisPorCargo = (
  texto: string,
): { termo: string; nivel: string }[] =>
  texto.split(";").flatMap((par) => {
    const [termo, nivel] = par.split("=").map((t) => t.trim());
    return termo && nivel ? [{ termo, nivel }] : [];
  });
export const textoDosNiveisPorCargo = (
  niveis: { termo: string; nivel: string }[],
) => niveis.map((n) => `${n.termo}=${n.nivel}`).join("; ");

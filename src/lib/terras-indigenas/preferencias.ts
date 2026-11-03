import { FASES_DAS_TERRAS } from "./fases-e-estilos.ts";

/*
  O que a pessoa escolheu no mapa e fica guardado neste navegador: as terras
  ligadas ou desligadas e as fases que a legenda escondeu. Sem armazenamento
  (modo privado, bloqueado), o mapa continua a funcionar e a escolha vale só
  até recarregar.
*/
const STORAGE_KEY = "agsus_map_terras_indigenas_v1";
const STORAGE_KEY_FASES = "agsus_map_terras_fases_ocultas_v1";

export function readStoredVisibility(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value == null ? true : value !== "0";
  } catch {
    return true;
  }
}

export function storeVisibility(visible: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, visible ? "1" : "0");
  } catch {
    // O mapa continua funcional mesmo sem armazenamento local.
  }
}

/*
  As fases que a pessoa escondeu na legenda. Só se aceita o que a legenda
  oferece: um valor antigo ou estranho no armazenamento não pode esconder uma
  fase que o ecrã nem mostra como interruptor.
*/
export function lerFasesOcultas(bruto: string | null | undefined): Set<string> {
  const validas = new Set<unknown>(FASES_DAS_TERRAS.map((f) => f.fase));
  try {
    const lista: unknown = JSON.parse(bruto ?? "[]");
    return new Set(
      (Array.isArray(lista) ? (lista as unknown[]) : []).filter(
        (f): f is string => validas.has(f),
      ),
    );
  } catch {
    return new Set();
  }
}

export function readStoredFases(): Set<string> {
  try {
    return lerFasesOcultas(localStorage.getItem(STORAGE_KEY_FASES));
  } catch {
    return new Set();
  }
}

export function storeFases(ocultas: ReadonlySet<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_FASES, JSON.stringify([...ocultas]));
  } catch {
    // Idem: sem armazenamento, a escolha vale só até recarregar.
  }
}

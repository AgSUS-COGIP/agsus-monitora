/*
  A cópia do perfil para entrar sem rede (src/lib/sessao/sessao-sem-rede.ts explica a
  decisão), no formato de src/lib/carga/cache-de-payload.ts. À parte da regra da
  sessão: só a cópia (src/app/perfil-guardado.ts, baixada sob demanda) a usa.
*/

/** O perfil que a entrada leu do banco (`ContextoDoPerfil` de src/app/sessao.ts). */
export interface PerfilParaGuardar {
  perfil: unknown;
  painelIds: unknown;
  contextoCarregado: unknown;
}

const registro = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** A cópia do perfil para entrar sem rede (no armazenamento das cópias de payload). */
export const PERFIL_GUARDADO = Object.freeze({
  nome: "perfil para entrar sem rede",
  chave: () => "perfil",
  esquema: (payload: unknown) => registro(payload).formato,
  esquemas: Object.freeze([1]),
  valido: (payload: unknown) => {
    const p = registro(payload);
    const perfil = registro(p.perfil);
    return (
      p.formato === 1 &&
      Boolean(perfil.id) &&
      perfil.ativo !== false &&
      Array.isArray(p.painelIds)
    );
  },
});

/** O que vai para a cópia: o perfil, os painéis e o formato. */
export function perfilParaGuardar(contexto: PerfilParaGuardar) {
  return {
    formato: 1,
    perfil: contexto.perfil,
    painelIds: Array.isArray(contexto.painelIds) ? contexto.painelIds : [],
    contextoCarregado: contexto.contextoCarregado === true,
  };
}

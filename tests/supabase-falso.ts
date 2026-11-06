import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";

/*
  O `auth` de mentira das telas de Editais e do Cronograma: a sessão só
  precisa do token (`exigirSessao`); o resto da Session vai preenchido com
  valores neutros para caber no tipo do Supabase.
*/

/** Quem a tela registra em `onAuthStateChange`. */
export type OuvinteDaSessao = (
  evento: AuthChangeEvent,
  sessao: Session | null,
) => unknown;

/** O que as telas usam do `auth` do Supabase. */
export type AuthFalso = Pick<
  SupabaseClient["auth"],
  "getSession" | "onAuthStateChange"
>;

/** Uma sessão com o token dado (o resto, neutro). */
export function sessaoFalsa(token: string): Session {
  return {
    access_token: token,
    refresh_token: "",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "",
      app_metadata: {},
      user_metadata: {},
      aud: "",
      created_at: "",
    },
  };
}

/**
 * `getSession` devolve a sessão com o token; `onAuthStateChange` entrega o
 * ouvinte a `aoOuvir` (se houver) e devolve uma assinatura que não faz nada.
 */
export function authFalso(
  token: string,
  aoOuvir: (ouvinte: OuvinteDaSessao) => void = () => {},
): AuthFalso {
  return {
    getSession: async () => ({
      data: { session: sessaoFalsa(token) },
      error: null,
    }),
    onAuthStateChange: (ouvinte: OuvinteDaSessao) => {
      aoOuvir(ouvinte);
      return {
        data: {
          subscription: {
            id: "teste",
            callback: () => {},
            unsubscribe: () => {},
          },
        },
      };
    },
  };
}

/** Só `getSession`, para as telas cujo teste não ouve a troca de sessão. */
export function authSoComSessao(token: string): Pick<AuthFalso, "getSession"> {
  return { getSession: authFalso(token).getSession };
}

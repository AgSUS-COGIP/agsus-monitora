import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabaseClient";

/*
  O início da sessão numa chamada: `obter_inicio_da_sessao` (migration
  20261029121700) traz juntas a configuração (TB_CONFIGURACAO), os painéis
  externos (TB_PAINEL_EXTERNO), o catálogo de abas, a situação do sistema e
  as unidades ativas (TD_UNIDADE) — antes, cinco chamadas a cada carga de
  página, e a configuração duas vezes (a entrada e a carga).

  O pedido sai cedo — na configuração da entrada, quando já há sessão
  guardada, ou quando a sessão é conferida (junto com o perfil) — e a carga
  da entrada (src/app/carga.ts) usa o mesmo. Cada parte chega no formato de
  sempre (`{ data, error }`). Se o pedido falhar (rede, migration ainda não
  aplicada), cada parte vai pela consulta de antes: nada deixa de carregar.
*/

const RPC_INICIO = "obter_inicio_da_sessao";

/** Resposta no formato do Supabase. */
export type RespostaDaParte = { data: unknown; error: unknown };

/** As partes do início, na chave que a carga usa. */
export type NomeDaParte =
  "config" | "paineis" | "abas" | "situacao" | "unidades";

/** A consulta de antes de cada parte, para quando o início não vier. */
export type ConsultasAvulsas = Record<
  NomeDaParte,
  () => PromiseLike<RespostaDaParte>
>;

export type PartesDoInicio = Record<NomeDaParte, Promise<RespostaDaParte>>;

/* A chave de cada parte na resposta do banco. */
const CHAVE_NO_BANCO: Readonly<Record<NomeDaParte, string>> = Object.freeze({
  config: "configuracao",
  paineis: "paineis",
  abas: "abas",
  situacao: "situacao",
  unidades: "unidades",
});

/** A parte da resposta do início, ou null se ela não veio. */
export function parteDoInicio(
  resposta: RespostaDaParte | null | undefined,
  parte: NomeDaParte,
): RespostaDaParte | null {
  const dados = resposta?.error ? null : resposta?.data;
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
  const chave = CHAVE_NO_BANCO[parte];
  if (!(chave in dados)) return null;
  return { data: (dados as Record<string, unknown>)[chave], error: null };
}

export type InicioDaSessao = ReturnType<typeof criarInicioDaSessao>;

export function criarInicioDaSessao({
  cliente = getSupabaseClient,
}: { cliente?: () => Pick<SupabaseClient, "rpc"> | null } = {}) {
  let pedido: Promise<RespostaDaParte> | null = null;
  /* As partes já pedidas deste pedido: cada uma vai ao banco no máximo uma vez. */
  let lidas = new Map<NomeDaParte, Promise<RespostaDaParte>>();

  /** Dispara o pedido (ou devolve o que já saiu); nunca rejeita. */
  function pedir(): Promise<RespostaDaParte> {
    if (!pedido) {
      const sb = cliente();
      pedido = sb
        ? Promise.resolve()
            .then(() => sb.rpc(RPC_INICIO))
            .then(
              (resposta) => resposta as RespostaDaParte,
              (error: unknown) => ({ data: null, error }),
            )
        : Promise.resolve({ data: null, error: new Error("Sem cliente.") });
    }
    return pedido;
  }

  /**
   * Uma parte, do início se ele veio; senão, pela consulta de antes (só
   * então, e uma vez só, mesmo pedida de novo).
   */
  function parte(
    nome: NomeDaParte,
    avulsa: () => PromiseLike<RespostaDaParte>,
  ): Promise<RespostaDaParte> {
    let lida = lidas.get(nome);
    if (!lida) {
      lida = pedir().then(
        (resposta) =>
          parteDoInicio(resposta, nome) ??
          Promise.resolve()
            .then(avulsa)
            .then(
              (avulsa) => avulsa,
              (error: unknown) => ({ data: null, error }),
            ),
      );
      lidas.set(nome, lida);
    }
    return lida;
  }

  /** Todas as partes (a carga da entrada e o "Atualizar dados"). */
  function partes(avulsas: ConsultasAvulsas): PartesDoInicio {
    return {
      config: parte("config", avulsas.config),
      paineis: parte("paineis", avulsas.paineis),
      abas: parte("abas", avulsas.abas),
      situacao: parte("situacao", avulsas.situacao),
      unidades: parte("unidades", avulsas.unidades),
    };
  }

  /** Esquece o pedido: o próximo (Atualizar dados, outra pessoa) vai ao banco. */
  function esquecer() {
    pedido = null;
    lidas = new Map();
  }

  return { pedir, parte, partes, esquecer };
}

/** A instância do app (src/app/sistema.ts e src/app/carga.ts). */
export const inicioDaSessao = criarInicioDaSessao();

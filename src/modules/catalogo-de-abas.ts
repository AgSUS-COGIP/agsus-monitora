/*
  O catálogo de abas do banco (`listar_abas_do_menu`: `TB_ABA` × `RL_ABA_AREA`)
  para o menu lateral.

  A consulta sai junto com as outras da entrada (`iniciarConsultas` em
  src/app/carga.ts) e vai na cópia da sessão. Quem monta a árvore é
  `montarArvoreDoMenu` (`src/lib/menu-lateral.ts`), que recebe `abasDoMenu()`.

  Sem catálogo — função ainda não publicada no banco, erro de rede, resposta
  vazia ou estranha —, vale `ABAS_DO_MENU`, o mesmo catálogo no código: o menu
  fica igual. Por isso a falha não interrompe a entrada nem invalida a cópia.

  No meio da sessão, o vigia do catálogo (src/app/vigia-do-catalogo.ts) relê
  e reaplica o catálogo quando a versão dele muda no banco.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { ABAS_DO_MENU, abasDoCatalogo } from "../lib/menu-lateral.ts";
import type { AbaDoCatalogo } from "../componentes/barra-lateral/tipos.ts";

/** O erro do PostgREST, no que a carga lê (`code`). */
export type ErroDaConsulta = { code?: string } | null;

/** A resposta da consulta: nunca rejeita, a falha vem em `error`. */
export interface RespostaDaConsulta {
  data: unknown;
  error: ErroDaConsulta;
}

/** O que a carga entrega para aplicar (a consulta, já disparada). */
export interface OpcoesDaCargaDoBanco {
  consulta?: PromiseLike<{ data?: unknown; error?: unknown }> | null;
}

const RPC_LISTAR_ABAS_DO_MENU = "listar_abas_do_menu";

/* PostgREST: a função não existe (migration ainda não aplicada). Não é falha. */
const FUNCAO_AUSENTE = "PGRST202";

let abas: readonly AbaDoCatalogo[] = ABAS_DO_MENU;

/** Dispara a consulta já (ver `iniciarConsultasDaSessao`); nunca rejeita. */
export function consultaDoCatalogoDeAbas(
  sb: Pick<SupabaseClient, "rpc"> | null | undefined,
): Promise<RespostaDaConsulta> {
  if (!sb) return Promise.resolve({ data: null, error: null });
  return Promise.resolve(sb.rpc(RPC_LISTAR_ABAS_DO_MENU)).catch((error) => ({
    data: null,
    error,
  }));
}

/**
 * Aplica a resposta da consulta. Devolve `true` quando o menu passa a vir do
 * catálogo do banco, `false` quando fica com o do código.
 */
export async function carregarCatalogoDeAbas({
  consulta,
}: OpcoesDaCargaDoBanco = {}): Promise<boolean> {
  let resposta: { data?: unknown; error?: unknown } | null | undefined;
  try {
    resposta = await consulta;
  } catch (error) {
    resposta = { data: null, error };
  }
  const { data, error } = resposta || {};
  if (error && (error as { code?: unknown }).code !== FUNCAO_AUSENTE)
    console.warn("Catálogo de abas indisponível; menu do código:", error);
  abas = (!error && abasDoCatalogo(data)) || ABAS_DO_MENU;
  return abas !== ABAS_DO_MENU;
}

/** O catálogo em uso: o do banco, quando carregou; senão, o do código. */
export function abasDoMenu(): readonly AbaDoCatalogo[] {
  return abas;
}

/*
  O catálogo em uso veio do banco? Só nesse caso dá para dizer que uma aba
  foi desligada (src/lib/pagina-desligada.ts): no do código, tudo está ligado.
*/
export function catalogoDoBanco(): boolean {
  return abas !== ABAS_DO_MENU;
}

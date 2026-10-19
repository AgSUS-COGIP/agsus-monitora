import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Versão do catálogo de abas na presença (20261019160000): a resposta de
  registrar_presenca_monitora ganha `versao_do_catalogo`, para a tela fechar a
  página desligada sem chamada nova ao banco. O ensaio (begin…rollback, em
  19/10/2026) conferiu: mesma versão em batidas seguidas, outra depois de
  trocar uma aba de área, ~0,4 ms por versão e authenticated sem execute na
  função privada. Invariantes estáticas abaixo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261019160000_versao_do_catalogo_na_presenca.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

describe("versão do catálogo na presença", () => {
  it("a versão cobre as quatro tabelas do catálogo e da situação", () => {
    for (const tabela of [
      "TB_SITUACAO_SISTEMA",
      "TB_AREA",
      "TB_ABA",
      "RL_ABA_AREA",
    ])
      expect(MIGRATION).toContain(`from public."${tabela}"`);
  });

  it("funções no padrão: SECURITY DEFINER, search_path vazio, comentário e grants", () => {
    expect(
      MIGRATION.match(/security definer\nset search_path to ''/g),
    ).toHaveLength(2);
    expect(MIGRATION).toContain(
      'comment on function private."FC_VERSAO_DO_CATALOGO_DE_ABAS"()',
    );
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_VERSAO_DO_CATALOGO_DE_ABAS"() from public, anon, authenticated;',
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.registrar_presenca_monitora(text) to authenticated;",
    );
    expect(MIGRATION.match(/^grant .*$/gm)).toEqual([
      "grant execute on function public.registrar_presenca_monitora(text) to authenticated;",
    ]);
  });

  it("o contrato se mantém: mesmo argumento e `status: 'OK'` na resposta", () => {
    expect(MIGRATION).toContain(
      "public.registrar_presenca_monitora(p_current_view text default null::text)",
    );
    expect(MIGRATION).toContain("'status', 'OK',");
    expect(MIGRATION).toContain("'versao_do_catalogo',");
    expect(CONTRATO_RPC.registrar_presenca_monitora.argumentos).toEqual([
      "p_current_view",
    ]);
  });

  it("rollback volta à resposta antiga e apaga a função; ensaio sempre desfeito", () => {
    expect(ROLLBACK).toContain("return jsonb_build_object('status', 'OK');");
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_VERSAO_DO_CATALOGO_DE_ABAS"();',
    );
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
  });
});

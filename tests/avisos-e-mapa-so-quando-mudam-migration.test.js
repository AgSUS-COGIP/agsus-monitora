import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Menos egress: os avisos de conferência e o mapa da Saúde Indígena só trafegam
  quando mudam (versão por FC_SE_MUDOU). As duas migrations só acrescentam
  funções: o front de hoje continua funcionando com elas aplicadas.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const AVISOS = "20261015000000_avisos_de_conferencia_so_quando_mudam.sql";
const MAPA = "20261015000100_mapa_da_saude_indigena_so_quando_muda.sql";
const migration = (nome) => ler(`supabase/migrations/${nome}`);

describe.each([AVISOS, MAPA])("%s", (nome) => {
  const sql = migration(nome);

  it("numa transação, só acrescenta (sem drop nem alteração de dados)", () => {
    expect(sql.trim()).toMatch(/^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/);
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).not.toMatch(/\b(insert|update|delete)\b\s+(into|public|from)/i);
    expect(sql).toContain('private."FC_SE_MUDOU"(');
  });

  it("ensaio termina em rollback e o rollback derruba a função", () => {
    expect(ler(`supabase/ensaios/${nome}`).trim()).toMatch(/rollback;$/);
    expect(ler(`supabase/rollback/${nome}`)).toMatch(
      /drop function if exists public\.\w+\(/,
    );
  });
});

describe("avisos de conferência", () => {
  const sql = migration(AVISOS);

  it("embrulha a função de sempre, sem nulos e sem exemplos de aviso com casos", () => {
    expect(sql).toContain(
      "create or replace function public.listar_avisos_conferencia_se_mudou(",
    );
    expect(sql).toContain(
      "public.listar_avisos_conferencia(p_area, p_modulo)::jsonb",
    );
    expect(sql).not.toContain(
      "create or replace function public.listar_avisos_conferencia(",
    );
    expect(sql).toContain("jsonb_strip_nulls(");
    expect(sql).toContain("then a.aviso - 'exemplos'");
    expect(sql).toContain('public."TB_CASO_AVISO_CONFERENCIA"');
  });

  it("só authenticated chama", () => {
    expect(sql).toContain(
      "revoke all on function public.listar_avisos_conferencia_se_mudou(text, text, text) from public, anon;",
    );
    expect(sql).toContain(
      "grant execute on function public.listar_avisos_conferencia_se_mudou(text, text, text) to authenticated;",
    );
  });
});

describe("mapa da Saúde Indígena", () => {
  const sql = migration(MAPA);

  it("as mesmas linhas do select do front, pela RLS de sempre", () => {
    expect(sql).toMatch(
      /listar_mapa_da_saude_indigena\(p_versao text default null\)[\s\S]*security invoker/,
    );
    expect(sql).toContain("where m.chave in ('lmap', 'rede_cnes')");
    expect(sql).toContain(
      "jsonb_build_object('chave', m.chave, 'payload', m.payload)",
    );
  });

  it("o front pede pela RPC, não mais pela tabela", () => {
    const carga = ler("src/app/carga.js");
    expect(carga).toContain('"listar_mapa_da_saude_indigena"');
    expect(carga).not.toContain(".from(TABELA_DO_MAPA)");
    expect(carga).not.toContain('"TB_CONFIG_MAPA_SAUDE_INDIG"');
  });
});

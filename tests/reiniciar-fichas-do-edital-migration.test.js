import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration 20261009160000 (reiniciar as fichas de um edital, admin global, sem
  apagar) e a correção do 93/2026. Invariantes estáticas: o que volta ao
  início, o que não se toca, quem pode, o histórico REINICIAR, o corpo do
  ensaio igual ao da migration e o rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009160000_reiniciar_fichas_do_edital.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const CORRECAO = ler("supabase/correcoes/20261009-reiniciar-fichas-93.sql");
const corpo = (texto) =>
  texto.slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"));
const FUNCAO = MIGRATION.slice(
  MIGRATION.indexOf('create function private."FC_REINICIAR_FICHAS_DO_EDITAL"'),
  MIGRATION.indexOf("create function public.reiniciar_fichas_do_edital"),
);

describe("migration de reiniciar as fichas do edital", () => {
  it("o histórico aceita REINICIAR com motivo obrigatório", () => {
    expect(MIGRATION).toMatch(
      /"CK_THFICHA_TPACAO" check \("TP_ACAO" in \([^)]*'REABRIR', 'REINICIAR'\)\)/,
    );
    expect(MIGRATION).toMatch(
      /"TP_ACAO" not in \('REDISTRIBUIR', 'DEVOLVER_FILA', 'LIBERAR_RESERVA', 'REVISAR', 'REABRIR', 'REINICIAR'\)\s+or length\(btrim\(coalesce\("DS_MOTIVO", ''\)\)\) between 10 and 2000/,
    );
  });

  it("volta ao início só as fichas do lote, sem apagar", () => {
    expect(FUNCAO).toContain("if v_f.\"TP_SITUACAO\" = 'FORA_LOTE' then");
    for (const coluna of [
      '"CO_USUARIO_RESPONSAVEL" = null',
      '"DT_ATRIBUICAO" = null',
      '"CO_USUARIO_RESERVA" = null',
      '"DT_RESERVA_EXPIRA" = null',
      '"DS_LANCAMENTO" = null',
      '"DS_RESULTADO" = null',
      '"DS_PARECER" = null',
      '"TP_RESULTADO" = null',
      '"VL_NOTA_APURADA" = null',
      '"VL_NOTA_FINAL" = null',
      '"CO_USUARIO_RASCUNHO" = null',
      '"DT_RASCUNHO" = null',
      '"CO_USUARIO_CONCLUSAO" = null',
      '"DT_CONCLUSAO" = null',
      '"NU_VERSAO" = "NU_VERSAO" + 1',
    ])
      expect(FUNCAO).toContain(coluna);
    expect(FUNCAO).toContain("\"TP_SITUACAO\" = 'PENDENTE',");
    expect(MIGRATION).not.toMatch(/\bdelete\s+from\b/i);
    expect(MIGRATION).not.toMatch(/disable\s+trigger|reinicio_treinamento/i);
    // Não toca regra, decisões, pré-classificação, Classificação nem análises.
    expect(FUNCAO).not.toMatch(
      /update public\."(TB_REGRA_ANALISE|TB_DECISAO_LOTE|TB_PRE_CLASSIFICACAO|TB_LISTA_CLASSIFICACAO|TB_ANALISE_CURRICULAR)"/,
    );
  });

  it("registra REINICIAR por ficha com motivo, autor e o que foi limpo", () => {
    expect(FUNCAO).toContain("'REINICIAR', v_f.\"TP_SITUACAO\", 'PENDENTE'");
    expect(FUNCAO).toContain('"DS_ALTERACAO"');
    expect(FUNCAO).toContain("length(v_motivo) not between 10 and 2000");
    expect(FUNCAO).toContain('a."ST_ADMIN_GLOBAL"');
  });

  it("só o administrador global; a função privada sem grant", () => {
    expect(MIGRATION).toContain("if not private.is_master() then");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid) from public, anon, authenticated, service_role;',
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.reiniciar_fichas_do_edital(uuid, text) from public, anon;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.reiniciar_fichas_do_edital(uuid, text) to authenticated;",
    );
    expect(CONTRATO_RPC.reiniciar_fichas_do_edital.argumentos).toEqual([
      "p_edital",
      "p_motivo",
    ]);
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    const a = "-- ===== corpo da migration (sem begin/commit) =====\n";
    const b = "\n-- ===== fim do corpo =====";
    expect(ENSAIO.slice(ENSAIO.indexOf(a) + a.length, ENSAIO.indexOf(b))).toBe(
      corpo(MIGRATION),
    );
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
  });

  it("o rollback desfaz e recusa depois de um reinício", () => {
    expect(ROLLBACK).toContain(
      "drop function if exists public.reiniciar_fichas_do_edital(uuid, text);",
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid);',
    );
    expect(ROLLBACK).toContain(
      'if exists (select 1 from public."TH_FICHA_ANALISE" where "TP_ACAO" = \'REINICIAR\') then',
    );
    expect(ROLLBACK).not.toContain("'REINICIAR')),");
  });

  it("a correção do 93/2026 chama o reinício pelo número e pela área", () => {
    expect(CORRECAO).toContain(
      "'Reinício do edital: a análise documental do 93/2026 foi feita pela planilha'",
    );
    expect(CORRECAO).toContain(
      "private.\"FC_NUMERO_EDITAL\"(m.edital) = '93/2026'",
    );
    expect(CORRECAO).toContain("m.\"CO_AREA\" = 'projetos'");
    expect(CORRECAO).toContain(
      'private."FC_REINICIAR_FICHAS_DO_EDITAL"(v_edital, c_motivo, v_autor)',
    );
    expect(CORRECAO).not.toMatch(/\bdelete\s+from\b/i);
  });
});

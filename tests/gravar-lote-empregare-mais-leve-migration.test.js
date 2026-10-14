import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* gravar_lote_empregare sem estourar os 8 s: lote em memória, sem tabela temporária, sem regravar o questionário igual. */
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261014100000_gravar_lote_empregare_mais_leve.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROBO = ler("scripts/robo-empregare/robo_empregare.py");

describe("gravar_lote_empregare mais leve", () => {
  it("mantém a assinatura, só service_role, numa transação", () => {
    expect(MIGRATION).toContain(
      "create or replace function public.gravar_lote_empregare(p_sync text, p_vaga text, p_total integer, p_linhas jsonb)",
    );
    expect(MIGRATION).toMatch(
      /security definer\s+set search_path = ''\s+set work_mem = '32MB'/,
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.gravar_lote_empregare(text, text, integer, jsonb) from public, anon, authenticated;",
    );
    expect(MIGRATION.trim()).toMatch(
      /^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/,
    );
  });

  it("sem tabela temporária e sem regravar o questionário de mesmo hash", () => {
    expect(MIGRATION).not.toMatch(/create temporary table/i);
    expect(MIGRATION).toMatch(/with lote as materialized/);
    expect(MIGRATION).toMatch(
      /"DS_COLUNA_ORIGINAL" = case\s+when c\."DS_HASH_LINHA" is distinct from excluded\."DS_HASH_LINHA" then excluded\."DS_COLUNA_ORIGINAL"\s+else c\."DS_COLUNA_ORIGINAL" end/,
    );
    // Semântica mantida: chave natural, trava na abertura, ausentes só no fechar.
    expect(MIGRATION).toContain(
      'on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do update set',
    );
    expect(MIGRATION).toContain(
      'private."FC_EMPREGARE_ABRIR_VAGA"(p_sync, p_vaga, p_total)',
    );
    expect(MIGRATION).not.toMatch(/"ST_REGISTRO_ATIVO" = 'N'\s*,/);
  });

  it("datas sem bloco de exceção (sem subtransação por linha)", () => {
    expect(MIGRATION).toMatch(
      /create or replace function private\."FC_EMPREGARE_DATA"\(p_texto text\)\s+returns date\s+language sql/,
    );
    expect(MIGRATION).toMatch(
      /create or replace function private\."FC_EMPREGARE_MOMENTO"\(p_texto text\)/,
    );
    expect(MIGRATION).toContain("pg_input_is_valid(left(p_texto, 10), 'date')");
    expect(MIGRATION).not.toMatch(/exception when others/i);
  });

  it("rollback volta as definições anteriores e o ensaio termina em rollback", () => {
    expect(ROLLBACK).toMatch(
      /create temporary table if not exists pg_temp\.tmp_empregare_lote_link/,
    );
    expect(ROLLBACK).toMatch(/exception when others then/);
    expect(ROLLBACK).not.toMatch(/SET work_mem/i);
    expect(ENSAIO.trim()).toMatch(/rollback;$/);
    expect(ENSAIO).not.toMatch(/\bcommit;/);
  });

  it("o robô grava em lotes de 200 e divide o lote que estoura o tempo", () => {
    expect(ROBO).toMatch(/^TAMANHO_DO_LOTE = 200$/m);
    expect(ROBO).toContain('"57014" in str(erro)');
  });
});

const NOME2 = "20261014110000_abrir_vaga_empregare_sem_varredura.sql";
const ABRIR = ler(`supabase/migrations/${NOME2}`);
const ABRIR_ROLLBACK = ler(`supabase/rollback/${NOME2}`);
const ABRIR_ENSAIO = ler(`supabase/ensaios/${NOME2}`);

describe("abrir a vaga da Empregare sem varrer as análises", () => {
  it("vaga já aberta na execução devolve a situação antes de procurar o edital", () => {
    const corpo = ABRIR.slice(
      ABRIR.indexOf(
        'create or replace function private."FC_EMPREGARE_ABRIR_VAGA"',
      ),
    );
    const atalho = corpo.indexOf('v."CO_SYNC" = p_sync');
    expect(atalho).toBeGreaterThan(0);
    expect(atalho).toBeLessThan(
      corpo.indexOf('private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga)'),
    );
    expect(corpo).toMatch(
      /for update;\s+if found then\s+return v_vaga\."TP_SITUACAO";/,
    );
  });

  it("busca por código usa o índice; lista inteira continua igual", () => {
    expect(ABRIR).toMatch(
      /create index if not exists "IN_ANALISECURR_VAGATRIM"\s+on public\."TB_ANALISE_CURRICULAR" \(btrim\(codigo_vaga\)\)\s+where ativo;/,
    );
    expect(ABRIR).toMatch(/where p_vaga is null\s+and a\.ativo/);
    expect(ABRIR).toMatch(
      /where p_vaga is not null\s+and a\.ativo\s+and btrim\(a\.codigo_vaga\) = p_vaga/,
    );
    expect(ABRIR).not.toContain(
      "(p_vaga is null or btrim(a.codigo_vaga) = p_vaga)",
    );
  });

  it("rollback e ensaio", () => {
    expect(ABRIR_ROLLBACK).toContain(
      "(p_vaga is null or btrim(a.codigo_vaga) = p_vaga)",
    );
    expect(ABRIR_ROLLBACK).toContain(
      'drop index if exists public."IN_ANALISECURR_VAGATRIM"',
    );
    expect(ABRIR_ENSAIO.trim()).toMatch(/rollback;$/);
    expect(ABRIR_ENSAIO).not.toMatch(/\bcommit;/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261007170000 (sync de análises não trava; ainda não aplicada: o
  ensaio begin…rollback está em supabase/ensaios/). Invariantes estáticas:
  assinaturas mantidas, execução parada encerrada como erro "por inatividade"
  sem apagar nada, a fila por planilha preservada, a varredura no pg_cron,
  o Status das atualizações com a marca, rollback com os corpos de antes e
  ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007170000_sync_de_analises_nao_trava.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const POR_PLANILHA = ler(
  "supabase/migrations/20260928140000_sync_de_analises_por_planilha.sql",
);
const AUSENTES = ler(
  "supabase/migrations/20261001140000_incremental_remove_ausentes.sql",
);
const CLIENTE = ler("apps-script/saude-indigena/3-analises-incremental.gs");

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const corpoDaMigration = (texto) =>
  texto
    .slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"))
    .trim();

const ENCERRAR =
  'create function public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(p_planilha text default null, p_minutos integer default 30)';
const INICIAR =
  "CREATE OR REPLACE FUNCTION public.iniciar_sync_analises_incremental(p_sync_id uuid, p_origem text DEFAULT 'apps_script_analises_incremental_v1'::text)";
const COMPARAR =
  "CREATE OR REPLACE FUNCTION public.comparar_analises_incremental_v2(p_sync_id uuid, p_itens jsonb, p_reiniciar boolean DEFAULT false)";
const GATILHO =
  "CREATE OR REPLACE FUNCTION public.analises_sync_guard_before_insert()";

describe("sync de análises não trava (20261007170000)", () => {
  it("transação única, sem comentário aninhado que engula o corpo", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    const cabecalho = MIGRATION.slice(0, MIGRATION.indexOf("*/"));
    expect(cabecalho.slice(2)).not.toContain("/*");
  });

  it("encerra como erro 'por inatividade', sem apagar nada, com o progresso do log, do manifesto e do staging", () => {
    const corpo = corpoDaFuncao(MIGRATION, ENCERRAR);
    expect(corpo).toContain("security definer");
    expect(corpo).toContain("set search_path to ''");
    expect(corpo).toContain("status = 'erro'");
    expect(corpo).toContain("'encerrada_por_inatividade', true");
    expect(corpo).toContain("Execução encerrada por inatividade");
    expect(corpo).toContain(
      'max(m."DT_CRIACAO") from public."TM_MANIFESTO_ANALISE"',
    );
    expect(corpo).toContain(
      'max(s.created_at) from public."TM_ANALISE_CURRICULAR"',
    );
    expect(corpo).toContain("l.updated_at, l.started_at, l.created_at");
    expect(corpo).toContain("p_minutos not between 30 and 1440");
    expect(corpo).toContain("for update of l skip locked");
    // Mesmo lock consultivo do iniciar, do lote e dos finalizar.
    expect(corpo).toContain(
      "pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:' || v_planilha)::bigint)",
    );
    expect(corpo).not.toMatch(/\bdelete\b|\btruncate\b/i);
    expect(MIGRATION).toContain(
      'revoke all on function public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer) from public, anon, authenticated;',
    );
    expect(MIGRATION).toContain(
      'grant execute on function public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer) to service_role;',
    );
  });

  it("iniciar: mesma assinatura, encerra a parada antes de conferir a fila, e a fila continua", () => {
    const corpo = corpoDaFuncao(MIGRATION, INICIAR);
    const lock = corpo.indexOf("pg_try_advisory_xact_lock");
    const encerra = corpo.indexOf(
      '"FC_ENCERRAR_SYNC_ANALISE_INATIVO"(v_planilha, 30)',
    );
    const fila = corpo.indexOf("Existe outro sync de Analises pendente");
    expect(lock).toBeGreaterThan(-1);
    expect(encerra).toBeGreaterThan(lock);
    expect(fila).toBeGreaterThan(encerra);
    expect(corpo).toContain("l.status in ('carregado','processando')");
    // A cabeça é a mesma de antes: o PostgREST não ganha sobrecarga.
    expect(
      corpoDaFuncao(
        POR_PLANILHA,
        "CREATE FUNCTION public.iniciar_sync_analises_incremental(",
      ),
    ).toContain(
      "p_sync_id uuid, p_origem text DEFAULT 'apps_script_analises_incremental_v1'",
    );
    expect(MIGRATION).not.toMatch(/drop function public\.iniciar_sync/i);
  });

  it("comparar v2 marca sinal de vida no log, no máximo 1 vez por minuto", () => {
    const corpo = corpoDaFuncao(MIGRATION, COMPARAR);
    expect(corpo).toContain("set updated_at = now()");
    expect(corpo).toContain("updated_at < now() - interval '1 minute'");
    // O resto é o corpo de 20261001140000.
    expect(corpo).toContain(
      "return public.comparar_analises_incremental(p_itens);",
    );
    expect(AUSENTES).toContain(
      "create function public.comparar_analises_incremental_v2(",
    );
  });

  it("gatilho do insert do log (FULL) usa a mesma regra e recusa qualquer pendente da planilha", () => {
    const corpo = corpoDaFuncao(MIGRATION, GATILHO);
    expect(corpo).toContain(
      'perform public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(v_planilha, 30);',
    );
    expect(corpo).not.toContain("interval '15 minutes'");
    expect(corpo).not.toContain("interval '45 minutes'");
    expect(corpo).toContain("using errcode = '55P03'");
  });

  it("varredura a cada 10 min no pg_cron e a marca no Status das atualizações", () => {
    expect(MIGRATION).toContain(
      "cron.schedule('agsus_analises_encerrar_inativas', '*/10 * * * *', v_comando)",
    );
    expect(MIGRATION).toContain(
      "'encerrada_por_inatividade', coalesce((x.j -> 'resultado' ->> 'encerrada_por_inatividade')::boolean, false)",
    );
  });

  it("o cliente usa o mesmo limite de 30 min", () => {
    expect(CLIENTE).toContain("MAX_SEM_PROGRESSO_MS: 30 * 60 * 1000");
  });

  it("rollback: tira a tarefa, volta os corpos de antes e apaga a função nova", () => {
    expect(ROLLBACK).toContain("cron.unschedule(v_id)");
    expect(ROLLBACK).toContain(
      'drop function public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer);',
    );
    expect(ROLLBACK).not.toContain(
      'FC_ENCERRAR_SYNC_ANALISE_INATIVO"(v_planilha',
    );
    expect(corpoDaFuncao(ROLLBACK, GATILHO)).toContain("interval '15 minutes'");
    expect(corpoDaFuncao(ROLLBACK, COMPARAR)).not.toContain("set updated_at");
    expect(ROLLBACK).not.toContain("'encerrada_por_inatividade', coalesce");
  });

  it("ensaio: o mesmo corpo da migration, termina em rollback e simula a execução parada", () => {
    const abre = "-- ═══ CORPO DA MIGRATION (início) ═══";
    const fecha = "-- ═══ CORPO DA MIGRATION (fim) ═══";
    const corpo = ENSAIO.slice(
      ENSAIO.indexOf(abre) + abre.length,
      ENSAIO.indexOf(fecha),
    ).trim();
    expect(corpo).toBe(corpoDaMigration(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).toContain("now() - interval '16 hours'");
    expect(ENSAIO).toContain("'ENSAIO OK' as resultado");
  });
});

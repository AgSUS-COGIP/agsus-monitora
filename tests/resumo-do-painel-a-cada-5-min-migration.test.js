import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  prazoDaAgenda,
  PRAZO_FREQUENTE_MIN,
} from "../src/lib/saude-das-cargas.ts";

/*
  A migration do resumo do Painel das análises a cada 5 min (20261024100000),
  ainda não aplicada: o ensaio begin…rollback está em supabase/ensaios/. Aqui,
  as invariantes estáticas: só a agenda do job muda (cron.alter_job, sem
  mexer no comando nem no active, que a chave "Pacotes dos painéis" controla),
  o ensaio roda o mesmo corpo e mede as rodadas, e o rollback volta aos
  minutos 20 e 50 de 20261019180000.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261024100000_resumo_do_painel_a_cada_5_min.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261019180000_resumo_do_painel_a_cada_30_min.sql",
);

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

describe("resumo do painel das análises a cada 5 min (20261024100000)", () => {
  it("é uma transação, com pré-requisito, e o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261022185000",
    );
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
  });

  it("só muda a agenda do job, para a cada 5 min", () => {
    expect(MIGRATION).toContain(
      "select cron.alter_job(jobid, schedule := '*/5 * * * *')\n  from cron.job where jobname = 'agsus_analises_cache_do_painel';",
    );
    expect(corpo(MIGRATION)).not.toMatch(/command\s*:=|active\s*:=/);
    expect(corpo(MIGRATION)).not.toMatch(/cron\.(schedule|unschedule)\(/);
    expect(prazoDaAgenda("*/5 * * * *")).toBe(PRAZO_FREQUENTE_MIN);
  });

  it("o ensaio mede a rodada sem marca e com marca, e prova a marca pelo update", () => {
    expect(ENSAIO).toContain(
      "public.atualizar_cache_painel_analises_vencidos()",
    );
    expect(ENSAIO).toContain('update public."TB_ANALISE_CURRICULAR"');
    expect(ENSAIO).toContain(
      "private.\"FC_CACHE_DESATUALIZADO\"('ANALISES', v_area)",
    );
    for (const chave of ["sem_marca_ms", "com_marca_ms", "marca_apagada"])
      expect(ENSAIO).toContain(`'${chave}'`);
  });

  it("o rollback volta aos minutos 20 e 50 de 20261019180000", () => {
    expect(ANTERIOR).toContain("schedule := '20,50 * * * *'");
    expect(ROLLBACK).toContain(
      "select cron.alter_job(jobid, schedule := '20,50 * * * *')\n  from cron.job where jobname = 'agsus_analises_cache_do_painel';",
    );
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });
});

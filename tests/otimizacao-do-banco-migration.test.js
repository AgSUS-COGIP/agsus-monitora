import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration 20261009110000 (otimização do banco): tira índices repetidos ou sem
  leitura, cria o índice do último sync processado, faz a carga das entrevistas
  regravar só a nota que mudou e completa comentários. O ensaio begin…rollback
  mede antes × depois em supabase/ensaios/. Invariantes estáticas: nada de
  constraint, tabela ou dado sai; a função mantém assinatura e permissão; o
  rollback desfaz tudo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009110000_otimizacao_do_banco.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const INDICES_QUE_SAEM = [
  "idx_monitoramento_cronograma_monitoramento",
  "idx_perfis_usuarios_user_id",
  "idx_analises_staging_sync_id",
  "idx_analises_staging_sync_entidade",
  "idx_analises_editais_ativo_chave",
  '"IN_FKROTEIROCOMPETENCIA_CO"',
  "idx_monitoramento_indigena_ativo",
  "idx_monitoramento_indigena_ativo_uf",
  "idx_monitoramento_indigena_ativo_status",
  "idx_monitoramento_indigena_status_etapa",
  "idx_analises_curriculares_ativo_ordem_todos",
  "idx_analises_curriculares_ordem_todos",
];
const INDICE_NOVO = "IN_SYNCANALISE_PROCESSADO";
const ASSINATURA =
  "public.sincronizar_entrevistas(p_sync text, p_area text, p_linhas jsonb)";

const corpoDaMigration = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();

describe("otimização do banco (20261009110000)", () => {
  it("é uma transação e só apaga índice, nunca tabela, coluna, constraint ou dado", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    // Fora os comentários e o corpo da função (que trunca a própria tabela temporária).
    const comandos = MIGRATION.replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\$function\$[\s\S]*?\$function\$/g, "")
      .replace(/--.*$/gm, "");
    expect(comandos).not.toMatch(/drop\s+(table|view|function|schema|column)/i);
    expect(comandos).not.toMatch(/drop\s+constraint/i);
    expect(comandos).not.toMatch(/\b(truncate|delete\s+from|alter\s+table)\b/i);
    expect(comandos).not.toMatch(/\brename\b/i);
    expect(comandos).not.toMatch(/\bgrant\b|\brevoke\b/i);
    expect(comandos).not.toMatch(/cron\.(schedule|unschedule|alter_job)/i);
  });

  it("tira os doze índices e o rollback recria cada um", () => {
    for (const indice of INDICES_QUE_SAEM) {
      expect(MIGRATION).toContain(`drop index if exists public.${indice};`);
      expect(ROLLBACK).toContain(
        `CREATE INDEX IF NOT EXISTS ${indice} ON public.`,
      );
    }
    expect(MIGRATION.match(/drop index if exists/g)).toHaveLength(
      INDICES_QUE_SAEM.length,
    );
  });

  it("o índice novo segue o MAD, é comentado e o rollback o tira", () => {
    expect(INDICE_NOVO.length).toBeLessThanOrEqual(30);
    expect(MIGRATION).toContain(
      `create index if not exists "${INDICE_NOVO}"\n  on public."TL_SYNC_ANALISE" (finished_at)\n  where status = 'processado';`,
    );
    expect(MIGRATION).toContain(`comment on index public."${INDICE_NOVO}" is`);
    expect(ROLLBACK).toContain(`drop index if exists public."${INDICE_NOVO}";`);
  });

  it("a carga das entrevistas só regrava a nota que mudou, com o mesmo contrato", () => {
    expect(CONTRATO_RPC).not.toHaveProperty("sincronizar_entrevistas");
    for (const texto of [MIGRATION, ROLLBACK]) {
      expect(texto).toContain(`CREATE OR REPLACE FUNCTION ${ASSINATURA}`);
      expect(texto).toContain(" SECURITY DEFINER\n SET search_path TO ''");
    }
    expect(MIGRATION).toContain(
      `  where ("TB_ENTREVISTA_NOTA"."DS_CRITERIO", "TB_ENTREVISTA_NOTA"."VL_NOTA")\n        is distinct from (excluded."DS_CRITERIO", excluded."VL_NOTA");`,
    );
    expect(ROLLBACK).not.toContain('"TB_ENTREVISTA_NOTA"."VL_NOTA")');
    // Fora a guarda, a função é a mesma do banco (o rollback guarda a de antes).
    const semGuarda = MIGRATION.replace(
      /"VL_NOTA" = excluded\."VL_NOTA"\n {2}-- Só a nota[\s\S]*?excluded\."VL_NOTA"\);/,
      '"VL_NOTA" = excluded."VL_NOTA";',
    );
    const funcao = (texto) =>
      texto.slice(
        texto.indexOf(`CREATE OR REPLACE FUNCTION ${ASSINATURA}`),
        texto.indexOf("$function$;", texto.indexOf(ASSINATURA)),
      );
    expect(funcao(semGuarda)).toBe(funcao(ROLLBACK));
  });

  it("os comentários novos têm volta no rollback", () => {
    const alvos = [
      ...MIGRATION.matchAll(
        /^(comment on (?:function|column) .+?) is(?: '|$)/gm,
      ),
    ].map((m) => m[1]);
    expect(alvos.length).toBe(47);
    for (const alvo of alvos) expect(ROLLBACK).toContain(`${alvo} is null;`);
  });

  it("o ensaio aplica o mesmo corpo, mede antes e depois e termina em rollback", () => {
    expect(ENSAIO).toContain(
      corpoDaMigration(MIGRATION, "\nbegin;\n", "commit;"),
    );
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
    for (const medida of [
      "'antes'",
      "'depois'",
      "pg_current_wal_insert_lsn()",
      "pg_stat_xact_user_tables",
    ])
      expect(ENSAIO).toContain(medida);
  });
});

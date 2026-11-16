import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  "CONTRATADO EM OUTRA LISTA" PELA ADMISSÃO NO RH (migration 20261116170000, regra v2)

  Quando a convocação não decide, vale a única linha com a admissão conciliada com o RH. O
  comportamento é conferido no banco pelo ensaio (e o rollback numa transação desfeita); aqui,
  que migration, ensaio e rollback contam a mesma história.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261116170000_contratado_em_outra_lista_pela_admissao_no_rh";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

describe("migration 20261116170000", () => {
  const migration = ler(`supabase/migrations/${NOME}.sql`);
  const ensaio = ler(`supabase/ensaios/${NOME}.sql`);
  const rollback = ler(`supabase/rollback/${NOME}.sql`);

  it("guarda pelo md5 das duas funções, antes e depois", () => {
    for (const md5 of [
      "11b65b89f036c309f21bf41dd7ac577d",
      "de50fc2d24a3cf9a6d919e7ef953736e",
      "aff87527cf05786f4cd614f3065ffb90",
      "a9200f2dc75788ba1d1aff7eb2e1c1d2",
    ])
      expect(migration).toContain(md5);
    expect(migration).toContain("já foi aplicada");
  });

  it("a leitura do job diz se a linha Contratado tem admissão no RH", () => {
    expect(migration).toContain(
      `'admitido', case when c.status = 'Contratado' then exists (`,
    );
    expect(migration).toContain(
      `public."TB_ADMISSAO_CONCILIADA" a where a."CO_CANDIDATO_APROVADO" = c.id`,
    );
    expect(migration).toContain("'schema_version', 1");
  });

  it("o banco aceita a versão 2 e o motivo ADMISSAO_NO_RH só nas decisões", () => {
    expect(migration).toContain("versao is null or versao not in (1, 2)");
    const escolha = migration.slice(
      migration.indexOf('add constraint "CK_CONTRATAPROV_ESCOLHA"'),
    );
    const ambiguo = escolha.slice(
      escolha.indexOf("when 'AMBIGUO'"),
      escolha.indexOf("when 'CONTRATACAO'"),
    );
    expect(ambiguo).not.toContain("ADMISSAO_NO_RH");
    expect(escolha).toContain("'HERDADA', 'ADMISSAO_NO_RH'");
    expect(migration).toMatch(
      /CK_CONTRATAPROV_TPMOTIVO" check \("TP_MOTIVO" in \([^)]*'ADMISSAO_NO_RH'/,
    );
  });

  it("o rollback apaga só as decisões ADMISSAO_NO_RH e volta as funções", () => {
    expect(rollback).toContain(`where y."TP_MOTIVO" = 'ADMISSAO_NO_RH'`);
    expect(rollback).not.toContain("'admitido'");
    expect(rollback).toContain("versao is distinct from 1");
    expect(rollback).not.toMatch(/ADD CONSTRAINT[^;]*ADMISSAO_NO_RH/i);
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    const corpo = migration.slice(
      migration.indexOf("begin;"),
      migration.lastIndexOf("commit;"),
    );
    expect(ensaio).toContain(corpo);
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ensaio).not.toMatch(/^commit;/m);
  });
});

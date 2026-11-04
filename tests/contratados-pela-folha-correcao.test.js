import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Correção 20261104-contratados-pela-folha: a situação dos aprovados conferida com a
  folha (confiança alta): parte 1 Contratado + matrícula, parte 2 "Contratado em outra
  lista" só em edital encerrado, parte 3 troca da matrícula. Assinada pela conta do setor,
  com histórico, sem tocar no edital 114/2026. O ensaio rodou no banco em 04/11/2026
  (ENSAIO_OK 787 linhas); aqui, as invariantes estáticas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261104-contratados-pela-folha.sql";
const CORRECAO = ler(`supabase/correcoes/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const CONTA_DO_SETOR = "a01afddb-f64b-47d9-80e8-476a1ed14e43";
const EDITAL_114 = "bcecfb08-88ef-4e06-8401-bcad6bf88fd0";

const entreMarcadores = (texto, nome) =>
  texto.slice(
    texto.indexOf(`-- >>> ${nome}\n`),
    texto.indexOf(`-- <<< ${nome}\n`) + `-- <<< ${nome}\n`.length,
  );
const semComentarios = (texto) =>
  texto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((linha) => linha.replace(/--.*$/, ""))
    .join("\n");

describe(`correção ${NOME}`, () => {
  it("só muda status e matrícula, com histórico: nada apagado, nada de réplica", () => {
    const sql = semComentarios(CORRECAO);
    expect(sql).toMatch(
      /update public\."TB_CANDIDATO_APROVADO" c\s+set status = t\.status_novo,\s+matricula = t\.matricula_nova,/,
    );
    expect(sql).toMatch(/insert into public\."TH_CANDIDATO_APROVADO"\(/);
    expect(sql.indexOf('insert into public."TH_CANDIDATO_APROVADO"')).toBeLessThan(
      sql.indexOf('update public."TB_CANDIDATO_APROVADO" c'),
    );
    expect(sql).toContain('private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"');
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bdrop\s+(table|function|view)\b/i);
    expect(sql).not.toMatch(/session_replication_role|disable trigger/i);
  });

  it("só usa os status permitidos e a parte 2 só em edital encerrado", () => {
    const status = [...CORRECAO.matchAll(/::uuid, (\d), '([^']+)'/g)];
    expect(status.length).toBeGreaterThan(700);
    for (const [, parte, novo] of status) {
      if (parte === "1") expect(novo).toBe("Contratado");
      if (parte === "2") expect(novo).toBe("Contratado em outra lista");
      if (parte === "3") expect(["Contratado", "Migração"]).toContain(novo);
    }
    expect(CORRECAO).toContain("Uma linha da parte 2 é de edital aberto: nada foi gravado.");
    expect(CORRECAO).toContain('private."FC_VENCIMENTO_DO_EDITAL"');
  });

  it("deixa o edital 114/2026 de fora e confere que ele não mudou", () => {
    expect(CORRECAO).toContain(`and l.edital_id is distinct from '${EDITAL_114}'`);
    expect(CORRECAO).toContain("O edital 114/2026 mudou: nada foi gravado.");
  });

  it("assina pela conta do setor (admin global ativo, auth.uid, updated_by e histórico)", () => {
    expect(CORRECAO).toContain(`p.user_id = '${CONTA_DO_SETOR}'`);
    expect(CORRECAO).toContain('a."ST_ADMIN_GLOBAL"');
    expect(CORRECAO).toContain(`'{"sub":"${CONTA_DO_SETOR}","role":"authenticated"}'`);
    expect(CORRECAO).toContain(`updated_by = '${CONTA_DO_SETOR}'`);
    expect(CORRECAO).toContain(`t.matricula_nova, '${CONTA_DO_SETOR}', c."DT_CONVOCACAO"`);
  });

  it("não traz CPF", () => {
    expect(CORRECAO).not.toMatch(/cpf/i);
    expect(ENSAIO).not.toMatch(/cpf/i);
    expect(CORRECAO).not.toMatch(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
  });

  it("o ensaio é cópia literal do corpo e termina em ENSAIO_OK + rollback, sem commit", () => {
    const corpo = entreMarcadores(CORRECAO, "correcao");
    expect(corpo.length).toBeGreaterThan(1000);
    expect(entreMarcadores(ENSAIO, "correcao")).toBe(corpo);
    const sql = semComentarios(ENSAIO);
    expect(sql).toMatch(/^\s*begin;/);
    expect(sql).not.toMatch(/\bcommit;/);
    expect(sql).toContain("raise exception 'ENSAIO_OK");
    expect(sql.trimEnd().endsWith("rollback;")).toBe(true);
    expect(CORRECAO.trimEnd().endsWith("commit;")).toBe(true);
  });
});

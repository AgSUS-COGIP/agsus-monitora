import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { limparModalidade } from "../src/lib/aprovados-import.ts";

/*
  Correção 20261103-modalidade-sem-aspas: a modalidade dos aprovados gravada
  com aspas pela importação do XLSX fica sem aspas, com a mesma regra da fonte
  (limparModalidade), assinada pela conta do setor e sem tocar no edital
  114/2026. O ensaio begin…rollback rodou no banco em 03/11/2026 (26.838
  linhas → 0 com aspas); aqui, as invariantes estáticas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261103-modalidade-sem-aspas.sql";
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
  it("só limpa a modalidade: nada apagado, nada de réplica", () => {
    const sql = semComentarios(CORRECAO);
    expect(sql).toMatch(
      /update public\."TB_CANDIDATO_APROVADO" c\s+set modalidade = t\.nova,/,
    );
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bdrop\s+(table|function|view)\b/i);
    expect(sql).not.toMatch(/session_replication_role|disable trigger/i);
  });

  it("deixa o edital 114/2026 de fora e confere que ele não mudou", () => {
    expect(CORRECAO).toContain(
      `and l.edital_id is distinct from '${EDITAL_114}';`,
    );
    expect(CORRECAO).toContain("O edital 114/2026 mudou: nada foi gravado.");
  });

  it("assina pela conta do setor (admin global ativo, auth.uid e updated_by)", () => {
    expect(CORRECAO).toContain(`p.user_id = '${CONTA_DO_SETOR}'`);
    expect(CORRECAO).toContain('a."ST_ADMIN_GLOBAL"');
    expect(CORRECAO).toContain(
      `'{"sub":"${CONTA_DO_SETOR}","role":"authenticated"}'`,
    );
    expect(CORRECAO).toContain(`updated_by = '${CONTA_DO_SETOR}'`);
  });

  it("a regra do SQL é a de limparModalidade (fonte)", () => {
    expect(CORRECAO).toContain(
      `regexp_replace(regexp_replace(p, '["“”]\\s*[,;]?\\s*["“”]', ';', 'g'), '["“”]', '', 'g')`,
    );
    expect(CORRECAO).toContain("'; ') end;");
    expect(limparModalidade('"Ampla concorrência", "Pretos e pardos"')).toBe(
      "Ampla concorrência; Pretos e pardos",
    );
  });

  it("o ensaio é cópia literal do corpo e termina em rollback, sem commit", () => {
    const corpo = entreMarcadores(CORRECAO, "correcao");
    expect(corpo.length).toBeGreaterThan(1000);
    expect(entreMarcadores(ENSAIO, "correcao")).toBe(corpo);
    const sql = semComentarios(ENSAIO);
    expect(sql).toMatch(/^\s*begin;/);
    expect(sql).not.toMatch(/\bcommit;/);
    expect(sql.trimEnd().endsWith("rollback;")).toBe(true);
    expect(CORRECAO.trimEnd().endsWith("commit;")).toBe(true);
  });
});

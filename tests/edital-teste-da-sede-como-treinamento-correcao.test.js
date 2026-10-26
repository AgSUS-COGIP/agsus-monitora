import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Correção 20261026-edital-teste-da-sede-como-treinamento: o edital "Teste"
  da SEDE ganha a marca de treinamento ("ST_TREINAMENTO" = 'S'), sem apagar
  dados, assinada pela conta do setor. O ensaio begin…rollback rodou no banco
  em 26/10/2026; aqui, as invariantes estáticas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261026-edital-teste-da-sede-como-treinamento.sql";
const CORRECAO = ler(`supabase/correcoes/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const CONTA_DO_SETOR = "a01afddb-f64b-47d9-80e8-476a1ed14e43";
const EDITAL = "317709c7-e5a5-4333-b2f2-ef0a8cfb8c12";

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
  it("usa o mecanismo do treinamento: só a marca, nada apagado", () => {
    const sql = semComentarios(CORRECAO);
    expect(sql).toContain(`set "ST_TREINAMENTO" = 'S'`);
    expect(sql).toContain(`where id = '${EDITAL}'`);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bdrop\s+(table|function|view)\b/i);
    expect(sql).not.toMatch(/reiniciar_edital_treinamento|FC_APAGAR_DADOS_DO_TREINAMENTO/);
    expect(sql).not.toMatch(/session_replication_role|disable trigger/i);
  });

  it("confere o edital pelo nome e pela área antes de gravar", () => {
    expect(CORRECAO).toContain(`v_m.edital is distinct from 'Teste'`);
    expect(CORRECAO).toContain(`v_m."CO_AREA" is distinct from 'sede'`);
    expect(CORRECAO).toContain("nada foi gravado");
  });

  it("assina pela conta do setor (admin global ativo, auth.uid e updated_by)", () => {
    expect(CORRECAO).toContain(`p.user_id = '${CONTA_DO_SETOR}'`);
    expect(CORRECAO).toContain('a."ST_ADMIN_GLOBAL"');
    expect(CORRECAO).toContain(
      `'{"sub":"${CONTA_DO_SETOR}","role":"authenticated"}'`,
    );
    expect(CORRECAO).toContain(`updated_by = '${CONTA_DO_SETOR}'`);
    expect(CORRECAO).toContain(`h.usuario_id = '${CONTA_DO_SETOR}'`);
  });

  it("marca o cache da SEDE e mede antes e depois", () => {
    expect(CORRECAO).toContain(
      `private."FC_MARCAR_CACHE"(array['APROVADOS', 'ENTREVISTAS'], array['sede']`,
    );
    const contagens = CORRECAO.split("-- >>> contagens\n").length - 1;
    expect(contagens).toBe(2);
    const blocos = CORRECAO.split("-- >>> contagens\n")
      .slice(1)
      .map((t) => t.slice(0, t.indexOf("-- <<< contagens\n")));
    expect(blocos[0]).toBe(blocos[1]);
  });

  it("o ensaio é cópia literal do corpo e termina em rollback, sem commit", () => {
    const corpo = entreMarcadores(CORRECAO, "correcao");
    expect(corpo.length).toBeGreaterThan(1000);
    expect(entreMarcadores(ENSAIO, "correcao")).toBe(corpo);
    const sql = semComentarios(ENSAIO);
    expect(sql).toMatch(/^\s*begin;/);
    expect(sql).not.toMatch(/\bcommit;/);
    expect(sql.indexOf("\nrollback;\n")).toBeGreaterThan(
      sql.indexOf("from tmp_contagens_sede a"),
    );
    expect(CORRECAO.trimEnd().endsWith("commit;")).toBe(true);
  });
});

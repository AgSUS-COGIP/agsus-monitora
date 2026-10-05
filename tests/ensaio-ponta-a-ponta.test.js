import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  O ensaio de ponta a ponta (supabase/ensaios/ponta-a-ponta.sql) roda no banco
  de produção: tem de abrir a transação, terminar em rollback e nunca ter
  commit — senão os dados sintéticos ficariam gravados.
*/
const ENSAIO = readFileSync("supabase/ensaios/ponta-a-ponta.sql", "utf8").replace(/\r\n/g, "\n");

// O SQL sem comentários de bloco e de linha (os textos entre aspas ficam).
const semComentarios = ENSAIO.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const comandos = semComentarios
  .split("\n")
  .map((linha) => linha.trim())
  .filter(Boolean);

describe("ensaio de ponta a ponta", () => {
  it("abre com begin e termina em rollback", () => {
    expect(comandos[0]).toMatch(/^begin;$/i);
    expect(comandos.at(-1)).toMatch(/^rollback;$/i);
  });

  it("não tem commit nem outro fim de transação no meio", () => {
    expect(semComentarios).not.toMatch(/\bcommit\b/i);
    expect(semComentarios).not.toMatch(/\bend\s+(transaction|work)\b/i);
    expect(comandos.filter((c) => /^rollback\b/i.test(c))).toHaveLength(1);
    expect(comandos.filter((c) => /^begin;$/i.test(c))).toHaveLength(1);
  });

  it("não aplica DDL fora das funções do próprio ensaio", () => {
    const ddl = semComentarios.match(/^\s*(create|alter|drop)\s+\w+/gim) || [];
    expect(ddl.map((c) => c.trim().toLowerCase())).toEqual(["create function", "create function"]);
    expect(semComentarios).toMatch(/create function public\."FC_ENSAIO_P2P_RETRATO"/);
  });

  it("usa só dados sintéticos e termina com ENSAIO OK", () => {
    expect(semComentarios).toContain("'ENSAIO OK (tudo será desfeito)'");
    const emails = semComentarios.match(/[\w.+-]+@[\w.-]+\.[a-z]+/gi) || [];
    expect(emails.length).toBeGreaterThan(0);
    for (const email of emails) expect(email).toMatch(/@ensaio\.invalid$/);
  });
});

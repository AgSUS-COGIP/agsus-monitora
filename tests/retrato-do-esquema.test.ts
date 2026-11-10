import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ARQUIVO_DO_RETRATO,
  CABECALHO,
  limparDump,
  montarRetrato,
  tarefasComoSql,
} from "../scripts/gerar-esquema-atual.mjs";

/*
  O retrato do schema (supabase/esquema-atual.sql): o código vigente do banco, só leitura,
  gerado por `npm run db:esquema` depois de cada migration aplicada.
*/
const DUMP = [
  "--",
  "-- PostgreSQL database dump",
  "--",
  "\\restrict AbC123aleatorio",
  "-- Dumped from database version 17.4",
  "-- Dumped by pg_dump version 17.6",
  "SET statement_timeout = 0;",
  "",
  "",
  "",
  'CREATE FUNCTION private."FC_X"() RETURNS integer',
  "    LANGUAGE sql AS $$ select 1 $$;",
  "\\unrestrict AbC123aleatorio",
  "",
].join("\r\n");

describe("limparDump", () => {
  it("tira o que muda a cada execução sem mudança no banco", () => {
    const limpo = limparDump(DUMP);
    expect(limpo).not.toMatch(/restrict|Dumped (from|by)|\r/);
    expect(limpo).toContain('CREATE FUNCTION private."FC_X"()');
    expect(limpo).toContain("SET statement_timeout = 0;");
    expect(limpo).not.toMatch(/\n{3,}/);
  });

  it("duas execuções com chaves de \\restrict diferentes dão o mesmo retrato", () => {
    const outra = DUMP.replace(/AbC123aleatorio/g, "Zz9outra").replace(
      "17.6",
      "17.7",
    );
    expect(limparDump(outra)).toBe(limparDump(DUMP));
  });
});

describe("tarefas do pg_cron", () => {
  it("em ordem de nome, uma por linha, com o comando numa linha só", () => {
    expect(
      tarefasComoSql([
        {
          nome: "b",
          agenda: "0 9 * * *",
          ativa: false,
          comando: "select\n  2;",
        },
        { nome: "a", agenda: "*/5 * * * *", ativa: true, comando: "select 1;" },
      ]),
    ).toBe(
      [
        "-- Tarefas do pg_cron (cron.job), em ordem de nome: nome | agenda | ativa | comando.",
        "-- a | */5 * * * * | ativa | select 1;",
        "-- b | 0 9 * * * | parada | select 2;",
      ].join("\n"),
    );
  });

  it("o retrato começa pelo aviso de não aplicar", () => {
    const retrato = montarRetrato(DUMP, []);
    expect(retrato.startsWith(CABECALHO)).toBe(true);
    expect(CABECALHO).toContain("NÃO APLICAR");
    expect(retrato.endsWith("\n")).toBe(true);
  });
});

describe.runIf(existsSync(ARQUIVO_DO_RETRATO))("o retrato gravado", () => {
  const texto = existsSync(ARQUIVO_DO_RETRATO)
    ? readFileSync(ARQUIVO_DO_RETRATO, "utf8")
    : "";

  it("veio do script (cabeçalho, sem a chave de \\restrict nem a versão)", () => {
    expect(texto.startsWith(CABECALHO)).toBe(true);
    expect(texto).not.toMatch(/^\\(un)?restrict\b|^-- Dumped (from|by)/m);
  });

  it("não traz credencial", () => {
    expect(texto).not.toMatch(/postgres(ql)?:\/\/[^\s'"]*@/);
    expect(texto).not.toMatch(/\bghp_[A-Za-z0-9]{20,}|\bsb_secret_/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Os dados do chat saem do sistema para o schema arquivo (nunca DROP). */
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const MIGRATION = ler(
  "supabase/migrations/20261014161000_arquivar_os_dados_do_chat.sql",
);
const ROLLBACK = ler(
  "supabase/rollback/20261014161000_arquivar_os_dados_do_chat.sql",
);
const TABELAS = [
  "RL_CONVERSA_PARTICIPANTE",
  "RL_MENSAGEM_REACAO",
  "TB_ANEXO_MENSAGEM",
  "TB_CONVERSA",
  "TB_MENSAGEM",
  "TH_LIMPEZA_CHAT",
];

describe("arquivar os dados do chat", () => {
  it("move as tabelas para arquivo e tira o acesso", () => {
    for (const t of TABELAS) {
      expect(MIGRATION).toContain(
        `alter table public."${t}" set schema arquivo;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on arquivo."${t}" from public, anon, authenticated;`,
      );
    }
  });
  it("não apaga dado", () => {
    expect(MIGRATION).not.toMatch(/\b(drop table|delete from|truncate)\b/i);
  });
  it("o rollback devolve ao public", () => {
    for (const t of TABELAS)
      expect(ROLLBACK).toContain(
        `alter table arquivo."${t}" set schema public;`,
      );
  });
});

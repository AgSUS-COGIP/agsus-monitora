import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Foto do Google no perfil (20261005200000): o banco copia a foto do login para
  google_avatar_url — no sinal de presença, ao ligar o perfil e uma vez para
  quem já entrou —, sem gatilho em auth.users (o Supabase recusa) e sem mexer
  na escolha de avatar.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261005200000_foto_do_google_no_perfil.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

describe("migration da foto do Google no perfil", () => {
  it("só aceita https e não põe gatilho em auth.users", () => {
    expect(MIGRATION).toContain("u ~* '^https://'");
    expect(MIGRATION).not.toMatch(/create trigger[^;]+on auth\.users/i);
  });

  it("o sinal de presença copia a foto só quando mudou e mantém o resto do corpo", () => {
    expect(MIGRATION).toContain(
      "create or replace function public.registrar_presenca_monitora(",
    );
    expect(MIGRATION).toContain(
      "and p.google_avatar_url is distinct from v_foto;",
    );
    expect(MIGRATION).toContain(
      'insert into public."TB_PRESENCA_ONLINE_MONITORA" (user_id, current_view, seen_at)',
    );
  });

  it("não mexe na escolha de avatar (avatar_source / avatar_url)", () => {
    expect(MIGRATION).not.toMatch(/set\s+avatar_source/i);
    expect(MIGRATION).not.toMatch(/(^|[^_])avatar_url\s*=\s*v_foto/im);
  });

  it("o rollback volta a presença sem a foto antes de tirar as funções", () => {
    const volta = ROLLBACK.indexOf(
      "create or replace function public.registrar_presenca_monitora(",
    );
    const tira = ROLLBACK.indexOf(
      'drop function if exists private."FC_FOTO_DO_GOOGLE"(jsonb);',
    );
    expect(volta).toBeGreaterThan(-1);
    expect(tira).toBeGreaterThan(volta);
    expect(ROLLBACK.slice(volta, tira)).not.toContain("FC_FOTO_DO_GOOGLE");
  });
});

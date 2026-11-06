import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";
import {
  INTERVALO_DA_PRESENCA_MS,
  ONLINE_NO_BANCO_MS,
} from "../src/app/presenca.ts";

/*
  Presença enxuta (20261103230000): a batida a cada 150 s vai por uma chamada
  só, registrar_navegacao_monitora, com os eventos de carona (p_eventos) e a
  lista de "Pessoas online" (p_listar); "online" passa de 4 a 6 min. O ensaio
  (begin…rollback, em 03/11/2026, como administrador global, Gestor e pessoa
  comum) conferiu: a lista da batida igual à de listar_presenca_online_monitora,
  pessoas_erro 42501 para a pessoa comum com a presença gravada, a chamada
  pelos nove nomes de antes aceita, o evento de carona com a origem, a aba e a
  versão de quem o mandou, online a 5 min e fora a 7 min, uma função só com o
  nome e anon sem execute. Invariantes estáticas abaixo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261103230000_presenca_enxuta.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ASSINATURA =
  "public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text, jsonb, boolean)";
const ANTIGA =
  "public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text)";

describe("presença enxuta (migration)", () => {
  it("online por 6 min: duas batidas de 150 s e um minuto de folga", () => {
    expect(MIGRATION).toContain("interval '6 minutes'");
    expect(MIGRATION).not.toContain("interval '4 minutes'");
    expect(ONLINE_NO_BANCO_MS).toBe(6 * 60_000);
    expect(ONLINE_NO_BANCO_MS - 2 * INTERVALO_DA_PRESENCA_MS).toBe(60_000);
  });

  it("a lista continua só para administrador global e Gestor", () => {
    expect(MIGRATION).toContain("private.is_master()");
    expect(MIGRATION).toContain("= 'edital_gestor'");
    expect(MIGRATION).toContain("using errcode = '42501'");
  });

  it("troca a função de nove parâmetros pela de onze, com os novos opcionais", () => {
    expect(MIGRATION).toContain(`drop function if exists ${ANTIGA};`);
    expect(MIGRATION).toContain("p_eventos jsonb default null,");
    expect(MIGRATION).toContain("p_listar boolean default false");
    expect(MIGRATION).toContain(
      `revoke all on function ${ASSINATURA} from public, anon;`,
    );
    expect(MIGRATION.match(/^grant .*$/gm)).toEqual([
      `grant execute on function ${ASSINATURA} to authenticated;`,
    ]);
    expect(MIGRATION).toMatch(
      /security invoker\n set search_path to ''\n set statement_timeout to '3s'/,
    );
  });

  it("carona limitada a 10 eventos; nenhum recusado desfaz a presença; lista em pessoas/pessoas_erro", () => {
    expect(MIGRATION).toContain("where t.n <= 10");
    expect(MIGRATION).toContain(
      "'pessoas', public.listar_presenca_online_monitora()",
    );
    expect(MIGRATION).toContain("'pessoas_erro'");
    expect(MIGRATION).toContain("'presenca_erro'");
  });

  it("o contrato tem os onze argumentos, os nove de antes na mesma ordem", () => {
    expect(CONTRATO_RPC.registrar_navegacao_monitora.argumentos).toEqual([
      "p_evento",
      "p_tela",
      "p_detalhes",
      "p_client_session_id",
      "p_user_agent",
      "p_app_version",
      "p_origem",
      "p_presenca",
      "p_current_view",
      "p_eventos",
      "p_listar",
    ]);
  });

  it("rollback volta a função de nove e os 4 min; ensaio sempre desfeito e sem carga em lote", () => {
    expect(ROLLBACK).toContain(`drop function if exists ${ASSINATURA};`);
    expect(ROLLBACK).toContain(
      `grant execute on function ${ANTIGA} to authenticated;`,
    );
    expect(ROLLBACK).toContain("interval '4 minutes'");
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toContain("TM_MANIFESTO_ANALISE");
  });
});

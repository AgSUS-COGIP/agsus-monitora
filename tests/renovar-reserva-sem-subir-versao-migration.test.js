import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Renovar a reserva vencida subia NU_VERSAO (FC_RESERVAR_FICHA) e a ficha
  aberta, com a versão de antes, dava "Esta ficha mudou…" no próximo
  rascunho. A migration 20261022130000 re-reserva para o mesmo responsável
  sem subir a versão (só PENDENTE → EM_ANALISE sobe); FC_RESERVAR_FICHA não
  muda. Ensaio begin…rollback e rollback com o mesmo nome.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261022130000_renovar_reserva_sem_subir_versao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261016160000_conflito_de_versao_sem_repeticao.sql",
);

const corpoDaRenovacao = (texto) => {
  const inicio = texto.search(
    /create or replace function public\.renovar_reserva\(p_ficha uuid\)/i,
  );
  expect(inicio).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};

describe("migration: renovar a reserva vencida sem subir a versão", () => {
  const corpo = corpoDaRenovacao(MIGRATION);

  it("a re-reserva não passa mais por FC_RESERVAR_FICHA e só sobe a versão de PENDENTE", () => {
    expect(corpo).not.toContain('"FC_RESERVAR_FICHA"');
    expect(corpo).toContain(
      `"NU_VERSAO" = "NU_VERSAO" + case when "TP_SITUACAO" = 'PENDENTE' then 1 else 0 end`,
    );
    expect(corpo).toContain(
      `perform private."FC_HISTORICO_FICHA"(p_ficha, 'RESERVAR'`,
    );
  });

  it("as condições e os erros são os de antes (o front de hoje segue igual)", () => {
    const antes = corpoDaRenovacao(ANTERIOR);
    for (const trecho of [
      `if v_f."CO_USUARIO_RESERVA" = v_uid and v_f."DT_RESERVA_EXPIRA" > now() then`,
      `and v_f."CO_USUARIO_RESPONSAVEL" = v_uid and v_f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE')`,
      `errcode = 'PT409'`,
      `return json_build_object('ficha', private."FC_FICHA_ANALISE_JSON"(p_ficha));`,
    ]) {
      expect(antes).toContain(trecho);
      expect(corpo).toContain(trecho);
    }
    expect(MIGRATION).toMatch(/security definer\s+set search_path to ''/i);
    expect(MIGRATION).not.toMatch(/FUNCTION private\."FC_RESERVAR_FICHA"/i);
  });

  it("ensaio termina em rollback e confere os quatro casos; rollback volta a definição anterior", () => {
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    for (const caso of [
      "1. vencida",
      "2. em dia",
      "3. pendente",
      "4. conflito real",
    ])
      expect(ENSAIO).toContain(caso);
    expect(corpoDaRenovacao(ROLLBACK)).toBe(corpoDaRenovacao(ANTERIOR));
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACOES_DO_PARECER,
  acoesDoParecer,
  aguardandoParecer,
  avaliarAcaoDoParecer,
  erroDoTextoDoParecer,
  proximaSituacao,
} from "../src/lib/parecer-do-recurso.js";
import { SITUACOES } from "../src/lib/recursos-dos-candidatos.ts";

/*
  O fluxo do parecer jurídico sem DOM — espelho de
  transicionar_recurso_candidato (20261001170000_recursos_parecer_juridico.sql).
*/
const MIGRATION = readFileSync(
  "supabase/migrations/20261001170000_recursos_parecer_juridico.sql",
  "utf8",
).replace(/\r\n/g, "\n");

describe("estados e transições", () => {
  it("as situações e as ações são as do banco", () => {
    const situacoes = MIGRATION.match(
      /add constraint "CK_RECURSOCANDIDATO_TPSITUACAO" check \(\s*"TP_SITUACAO" in \(([^)]*)\)/,
    )[1];
    expect(
      [...situacoes.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort(),
    ).toEqual(SITUACOES.map((s) => s.id).sort());
    const inicio = MIGRATION.indexOf(
      "create function public.transicionar_recurso_candidato(",
    );
    const acoes = MIGRATION.slice(inicio).match(/p_acao not in \(([^)]*)\)/)[1];
    expect([...acoes.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual(
      Object.keys(ACOES_DO_PARECER).sort(),
    );
  });

  it.each([
    ["REGISTRADO", "enviar_parecer", "EM_ANALISE_JURIDICA"],
    ["EM_ANALISE_JURIDICA", "devolver", "REGISTRADO"],
    ["EM_ANALISE_JURIDICA", "deferir", "DEFERIDO"],
    ["EM_ANALISE_JURIDICA", "deferir_parcialmente", "PARCIALMENTE_INDEFERIDO"],
    ["EM_ANALISE_JURIDICA", "indeferir", "INDEFERIDO"],
    ["DEFERIDO", "reabrir", "EM_ANALISE_JURIDICA"],
    ["INDEFERIDO", "reabrir", "EM_ANALISE_JURIDICA"],
    // Inválidas: decidir sem passar pelo jurídico, reenviar, reabrir sem decisão.
    ["REGISTRADO", "deferir", null],
    ["REGISTRADO", "devolver", null],
    ["EM_ANALISE_JURIDICA", "enviar_parecer", null],
    ["DEFERIDO", "indeferir", null],
    ["REGISTRADO", "reabrir", null],
    ["EM_ANALISE_JURIDICA", "reabrir", null],
    ["REGISTRADO", "inventada", null],
  ])("%s --%s--> %s", (de, acao, para) => {
    expect(proximaSituacao(de, acao)).toBe(para);
  });
});

describe("quem vê cada botão", () => {
  const editor = { podeEditar: true, podeDecidir: false };
  const juridico = { podeEditar: true, podeDecidir: true };
  const acoes = (situacao, quem, extra = {}) =>
    acoesDoParecer({ situacao, ...quem, ...extra }).map((a) => a.acao);

  it("quem edita só envia para parecer; não vê decidir, devolver nem reabrir", () => {
    expect(acoes("REGISTRADO", editor)).toEqual(["enviar_parecer"]);
    expect(acoes("EM_ANALISE_JURIDICA", editor)).toEqual([]);
    expect(acoes("DEFERIDO", editor)).toEqual([]);
    expect(aguardandoParecer("EM_ANALISE_JURIDICA", false)).toBe(true);
    expect(
      avaliarAcaoDoParecer("deferir", {
        situacao: "EM_ANALISE_JURIDICA",
        ...editor,
      }),
    ).toEqual({ permitida: false, motivo: "Sem permissão." });
  });

  it("o jurídico decide, devolve e reabre; quem só lê não vê nada", () => {
    expect(acoes("EM_ANALISE_JURIDICA", juridico)).toEqual([
      "deferir",
      "deferir_parcialmente",
      "indeferir",
      "devolver",
    ]);
    expect(acoes("INDEFERIDO", juridico)).toEqual(["reabrir"]);
    expect(aguardandoParecer("EM_ANALISE_JURIDICA", true)).toBe(false);
    expect(
      acoes("EM_ANALISE_JURIDICA", { podeEditar: false, podeDecidir: false }),
    ).toEqual([]);
    expect(
      acoes("REGISTRADO", { podeEditar: false, podeDecidir: false }),
    ).toEqual([]);
  });

  it("com a resposta enviada, reabrir aparece desligado, com o motivo", () => {
    const [reabrir] = acoesDoParecer({
      situacao: "DEFERIDO",
      ...juridico,
      respostaEnviada: true,
    });
    expect(reabrir).toMatchObject({
      acao: "reabrir",
      permitida: false,
      motivo: "A resposta já foi enviada ao candidato.",
    });
  });
});

describe("textos", () => {
  it("decidir exige parecer (10 a 20.000); devolver e reabrir, motivo; enviar, opcional", () => {
    expect(erroDoTextoDoParecer("deferir", "curto")).toMatch(/parecer/);
    expect(erroDoTextoDoParecer("indeferir", "x".repeat(10))).toBe("");
    expect(erroDoTextoDoParecer("deferir", "x".repeat(20001))).toMatch(
      /20.000/,
    );
    expect(erroDoTextoDoParecer("devolver", " ")).toBe(
      "Diga o que precisa ser ajustado.",
    );
    expect(erroDoTextoDoParecer("reabrir", "ok")).toBe("Informe o motivo.");
    expect(erroDoTextoDoParecer("enviar_parecer", "")).toBe("");
  });
});

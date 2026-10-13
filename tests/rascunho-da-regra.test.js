import { describe, expect, it } from "vitest";
import {
  chaveDoRascunhoLocal,
  dataEHoraCurtas,
  escolherRascunho,
  rascunhoDoBanco,
  rascunhoDoLocal,
  rascunhoParaLocal,
  recuperacaoDoRascunho,
  textoDaGravacao,
} from "../src/lib/rascunho-da-regra.ts";

/* Regras puras do rascunho guardado das regras (src/lib/rascunho-da-regra.ts). TZ=UTC. */

const DO_BANCO = {
  conteudo: { regra: { titulo_etapa: "X" } },
  versao_base: 2,
  atualizado_em: "2026-10-13T14:05:00+00:00",
};

describe("formato", () => {
  it("lê a resposta do banco e recusa o estranho", () => {
    expect(rascunhoDoBanco(DO_BANCO)).toEqual({
      conteudo: { regra: { titulo_etapa: "X" } },
      versaoBase: 2,
      atualizadoEm: "2026-10-13T14:05:00.000Z",
      local: false,
    });
    expect(rascunhoDoBanco(null)).toBeNull();
    expect(rascunhoDoBanco({ ...DO_BANCO, conteudo: [1] })).toBeNull();
    expect(rascunhoDoBanco({ ...DO_BANCO, versao_base: -1 })).toBeNull();
    expect(rascunhoDoBanco({ ...DO_BANCO, atualizado_em: "ontem" })).toBeNull();
  });

  it("ida e volta da cópia local; texto estragado = nada", () => {
    const r = { ...rascunhoDoBanco(DO_BANCO), local: true };
    expect(rascunhoDoLocal(rascunhoParaLocal(r))).toEqual(r);
    expect(rascunhoDoLocal("{")).toBeNull();
    expect(rascunhoDoLocal(null)).toBeNull();
  });

  it("chave por tipo, edital e pessoa", () => {
    expect(chaveDoRascunhoLocal("ANALISE", "e1", "u1")).not.toBe(
      chaveDoRascunhoLocal("CLASSIFICACAO", "e1", "u1"),
    );
    expect(chaveDoRascunhoLocal("ANALISE", "e1", "u1")).not.toBe(
      chaveDoRascunhoLocal("ANALISE", "e1", "u2"),
    );
  });
});

describe("qual vale ao abrir", () => {
  const banco = rascunhoDoBanco(DO_BANCO);
  const local = (iso, ehLocal = true) => ({
    ...banco,
    atualizadoEm: iso,
    local: ehLocal,
  });

  it("a cópia local não enviada e mais nova ganha; a mais velha perde", () => {
    expect(escolherRascunho(banco, local("2026-10-13T15:00:00.000Z"))).toEqual(
      local("2026-10-13T15:00:00.000Z"),
    );
    expect(escolherRascunho(banco, local("2026-10-13T13:00:00.000Z"))).toBe(
      banco,
    );
    expect(escolherRascunho(null, local("2026-10-13T13:00:00.000Z"))).toEqual(
      local("2026-10-13T13:00:00.000Z"),
    );
    expect(escolherRascunho(null, null)).toBeNull();
  });
});

describe("aviso e indicador", () => {
  it("diz quando e se a vigente mudou desde o rascunho", () => {
    const r = rascunhoDoBanco(DO_BANCO);
    expect(recuperacaoDoRascunho(r, 2)).toEqual({
      quando: "13/10 14:05",
      versaoBase: 2,
      versaoMudou: false,
    });
    expect(recuperacaoDoRascunho(r, 3).versaoMudou).toBe(true);
    expect(dataEHoraCurtas("x")).toBe("");
  });

  it("textos discretos", () => {
    expect(textoDaGravacao("guardado", "2026-10-13T14:05:00.000Z")).toBe(
      "Rascunho guardado às 14:05",
    );
    expect(textoDaGravacao("guardando", null)).toBe("Guardando…");
    expect(textoDaGravacao("local", null)).toBe(
      "Sem conexão — guardado neste computador",
    );
    expect(textoDaGravacao("ocioso", null)).toBe("");
  });
});

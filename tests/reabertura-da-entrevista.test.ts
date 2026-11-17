import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  entrevistaConcluida,
  MOTIVOS_DA_REABERTURA_DA_ENTREVISTA,
  podeConcluirAEntrevista,
  validarReaberturaDaEntrevista,
} from "../src/lib/reabertura-da-entrevista.ts";

/*
  Concluir e reabrir a entrevista (20261117050000): a lista de motivos da
  tela é a mesma do banco (private."FC_MOTIVO_REABERTURA_ENTREVISTA", lida no
  retrato de produção), as regras do texto são as da Avaliação documental e o
  Concluir só aparece com o resultado definido e tudo salvo.
*/

const RETRATO = "supabase/esquema-atual.sql";

describe("motivos da reabertura da entrevista", () => {
  it("a lista da tela é a do banco (códigos, rótulos e ordem)", () => {
    const sql = readFileSync(RETRATO, "utf8");
    const corpo = sql.slice(
      sql.indexOf('CREATE FUNCTION private."FC_MOTIVO_REABERTURA_ENTREVISTA"'),
    );
    const doBanco = [
      ...corpo
        .slice(0, corpo.indexOf("end;"))
        .matchAll(/when '([A-Z_]+)' then '([^']+)'/g),
    ].map(([, codigo, rotulo]) => ({ codigo, rotulo }));
    expect(doBanco.length).toBeGreaterThan(0);
    expect(
      MOTIVOS_DA_REABERTURA_DA_ENTREVISTA.map(({ codigo, rotulo }) => ({
        codigo,
        rotulo,
      })),
    ).toEqual(doBanco);
  });

  it("motivo obrigatório; complemento opcional; Outro pede a descrição", () => {
    expect(validarReaberturaDaEntrevista("", "")).toMatchObject({
      ok: false,
      campo: "motivo",
    });
    expect(validarReaberturaDaEntrevista("DOCUMENTO_NOVO", "")).toMatchObject({
      ok: false,
      campo: "motivo",
    });
    expect(validarReaberturaDaEntrevista("NOTA", "")).toEqual({
      ok: true,
      argumentos: { p_motivo: "NOTA", p_complemento: null },
      texto: "Correção de nota",
    });
    expect(
      validarReaberturaDaEntrevista("RECURSO", " recurso 12 deferido "),
    ).toEqual({
      ok: true,
      argumentos: { p_motivo: "RECURSO", p_complemento: "recurso 12 deferido" },
      texto: "Recurso deferido — recurso 12 deferido",
    });
    expect(validarReaberturaDaEntrevista("OUTRO", "curto")).toMatchObject({
      ok: false,
      campo: "complemento",
    });
    expect(
      validarReaberturaDaEntrevista("OUTRO", "pedido da banca para revisar"),
    ).toMatchObject({
      ok: true,
      texto: "Outro — pedido da banca para revisar",
    });
  });
});

describe("concluir a entrevista", () => {
  const pronta = {
    podeEditar: true,
    concluida: false,
    sujo: false,
    pendencia: "",
    compareceu: "S",
  };

  it("só com o resultado definido, tudo salvo e quem edita", () => {
    expect(podeConcluirAEntrevista(pronta)).toBe(true);
    expect(podeConcluirAEntrevista({ ...pronta, compareceu: "N" })).toBe(true);
    expect(podeConcluirAEntrevista({ ...pronta, podeEditar: false })).toBe(
      false,
    );
    expect(podeConcluirAEntrevista({ ...pronta, concluida: true })).toBe(false);
    expect(podeConcluirAEntrevista({ ...pronta, sujo: true })).toBe(false);
    expect(
      podeConcluirAEntrevista({ ...pronta, pendencia: "falta 1 nota" }),
    ).toBe(false);
    expect(podeConcluirAEntrevista({ ...pronta, compareceu: null })).toBe(
      false,
    );
  });

  it("concluída é quem tem a data da conclusão", () => {
    expect(entrevistaConcluida({ concluida_em: "2026-11-17T12:00:00Z" })).toBe(
      true,
    );
    expect(entrevistaConcluida({ concluida_em: null })).toBe(false);
    expect(entrevistaConcluida(null)).toBe(false);
  });
});

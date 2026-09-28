import { describe, expect, it } from "vitest";
import {
  apagarRascunho,
  chaveDoRascunho,
  estadoComparavel,
  guardarRascunho,
  horaDoRascunho,
  lerRascunho,
  usuarioDoPerfil,
} from "../../src/lib/rascunho-do-edital.js";

/* Rascunho do formulário do edital no navegador: chave, validade e falhas do armazenamento. */

function armazenamentoFalso() {
  const dados = new Map();
  return {
    getItem: (chave) => (dados.has(chave) ? dados.get(chave) : null),
    setItem: (chave, valor) => dados.set(chave, String(valor)),
    removeItem: (chave) => dados.delete(chave),
    dados,
  };
}

const HOJE = new Date(2026, 8, 28, 14, 32);

describe("rascunho do edital", () => {
  it("a chave separa usuário, edital e, no edital novo, a área", () => {
    expect(chaveDoRascunho({ usuario: "u1", id: "7" })).toBe(
      "agsus_monitora_rascunho_edital_v1:u1:edital-7",
    );
    expect(chaveDoRascunho({ usuario: "u1", id: "", area: "sede" })).toBe(
      "agsus_monitora_rascunho_edital_v1:u1:novo-sede",
    );
    expect(usuarioDoPerfil({ user_id: "abc", email: "A@x" })).toBe("abc");
    expect(usuarioDoPerfil({ email: "Ana@Agsus" })).toBe("ana@agsus");
    expect(usuarioDoPerfil(null)).toBe("anonimo");
  });

  it("guarda, lê e apaga só o formulário e as partes editáveis do cronograma", () => {
    const armazenamento = armazenamentoFalso();
    guardarRascunho(
      "k",
      {
        formulario: { edital: "20/2026" },
        cronograma: { automatico: true, etapas: [], historico: [1, 2, 3] },
      },
      HOJE,
      armazenamento,
    );
    const lido = lerRascunho("k", armazenamento, HOJE);
    expect(lido.formulario).toEqual({ edital: "20/2026" });
    expect(lido.cronograma.automatico).toBe(true);
    expect(lido.cronograma).not.toHaveProperty("historico");
    apagarRascunho("k", armazenamento);
    expect(lerRascunho("k", armazenamento, HOJE)).toBeNull();
  });

  it("rascunho velho ou estragado é ignorado e apagado", () => {
    const armazenamento = armazenamentoFalso();
    guardarRascunho(
      "velho",
      { formulario: {}, cronograma: {} },
      new Date(2026, 7, 1),
      armazenamento,
    );
    expect(lerRascunho("velho", armazenamento, HOJE)).toBeNull();
    expect(armazenamento.dados.has("velho")).toBe(false);
    armazenamento.setItem("ruim", "{não é json");
    expect(lerRascunho("ruim", armazenamento, HOJE)).toBeNull();
  });

  it("armazenamento bloqueado não quebra nada", () => {
    const bloqueado = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(lerRascunho("k", bloqueado, HOJE)).toBeNull();
    expect(
      guardarRascunho("k", { formulario: {}, cronograma: {} }, HOJE, bloqueado),
    ).toBe(false);
    expect(() => apagarRascunho("k", bloqueado)).not.toThrow();
  });

  it("enquanto o cronograma carrega, só o formulário conta como mudança", () => {
    const carregando = { carregando: true, etapas: [] };
    expect(estadoComparavel({ a: 1 }, carregando)).toBe(
      estadoComparavel({ a: 1 }, { carregando: true, etapas: [{ x: 1 }] }),
    );
    expect(estadoComparavel({ a: 1 }, { etapas: [] })).not.toBe(
      estadoComparavel({ a: 1 }, { etapas: [{ x: 1 }] }),
    );
  });

  it("a hora do rascunho: só a hora se foi hoje, com a data se foi antes", () => {
    expect(horaDoRascunho(new Date(2026, 8, 28, 9, 5), HOJE)).toBe("09:05");
    expect(horaDoRascunho(new Date(2026, 8, 27, 18, 0), HOJE)).toBe(
      "27/09 às 18:00",
    );
    expect(horaDoRascunho("lixo", HOJE)).toBe("");
  });
});

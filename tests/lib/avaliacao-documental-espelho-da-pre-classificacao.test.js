import { describe, expect, it } from "vitest";
import { espelhoDaEliminacaoPreAnalise } from "../../src/lib/avaliacao-documental/espelho-da-pre-classificacao.ts";
import { folhaDoEspelho } from "../../src/lib/avaliacao-documental/espelho-de-nota.ts";

const exemplo = {
  codigo: "C123",
  nome: "Pessoa de Exemplo",
  vaga: "V001",
  cargo: "Cargo de Exemplo",
  edital: "Edital 100/2026",
  modalidade: "Ampla concorrência",
  situacao: "ELIMINADO",
  motivo: "Questionário não finalizado no prazo do edital.",
  motivo_codigo: "QUESTIONARIO",
  art: 24,
  declarada: 25.5,
};

describe("espelho da eliminação antes da análise", () => {
  it("não atribui nota da comissão nem cria critérios documentais", () => {
    const espelho = espelhoDaEliminacaoPreAnalise(exemplo);
    expect(espelho.modelo).toBe("ELIMINADO");
    expect(espelho.criterios).toEqual([]);
    expect(espelho.justificativas).toEqual([exemplo.motivo]);
    expect(espelho.notas).toContainEqual({
      rotulo: "Nota da análise documental",
      valor: "Não se aplica — análise não realizada",
    });
    expect(espelho.notas.some((n) => n.valor === "0")).toBe(false);
    expect(espelho.textos.abertura).toContain("Não houve análise documental");
  });

  it("nota ausente não vira zero e as notas da inscrição são informativas", () => {
    const espelho = espelhoDaEliminacaoPreAnalise({
      ...exemplo,
      art: null,
      declarada: null,
    });
    expect(espelho.notas).toHaveLength(1);
    expect(espelho.notas[0].valor).toContain("Não se aplica");
  });

  it("não emite documento de aprovado, nem de eliminação sem motivo", () => {
    expect(() =>
      espelhoDaEliminacaoPreAnalise({ ...exemplo, situacao: "NO_LOTE" }),
    ).toThrow(/Somente eliminados/);
    expect(() =>
      espelhoDaEliminacaoPreAnalise({ ...exemplo, motivo: "" }),
    ).toThrow(/justificativa registrada/);
  });

  it("escapa texto do motivo no HTML do documento", () => {
    const espelho = espelhoDaEliminacaoPreAnalise({
      ...exemplo,
      motivo: '<script>alert("x")</script>',
    });
    const html = folhaDoEspelho(espelho);
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;");
  });
});

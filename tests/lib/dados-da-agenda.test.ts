import { describe, expect, it } from "vitest";
import { dadosDaAgenda } from "../../src/lib/dados-da-agenda.ts";
import { convocadosDaLista } from "../../src/lib/agenda-das-entrevistas.ts";
const base = {
  edital: { id: "A" },
  regra: { versao: 2, configuracao: {} },
  itens: [],
  bancas: [],
  historico: [],
};
describe("Dados tipados da agenda", () => {
  it("permissão é booleana e o registro visto é preservado para controle de concorrência", () => {
    expect(
      dadosDaAgenda({ ...base, pode_editar: "false", ultimo_registro: "h1" }),
    ).toMatchObject({
      pode_editar: false,
      ultimo_registro: "h1",
      regra: { versao: 2 },
    });
    expect(dadosDaAgenda({ ...base, pode_editar: true }).pode_editar).toBe(
      true,
    );
  });
  it.each([
    { itens: [null] },
    { itens: [{ analise_id: "" }] },
    { itens: [{ analise_id: "a1", data: "2026-10-14" }] },
    {
      itens: [
        {
          analise_id: "a1",
          data: "2026-10-14",
          inicio: "08:00",
          fim: "08:30",
          banca: "1",
        },
      ],
    },
    { bancas: {} },
    { regra: { versao: 0 } },
  ])("não usa coleções ou horários incompletos (%j)", (extra) => {
    expect(() => dadosDaAgenda({ ...base, ...extra })).toThrow();
  });
  it("não descarta linhas sem identidade para montar uma convocação parcial", () => {
    expect(() =>
      convocadosDaLista({
        vagas: [
          {
            geral: [
              { analise_id: "a1", nome: "Ana" },
              { nome: "Sem identidade" },
            ],
          },
        ],
      }),
    ).toThrow("identificação");
  });
});

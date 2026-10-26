import { describe, expect, it } from "vitest";
import {
  resultadoDaPublicacao,
  situacaoDaPublicacao,
} from "../../src/lib/dados-da-publicacao-de-aprovados.ts";
import { candidatosDaListaFinal } from "../../src/lib/publicacao-de-aprovados.ts";

const vigente = {
  lista_id: "l1",
  origem: "XLSX",
  candidatos: [
    {
      candidato_id: "c1",
      nome: "Ana",
      classificacao: "2",
      status: "Contratado",
      matricula: "M1",
      sub_judice: true,
    },
  ],
};
describe("Dados para a publicação de aprovados", () => {
  it("preserva os campos usados na revisão e aceita posição numérica da planilha", () => {
    expect(
      situacaoDaPublicacao({ vigente }).vigente.candidatos[0],
    ).toMatchObject({
      candidato_id: "c1",
      classificacao: 2,
      status: "Contratado",
      matricula: "M1",
      sub_judice: true,
    });
    expect(situacaoDaPublicacao({ vigente: null })).toEqual({
      vigente: null,
      pode_substituir: true,
    });
    // pode_substituir vem do banco (20261026150000); sem ele, quem barra é o banco.
    expect(
      situacaoDaPublicacao({ vigente: null, pode_substituir: false })
        .pode_substituir,
    ).toBe(false);
  });
  it.each([
    {},
    { vigente: { ...vigente, candidatos: null } },
    { vigente: { ...vigente, candidatos: [vigente.candidatos[0], null] } },
    {
      vigente: {
        ...vigente,
        candidatos: [vigente.candidatos[0], vigente.candidatos[0]],
      },
    },
    {
      vigente: {
        ...vigente,
        candidatos: [{ candidato_id: "c1", sub_judice: "false" }],
      },
    },
    { vigente: { ...vigente, lista_id: "" } },
  ])(
    "não transforma dados incompletos em uma revisão parcial (%j)",
    (dados) => {
      expect(() => situacaoDaPublicacao(dados)).toThrow("Recarregue a lista");
    },
  );
  it.each([
    { vagas: [{ geral: {}, listas: {} }] },
    { vagas: [{ geral: [], listas: { PP: "inválida" } }] },
    { vagas: [null] },
  ])("recusa coleções malformadas do retrato (%j)", (retrato) => {
    expect(() => candidatosDaListaFinal(retrato)).toThrow(
      "Dados da publicação inválidos",
    );
  });
  it.each([
    null,
    {},
    { ok: false, candidatos: 3, pendencias: [] },
    { ok: true, candidatos: "3", pendencias: [] },
    { ok: true, candidatos: -1, pendencias: [] },
    { ok: true, candidatos: 3, pendencias: {} },
  ])("não confirma uma resposta de publicação inválida (%j)", (dados) => {
    expect(() => resultadoDaPublicacao(dados)).toThrow();
  });
  it("conserva a quantidade publicada e as pendências informadas pelo banco", () => {
    expect(
      resultadoDaPublicacao({
        ok: true,
        candidatos: 3,
        pendencias: [{ candidato_id: "c2", status: "Desistente" }],
      }),
    ).toEqual({
      candidatos: 3,
      pendencias: [{ candidato_id: "c2", status: "Desistente" }],
    });
  });
});

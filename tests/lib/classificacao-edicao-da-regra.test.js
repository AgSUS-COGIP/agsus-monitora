import { describe, expect, it } from "vitest";
import {
  alterarCampoDaRegra,
  alterarGrupoDaRegra,
  alterarListaDaRegra,
  listaEmMaiusculas,
  niveisPorCargo,
  numeroOuNulo,
  textoDosNiveisPorCargo,
} from "../../src/lib/classificacao/edicao-da-regra.ts";
import {
  normalizarRegra,
  validarRegra,
} from "../../src/lib/classificacao/regra.ts";
import { regraDaClassificacao } from "../../src/lib/classificacao/dados-do-estado.ts";

describe("Edição tipada da regra de Classificação", () => {
  it("preserva texto não numérico no rascunho e converte vírgula decimal e campo vazio", () => {
    expect(numeroOuNulo("7,")).toBe(7);
    expect(numeroOuNulo("7,5")).toBe(7.5);
    expect(numeroOuNulo(" ")).toBeNull();
    expect(numeroOuNulo("em revisão")).toBe("em revisão");
  });
  it("altera só o campo escolhido, preservando documentos e exceções sem mudar a versão carregada", () => {
    const vigente = normalizarRegra({
      documento: {
        processo: "123",
        modelos: { FINAL_GERAL: { titulo: "Resultado" } },
      },
      convocacao: { excecoes: [{ termos: ["Médico"], multiplo_vagas: 5 }] },
    });
    const depois = alterarListaDaRegra(
      alterarGrupoDaRegra(
        alterarCampoDaRegra(vigente, "rodape", "Nova nota"),
        "composicao",
        { casas: "3" },
      ),
      "FINAL",
      { empate: "MESMA_POSICAO" },
    );
    expect(vigente.rodape).toBe("");
    expect(vigente.composicao.casas).toBe(2);
    expect(vigente.listas.FINAL.empate).toBe("CRITERIOS");
    expect(depois.documento).toEqual(vigente.documento);
    expect(depois.convocacao.excecoes).toEqual(vigente.convocacao.excecoes);
    expect(normalizarRegra(depois).composicao.casas).toBe(3);
    expect(validarRegra(depois)).toEqual([]);
  });
  it("a modalidade padrão de um edital não compartilha listas com a de outro", () => {
    const a = normalizarRegra(null),
      b = normalizarRegra(null);
    a.modalidades[0].remanejar_para.push("PP");
    a.modalidades[0].agrupa.push("PI");
    expect(b.modalidades[0].remanejar_para).toEqual([]);
    expect(b.modalidades[0].agrupa).toEqual([]);
    expect(normalizarRegra(null).modalidades[0].agrupa).toEqual([]);
  });
  it("mantém as listas de modalidades e os pares cargo/nível durante a edição", () => {
    expect(listaEmMaiusculas("pp, pi; pq")).toEqual(["PP", "PI", "PQ"]);
    const niveis = niveisPorCargo(
      "Técnico=tecnico; sem nível; Agente=fundamental",
    );
    expect(textoDosNiveisPorCargo(niveis)).toBe(
      "Técnico=tecnico; Agente=fundamental",
    );
  });
  it("preserva configuração, autoria, motivo e renomeações das versões", () => {
    const regra = regraDaClassificacao({
      versao: 2,
      configuracao: {},
      versoes: [
        {
          versao: 1,
          nome: "Inicial",
          em: "2026-10-13T12:00:00Z",
          por: "Gestora",
          motivo: "Primeira regra",
          configuracao: { rodape: "Texto anterior" },
          renomeacoes: [{ de: "Antes", para: "Inicial", motivo: "Nome claro" }],
        },
      ],
    });
    expect(regra.versoes[0]).toMatchObject({
      versao: 1,
      por: "Gestora",
      motivo: "Primeira regra",
      configuracao: { rodape: "Texto anterior" },
      renomeacoes: [{ de: "Antes", para: "Inicial" }],
    });
  });
  it.each([
    "inválido",
    [null],
    [{ versao: 0 }],
    [{ versao: 1, configuracao: "inválida" }],
  ])(
    "não oferece configuração inválida como versão anterior (%j)",
    (versoes) => {
      expect(() =>
        regraDaClassificacao({ versao: 2, configuracao: {}, versoes }),
      ).toThrow();
    },
  );
});

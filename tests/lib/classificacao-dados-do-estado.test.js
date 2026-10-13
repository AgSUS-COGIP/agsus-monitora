import { describe, expect, it } from "vitest";
import {
  editaisDaClassificacao,
  dadosDaClassificacao,
  regraDaClassificacao,
  listaComRetrato,
} from "../../src/lib/classificacao/dados-do-estado.ts";
describe("dados do estado da Classificação", () => {
  it("valida os campos do seletor e não libera edição por um valor não booleano", () => {
    const d = editaisDaClassificacao({
      pode_editar: "true",
      editais: [
        null,
        { id: {} },
        {
          id: "e1",
          edital: {},
          unidade: [],
          candidatos: Infinity,
          extra: { valor: 1 },
        },
      ],
    });
    expect(d.pode_editar).toBe(false);
    expect(d.editais).toHaveLength(1);
    expect(d.editais[0]).toMatchObject({
      id: "e1",
      edital: "",
      unidade: "",
      candidatos: 0,
      extra: { valor: 1 },
    });
  });
  it("conserva a configuração e os campos usados pelas peças ainda em JSX", () => {
    const configuracao = { etapas: { documental: true } };
    const d = dadosDaClassificacao({
      regra: { versao: 2, nome: "Regra atual", configuracao },
      entrevistas: [{ analise_id: "a1" }],
      candidatos: [{ analise_id: "a1", nota_documental: 5 }],
      extra: { valor: 1 },
      pode_editar: true,
    });
    expect(d.regra.configuracao).toBe(configuracao);
    expect(d.extra).toEqual({ valor: 1 });
    expect(d.entrevistas).toEqual([{ analise_id: "a1" }]);
    expect(d.pode_editar).toBe(true);
    expect(regraDaClassificacao({ versao: Infinity })).toBeNull();
  });
  it("recusa coleções malformadas para não calcular uma lista com candidatos descartados", () => {
    for (const candidatos of [{}, [null], [[]], "texto"])
      expect(() => dadosDaClassificacao({ candidatos })).toThrow(
        "dados da classificação recebidos são inválidos",
      );
    expect(() =>
      dadosDaClassificacao({ regra: { versao: 1, configuracao: [] } }),
    ).toThrow("configuração da regra recebida é inválida");
  });
  it("só devolve registros de lista com retrato válido para reexportação", () => {
    const v = {
      lista: { id: "l1", hash: "hash" },
      resultado: {
        tipo: "FINAL",
        edital: { id: "e1", edital: "105/2026" },
        vagas: [],
        modalidades: [],
        extra: { valor: 1 },
      },
    };
    expect(listaComRetrato(v)).toMatchObject({
      id: "l1",
      hash: "hash",
      retrato: { tipo: "FINAL", extra: { valor: 1 } },
    });
    expect(
      listaComRetrato({ ...v, resultado: { ...v.resultado, vagas: [null] } }),
    ).toBeNull();
    expect(listaComRetrato({ ...v, lista: { id: {} } })).toBeNull();
  });
});

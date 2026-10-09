import { describe, it, expect } from "vitest";
import {
  normalizarDadosDosRecursos,
  normalizarDetalheDoRecurso,
  normalizarCandidatosDosRecursos,
} from "../src/lib/dados-dos-recursos.ts";

describe("entrada dos Recursos", () => {
  it("conserva campos adicionais e só libera permissões booleanas", () => {
    const d = normalizarDadosDosRecursos({
      recursos: [
        {
          id: "r1",
          candidato: "Ana",
          nota_atual: "5.5",
          campo_extra: { valor: 1 },
        },
      ],
      modelos: [{ corpo: "Texto" }],
      pode_editar: true,
      pode_decidir: "true",
      pode_administrar_modelos: 1,
    });
    expect(d.recursos[0]).toMatchObject({
      id: "r1",
      candidato: "Ana",
      nota_atual: "5.5",
      campo_extra: { valor: 1 },
    });
    expect(d.modelos).toEqual([{ corpo: "Texto" }]);
    expect([d.pode_editar, d.pode_decidir, d.pode_administrar_modelos]).toEqual(
      [true, false, false],
    );
  });
  it("ignora linhas sem identificador e protege arrays e valores usados na tela", () => {
    const d = normalizarDadosDosRecursos({
      recursos: [
        null,
        [],
        { id: {} },
        {
          id: "r1",
          candidato: {},
          situacao: [],
          nota_atual: {},
          qt_anexos: Infinity,
        },
      ],
      editais: {},
      origens: [null, { id: 2 }],
      cronogramas: [null, { atividade: {}, ordem: {} }],
    });
    expect(d.recursos).toHaveLength(1);
    expect(d.recursos[0]).toMatchObject({
      candidato: "",
      situacao: "",
      nota_atual: null,
      qt_anexos: null,
    });
    expect(d.editais).toEqual([]);
    expect(d.origens).toEqual([]);
    expect(d.cronogramas[0]).toMatchObject({ atividade: "", ordem: null });
  });
  it("não insere objetos nos campos editáveis e conserva o restante do detalhe", () => {
    const d = normalizarDetalheDoRecurso({
      observacao: {},
      nome_informado: [],
      codigo_informado: "001",
      resposta: { texto_final: "Texto" },
      historico: [{ campo: "origem" }],
    });
    expect(d.observacao).toBe("");
    expect(d.nome_informado).toBeUndefined();
    expect(d.codigo_informado).toBe("001");
    expect(d.resposta).toEqual({ texto_final: "Texto" });
    expect(d.historico).toEqual([{ campo: "origem" }]);
  });
  it("normaliza candidatos sem perder códigos com zeros nem identificadores numéricos", () => {
    expect(
      normalizarCandidatosDosRecursos([
        null,
        { id: {} },
        { id: 12, candidato: "Ana", codigo: "001", nota: 7, responsavel: {} },
      ]),
    ).toMatchObject([
      { id: 12, candidato: "Ana", codigo: "001", nota: 7, responsavel: "" },
    ]);
    expect(normalizarCandidatosDosRecursos({})).toEqual([]);
  });
});

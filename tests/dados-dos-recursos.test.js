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
    expect(d.resposta).toMatchObject({ texto_final: "Texto" });
    expect(d.historico).toMatchObject([{ campo: "origem" }]);
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
  it("protege histórico, autores das etapas e anexos contra dados malformados", () => {
    const d = normalizarDetalheDoRecurso({
      parecer: {},
      modalidade: [],
      criado_por: {},
      etapas: { processo_sei: { nome: "Carla" } },
      historico: [
        null,
        [],
        {
          acao: "edicao",
          campo: "codigo",
          anterior: 12,
          novo: {},
          motivo: [],
          autor: {},
        },
      ],
      anexos: [
        null,
        { id: {} },
        { id: "a1", nome: {}, mime: [], bytes: Infinity, ativo: "true" },
      ],
    });
    expect(d).toMatchObject({
      parecer: "",
      modalidade: "",
      criado_por: "",
      etapas: { processo_sei: "" },
    });
    expect(d.historico).toHaveLength(1);
    expect(d.historico[0]).toMatchObject({
      anterior: "12",
      novo: null,
      motivo: "",
      autor: "",
    });
    expect(d.anexos).toHaveLength(1);
    expect(d.anexos[0]).toMatchObject({
      id: "a1",
      nome: "",
      mime: "",
      bytes: 0,
      ativo: false,
    });
    expect(
      normalizarDetalheDoRecurso({
        historico: {},
        anexos: "texto",
        etapas: [],
      }),
    ).toMatchObject({ historico: [], anexos: [], etapas: { upload_sei: "" } });
  });
  it("preserva metadados válidos do anexo e da resposta sem confundir permissões", () => {
    const d = normalizarDetalheDoRecurso({
      anexos: [
        {
          id: 1,
          nome: "recurso.pdf",
          mime: "application/pdf",
          bytes: 50,
          ativo: true,
          incluido_por: "Ana",
          caminho: "privado/arquivo",
        },
      ],
      resposta: {
        id: "resp1",
        revisao: 2,
        estado: "enviada",
        texto_final: "Texto",
        modelo_corpo: "{fundamentacao}",
      },
    });
    expect(d.anexos[0]).toMatchObject({
      id: 1,
      nome: "recurso.pdf",
      bytes: 50,
      ativo: true,
      caminho: "privado/arquivo",
    });
    expect(d.resposta).toMatchObject({
      id: "resp1",
      revisao: 2,
      estado: "enviada",
      texto_final: "Texto",
      modelo_corpo: "{fundamentacao}",
    });
    const r = normalizarDadosDosRecursos({
      recursos: [
        {
          id: "r1",
          resultado_atual: {},
          resultado_anterior: "Aprovado",
          parecer_enviado_em: [],
        },
      ],
    }).recursos[0];
    expect(r).toMatchObject({
      resultado_atual: "",
      resultado_anterior: "Aprovado",
      parecer_enviado_em: null,
    });
  });
});

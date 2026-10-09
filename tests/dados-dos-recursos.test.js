import { describe, it, expect } from "vitest";
import {
  normalizarDadosDosRecursos,
  normalizarDetalheDoRecurso,
  normalizarCandidatosDosRecursos,
  normalizarDadosDosModelos,
  normalizarRespostaDoRecurso,
} from "../src/lib/dados-dos-recursos.ts";

describe("entrada da resposta e dos modelos", () => {
  it("não amplia o escopo de modelos com área ou origem malformada", () => {
    const dados = normalizarDadosDosModelos({
      modelos: [
        null,
        { id: "m1", versao: 1, area: {} },
        { id: "m2", versao: 1, origem: [] },
        { id: "m3", versao: 0 },
        {
          id: "m4",
          versao: 2,
          area: "sede",
          origem: "entrevista",
          corpo: "{fundamentacao}",
          ativo: true,
        },
      ],
      areas: [null, { id: {}, rotulo: "Área" }, { id: "sede", rotulo: {} }],
      origens: { id: "entrevista" },
    });
    expect(dados.modelos).toHaveLength(1);
    expect(dados.modelos[0]).toMatchObject({
      id: "m4",
      versao: 2,
      area: "sede",
      origem: "entrevista",
      corpo: "{fundamentacao}",
      ativo: true,
    });
    expect(dados.areas).toEqual([{ id: "sede", rotulo: "" }]);
    expect(dados.origens).toEqual([]);
  });
  it("sinaliza uma resposta inválida em vez de oferecer um novo rascunho", () => {
    for (const resposta of [
      [],
      "texto",
      { id: "resp1", estado: "rascunho", revisao: Infinity },
      { id: "resp1", estado: "inventado", revisao: 1 },
    ]) {
      const detalhe = normalizarDetalheDoRecurso({ resposta });
      expect(detalhe.resposta).toBeNull();
      expect(detalhe.erro).toContain("resposta recebida é inválida");
    }
    expect(normalizarDetalheDoRecurso({ resposta: null }).erro).toBeUndefined();
  });
  it("conserva a versão usada e protege textos e histórico da resposta", () => {
    const r = normalizarRespostaDoRecurso({
      id: "resp1",
      revisao: 3,
      estado: "devolvida",
      modelo_id: "m1",
      modelo_versao: 1,
      modelo_corpo: "Texto antigo {fundamentacao}",
      modelo_vigente: false,
      texto_final: "<b>Texto</b>",
      fundamentacao: {},
      comentario_revisao: [],
      historico: [null, { acao: "devolver", comentario: {}, autor: {} }],
      passou_revisao: true,
      autor_id: "autora",
      envio_revisao_por_id: "remetente",
      extra: { valor: 1 },
    });
    expect(r).toMatchObject({
      modelo_versao: 1,
      modelo_corpo: "Texto antigo {fundamentacao}",
      modelo_vigente: false,
      texto_final: "<b>Texto</b>",
      fundamentacao: "",
      comentario_revisao: "",
      passou_revisao: true,
      extra: { valor: 1 },
    });
    expect(r.historico).toEqual([
      { acao: "devolver", comentario: "", autor: "", em: "" },
    ]);
  });
});

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
      modelos: [{ id: "m1", versao: 1, corpo: "Texto" }],
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
    expect(d.modelos).toMatchObject([{ id: "m1", versao: 1, corpo: "Texto" }]);
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
      resposta: {
        id: "resp1",
        estado: "rascunho",
        revisao: 1,
        texto_final: "Texto",
      },
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

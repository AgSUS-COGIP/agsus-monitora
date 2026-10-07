import { describe, expect, it } from "vitest";
import { criarEstadoDaPreClassificacao } from "../../src/modulos/avaliacao-documental/estado-da-pre-classificacao.js";
import {
  contadoresDaPreClassificacao,
  declaradasCongeladas,
  lotesAPublicar,
  nota,
  regraComTamanhos,
  tamanhoDefinido,
  tamanhoSugerido,
  textoDoAviso,
  vagasDaTela,
} from "../../src/lib/avaliacao-documental/tela-da-pre-classificacao.js";
import {
  chaveDoModelo,
  documentoOficial,
  faseDaPublicacao,
  textoParaSei,
} from "../../src/lib/classificacao/documento-sei.js";
import { nomeDoArquivo } from "../../src/lib/classificacao/exportacao.js";

/*
  A aba Pré-classificação sem DOM (src/lib/avaliacao-documental/
  tela-da-pre-classificacao.js) e o documento das listas PROVISORIA e LOTE no
  gerador da Classificação (src/lib/classificacao/documento-sei.js) — AM-4.4,
  AM-5.0, AM-5.6 e AM-16.
*/

const DADOS = {
  regra: { configuracao: { lote: { publica_reposicao: true } } },
  vagas: [
    {
      codigo: "1",
      inscritos: 4,
      eliminados: 1,
      ranqueados: 3,
      no_lote: 2,
      tamanho: 2,
      divergencias: 1,
    },
    {
      codigo: "2",
      inscritos: 3,
      eliminados: 0,
      ranqueados: 3,
      no_lote: 3,
      tamanho: 3,
      divergencias: 0,
    },
    { codigo: "3", inscritos: null, tamanho: null },
  ],
  candidatos: [
    {
      id: "a",
      vaga: "1",
      codigo: "10",
      situacao: "NO_LOTE",
      posicao: 2,
      lote: 2,
    },
    {
      id: "b",
      vaga: "1",
      codigo: "11",
      situacao: "NO_LOTE",
      posicao: 1,
      lote: 1,
    },
    { id: "c", vaga: "1", codigo: "12", situacao: "RANQUEADO", posicao: 3 },
    { id: "d", vaga: "1", codigo: "09", situacao: "ELIMINADO" },
    {
      id: "e",
      vaga: "2",
      codigo: "20",
      situacao: "ANALISADO",
      posicao: 1,
      lote: 1,
    },
  ],
  listas: [{ meta: { tipo: "LOTE" }, lote: 1 }],
};

describe("tela da pré-classificação", () => {
  it("AM-4.4: contadores e 'N de M' só das vagas já pré-classificadas", () => {
    expect(contadoresDaPreClassificacao(DADOS)).toEqual({
      inscritos: 7,
      eliminados: 1,
      ranqueados: 6,
      noLote: 5,
      noLotePelaRegra: 5,
      noLotePorDecisao: 0,
      tamanho: 5,
      divergencias: 1,
      vagasSemPreClassificacao: 1,
    });
    const semQuadro = { vagas: [{ inscritos: 2, tamanho: null }] };
    expect(contadoresDaPreClassificacao(semQuadro).tamanho).toBeNull();
  });

  it("vagas com o lote em ordem, os de fora e os eliminados", () => {
    const [v1, v2] = vagasDaTela(DADOS);
    expect(v1.lote.map((c) => c.codigo)).toEqual(["11", "10"]);
    expect(v1.fora.map((c) => c.codigo)).toEqual(["12"]);
    expect(v1.eliminados.map((c) => c.codigo)).toEqual(["09"]);
    expect(v2.lote.map((c) => c.situacao)).toEqual(["ANALISADO"]);
  });

  it("AM-5.6: com 'publica cada reposição', os lotes sem lista; sem, só o inicial", () => {
    expect(lotesAPublicar(DADOS)).toEqual([{ lote: 2, quantidade: 1 }]);
    const naoPublica = {
      ...DADOS,
      regra: { configuracao: { lote: {} } },
      listas: [],
    };
    expect(lotesAPublicar(naoPublica)).toEqual([{ lote: 1, quantidade: 2 }]);
  });

  it("AM-5.0: tamanho sugerido pela regra, definido à mão e a regra com os tamanhos", () => {
    const config = {
      lote: {
        base: "MULTIPLO_VAGAS",
        multiplo: 3,
        inclui_cr: true,
        por_vaga: { 179698: 40 },
      },
    };
    expect(
      tamanhoSugerido(config, {
        codigo: "179698",
        vagas_imediatas: 11,
        cadastro_reserva: true,
      }),
    ).toMatchObject({ tamanho: 36, descricao: "3 × (11 + CR) = 36" });
    expect(tamanhoSugerido(config, { codigo: "1" }).aviso).toBe("SEM_QUADRO");
    expect(tamanhoDefinido(config, "179698")).toBe(40);
    expect(tamanhoDefinido(config, "1")).toBeNull();
    const nova = regraComTamanhos(config, {
      179698: "",
      180231: "12",
      x: "abc",
    });
    expect(nova.lote.por_vaga).toEqual({ 180231: 12 });
    expect(config.lote.por_vaga).toEqual({ 179698: 40 });
    expect(
      regraComTamanhos(config, { 179698: "" }).lote.por_vaga,
    ).toBeUndefined();
  });

  it("avisos e notas", () => {
    expect(textoDoAviso("SEM_QUADRO")).toMatch(/defina o tamanho/);
    expect(textoDoAviso("COLUNA_AUSENTE:TERMO")).toBe(
      "A coluna da regra TERMO não veio no arquivo.",
    );
    expect(textoDoAviso("PERGUNTA_AMBIGUA:EXPERIENCIA_DECLARADA")).toBe(
      "A pergunta de experiência do desempate casa com mais de uma coluna do arquivo: na regra, use um começo de enunciado que só ela tenha.",
    );
    expect(textoDoAviso("PERGUNTA_AMBIGUA:NOTA_ETNICO")).toMatch(
      /^A pergunta da nota declarada ETNICO casa/,
    );
    expect(textoDoAviso("PERGUNTA_AMBIGUA:MODALIDADE")).toMatch(
      /^A pergunta do sistema de concorrência casa/,
    );
    expect(textoDoAviso("PERGUNTA_AMBIGUA:TERMO")).toMatch(
      /^A pergunta da eliminação TERMO casa/,
    );
    expect(nota(24.5)).toBe("24,5");
    expect(nota(null)).toBe("—");
    expect(textoDoAviso("SEM_DECLARADA_COMPLETA")).toMatch(
      /sem nota declarada completa: o lote usou a ART/,
    );
  });

  it("as notas declaradas congeladas do edital: quantas e desde quando", () => {
    expect(declaradasCongeladas({})).toEqual({ quantidade: 0, em: null });
    expect(
      declaradasCongeladas({
        candidatos: [
          { declarada_congelada: 20, congelada_em: "2026-10-08T12:00:00Z" },
          { declarada_congelada: 15, congelada_em: "2026-10-07T12:00:00Z" },
          { declarada_congelada: null, congelada_em: null },
          { declarada: 10 },
        ],
      }),
    ).toEqual({ quantidade: 2, em: "2026-10-07T12:00:00Z" });
  });
});

describe("estado da aba: descongelar e recalcular", () => {
  const criar = (rpcs, pedidos) => {
    const toasts = [];
    const supabase = {
      rpc: (nome, args) => {
        rpcs.push([nome, args]);
        return Promise.resolve(
          nome === "descongelar_declarada_pre_classificacao"
            ? { data: { descongeladas: 3 }, error: null }
            : { data: { vagas: [], candidatos: [] }, error: null },
        );
      },
    };
    const pre = criarEstadoDaPreClassificacao({
      supabase,
      toast: (m, t) => toasts.push([m, t]),
      obterToken: async () => "t",
      buscar: async (url, opcoes) => {
        pedidos.push(JSON.parse(opcoes.body));
        return { status: 202, json: async () => ({}) };
      },
      agendar: () => {},
    });
    return { pre, toasts };
  };

  it("descongela o edital com o motivo e pede o recálculo", async () => {
    const rpcs = [];
    const pedidos = [];
    const { pre, toasts } = criar(rpcs, pedidos);
    await pre.carregar("ed-1");
    expect(await pre.descongelar("  Respostas corrigidas na Empregare  ")).toBe(
      true,
    );
    expect(rpcs).toContainEqual([
      "descongelar_declarada_pre_classificacao",
      {
        p_edital: "ed-1",
        p_motivo: "Respostas corrigidas na Empregare",
        p_vaga: null,
      },
    ]);
    expect(pedidos).toEqual([{ robo: "pre_classificacao", edital: "ed-1" }]);
    expect(toasts[0]).toEqual(["3 notas declaradas descongeladas.", "success"]);
  });

  it("recusa do banco: avisa e não recalcula", async () => {
    const pedidos = [];
    const toasts = [];
    const pre = criarEstadoDaPreClassificacao({
      supabase: {
        rpc: (nome) =>
          Promise.resolve(
            nome === "descongelar_declarada_pre_classificacao"
              ? { data: null, error: { message: "Diga o motivo" } }
              : { data: {}, error: null },
          ),
      },
      toast: (m, t) => toasts.push([m, t]),
      buscar: async (url, opcoes) => {
        pedidos.push(opcoes);
        return { status: 202, json: async () => ({}) };
      },
      agendar: () => {},
    });
    await pre.carregar("ed-1");
    expect(await pre.descongelar("curto")).toBe(false);
    expect(pedidos).toEqual([]);
    expect(toasts.at(-1)[1]).toBe("error");
  });
});

describe("documento das listas PROVISORIA e LOTE (AM-16)", () => {
  const retrato = (tipo, lote = null) => ({
    schema: 1,
    tipo,
    lote,
    edital: {
      id: "e93",
      edital: "Edital 93/2026",
      unidade: "Escritório de Boa Vista",
    },
    casas: 1,
    modalidades: [],
    vagas: [
      {
        chave: "179698",
        codigo: "179698",
        cabecalho:
          "VAGA 179698 - Técnico de Segurança do Trabalho - 1 vaga + CR",
        geral: [
          { posicao: 1, nome: "Ana Exemplo", nota: 26, modalidades: ["AC"] },
          { posicao: 2, nome: "Bia Exemplo", nota: 24.5, modalidades: ["AC"] },
        ],
        listas: {},
        eliminados:
          tipo === "PROVISORIA"
            ? [
                {
                  nome: "Caio Exemplo",
                  motivo: "Cancelou a inscrição",
                  detalhe: "",
                },
              ]
            : [],
      },
      {
        chave: "180231",
        codigo: "180231",
        cabecalho: "VAGA 180231",
        geral: [],
        listas: {},
        eliminados: [],
      },
    ],
  });

  it("sem fase no título e com o modelo próprio", () => {
    expect(faseDaPublicacao("PROVISORIA", "FINAL")).toBeNull();
    expect(faseDaPublicacao("LOTE", null)).toBeNull();
    expect(chaveDoModelo("PROVISORIA", null)).toBe("PROVISORIA");
    expect(chaveDoModelo("PROVISORIA", null, "eliminados")).toBe(
      "PROVISORIA_ELIMINADOS",
    );
    expect(chaveDoModelo("LOTE", null, "eliminados")).toBe("LOTE");
  });

  it("AM-16.1: a Provisória por vaga com a nota da ART e o item 8.3.1 (não valida documentos)", () => {
    const doc = documentoOficial(retrato("PROVISORIA"));
    expect(doc.titulo[0]).toBe(
      "LISTA GERAL DE CLASSIFICAÇÃO PROVISÓRIA - RANQUEAMENTO ELETRÔNICO",
    );
    const texto = textoParaSei(doc);
    expect(texto).toContain("item 8.3.1");
    expect(texto).toContain("não valida os documentos");
    expect(doc.blocos[0].tabelas[0].colunas.map((c) => c.rotulo)).toEqual([
      "Classificação",
      "Nome",
      "Nota da Autodeclaração de Requisitos e Títulos (ART)",
    ]);
    expect(doc.blocos[0].tabelas[0].linhas[1]).toEqual([
      "2º",
      "Bia Exemplo",
      "24,5",
    ]);
    expect(doc.blocos[1].tabelas[0].vazia).toBe(
      "Não houve candidatos classificados.",
    );
    const eliminados = documentoOficial(retrato("PROVISORIA"), {
      lista: "eliminados",
    });
    expect(eliminados.chave).toBe("PROVISORIA_ELIMINADOS");
    expect(eliminados.blocos[0].tabelas[0].linhas[0]).toEqual([
      "Caio Exemplo",
      "Cancelou a inscrição",
    ]);
  });

  it("AM-16.2: o lote de convocação (item 8.4) e o nome do arquivo com o número do lote", () => {
    const doc = documentoOficial(retrato("LOTE", 2));
    expect(doc.titulo[0]).toBe(
      "LOTE DE CONVOCAÇÃO - ETAPA DE AVALIAÇÃO DOCUMENTAL E DE TÍTULOS",
    );
    expect(textoParaSei(doc)).toContain("item 8.4");
    expect(doc.blocos[1].tabelas[0].vazia).toBe(
      "Não houve candidatos convocados.",
    );
    expect(nomeDoArquivo(retrato("LOTE", 2))).toBe(
      "classificacao-lote-lote-2-Edital-93-2026",
    );
    expect(nomeDoArquivo(retrato("PROVISORIA"))).toBe(
      "classificacao-provisoria-Edital-93-2026",
    );
  });

  it("AM-16.3: os textos podem ser trocados por edital (regra.documento.modelos)", () => {
    const regra = {
      documento: { modelos: { LOTE: { titulo: "LOTE {edital}" } } },
    };
    expect(documentoOficial(retrato("LOTE", 1), { regra }).titulo[0]).toBe(
      "LOTE 93/2026",
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { criarEstadoDaPreClassificacao } from "../../src/modulos/avaliacao-documental/estado-da-pre-classificacao.js";
import { decidirNoLote } from "../../src/modulos/avaliacao-documental/decisao-no-banco.js";
import { loteDaFila } from "../../src/lib/avaliacao-documental/fila.js";
import {
  codigosPorVaga,
  contadoresDaPreClassificacao,
  entrouPorDecisao,
  erroDoMotivo,
  loteDaVaga,
  MOTIVO_DA_DECISAO,
  MOTIVO_DA_REVOGACAO,
  MOTIVO_SUGERIDO_DA_DECISAO,
  motivoDaDecisao,
  podeIncluirPorDecisao,
  seloDaDecisao,
  textoDoAviso,
  textoDoLote,
} from "../../src/lib/avaliacao-documental/tela-da-pre-classificacao.js";
import {
  documentoOficial,
  htmlParaSei,
  marcasDasDecisoes,
  textoParaSei,
} from "../../src/lib/classificacao/documento-sei.js";
import { corpoXml } from "../../src/lib/classificacao/documento-docx.js";

/*
  Inclusão no lote por decisão da coordenação (ex.: "Critério CORES"): o selo,
  os contadores "N pela regra + M por decisão", os candidatos que podem ser
  incluídos, o motivo, as chamadas ao banco (uma por vaga) e a nota de rodapé
  dos documentos oficiais (Lista Provisória e Lote). A conta do recálculo que
  respeita as decisões está nos casos dourados (casos-de-pre-classificacao.json).
*/

const CORES = "Critério CORES";
const daPre = (codigo, extra = {}) => ({
  id: `id-${codigo}`,
  vaga: "180258",
  codigo,
  situacao: "RANQUEADO",
  ...extra,
});

describe("decisão da coordenação na tela", () => {
  it("selo e motivo: só de quem entrou por decisão (pré-classificação e fila)", () => {
    const pre = daPre("6975425", {
      situacao: "NO_LOTE",
      entrada: "DECISAO",
      motivo_entrada: CORES,
      decisao: { motivo: CORES, por: "Coordenação", em: "2026-10-07" },
    });
    const fila = { codigo: "6948286", entrada: "DECISAO", decisao: CORES };
    expect(entrouPorDecisao(pre)).toBe(true);
    expect(motivoDaDecisao(pre)).toBe(CORES);
    expect(seloDaDecisao(pre)).toBe("Decisão: Critério CORES");
    expect(seloDaDecisao(fila)).toBe("Decisão: Critério CORES");
    expect(
      seloDaDecisao({ entrada: "INICIAL", motivo_entrada: "Lote inicial" }),
    ).toBe("");
    expect(seloDaDecisao(null)).toBe("");
  });

  it('contadores: "Lote: 11 pela regra + 6 por decisão" (sem decisão, só o da regra)', () => {
    expect(textoDoLote(11, 6)).toBe("Lote: 11 pela regra + 6 por decisão");
    expect(textoDoLote(11, 6, 11)).toBe(
      "Lote: 11 de 11 pela regra + 6 por decisão",
    );
    expect(textoDoLote(11, 0, 11)).toBe("Lote: 11 de 11");
    const dados = {
      vagas: [
        {
          codigo: "180258",
          inscritos: 45,
          no_lote: 17,
          no_lote_regra: 11,
          no_lote_decisao: 6,
          tamanho: 11,
        },
        // Sem os campos novos (antes da migration): conta os inscritos.
        { codigo: "180250", inscritos: 3, no_lote: 2, tamanho: 2 },
      ],
      candidatos: [
        daPre("1", { vaga: "180250", situacao: "NO_LOTE", entrada: "INICIAL" }),
        daPre("2", {
          vaga: "180250",
          situacao: "NO_LOTE",
          entrada: "DECISAO",
          motivo_entrada: CORES,
        }),
      ],
    };
    expect(loteDaVaga(dados.vagas[0], dados.candidatos)).toEqual({
      pelaRegra: 11,
      porDecisao: 6,
    });
    expect(loteDaVaga(dados.vagas[1], dados.candidatos)).toEqual({
      pelaRegra: 1,
      porDecisao: 1,
    });
    const cont = contadoresDaPreClassificacao(dados);
    expect([cont.noLote, cont.noLotePelaRegra, cont.noLotePorDecisao]).toEqual([
      19, 12, 7,
    ]);
    const naFila = [
      { vaga: "180258", situacao_pre: "NO_LOTE", entrada: "INICIAL" },
      { vaga: "180258", situacao_pre: "ANALISADO", entrada: "DECISAO" },
      { vaga: "180258", situacao_pre: "NO_LOTE", entrada: "DECISAO" },
      { vaga: "180258", situacao_pre: "ELIMINADO" },
      { vaga: "180250", situacao_pre: "NO_LOTE", entrada: "AMPLIACAO" },
    ];
    expect(loteDaFila(naFila)).toEqual({ pelaRegra: 2, porDecisao: 2 });
    expect(loteDaFila(naFila, "180258")).toEqual({
      pelaRegra: 1,
      porDecisao: 2,
    });
  });

  it("só quem está fora do lote pela regra pode ser incluído (e não quem saiu da Empregare)", () => {
    expect(podeIncluirPorDecisao(daPre("1"))).toBe(true);
    expect(
      podeIncluirPorDecisao(
        daPre("2", { situacao: "ELIMINADO", motivo_codigo: "QUESTIONARIO" }),
      ),
    ).toBe(true);
    expect(
      podeIncluirPorDecisao(
        daPre("3", {
          situacao: "ELIMINADO",
          motivo_codigo: "SAIU_DA_EMPREGARE",
        }),
      ),
    ).toBe(false);
    expect(podeIncluirPorDecisao(daPre("4", { situacao: "NO_LOTE" }))).toBe(
      false,
    );
    expect(podeIncluirPorDecisao({ situacao_pre: "RANQUEADO" })).toBe(true);
    expect(podeIncluirPorDecisao({ situacao_pre: "ANALISADO" })).toBe(false);
  });

  it("motivo: a sugestão é Critério CORES; decisão de 5 a 250, revogação de 10 a 250", () => {
    expect(MOTIVO_SUGERIDO_DA_DECISAO).toBe(CORES);
    expect(erroDoMotivo(CORES, MOTIVO_DA_DECISAO)).toBe("");
    expect(erroDoMotivo("abc", MOTIVO_DA_DECISAO)).toMatch(/pelo menos 5/);
    expect(erroDoMotivo("x".repeat(251), MOTIVO_DA_DECISAO)).toMatch(
      /no máximo 250/,
    );
    expect(erroDoMotivo("Engano", MOTIVO_DA_REVOGACAO)).toMatch(
      /pelo menos 10/,
    );
    expect(textoDoAviso("DECISAO_SAIU_DA_EMPREGARE")).toMatch(
      /saiu do arquivo da Empregare/,
    );
  });
});

describe("decisão da coordenação no banco", () => {
  it("uma chamada por vaga, com os códigos, o motivo e a vaga", async () => {
    expect(
      codigosPorVaga([
        { codigo: "6975425", vaga: "180258" },
        { codigo: "6948286", vaga: "180258" },
        { codigo: "6975425", vaga: "180258" },
        { codigo: "7000001", vaga: "180250" },
        { codigo: " " },
      ]),
    ).toEqual([
      { vaga: "180258", codigos: ["6975425", "6948286"] },
      { vaga: "180250", codigos: ["7000001"] },
    ]);
    const rpc = vi.fn(async (_nome, { p_codigos }) => ({
      incluidos: p_codigos.length,
    }));
    const r = await decidirNoLote(
      rpc,
      "incluir",
      "e93",
      [
        { codigo: "6975425", vaga: "180258" },
        { codigo: "7000001", vaga: "180250" },
      ],
      ` ${CORES} `,
    );
    expect(rpc).toHaveBeenNthCalledWith(1, "incluir_no_lote_por_decisao", {
      p_edital: "e93",
      p_codigos: ["6975425"],
      p_motivo: CORES,
      p_vaga: "180258",
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(r).toEqual({
      quantidade: 2,
      texto: "2 candidatos incluídos no lote por decisão da coordenação.",
    });
    const revogar = vi.fn(async () => ({ revogadas: 1 }));
    const r2 = await decidirNoLote(
      revogar,
      "revogar",
      "e93",
      [{ codigo: "5112426", vaga: "180258" }],
      "Engano na lista",
    );
    expect(revogar).toHaveBeenCalledWith("revogar_decisao_lote", {
      p_edital: "e93",
      p_codigos: ["5112426"],
      p_motivo: "Engano na lista",
      p_vaga: "180258",
    });
    expect(r2.texto).toBe("1 decisão revogada.");
  });

  it("o store relê depois de incluir e devolve o erro do banco (permissão, ficha concluída)", async () => {
    const respostas = {
      obter_pre_classificacao: () => ({ data: { vagas: [] }, error: null }),
      incluir_no_lote_por_decisao: () => ({
        data: null,
        error: {
          code: "42501",
          message:
            "Só o gestor do edital ou a coordenação da avaliação muda a regra e a equipe",
        },
      }),
      revogar_decisao_lote: () => ({
        data: null,
        error: {
          code: "22023",
          message:
            "O candidato 6948286 já tem a ficha concluída: a decisão não se revoga.",
        },
      }),
    };
    const supabase = {
      rpc: vi.fn(async (nome) => respostas[nome]()),
    };
    const toast = vi.fn();
    const pre = criarEstadoDaPreClassificacao({ supabase, toast });
    await pre.carregar("e93");
    const negado = await pre.incluirPorDecisao(
      [{ codigo: "6975425", vaga: "180258" }],
      CORES,
    );
    expect(negado.ok).toBe(false);
    expect(negado.erro).toMatch(/coordenação/);
    const concluida = await pre.revogarDecisao(
      [{ codigo: "6948286", vaga: "180258" }],
      "Engano na lista",
    );
    expect(concluida).toEqual({
      ok: false,
      erro: expect.stringMatching(/ficha concluída/),
    });

    respostas.incluir_no_lote_por_decisao = () => ({
      data: { incluidos: 1, fichas_criadas: 1 },
      error: null,
    });
    const ok = await pre.incluirPorDecisao(
      [{ codigo: "6975425", vaga: "180258" }],
      CORES,
    );
    expect(ok).toEqual({ ok: true, quantidade: 1 });
    expect(toast).toHaveBeenCalledWith(
      "1 candidato incluído no lote por decisão da coordenação.",
      "success",
    );
    // Releu a pré-classificação depois de incluir.
    expect(
      supabase.rpc.mock.calls.filter(([n]) => n === "obter_pre_classificacao")
        .length,
    ).toBe(2);
  });
});

describe("decisão da coordenação nos documentos oficiais", () => {
  const retrato = (tipo) => ({
    schema: 1,
    tipo,
    lote: tipo === "LOTE" ? 2 : null,
    edital: { id: "e93", edital: "Edital 93/2026", unidade: "Boa Vista" },
    casas: 1,
    modalidades: [],
    vagas: [
      {
        chave: "180258",
        codigo: "180258",
        cabecalho: "VAGA 180258 - Cargo 5",
        geral: [
          { posicao: 1, nome: "Ana Exemplo", nota: 26, modalidades: ["AC"] },
          {
            posicao: 28,
            nome: "Bia Exemplo",
            nota: 0,
            modalidades: ["AC"],
            decisao: CORES,
          },
          {
            posicao: 29,
            nome: "Caio Exemplo",
            nota: 0,
            modalidades: ["AC"],
            decisao: "Outro motivo.",
          },
        ],
        listas: {},
        eliminados: [],
      },
    ],
  });

  it("o nome leva a marca e a tabela, a nota: 'Incluído por decisão da coordenação: Critério CORES.'", () => {
    const marcas = marcasDasDecisoes(retrato("LOTE").vagas[0].geral);
    expect(marcas.notas).toEqual([
      "* Incluído por decisão da coordenação: Critério CORES.",
      "** Incluído por decisão da coordenação: Outro motivo.",
    ]);
    for (const tipo of ["LOTE", "PROVISORIA"]) {
      const doc = documentoOficial(retrato(tipo), {
        regra: {},
        hoje: new Date("2026-10-07T12:00:00Z"),
      });
      const tabela = doc.blocos[0].tabelas[0];
      expect(tabela.linhas.map((l) => l[1])).toEqual([
        "Ana Exemplo",
        "Bia Exemplo *",
        "Caio Exemplo **",
      ]);
      expect(tabela.notas[0]).toBe(
        "* Incluído por decisão da coordenação: Critério CORES.",
      );
      expect(htmlParaSei(doc)).toContain(
        "* Incluído por decisão da coordenação: Critério CORES.",
      );
      expect(textoParaSei(doc)).toContain(
        "* Incluído por decisão da coordenação: Critério CORES.",
      );
      expect(corpoXml(doc)).toContain(
        "* Incluído por decisão da coordenação: Critério CORES.",
      );
    }
  });

  it("sem decisão, nada muda (nem nas outras listas)", () => {
    const semDecisao = retrato("LOTE");
    semDecisao.vagas[0].geral = semDecisao.vagas[0].geral.slice(0, 1);
    const doc = documentoOficial(semDecisao, { regra: {} });
    expect(doc.blocos[0].tabelas[0].notas).toEqual([]);
    expect(doc.blocos[0].tabelas[0].linhas[0][1]).toBe("Ana Exemplo");
  });
});

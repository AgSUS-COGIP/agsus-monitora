import { describe, expect, it } from "vitest";
import {
  chamadaDaDecisao,
  contarAbertas,
  editaisDasPendencias,
  filtrarPendencias,
  normalizarPendencia,
  normalizarResposta,
  textoDaAlteracao,
  textoDoDetalhe,
} from "../../src/lib/pendencias-do-edital.ts";

/* As regras puras da aba Pendências (src/lib/pendencias-do-edital.ts), com dados fictícios. */

const linha = (id, extra = {}) => ({
  id,
  nome: `Pessoa ${id}`,
  vaga: "100",
  modalidade: '"Ampla Concorrência"',
  posicao: 3,
  status: "",
  lista_ativa: true,
  ...extra,
});
const pendencia = (tipo, extra = {}) =>
  normalizarPendencia({
    id: `p-${tipo}`,
    tipo,
    situacao: "ABERTA",
    edital_id: "e1",
    edital: "01/2026",
    unidade: "DSEI",
    detalhe: {},
    pode_decidir: true,
    linhas: [linha("a"), linha("b")],
    ...extra,
  });
const HOJE = "2026-10-26";

describe("normalização", () => {
  it("formato desconhecido é erro; tipo desconhecido sai", () => {
    expect(() => normalizarResposta({ pendencias: [] })).toThrow();
    const { pendencias } = normalizarResposta({
      schema_version: 1,
      pendencias: [
        { id: "x", tipo: "OUTRO" },
        { id: "y", tipo: "POSICAO_REPETIDA" },
      ],
    });
    expect(pendencias.map((p) => p.id)).toEqual(["y"]);
  });

  it("limpa as aspas da modalidade e lê os tipos", () => {
    const p = pendencia("POSICAO_REPETIDA");
    expect(p.linhas[0].modalidade).toBe("Ampla Concorrência");
    expect(p.linhas[0].listaAtiva).toBe(true);
    expect(p.podeDecidir).toBe(true);
  });
});

describe("textos, contagens e filtros", () => {
  it("o detalhe de cada tipo", () => {
    expect(
      textoDoDetalhe(
        pendencia("CONTRATADO_DUAS_MATRICULAS", {
          detalhe: { linhas: 3, vinculos: 2 },
        }),
      ),
    ).toBe("2 matrículas em 3 linhas deste edital");
    expect(
      textoDoDetalhe(
        pendencia("CONTRATADO_EM_DUAS_LISTAS", {
          detalhe: { linhas: 2, motivo: "NENHUMA_ALCANCADA" },
        }),
      ),
    ).toBe(
      "Mesma matrícula em 2 listas: nenhuma linha está dentro do que a convocação já chamou",
    );
    expect(
      textoDoDetalhe(
        pendencia("CONVOCADO_SEM_DESFECHO", {
          detalhe: { convocado_em: "2026-09-01", dias: 55 },
        }),
      ),
    ).toBe("Convocado em 01/09/2026, há 55 dias, sem desfecho");
  });

  it("conta e filtra as abertas por edital, tipo e situação", () => {
    const lista = [
      pendencia("POSICAO_REPETIDA"),
      pendencia("PESSOA_REPETIDA", {
        id: "p2",
        edital_id: "e2",
        edital: "02/2026",
      }),
      pendencia("PESSOA_REPETIDA", { id: "p3", situacao: "RESOLVIDA" }),
    ];
    expect(contarAbertas(lista).total).toBe(2);
    expect(contarAbertas(lista, "e1").porTipo.POSICAO_REPETIDA).toBe(1);
    expect(
      filtrarPendencias(lista, { tipo: "PESSOA_REPETIDA" }).map((p) => p.id),
    ).toEqual(["p2"]);
    expect(
      filtrarPendencias(lista, { situacao: "RESOLVIDA" }).map((p) => p.id),
    ).toEqual(["p3"]);
    expect(editaisDasPendencias(lista)).toEqual([
      { valor: "e1", rotulo: "01/2026 · DSEI", abertas: 1 },
      { valor: "e2", rotulo: "02/2026 · DSEI", abertas: 1 },
    ]);
  });

  it("a alteração do histórico em texto", () => {
    expect(
      textoDaAlteracao({ campo: "status", antes: "Contratado", depois: null }),
    ).toBe("Contratado → sem status");
    expect(textoDaAlteracao({ campo: "posicao", antes: 7, depois: 8 })).toBe(
      "posição 7 → 8",
    );
    expect(
      textoDaAlteracao({ campo: "removido", antes: false, depois: true }),
    ).toBe("saiu da lista");
  });
});

describe("a decisão vira a chamada certa", () => {
  const contratados = [
    linha("a", { status: "Contratado" }),
    linha("b", { status: "Contratado" }),
  ];

  it("motivo obrigatório em todo tipo", () => {
    for (const tipo of [
      "CONTRATADO_EM_DUAS_LISTAS",
      "POSICAO_REPETIDA",
      "CONVOCADO_SEM_DESFECHO",
    ])
      expect(
        chamadaDaDecisao(pendencia(tipo), { motivo: "  " }, HOJE).erro,
      ).toMatch(/motivo/);
  });

  it("duas matrículas: a linha que vale e o desfecho das outras", () => {
    const p = pendencia("CONTRATADO_DUAS_MATRICULAS", { linhas: contratados });
    expect(
      chamadaDaDecisao(p, { motivo: "ok!", linha: "x" }, HOJE).erro,
    ).toMatch(/linha/);
    expect(
      chamadaDaDecisao(
        p,
        { motivo: "ok!", linha: "a", outras: "Desistente" },
        HOJE,
      ).chamada,
    ).toEqual({
      rpc: "escolher_vinculo_do_contratado",
      argumentos: {
        p_pendencia: p.id,
        p_motivo: "ok!",
        p_candidato: "a",
        p_status_das_outras: "Desistente",
      },
    });
    expect(
      chamadaDaDecisao(p, { motivo: "ok!", linha: "a" }, HOJE).chamada
        .argumentos.p_status_das_outras,
    ).toBe("Contratado em outra lista");
  });

  it("duas listas: só linha Contratado", () => {
    const p = pendencia("CONTRATADO_EM_DUAS_LISTAS", {
      linhas: [linha("a", { status: "Contratado" }), linha("b")],
    });
    expect(
      chamadaDaDecisao(p, { motivo: "ok!", linha: "b" }, HOJE).erro,
    ).toBeTruthy();
    expect(
      chamadaDaDecisao(p, { motivo: "ok!", linha: "a" }, HOJE).chamada.rpc,
    ).toBe("escolher_lista_da_contratacao");
  });

  it("pessoa repetida: a linha que fica ou pessoas diferentes", () => {
    const p = pendencia("PESSOA_REPETIDA");
    expect(
      chamadaDaDecisao(p, { motivo: "ok!", pessoasDiferentes: true }, HOJE)
        .chamada,
    ).toEqual({
      rpc: "manter_linha_da_pessoa_repetida",
      argumentos: { p_pendencia: p.id, p_motivo: "ok!", p_candidato: null },
    });
    expect(
      chamadaDaDecisao(p, { motivo: "ok!", linha: "b" }, HOJE).chamada
        .argumentos.p_candidato,
    ).toBe("b");
  });

  it("posição: empate ou correção com número válido e diferente", () => {
    const p = pendencia("POSICAO_REPETIDA");
    expect(chamadaDaDecisao(p, { motivo: "ok!" }, HOJE).erro).toMatch(/empate/);
    expect(
      chamadaDaDecisao(p, { motivo: "ok!", acao: "empate" }, HOJE).chamada.rpc,
    ).toBe("confirmar_empate_da_posicao");
    expect(
      chamadaDaDecisao(
        p,
        { motivo: "ok!", acao: "corrigir", linha: "a", posicao: "0" },
        HOJE,
      ).erro,
    ).toMatch(/posição/);
    expect(
      chamadaDaDecisao(
        p,
        { motivo: "ok!", acao: "corrigir", linha: "a", posicao: "3" },
        HOJE,
      ).erro,
    ).toMatch(/igual/);
    expect(
      chamadaDaDecisao(
        p,
        { motivo: "ok!", acao: "corrigir", linha: "a", posicao: "4" },
        HOJE,
      ).chamada,
    ).toEqual({
      rpc: "corrigir_posicao_da_pendencia",
      argumentos: {
        p_pendencia: p.id,
        p_motivo: "ok!",
        p_candidato: "a",
        p_posicao: 4,
      },
    });
  });

  it("convocado: matrícula no Contratado; nova data não futura nem igual", () => {
    const p = pendencia("CONVOCADO_SEM_DESFECHO", {
      linhas: [linha("c", { status: "Convocado", convocado_em: "2026-09-01" })],
    });
    expect(
      chamadaDaDecisao(p, { motivo: "ok!", status: "Contratado" }, HOJE).erro,
    ).toMatch(/matrícula/);
    expect(
      chamadaDaDecisao(
        p,
        { motivo: "ok!", status: "Convocado", data: "2026-09-01" },
        HOJE,
      ).erro,
    ).toMatch(/igual/);
    expect(
      chamadaDaDecisao(
        p,
        { motivo: "ok!", status: "Convocado", data: "2026-10-27" },
        HOJE,
      ).erro,
    ).toMatch(/futura/);
    expect(
      chamadaDaDecisao(
        p,
        { motivo: "ok!", status: "Desistente", data: "2026-10-01" },
        HOJE,
      ).chamada.argumentos,
    ).toEqual({
      p_pendencia: p.id,
      p_motivo: "ok!",
      p_status: "Desistente",
      p_matricula: null,
      p_data_convocacao: null,
    });
  });
});

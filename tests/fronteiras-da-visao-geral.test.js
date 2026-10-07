import { describe, expect, it, vi } from "vitest";
import {
  acompanhamentoDaResposta,
  enriquecerLinhas,
  indicadoresDaVisaoGeral,
  linhasDaResposta,
  normalizarFiltros,
} from "../src/lib/visao-geral.ts";
import {
  buscarAcompanhamentoNoSupabase,
  criarEstadoDaVisaoGeral,
} from "../src/modulos/visao-geral/estado.ts";
import { lerMarcosDaArea } from "../src/modulos/visao-geral/marcos.ts";

const campoInvalido = { toString: null, valueOf: null };
const linha = {
  id: 1,
  CO_AREA: "sede",
  unidade: "Sede",
  edital: "1/2026",
  status: "Em andamento",
  vagas_total: "10",
  contratados: 2,
  inscritos: 8,
};

describe("fronteiras externas da Visão geral", () => {
  it("ignora filtros desconhecidos e valores que não podem ser texto", () => {
    expect(
      normalizarFiltros({
        unidade: ["Sede", null, "Sede", campoInvalido],
        uf: false,
        invasor: ["x"],
      }),
    ).toEqual({ unidade: ["Sede"], edital: [], status: [], fase: [], uf: [] });
    expect(normalizarFiltros(null).unidade).toEqual([]);
  });

  it("preserva campos dos mapas e evita que campos malformados quebrem os indicadores", () => {
    const geografico = { latitude: -15, longitude: -47 };
    const bruto = {
      ...linha,
      observacoes: campoInvalido,
      inscritos: campoInvalido,
      localizacao: geografico,
      atencao: campoInvalido,
    };
    const normalizadas = linhasDaResposta([null, false, [], bruto]);
    expect(normalizadas).toHaveLength(1);
    expect(normalizadas[0].localizacao).toBe(geografico);
    expect(normalizadas[0].observacoes).toBeUndefined();
    expect(normalizadas[0].atencao).toBeUndefined();
    expect(bruto.atencao).toBe(campoInvalido);
    expect(
      linhasDaResposta([{ ...linha, cronograma_percentual: "Infinity" }])[0]
        .cronograma_percentual,
    ).toBeUndefined();
    const enriquecidas = enriquecerLinhas(normalizadas, { hoje: "2026-10-07" });
    expect(indicadoresDaVisaoGeral(enriquecidas)).toMatchObject({
      vagas: 10,
      contratadas: 2,
      emSelecao: 8,
      inscritos: 0,
    });
  });

  it("aceita IDs numéricos e UUIDs e ignora objetos no acompanhamento", () => {
    const resultado = acompanhamentoDaResposta({
      etapas: [
        null,
        { monitoramento_id: campoInvalido },
        {
          monitoramento_id: 1,
          data_inicio: "2026-10-07",
          atividade: campoInvalido,
        },
      ],
      listas: [
        [],
        { monitoramento_id: false },
        {
          monitoramento_id: "uuid",
          aprovados: "2",
          desistentes: campoInvalido,
        },
      ],
    });
    expect([...resultado.etapasPorEdital.keys()]).toEqual(["1"]);
    expect(resultado.etapasPorEdital.get("1")[0].atividade).toBeUndefined();
    expect([...resultado.listasPorEdital.keys()]).toEqual(["uuid"]);
    expect(resultado.listasPorEdital.get("uuid").aprovados).toBe("2");
    expect(resultado.listasPorEdital.get("uuid").desistentes).toBeUndefined();
    expect(acompanhamentoDaResposta([])).toBeNull();
  });

  it("descarta o acompanhamento da área anterior sem repetir pedidos da mesma carga", async () => {
    let snapshot = { linhas: [linha], areaAtual: "sede", carregado: true };
    let avisar;
    const resolver = new Map();
    const buscar = vi.fn(
      (area) => new Promise((resolve) => resolver.set(area, resolve)),
    );
    const estado = criarEstadoDaVisaoGeral({
      dados: {
        obter: () => snapshot,
        assinar: (fn) => {
          avisar = fn;
          return () => {};
        },
      },
      armazenamento: null,
    });
    estado.definirBuscaDoAcompanhamento(buscar);
    await vi.waitFor(() => expect(buscar).toHaveBeenCalledTimes(1));
    avisar();
    expect(buscar).toHaveBeenCalledTimes(1);
    snapshot = { ...snapshot, areaAtual: "projetos" };
    avisar();
    await vi.waitFor(() => expect(resolver.has("projetos")).toBe(true));
    resolver.get("sede")({
      etapas: [{ monitoramento_id: "antigo" }],
      listas: [],
    });
    resolver.get("projetos")({
      etapas: [{ monitoramento_id: "novo" }],
      listas: [],
    });
    await vi.waitFor(() =>
      expect(estado.obter().etapasPorEdital?.has("novo")).toBe(true),
    );
    expect(estado.obter().etapasPorEdital.has("antigo")).toBe(false);
    expect(estado.obter().area).toBe("projetos");
    avisar();
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("repassa o erro da RPC e não aceita números de marcos malformados", async () => {
    const erro = { code: "42501", message: "Sem acesso" };
    const rpc = vi.fn(async () => ({ data: null, error: erro }));
    await expect(buscarAcompanhamentoNoSupabase({ rpc })("sede")).rejects.toBe(
      erro,
    );
    expect(rpc).toHaveBeenCalledWith("listar_acompanhamento_da_visao_geral", {
      p_area: "sede",
    });
    for (const data of [
      null,
      [],
      { ano: "2026", concluidas_no_ano: 100 },
      { ano: 2026, concluidas_no_ano: -1 },
      { ano: 2026, concluidas_no_ano: campoInvalido },
    ]) {
      const resposta = await lerMarcosDaArea(
        { rpc: async () => ({ data, error: null }) },
        "sede",
      );
      expect(resposta.data).toBeNull();
      expect(resposta.error).toBeInstanceOf(Error);
    }
    const resultado = await lerMarcosDaArea(
      {
        rpc: async () => ({
          data: { ano: 2026, concluidas_no_ano: 7600 },
          error: null,
        }),
      },
      "sede",
    );
    expect(resultado).toEqual({
      data: { ano: 2026, concluidas_no_ano: 7600 },
      error: null,
    });
  });
});

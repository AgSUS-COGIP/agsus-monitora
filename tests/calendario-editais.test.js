import { describe, expect, it, vi } from "vitest";
import {
  comLimite,
  editaisComCronograma,
  montarEtapasDosEditais,
  montarGradeDoMes,
  etapasDoDia,
  proximasEtapas,
} from "../src/lib/calendario-editais.ts";
import { criarEstadoDoCalendario } from "../src/modulos/cronograma/estado.ts";

const RESUMO = [
  { id: 1, unidade: "DSEI Manaus", edital: "10/2026", cronograma_total: 1 },
];
const ETAPA = {
  monitoramento_id: 1,
  atividade: "Entrevista",
  data_inicio: "2026-09-15T12:00:00",
  data_fim: "2026-09-17",
  ordem: 1,
};
const auth = {
  getSession: async () => ({
    data: { session: { access_token: "token-falso" } },
    error: null,
  }),
};

describe("normalização das respostas do calendário", () => {
  it("só solicita cronogramas com ID utilizável e contagem positiva", () => {
    expect(
      editaisComCronograma([
        ...RESUMO,
        { id: "uuid", cronograma_total: "2" },
        null,
        false,
        [],
        { cronograma_total: 1 },
        { id: {}, cronograma_total: 1 },
        { id: "", cronograma_total: 1 },
        { id: 2, cronograma_total: "inválida" },
        { id: 3, cronograma_total: "Infinity" },
        { id: 5, cronograma_total: { toString: null, valueOf: null } },
        { id: 4, cronograma_total: 0 },
      ]),
    ).toEqual([
      ...RESUMO,
      {
        id: "uuid",
        cronograma_total: 2,
        unidade: "Unidade não informada",
        edital: "Edital sem número",
      },
    ]);
    expect(editaisComCronograma({ id: 1 })).toEqual([]);
  });

  it("ignora etapas malformadas, normaliza timestamps e conserva os marcos do intervalo", () => {
    const { etapas, editais, falhas } = montarEtapasDosEditais(
      editaisComCronograma(RESUMO),
      [[null, 7, [], {}, { data_inicio: "sem data" }, ETAPA]],
    );
    expect(etapas).toHaveLength(1);
    expect(etapas[0]).toMatchObject({
      editalId: "1",
      data_inicio: "2026-09-15",
      data_fim: "2026-09-17",
      tipo: { id: "entrevistas" },
    });
    expect(editais).toEqual([
      { id: "1", unidade: "DSEI Manaus", edital: "10/2026" },
    ]);
    expect(falhas).toBe(0);
    const grade = montarGradeDoMes(new Date(2026, 8, 1), etapas, {
      hoje: new Date(2026, 8, 15),
    });
    expect(grade).toHaveLength(42);
    expect(grade.find((c) => c.chave === "2026-09-15")).toMatchObject({
      hoje: true,
      total: 1,
    });
    expect(etapasDoDia(etapas, "2026-09-15")[0].marco).toBe("início");
    expect(etapasDoDia(etapas, "2026-09-16")).toEqual([]);
    expect(etapasDoDia(etapas, "2026-09-17")[0].marco).toBe("fim");
    expect(proximasEtapas(etapas, new Date(2026, 8, 16))).toEqual(etapas);
    const campoMalformado = { toString: null, valueOf: null };
    const comCamposInvalidos = montarEtapasDosEditais(
      editaisComCronograma([
        { id: 1, unidade: campoMalformado, cronograma_total: 1 },
      ]),
      [[{ ...ETAPA, atividade: campoMalformado, ordem: campoMalformado }]],
    );
    expect(comCamposInvalidos.etapas[0]).toMatchObject({
      unidade: "Unidade não informada",
      atividade: "Etapa sem nome",
      ordem: 0,
    });
  });
});

describe("concorrência no carregamento por edital", () => {
  it("preserva a ordem, limita pedidos simultâneos e isola uma falha", async () => {
    const liberar = new Map();
    let ativos = 0;
    let maximo = 0;
    const tarefa = vi.fn(async (item) => {
      ativos++;
      maximo = Math.max(maximo, ativos);
      try {
        if (item === "falha") throw new Error("indisponível");
        await new Promise((resolve) => liberar.set(item, resolve));
        return item.toUpperCase();
      } finally {
        ativos--;
      }
    });
    const carga = comLimite(["lento", "rápido", "falha", "resto"], 2, tarefa);
    expect(tarefa).toHaveBeenCalledTimes(2);
    liberar.get("rápido")();
    await vi.waitFor(() => expect(liberar.has("resto")).toBe(true));
    liberar.get("resto")();
    liberar.get("lento")();
    expect(await carga).toEqual(["LENTO", "RÁPIDO", null, "RESTO"]);
    expect(maximo).toBe(2);
    expect(ativos).toBe(0);
    expect(tarefa).toHaveBeenCalledTimes(4);
  });
});

describe("fronteiras das RPCs do calendário", () => {
  it("um item nulo na carga em lote não impede o cache nem as etapas válidas", async () => {
    const rpc = vi.fn(async (nome) => ({
      data:
        nome === "get_nucleo_cronograma_resumo"
          ? RESUMO
          : [null, false, [], ETAPA],
      error: null,
    }));
    const estado = criarEstadoDoCalendario({ supabase: { auth, rpc } });
    await estado.carregar();
    expect(estado.obter()).toMatchObject({
      carregado: true,
      carregando: false,
      erro: "",
    });
    expect(estado.obter().etapas).toHaveLength(1);
    await estado.carregar();
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("erros sem mensagem textual mostram a reserva e permitem tentar novamente", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: { detalhe: "falha" } },
    }));
    const estado = criarEstadoDoCalendario({ supabase: { auth, rpc } });
    await estado.carregar();
    expect(estado.obter()).toMatchObject({
      carregado: false,
      carregando: false,
      erro: "Não foi possível carregar os cronogramas.",
    });
    rpc.mockImplementation(async (nome) => ({
      data: nome === "get_nucleo_cronograma_resumo" ? RESUMO : [ETAPA],
      error: null,
    }));
    await estado.carregar(true);
    expect(estado.obter()).toMatchObject({
      carregado: true,
      carregando: false,
      erro: "",
    });
  });
});

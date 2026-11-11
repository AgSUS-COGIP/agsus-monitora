import { describe, expect, it, vi } from "vitest";
import {
  contarEtapasNoIntervalo,
  diasDaLista,
  editaisComCronograma,
  editaisDoFiltro,
  editalDaLinhaDoTempo,
  editalSuspenso,
  filtrarEtapas,
  montarEtapasDosEditais,
  montarGradeDoMes,
  proximasEtapas,
} from "../src/lib/calendario-editais.ts";
import { criarEstadoDoCalendario } from "../src/modulos/cronograma/estado.ts";

/*
  Cartão #59: edital suspenso aparecia no cronograma. O banco devolve só os
  editais com `ativo = true`, e o suspenso continua ativo (suspenso não é
  encerrado). Fixtures fictícias: dois editais ativos com etapas nos mesmos
  dias, um em andamento e outro com o status excepcional "Suspenso".
*/

const NORMAL = {
  id: "edital-normal",
  unidade: "DSEI Fictício Norte",
  edital: "900/2099",
  ativo: true,
  status: "Em andamento",
  status_override: null,
  cronograma_total: 2,
};
const SUSPENSO = {
  id: "edital-suspenso",
  unidade: "DSEI Fictício Sul",
  edital: "901/2099",
  ativo: true,
  status: "Suspenso",
  status_override: "Suspenso",
  cronograma_total: 2,
};
const RESUMO = [NORMAL, SUSPENSO];

const etapa = (
  edital: string,
  ordem: number,
  atividade: string,
  inicio: string,
  fim = inicio,
) => ({
  monitoramento_id: edital,
  ordem,
  atividade,
  data_inicio: inicio,
  data_fim: fim,
});
const ETAPAS_DO_BANCO = [
  etapa(NORMAL.id, 1, "Período de Entrevistas", "2099-03-10", "2099-03-12"),
  etapa(NORMAL.id, 2, "Resultado final do Processo Seletivo", "2099-03-20"),
  etapa(SUSPENSO.id, 1, "Período de Entrevistas", "2099-03-10", "2099-03-12"),
  etapa(SUSPENSO.id, 2, "Resultado final do Processo Seletivo", "2099-03-20"),
];
const etapasDe = (id: string) =>
  ETAPAS_DO_BANCO.filter((e) => e.monitoramento_id === id);

const auth = {
  getSession: async () => ({
    data: { session: { access_token: "token-falso" } },
    error: null,
  }),
};

describe("editalSuspenso", () => {
  it("reconhece o status excepcional e as grafias da planilha", () => {
    expect(editalSuspenso(SUSPENSO)).toBe(true);
    expect(editalSuspenso({ status: "SUSPENSO" })).toBe(true);
    expect(editalSuspenso({ status: "Suspensa" })).toBe(true);
    expect(editalSuspenso({ status: "  suspenso " })).toBe(true);
    // Resumo sem o status efetivo: o status excepcional basta.
    expect(editalSuspenso({ status: null, status_override: "Suspenso" })).toBe(
      true,
    );
  });

  it("não tira os outros status, nem o que vem malformado", () => {
    for (const status of [
      "Em andamento",
      "Planejado",
      "Concluído",
      "Paralisado",
      "Cancelado",
      "Cronograma pendente",
      "",
      null,
      undefined,
      42,
      { toString: () => "Suspenso" },
    ])
      expect(editalSuspenso({ status, status_override: null })).toBe(false);
    expect(editalSuspenso(null)).toBe(false);
    expect(editalSuspenso("Suspenso")).toBe(false);
  });
});

describe("edital suspenso fora do cronograma", () => {
  const editais = editaisComCronograma(RESUMO);
  const { etapas, editais: doCalendario } = montarEtapasDosEditais(
    editais,
    editais.map((e) => etapasDe(String(e.id))),
  );
  const hoje = new Date(2099, 2, 1);

  it("o resumo só pede o cronograma do edital não suspenso", () => {
    expect(editais.map((e) => e.id)).toEqual([NORMAL.id]);
    expect(doCalendario).toEqual([
      { id: NORMAL.id, unidade: NORMAL.unidade, edital: NORMAL.edital },
    ]);
    expect(etapas.every((e) => e.editalId === NORMAL.id)).toBe(true);
    expect(etapas).toHaveLength(2);
  });

  it("Mês: os dias só contam as etapas do edital não suspenso", () => {
    const grade = montarGradeDoMes(new Date(2099, 2, 1), etapas, { hoje });
    const dia10 = grade.find((c) => c.chave === "2099-03-10");
    expect(dia10?.total).toBe(1);
    expect(dia10?.marcos.map((m) => m.etapa.editalId)).toEqual([NORMAL.id]);
  });

  it("Semana e Lista: nenhuma etapa do suspenso", () => {
    expect(contarEtapasNoIntervalo(etapas, "2099-03-08", "2099-03-14")).toBe(
      1,
    );
    const dias = diasDaLista(etapas, "2099-03-01", "2099-03-31", 2099);
    const ids = dias.flatMap((d) => d.itens.map((i) => i.etapa.editalId));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain(SUSPENSO.id);
  });

  it("Próximas etapas e linha do tempo: só o edital não suspenso", () => {
    expect(proximasEtapas(etapas, hoje).map((e) => e.editalId)).toEqual([
      NORMAL.id,
      NORMAL.id,
    ]);
    const visiveis = editaisDoFiltro(doCalendario, filtrarEtapas(etapas));
    expect(visiveis.map((e) => e.id)).toEqual([NORMAL.id]);
    // Um link antigo que apontava para o suspenso cai no primeiro que restou.
    expect(editalDaLinhaDoTempo(SUSPENSO.id, visiveis)).toBe(NORMAL.id);
  });
});

describe("carga do cronograma com edital suspenso", () => {
  it("a RPC das etapas devolve o suspenso (só filtra ativo): a tela o tira, também do cache", async () => {
    const rpc = vi.fn(async (nome: string) => ({
      data:
        nome === "get_nucleo_cronograma_resumo"
          ? RESUMO
          : nome === "listar_etapas_do_cronograma"
            ? ETAPAS_DO_BANCO
            : [],
      error: null,
    }));
    let agora = 1_000;
    const estado = criarEstadoDoCalendario({
      supabase: { auth, rpc } as never,
      relogio: () => agora,
    });
    await estado.carregar();
    const primeira = estado.obter();
    expect(primeira.editais.map((e) => e.id)).toEqual([NORMAL.id]);
    expect(primeira.etapas.map((e) => e.editalId)).toEqual([
      NORMAL.id,
      NORMAL.id,
    ]);

    // Reabrir dentro do minuto usa o cache: continua sem o suspenso e sem pedir de novo.
    agora += 10_000;
    await estado.carregar();
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(estado.obter().etapas).toBe(primeira.etapas);
  });

  it("caminho antigo, por edital (PGRST202): nem pede o cronograma do suspenso", async () => {
    const rpc = vi.fn(async (nome: string, argumentos?: unknown) => {
      if (nome === "get_nucleo_cronograma_resumo")
        return { data: RESUMO, error: null };
      if (nome === "listar_etapas_do_cronograma")
        return { data: null, error: { code: "PGRST202" } };
      if (nome === "get_monitoramento_cronograma") {
        const id = (argumentos as { p_monitoramento_id: string })
          .p_monitoramento_id;
        return { data: { etapas: etapasDe(id) }, error: null };
      }
      return { data: [], error: null };
    });
    const estado = criarEstadoDoCalendario({
      supabase: { auth, rpc } as never,
    });
    await estado.carregar();
    const pedidos = rpc.mock.calls.filter(
      ([nome]) => nome === "get_monitoramento_cronograma",
    );
    expect(pedidos).toEqual([
      ["get_monitoramento_cronograma", { p_monitoramento_id: NORMAL.id }],
    ]);
    expect(estado.obter().etapas.map((e) => e.editalId)).toEqual([
      NORMAL.id,
      NORMAL.id,
    ]);
  });
});

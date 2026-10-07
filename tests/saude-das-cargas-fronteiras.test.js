import { describe, expect, it, vi } from "vitest";
import { normalizarSaude, visaoSimples } from "../src/lib/saude-das-cargas.ts";
import {
  acompanhamentoDoPedido,
  normalizarPainel,
  normalizarVagas,
} from "../src/lib/painel-dos-robos.ts";
import { criarEstadoDaSaude } from "../src/componentes/saude-das-cargas/estado.ts";

import { situacaoDoPedido } from "../src/lib/robos-de-carga.js";

describe("fronteiras do Status das atualizações", () => {
  it("mantém o acompanhamento quando o histórico ainda não existe", () => {
    expect(
      acompanhamentoDoPedido({
        robo: "empregare",
        pedido: { em: new Date("2026-10-07T12:00:00Z"), modo: "normal" },
        execucoes: null,
      }),
    ).toMatchObject({ etapa: "aguardando", execucao: null, url: null });
  });
  it.each([null, [], "inválido"])(
    "normaliza respostas fora do formato: %s",
    (entrada) => {
      expect(normalizarPainel(entrada)).toMatchObject({
        geradoEm: null,
        areas: [],
        editais: [],
        execucoes: { empregare: [], pre_classificacao: [] },
      });
      expect(normalizarVagas(entrada)).toEqual([]);
      expect(
        visaoSimples(normalizarSaude(entrada)).linhas.every(
          (l) => l.situacao === "nunca",
        ),
      ).toBe(true);
    },
  );
  it("descarta execuções inválidas e não usa nomes herdados do objeto", () => {
    const saude = normalizarSaude(
      {
        analises: [
          null,
          [],
          {
            area: "constructor",
            origem: "origem",
            tipo: "INCREMENTAL",
            execucoes: [
              null,
              "erro",
              {
                inicio: {},
                fim: "2026-10-07T12:00:00Z",
                situacao: "processado",
                linhas: Infinity,
                mensagem: {},
              },
            ],
          },
        ],
        empregare: [null, []],
        tarefas: [null, { nome: "constructor", agenda: {}, execucoes: [] }],
      },
      new Date("2026-10-07T12:30:00Z"),
    );
    expect(saude.grupos[0].cargas).toHaveLength(1);
    expect(saude.grupos[0].cargas[0].nome).toBe("constructor · incremental");
    expect(saude.grupos[0].cargas[0].historico).toHaveLength(1);
    expect(saude.grupos[0].cargas[0].historico[0]).toMatchObject({
      inicio: null,
      linhas: null,
      mensagem: null,
    });
    expect(saude.grupos[2].cargas[0].historico).toEqual([]);
    expect(saude.grupos.find((g) => g.id === "tarefas").cargas[0].nome).toBe(
      "constructor",
    );
  });
  it("normaliza campos desconhecidos do histórico e permite somente links HTTP ou HTTPS", () => {
    const painel = normalizarPainel({
      empregare: [
        null,
        {
          id: "e1",
          disparo: "constructor",
          execucao: "javascript:alert(1)",
          filtro: [],
          vagas_pedidas: Infinity,
          por_vaga: [null, { vaga: "123", ativos: {}, arquivo: "10" }],
        },
      ],
    });
    expect(painel.execucoes.empregare).toHaveLength(1);
    expect(painel.execucoes.empregare[0]).toMatchObject({
      quem: "—",
      execucao: null,
      porVaga: [{ vaga: "123", ativos: null, arquivo: 10 }],
    });
    expect(
      situacaoDoPedido({ situacao: {}, http: Infinity, mensagem: {} }),
    ).toMatchObject({
      situacao: "PEDIDO",
      http: null,
      mensagem: "",
      terminou: false,
      aviso: null,
    });
  });
  it("mantém opções e os dois agendamentos do pedido simulado pelo banco", async () => {
    const rpc = vi.fn(async () => ({ data: 41, error: null }));
    const agendar = vi.fn();
    const agora = () => new Date("2026-10-07T12:00:00Z");
    const estado = criarEstadoDaSaude({ supabase: { rpc }, agendar, agora });
    const opcoes = { modo: "seco", editais: [], vagas: ["123"], limite: 1 };
    expect(await estado.rodarComOpcoes("empregare", opcoes, "Uma vaga.")).toBe(
      true,
    );
    expect(rpc).toHaveBeenCalledWith("disparar_robo", {
      p_robo: "empregare",
      p_inputs: { modo: "seco", vagas: ["123"], limite: "1" },
    });
    expect(agendar).toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(agendar).toHaveBeenCalledWith(expect.any(Function), 20000);
    expect(estado.obter().acompanhamentos.empregare).toMatchObject({
      id: 41,
      em: agora(),
      modo: "seco",
      frase: "Uma vaga.",
      disparo: { situacao: "PEDIDO", terminou: false },
    });
  });
  it.each([null, {}, [], "inválido", 0, Infinity, 1.5])(
    "recusa identificador inválido do disparo: %s",
    async (data) => {
      const agendar = vi.fn();
      const estado = criarEstadoDaSaude({
        supabase: { rpc: async () => ({ data, error: null }) },
        agendar,
      });
      expect(await estado.rodarAgora("empregare")).toBe(false);
      expect(estado.obter().acompanhamentos).toEqual({});
      expect(estado.obter().pedidos.empregare).toBeNull();
      expect(agendar).not.toHaveBeenCalled();
    },
  );
  it("preserva identificadores bigint recebidos como texto", async () => {
    const id = "9007199254740993";
    const estado = criarEstadoDaSaude({
      supabase: { rpc: async () => ({ data: id, error: null }) },
      agendar: vi.fn(),
    });
    expect(await estado.rodarAgora("empregare")).toBe(true);
    expect(estado.obter().acompanhamentos.empregare.id).toBe(id);
  });
  it("descarta pedidos inválidos na agenda e rótulos herdados de workflow", () => {
    const saude = normalizarSaude({
      agenda_dos_robos: {
        chave_cadastrada: true,
        ultimo_aceito: {},
        falhas_24h: Infinity,
        disparos: [
          null,
          [],
          { workflow: "constructor", situacao: "FALHOU", http: {} },
        ],
      },
    });
    const agenda = saude.grupos.find((g) => g.id === "agenda").cargas[0];
    expect(agenda.historico).toHaveLength(1);
    expect(agenda.historico[0].mensagem).toBe("constructor");
    expect(agenda.agenda).toMatchObject({ ultimoAceito: null, falhas24h: 0 });
    expect(
      normalizarSaude({ agenda_dos_robos: [] }).grupos.find(
        (g) => g.id === "agenda",
      ).cargas,
    ).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  nomeDoWorkflow,
  normalizarCatalogo,
  tarefaDoCatalogo,
} from "../src/lib/catalogo-dos-robos.ts";
import { normalizarSaude, visaoSimples } from "../src/lib/saude-das-cargas.ts";
import { CATALOGO_DOS_ROBOS } from "./fixtures/catalogo-dos-robos.ts";

const CATALOGO = normalizarCatalogo(CATALOGO_DOS_ROBOS);

describe("normalizarCatalogo", () => {
  it("lê workflows e tarefas", () => {
    expect(CATALOGO?.workflows.size).toBe(11);
    expect(CATALOGO?.workflows.get("conferencias.yml")).toEqual({
      workflow: "conferencias.yml",
      nome: "Conferências",
      chave: "conferencias",
      disparavel: true,
    });
    expect(CATALOGO?.tarefas).toHaveLength(17);
  });

  it("sem as duas listas não é catálogo (RPC ausente, erro ou outro payload)", () => {
    expect(normalizarCatalogo(null)).toBeNull();
    expect(normalizarCatalogo([])).toBeNull();
    expect(normalizarCatalogo({ tarefas: [] })).toBeNull();
    expect(normalizarCatalogo({ workflows: [] })).toBeNull();
  });

  it("descarta entradas malformadas sem quebrar", () => {
    const c = normalizarCatalogo({
      workflows: [
        null,
        1,
        { workflow: "" },
        { workflow: "a.yml", nome: 3, chave: {} },
      ],
      tarefas: [
        { tarefa: "" },
        "x",
        { tarefa: "agsus_x", prefixo: "sim", workflow: 2 },
      ],
    });
    expect([...(c?.workflows.values() ?? [])]).toEqual([
      { workflow: "a.yml", nome: "a.yml", chave: null, disparavel: false },
    ]);
    expect(c?.tarefas).toEqual([
      {
        tarefa: "agsus_x",
        prefixo: false,
        rotulo: "",
        chave: null,
        workflow: null,
      },
    ]);
  });
});

describe("nomes e tarefas pelo catálogo", () => {
  it("nome do workflow; sem catálogo ou fora dele, o arquivo", () => {
    expect(nomeDoWorkflow(CATALOGO, "robo-empregare.yml")).toBe(
      "Robô da Empregare",
    );
    expect(nomeDoWorkflow(CATALOGO, "novo.yml")).toBe("novo.yml");
    expect(nomeDoWorkflow(null, "conferencias.yml")).toBe("conferencias.yml");
  });

  it("tarefa: nome exato ganha do prefixo; prefixo mais longo ganha (a regra do banco)", () => {
    expect(
      tarefaDoCatalogo(CATALOGO, "agsus_robo_conferencias")?.workflow,
    ).toBe("conferencias.yml");
    expect(
      tarefaDoCatalogo(CATALOGO, "agsus_robo_inscricoes_120_2026")?.chave,
    ).toBe("robo_de_inscricoes");
    expect(tarefaDoCatalogo(CATALOGO, "agsus_robo_inscricoes")).toBeNull();
    expect(tarefaDoCatalogo(CATALOGO, "outra")).toBeNull();
    expect(tarefaDoCatalogo(null, "agsus_robo_conferencias")).toBeNull();
    const comExata = normalizarCatalogo({
      workflows: [],
      tarefas: [
        { tarefa: "agsus_a_", prefixo: true, rotulo: "curto" },
        { tarefa: "agsus_a_b_", prefixo: true, rotulo: "longo" },
        { tarefa: "agsus_a_b_c", prefixo: false, rotulo: "exato" },
      ],
    });
    expect(tarefaDoCatalogo(comExata, "agsus_a_b_c")?.rotulo).toBe("exato");
    expect(tarefaDoCatalogo(comExata, "agsus_a_b_cd")?.rotulo).toBe("longo");
    expect(tarefaDoCatalogo(comExata, "agsus_a_x")?.rotulo).toBe("curto");
  });
});

describe("Status das atualizações com e sem o catálogo", () => {
  const AGORA = new Date("2026-11-09T12:00:00Z");
  const ha = (min: number) =>
    new Date(AGORA.getTime() - min * 60000).toISOString();
  const PAYLOAD = {
    entrevistas: [],
    selecao: [],
    conferencias: [
      { inicio: ha(27 * 60 + 1), fim: ha(27 * 60), situacao: "CONCLUIDA" },
    ],
    agenda_dos_robos: {
      chave_cadastrada: true,
      ultimo_aceito: ha(27 * 60),
      falhas_24h: 0,
      sem_chave_24h: 0,
      disparos: [
        {
          workflow: "conferencias.yml",
          inicio: ha(27 * 60),
          fim: ha(27 * 60),
          situacao: "ACEITO",
          http: 204,
        },
        {
          workflow: "novo.yml",
          inicio: ha(28 * 60),
          fim: ha(28 * 60),
          situacao: "ACEITO",
        },
      ],
    },
    tarefas: [
      {
        nome: "agsus_robo_conferencias",
        agenda: "0 9 * * *",
        ativa: true,
        execucoes: [],
      },
      {
        nome: "agsus_robo_inscricoes_120_2026",
        agenda: "0 10 * * *",
        ativa: false,
        execucoes: [],
      },
      {
        nome: "agsus_tarefa_nova",
        agenda: "0 1 * * *",
        ativa: true,
        execucoes: [],
      },
    ],
  };
  const carga = (payload: object, id: string) =>
    normalizarSaude(payload, AGORA)
      .grupos.flatMap((g) => g.cargas)
      .find((c) => c.id === id);

  it("com o catálogo: Conferências atrasa pela tarefa que pede conferencias.yml; nomes de gente", () => {
    const comCatalogo = { ...PAYLOAD, catalogo_dos_robos: CATALOGO_DOS_ROBOS };
    expect(carga(comCatalogo, "conferencias")).toMatchObject({
      prazoMin: 26 * 60,
      esperado: "todo dia às 6h",
      situacao: "atrasada",
    });
    const agenda = carga(comCatalogo, "agenda_dos_robos");
    expect(agenda?.situacao).toBe("atrasada");
    expect(agenda?.esperado).toBe("Conferências: todo dia às 6h");
    expect(agenda?.historico.map((e) => e.mensagem)).toEqual([
      "Conferências · HTTP 204",
      "novo.yml",
    ]);
    expect(
      carga(comCatalogo, "tarefa:agsus_robo_inscricoes_120_2026")?.nome,
    ).toBe("Agenda das inscrições: pedir o robô da Empregare");
    expect(carga(comCatalogo, "tarefa:agsus_tarefa_nova")?.nome).toBe(
      "agsus_tarefa_nova",
    );
    expect(
      visaoSimples(normalizarSaude(comCatalogo, AGORA)).atencao.map(
        (l) => l.id,
      ),
    ).toContain("conferencias");
  });

  it("sem o catálogo: nomes do banco e nenhuma carga com agenda conhecida (não acusa atraso falso)", () => {
    expect(carga(PAYLOAD, "conferencias")).toMatchObject({
      prazoMin: null,
      esperado: "só pelo Rodar agora",
      situacao: "em_dia",
    });
    const agenda = carga(PAYLOAD, "agenda_dos_robos");
    expect(agenda?.situacao).toBe("em_dia");
    expect(agenda?.historico[0]?.mensagem).toBe("conferencias.yml · HTTP 204");
    expect(carga(PAYLOAD, "tarefa:agsus_robo_conferencias")?.nome).toBe(
      "agsus_robo_conferencias",
    );
  });
});

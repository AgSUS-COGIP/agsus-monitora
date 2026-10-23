import { describe, expect, it } from "vitest";
import {
  chaveDaLinha,
  mensagemDaRecusa,
  motivoValido,
  normalizarChaves,
  proximaDaChave,
  proximaExecucao,
  semProxima,
  tarefasForaDaChave,
  ultimaExecucao,
} from "../src/lib/chaves-da-automacao.ts";
import { normalizarSaude, visaoSimples } from "../src/lib/saude-das-cargas.ts";

/*
  Chaves da automação (Configurações › Automação, 20261022190000): leitura do
  payload, próxima execução pela agenda do pg_cron (UTC), última execução,
  tarefas mexidas direto no banco, motivo e o efeito no Status das
  atualizações ("Desligada pelo administrador" em vez de atraso ou erro).
*/

const AGORA = new Date("2026-10-22T14:07:30Z");
const ha = (min) => new Date(AGORA.getTime() - min * 60000).toISOString();

const PAYLOAD_DAS_CHAVES = () => ({
  schema_version: 1,
  gerado_em: AGORA.toISOString(),
  cron_disponivel: true,
  chaves: [
    {
      chave: "entrevistas",
      nome: "Entrevistas",
      ligada: false,
      motivo: "Pausa de propósito desde 16/10/2026.",
      em: "2026-10-22T13:00:00Z",
      por: "Gestão da Informação de Pessoal",
      tarefas: [
        {
          nome: "agsus_robo_sincronizar_entrevistas",
          agenda: "5 * * * *",
          ativa: false,
          ultima: {
            inicio: "2026-10-16T10:05:00Z",
            fim: "2026-10-16T10:05:01Z",
            situacao: "succeeded",
          },
        },
      ],
      ultimo_pedido: null,
      ultima_pre_classificacao: null,
    },
    {
      chave: "paineis",
      nome: "Pacotes dos painéis",
      ligada: true,
      motivo: "Estado inicial (migração 20261022190000).",
      em: "2026-10-22T13:00:00Z",
      por: null,
      tarefas: [
        {
          nome: "agsus_analises_cache_do_painel",
          agenda: "*/5 * * * *",
          ativa: true,
          ultima: { inicio: ha(2), fim: ha(2), situacao: "succeeded" },
        },
        {
          nome: "agsus_aprovados_cache_por_area",
          agenda: "1-59/5 * * * *",
          ativa: true,
          ultima: { inicio: ha(1), fim: ha(1), situacao: "succeeded" },
        },
      ],
    },
    {
      chave: "pre_classificacao",
      nome: "Pré-classificação automática",
      ligada: true,
      motivo: "Estado inicial (migração 20261022190000).",
      tarefas: [],
      ultima_pre_classificacao: {
        inicio: "2026-10-15T12:14:00Z",
        situacao: "CONCLUIDA",
      },
    },
    { nome: "sem código" },
    "lixo",
  ],
  sem_chave: [
    {
      nome: "agsus_robo_conferir_disparos",
      agenda: "*/5 * * * *",
      ativa: true,
      chave: null,
    },
  ],
  historico: [
    {
      chave: "entrevistas",
      ligada: false,
      motivo: "Pausa de propósito desde 16/10/2026.",
      em: "2026-10-22T13:00:00Z",
      por: null,
      tarefas: ["agsus_robo_sincronizar_entrevistas", 3, { x: 1 }],
    },
    { ligada: true },
  ],
});

describe("normalizarChaves", () => {
  it("lê as chaves e descarta o que não é registro ou não tem código", () => {
    const dados = normalizarChaves(PAYLOAD_DAS_CHAVES());
    expect(dados.chaves.map((c) => c.chave)).toEqual([
      "entrevistas",
      "paineis",
      "pre_classificacao",
    ]);
    const [entrevistas] = dados.chaves;
    expect(entrevistas.ligada).toBe(false);
    expect(entrevistas.em).toEqual(new Date("2026-10-22T13:00:00Z"));
    expect(entrevistas.tarefas[0].ultima.situacao).toBe("succeeded");
    expect(dados.semChave.map((t) => t.nome)).toEqual([
      "agsus_robo_conferir_disparos",
    ]);
    expect(dados.historico).toHaveLength(1);
    expect(dados.historico[0].tarefas).toEqual([
      "agsus_robo_sincronizar_entrevistas",
      "3",
    ]);
  });

  it("entrada malformada vira lista vazia", () => {
    for (const entrada of [null, "x", 3, [], { chaves: "x" }]) {
      const dados = normalizarChaves(entrada);
      expect(dados.chaves).toEqual([]);
      expect(dados.historico).toEqual([]);
    }
    expect(normalizarChaves({ cron_disponivel: false }).cronDisponivel).toBe(
      false,
    );
  });
});

describe("proximaExecucao (agenda do pg_cron, UTC)", () => {
  const prox = (agenda, agora = AGORA) =>
    proximaExecucao(agenda, agora)?.toISOString() ?? null;

  it("de hora em hora, faixas, passos e listas", () => {
    expect(prox("5 * * * *")).toBe("2026-10-22T15:05:00.000Z");
    expect(prox("20,50 * * * *")).toBe("2026-10-22T14:20:00.000Z");
    expect(prox("1-59/5 * * * *")).toBe("2026-10-22T14:11:00.000Z");
    expect(prox("*/5 * * * *")).toBe("2026-10-22T14:10:00.000Z");
    expect(prox("10 11,16,21 * * *")).toBe("2026-10-22T16:10:00.000Z");
  });

  it("vira o dia, o mês e respeita o dia da semana", () => {
    expect(prox("0 9 * * *")).toBe("2026-10-23T09:00:00.000Z");
    expect(prox("0 6 1 * *")).toBe("2026-11-01T06:00:00.000Z");
    // 22/10/2026 é quinta (4); domingo seguinte, 25/10.
    expect(prox("0 12 * * 0")).toBe("2026-10-25T12:00:00.000Z");
    expect(prox("0 12 * * 7")).toBe("2026-10-25T12:00:00.000Z");
    // Dia do mês e da semana restritos: vale um ou outro.
    expect(prox("0 12 30 * 6")).toBe("2026-10-24T12:00:00.000Z");
  });

  it("o minuto exato de agora já passou: é o próximo", () => {
    expect(prox("7 14 * * *")).toBe("2026-10-23T14:07:00.000Z");
  });

  it("agenda fora do formato não tem próxima", () => {
    for (const agenda of [
      "30 seconds",
      "",
      "* * *",
      "61 * * * *",
      "a b c d e",
      null,
    ])
      expect(prox(agenda)).toBeNull();
    expect(prox("0 0 31 2 *")).toBeNull();
  });
});

describe("cada chave na tela", () => {
  const dados = normalizarChaves(PAYLOAD_DAS_CHAVES());
  const [entrevistas, paineis, pre] = dados.chaves;

  it("última: a tarefa mais recente, ou a pré-classificação do fim do robô", () => {
    expect(ultimaExecucao(paineis).inicio).toEqual(new Date(ha(1)));
    expect(ultimaExecucao(pre).situacao).toBe("CONCLUIDA");
    expect(ultimaExecucao(entrevistas).inicio).toEqual(
      new Date("2026-10-16T10:05:00Z"),
    );
  });

  it("próxima: a mais cedo das tarefas ativas; nada com a chave desligada", () => {
    expect(proximaDaChave(paineis, AGORA)).toEqual(
      new Date("2026-10-22T14:10:00Z"),
    );
    expect(proximaDaChave(entrevistas, AGORA)).toBeNull();
    expect(semProxima(entrevistas)).toBe("Não roda enquanto estiver desligada");
    expect(semProxima(pre)).toBe("No fim de cada carga do robô da Empregare");
    expect(
      semProxima({
        ...pre,
        chave: "classificacao",
        nome: "Classificação em Python",
      }),
    ).toBe("Quando uma lista é gerada na Classificação");
  });

  it("aponta a tarefa mexida direto no banco", () => {
    expect(tarefasForaDaChave(entrevistas)).toEqual([]);
    expect(
      tarefasForaDaChave({
        ...entrevistas,
        tarefas: [{ ...entrevistas.tarefas[0], ativa: true }],
      }).map((t) => t.nome),
    ).toEqual(["agsus_robo_sincronizar_entrevistas"]);
  });

  it("chave das linhas do Status das atualizações", () => {
    expect(chaveDaLinha(dados, "entrevistas")?.chave).toBe("entrevistas");
    expect(chaveDaLinha(dados, "empregare")).toBeNull();
    expect(chaveDaLinha(dados, "constructor")).toBeNull();
    expect(chaveDaLinha(null, "entrevistas")).toBeNull();
  });
});

describe("motivo e recusas", () => {
  it("motivo de 10 a 500 caracteres", () => {
    expect(motivoValido("curto")).toBe(false);
    expect(motivoValido("          ".repeat(3))).toBe(false);
    expect(motivoValido("Pausa pedida pela coordenação")).toBe(true);
    expect(motivoValido("x".repeat(501))).toBe(false);
    expect(motivoValido(null)).toBe(false);
  });

  it("recusas do banco em português", () => {
    expect(mensagemDaRecusa({ code: "42501" })).toMatch(/administrador global/);
    expect(mensagemDaRecusa({ code: "55000" })).toMatch(/Outra pessoa/);
    expect(mensagemDaRecusa({ code: "PGRST202" })).toMatch(/20261022190000/);
    expect(mensagemDaRecusa({ message: "x" })).toBe("x");
  });
});

describe("Status das atualizações com as chaves", () => {
  const SAUDE = {
    gerado_em: AGORA.toISOString(),
    analises: [],
    entrevistas: [
      // Última de 16/10: sem chave seria "Atrasada".
      {
        inicio: "2026-10-16T10:05:00Z",
        fim: "2026-10-16T10:05:30Z",
        situacao: "CONCLUIDA",
      },
    ],
    selecao: [{ inicio: ha(30), situacao: "RECUSADA", mensagem: "falhou" }],
    agenda_dos_robos: {
      chave_cadastrada: true,
      ultimo_aceito: ha(5 * 60),
      falhas_24h: 0,
      sem_chave_24h: 0,
      disparos: [
        {
          workflow: "conferencias.yml",
          inicio: ha(5 * 60),
          fim: ha(5 * 60),
          situacao: "ACEITO",
        },
      ],
    },
    tarefas: [
      {
        nome: "agsus_analises_cache_do_painel",
        agenda: "*/5 * * * *",
        ativa: false,
        execucoes: [{ inicio: ha(600), fim: ha(600), situacao: "succeeded" }],
      },
    ],
  };

  it("sem as chaves, segue como antes", () => {
    const { linhas } = visaoSimples(normalizarSaude(SAUDE, AGORA));
    const porId = Object.fromEntries(linhas.map((l) => [l.id, l]));
    expect(porId.entrevistas.situacao).toBe("atrasada");
    expect(porId.agenda_dos_robos.situacao).toBe("atrasada");
  });

  it("chave desligada: 'Desligada pelo administrador', sem atraso nem erro", () => {
    const chaves = normalizarChaves({
      chaves: [
        {
          chave: "entrevistas",
          nome: "Entrevistas",
          ligada: false,
          motivo: "Pausa de propósito",
          por: "Setor",
        },
        { chave: "selecao", nome: "Seleção", ligada: false, motivo: "Pausa" },
        {
          chave: "paineis",
          nome: "Pacotes dos painéis",
          ligada: false,
          motivo: "Teste",
          tarefas: [
            {
              nome: "agsus_analises_cache_do_painel",
              agenda: "*/5 * * * *",
              ativa: false,
            },
          ],
        },
      ],
    });
    const { linhas, atencao } = visaoSimples(
      normalizarSaude(SAUDE, AGORA),
      chaves,
    );
    const porId = Object.fromEntries(linhas.map((l) => [l.id, l]));
    expect(porId.entrevistas.situacao).toBe("desligada");
    expect(porId.entrevistas.desligada).toEqual({
      motivo: "Pausa de propósito",
      em: null,
      por: "Setor",
    });
    expect(porId.selecao.situacao).toBe("desligada");
    expect(porId.selecao.erro).toBeNull();
    // Entrevistas desligada: a agenda só pede as diárias; 5 h sem pedido não é atraso.
    expect(porId.agenda_dos_robos.situacao).toBe("em_dia");
    expect(porId.tarefas.partes[0].situacao).toBe("desligada");
    expect(atencao.map((l) => l.id)).toEqual([]);
  });
});

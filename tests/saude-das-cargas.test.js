import { describe, expect, it } from "vitest";
import {
  normalizarSaude,
  prazoDaAgenda,
  prazoDosDiasUteis,
  PRAZO_FIM_DE_SEMANA_MIN,
  PRAZO_DIARIO_MIN,
  PRAZO_DE_HORA_EM_HORA_MIN,
  PRAZO_DA_NOITE_MIN,
  prazoDeHoraEmHora,
  PRAZO_FREQUENTE_MIN,
  PRAZO_MENSAL_MIN,
  textoDaIdade,
  visaoSimples,
} from "../src/lib/saude-das-cargas.js";

/* "Agora" fixo: 01/10/2026 12:00 UTC. */
const AGORA = new Date("2026-10-01T12:00:00Z");
const ha = (min) => new Date(AGORA.getTime() - min * 60000).toISOString();
const execucao = (situacao, minAtras, extra = {}) => ({
  inicio: ha(minAtras + 1),
  fim: ha(minAtras),
  situacao,
  ...extra,
});

/* O formato de get_saude_das_cargas (20261001120000_saude_das_cargas.sql). */
const PAYLOAD = {
  schema_version: 1,
  gerado_em: AGORA.toISOString(),
  analises: [
    {
      origem: "apps_script_analises_incremental_v1",
      area: "saude-indigena",
      tipo: "INCREMENTAL",
      execucoes: [execucao("processado", 10, { linhas: "120" })],
    },
    {
      origem: "apps_script_analises_sede_incremental_v1",
      area: "sede",
      tipo: "INCREMENTAL",
      execucoes: [execucao("processado", 90)],
    },
    {
      origem: "apps_script_analises_projetos_incremental_v1",
      area: "projetos",
      tipo: "INCREMENTAL",
      // A mais recente falhou, mesmo com uma boa antes.
      execucoes: [
        execucao("processado", 40),
        execucao("erro", 5, { mensagem: "Timeout" }),
      ],
    },
    {
      origem: "apps_script_analises_curriculares_v2_pdf",
      area: "saude-indigena",
      tipo: "FULL",
      // Completa de 10 dias atrás: sem prazo, segue em dia.
      execucoes: [execucao("processado", 10 * 24 * 60)],
    },
    {
      origem: "apps_script_analises_sede_full_v1",
      area: "sede",
      tipo: "FULL",
      execucoes: [],
    },
  ],
  entrevistas: [
    { inicio: ha(181), fim: ha(180), situacao: "CONCLUIDA", linhas: 3404 },
  ],
  selecao: [
    { inicio: ha(2), fim: null, situacao: "EM_ANDAMENTO", linhas: 0 },
    {
      inicio: ha(27 * 60),
      fim: ha(27 * 60 - 1),
      situacao: "CONCLUIDA",
      linhas: 3146,
    },
  ],
  tarefas: [
    {
      nome: "agsus_entrevistas_cache_do_painel",
      agenda: "1-59/2 * * * *",
      ativa: true,
      execucoes: [{ inicio: ha(1), fim: ha(1), situacao: "succeeded" }],
    },
    {
      nome: "agsus_analises_cache_do_painel",
      agenda: "*/2 * * * *",
      ativa: true,
      execucoes: [
        { inicio: ha(3), fim: ha(3), situacao: "failed", mensagem: "deadlock" },
      ],
    },
  ],
};

const saude = normalizarSaude(PAYLOAD, AGORA);
const carga = (id) =>
  saude.grupos.flatMap((g) => g.cargas).find((c) => c.id === id);

describe("selo de cada carga", () => {
  it("incremental das análises: em dia até 1 h, atrasada depois", () => {
    expect(carga("analises:apps_script_analises_incremental_v1")).toMatchObject(
      {
        nome: "Saúde Indígena · incremental",
        situacao: "em_dia",
        idadeMin: 10,
      },
    );
    expect(
      carga("analises:apps_script_analises_incremental_v1").ultimaOk.linhas,
    ).toBe(120);
    expect(
      carga("analises:apps_script_analises_sede_incremental_v1").situacao,
    ).toBe("atrasada");
  });

  it("a execução terminada mais recente com erro é falha, com a mensagem", () => {
    const c = carga("analises:apps_script_analises_projetos_incremental_v1");
    expect(c.situacao).toBe("falhou");
    expect(c.historico[0]).toMatchObject({
      situacao: "falha",
      mensagem: "Timeout",
    });
    expect(c.ultimaOk.situacao).toBe("ok");
  });

  it("a carga completa não tem prazo; sem execução é 'nunca rodou'", () => {
    expect(
      carga("analises:apps_script_analises_curriculares_v2_pdf"),
    ).toMatchObject({
      nome: "Saúde Indígena · carga completa",
      situacao: "em_dia",
      prazoMin: null,
    });
    expect(carga("analises:apps_script_analises_sede_full_v1").situacao).toBe(
      "nunca",
    );
  });

  it("entrevistas e seleção: atrasada pelo prazo de hora em hora; rodando agora aparece", () => {
    expect(carga("entrevistas")).toMatchObject({
      situacao: "em_dia",
      idadeMin: 180,
    });
    const selecao = carga("selecao");
    expect(selecao.situacao).toBe("atrasada");
    expect(selecao.emAndamento).toBe(true);
    expect(selecao.ultimaOk.linhas).toBe(3146);
  });

  it("tarefas do banco com nome legível e o prazo pela agenda", () => {
    expect(carga("tarefa:agsus_entrevistas_cache_do_painel")).toMatchObject({
      nome: "Painel de entrevistas (pacote pronto)",
      situacao: "em_dia",
      prazoMin: PRAZO_FREQUENTE_MIN,
    });
    expect(carga("tarefa:agsus_analises_cache_do_painel").situacao).toBe(
      "falhou",
    );
  });

  it("resumo conta cada situação", () => {
    expect(saude.resumo).toEqual({
      em_dia: 4,
      atrasada: 2,
      falhou: 2,
      em_andamento: 0,
      nunca: 1,
    });
    expect(saude.total).toBe(9);
  });

  it("sem acesso ao pg_cron, o grupo das tarefas fica indisponível", () => {
    const sem = normalizarSaude({ ...PAYLOAD, tarefas: null }, AGORA);
    const grupo = sem.grupos.find((g) => g.id === "tarefas");
    expect(grupo.indisponivel).toBe(true);
    expect(grupo.cargas).toEqual([]);
  });

  it("só execução em curso, sem nenhuma terminada: em andamento", () => {
    const so = normalizarSaude(
      { selecao: [{ inicio: ha(1), situacao: "EM_ANDAMENTO" }] },
      AGORA,
    );
    expect(so.grupos[1].cargas[1].situacao).toBe("em_andamento");
  });
});

describe("prazos e textos", () => {
  it("prazo pela agenda do pg_cron", () => {
    expect(prazoDaAgenda("*/2 * * * *")).toBe(PRAZO_FREQUENTE_MIN);
    expect(prazoDaAgenda("1-59/2 * * * *")).toBe(PRAZO_FREQUENTE_MIN);
    expect(prazoDaAgenda("20 6 * * *")).toBe(PRAZO_DIARIO_MIN);
    expect(prazoDaAgenda("0 6 1 * *")).toBe(PRAZO_MENSAL_MIN);
    expect(prazoDaAgenda("qualquer")).toBeNull();
  });

  it("idade em texto", () => {
    expect(textoDaIdade(null)).toBe("—");
    expect(textoDaIdade(0)).toBe("agora há pouco");
    expect(textoDaIdade(45)).toBe("há 45 min");
    expect(textoDaIdade(180)).toBe("há 3 h");
    expect(textoDaIdade(3 * 24 * 60)).toBe("há 3 dias");
  });
});

describe("visão simples: uma linha por aba do sistema", () => {
  const { linhas, atencao } = visaoSimples(saude);
  const linha = (id) => linhas.find((l) => l.id === id);

  it("junta incremental e completa por área; a completa sem prazo não pesa", () => {
    expect(linhas.map((l) => l.titulo)).toEqual([
      "Análises curriculares · Saúde Indígena",
      "Análises curriculares · SEDE",
      "Análises curriculares · Projetos",
      "Entrevistas",
      "Seleção",
      "Atualização automática do banco",
    ]);
    expect(linha("analises:saude-indigena")).toMatchObject({
      situacao: "em_dia",
      idadeMin: 10,
    });
    // SEDE: a incremental está atrasada; a completa que nunca rodou não conta.
    expect(linha("analises:sede").situacao).toBe("atrasada");
  });

  it("a falha leva a mensagem e o nome da parte", () => {
    expect(linha("analises:projetos")).toMatchObject({
      situacao: "falhou",
      erro: { mensagem: "Timeout", parte: "Projetos · incremental" },
    });
  });

  it("as tarefas do banco viram uma linha só, com a pior situação", () => {
    expect(linha("tarefas")).toMatchObject({ situacao: "falhou" });
    expect(linha("tarefas").partes).toHaveLength(2);
  });

  it("o aviso do topo lista só falha e atraso", () => {
    expect(atencao.map((l) => l.id)).toEqual([
      "analises:sede",
      "analises:projetos",
      "selecao",
      "tarefas",
    ]);
  });

  it("área sem nenhuma carga (SEDE sem planilha ainda) não pede atenção", () => {
    const semSede = normalizarSaude(
      {
        analises: [
          {
            origem: "sede_inc",
            area: "sede",
            tipo: "INCREMENTAL",
            execucoes: [],
          },
          { origem: "sede_full", area: "sede", tipo: "FULL", execucoes: [] },
        ],
        entrevistas: [],
        selecao: [],
        tarefas: [],
      },
      AGORA,
    );
    const visao = visaoSimples(semSede);
    expect(visao.linhas[0]).toMatchObject({
      titulo: "Análises curriculares · SEDE",
      situacao: "nunca",
      ultimaAtualizacao: null,
    });
    expect(visao.atencao.map((l) => l.id)).not.toContain("analises:sede");
  });
});

describe("robô da Empregare (20261005170000)", () => {
  const comRobo = (empregare, agora = AGORA) =>
    normalizarSaude({ ...PAYLOAD, empregare }, agora);

  it("sem a chave no payload (migration não aplicada), a linha não aparece", () => {
    expect(visaoSimples(saude).linhas.map((l) => l.id)).not.toContain(
      "empregare",
    );
  });

  it("vira uma linha depois da Seleção, com as contagens e quem disparou na mensagem", () => {
    const s = comRobo([
      execucao("PARCIAL", 30, {
        linhas: 812,
        vagas_pedidas: 12,
        vagas_baixadas: 11,
        vagas_falha: 1,
        vagas_recusadas: 0,
        disparo: "MONITORA",
      }),
      execucao("CONCLUIDA", 24 * 60, { linhas: 800, disparo: "AGENDA" }),
    ]);
    const { linhas, atencao } = visaoSimples(s);
    expect(linhas.map((l) => l.titulo).slice(-3)).toEqual([
      "Seleção",
      "Robô da Empregare",
      "Atualização automática do banco",
    ]);
    const robo = linhas.find((l) => l.id === "empregare");
    expect(robo.situacao).toBe("falhou");
    expect(robo.erro.mensagem).toBe(
      "12 vagas pedidas · 11 baixadas · 1 com falha · 0 recusadas · disparo: Rodar agora",
    );
    expect(atencao.map((l) => l.id)).toContain("empregare");
    expect(robo.partes[0].historico[1].mensagem).toContain("disparo: agenda");
  });

  it("concluída dentro do prazo fica em dia; em andamento aparece", () => {
    const s = comRobo([
      { inicio: ha(5), situacao: "EM_ANDAMENTO" },
      execucao("CONCLUIDA", 60, { linhas: 10 }),
    ]);
    const robo = visaoSimples(s).linhas.find((l) => l.id === "empregare");
    expect(robo).toMatchObject({ situacao: "em_dia", emAndamento: true });
  });

  it("prazo de hora em hora: 4 h de dia, 14 h à noite", () => {
    // 12h de Brasília = 15h UTC; 23h de Brasília = 02h UTC do dia seguinte.
    expect(prazoDeHoraEmHora(new Date("2026-10-05T15:00:00Z"))).toBe(
      PRAZO_DE_HORA_EM_HORA_MIN,
    );
    expect(prazoDeHoraEmHora(new Date("2026-10-06T02:00:00Z"))).toBe(
      PRAZO_DA_NOITE_MIN,
    );
    // 8h de Brasília (11h UTC): a primeira carga das 7h pode atrasar; vale a noite.
    expect(prazoDeHoraEmHora(new Date("2026-10-05T11:00:00Z"))).toBe(
      PRAZO_DA_NOITE_MIN,
    );
  });

  it("prazo dos dias úteis: o fim de semana não atrasa", () => {
    // 01/10/2026 é quinta-feira.
    expect(prazoDosDiasUteis(new Date("2026-10-01T12:00:00Z"))).toBe(
      PRAZO_DIARIO_MIN,
    );
    expect(prazoDosDiasUteis(new Date("2026-10-03T15:00:00Z"))).toBe(
      PRAZO_FIM_DE_SEMANA_MIN,
    );
    // Segunda 8h de Brasília (11h UTC): ainda vale o fim de semana; 10h, não.
    expect(prazoDosDiasUteis(new Date("2026-10-05T11:00:00Z"))).toBe(
      PRAZO_FIM_DE_SEMANA_MIN,
    );
    expect(prazoDosDiasUteis(new Date("2026-10-05T13:00:00Z"))).toBe(
      PRAZO_DIARIO_MIN,
    );
    const domingo = new Date("2026-10-04T15:00:00Z");
    const sexta = new Date("2026-10-02T09:40:00Z").toISOString();
    const s = comRobo(
      [{ inicio: sexta, fim: sexta, situacao: "CONCLUIDA" }],
      domingo,
    );
    expect(
      visaoSimples(s).linhas.find((l) => l.id === "empregare").situacao,
    ).toBe("em_dia");
  });
});

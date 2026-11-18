import { describe, expect, it } from "vitest";
import {
  contagemDasMarcas,
  editalDoEndereco,
  enderecoDoEdital,
  etapasNaLinhaDoTempo,
  numeroNoEndereco,
  retificacoesDoHistorico,
  situacaoDasVagas,
  situacaoDosCandidatos,
  situacaoExcepcional,
} from "../src/lib/pagina-do-edital/pagina-do-edital.ts";

/*
  A página do edital (src/lib/pagina-do-edital/): o endereço pelo número do
  edital, as vagas e os candidatos com as contas da Visão geral e a linha do
  tempo pelas datas de hoje.
*/

const ID = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";
const OUTRO = "7d1e2c3b-4a5f-4e6d-8c7b-9a0f1e2d3c4b";
const LINHAS = [
  { id: ID, edital: "Edital nº 105/2026", unidade: "DSEI Yanomami" },
  { id: "e2", edital: "Edital 91/2026", unidade: "DSEI Leste" },
  { id: OUTRO, edital: "Edital 120/2026", unidade: "Escritório Distrital" },
  { id: "e4", edital: "Edital 120/2026", unidade: "CCE Norte" },
];

describe("o edital no endereço", () => {
  it("o número vira o pedaço do endereço", () => {
    expect(numeroNoEndereco("Edital nº 105/2026 - DSEI")).toBe("105-2026");
    expect(numeroNoEndereco("Edital 091/2026")).toBe("91-2026");
    expect(numeroNoEndereco("Sem número")).toBe("");
  });

  it("acha o edital pelo número (com ou sem zero à esquerda) ou pelo id", () => {
    expect(editalDoEndereco("105-2026", LINHAS)).toEqual({
      tipo: "um",
      linha: LINHAS[0],
    });
    expect(editalDoEndereco("091-2026", LINHAS)).toEqual({
      tipo: "um",
      linha: LINHAS[1],
    });
    expect(editalDoEndereco(OUTRO, LINHAS)).toEqual({
      tipo: "um",
      linha: LINHAS[2],
    });
  });

  it("dois editais de mesmo número na área: a escolha; nenhum: nenhum", () => {
    expect(editalDoEndereco("120-2026", LINHAS)).toEqual({
      tipo: "varios",
      linhas: [LINHAS[2], LINHAS[3]],
    });
    expect(editalDoEndereco("7-2030", LINHAS)).toEqual({ tipo: "nenhum" });
    expect(editalDoEndereco("", LINHAS)).toEqual({ tipo: "nenhum" });
    expect(editalDoEndereco("qualquer-coisa", LINHAS)).toEqual({
      tipo: "nenhum",
    });
  });

  it("o endereço de um edital: o número, se for só dele na área; senão o id", () => {
    expect(enderecoDoEdital(LINHAS[0]!, LINHAS)).toBe("105-2026");
    expect(enderecoDoEdital(LINHAS[2]!, LINHAS)).toBe(OUTRO);
    expect(enderecoDoEdital({ id: "x", edital: "Sem número" }, LINHAS)).toBe(
      "x",
    );
    // O endereço volta para o mesmo edital.
    for (const linha of LINHAS)
      expect(editalDoEndereco(enderecoDoEdital(linha, LINHAS), LINHAS)).toEqual(
        { tipo: "um", linha },
      );
  });
});

describe("vagas e candidatos", () => {
  it("0 de 70 preenchidas, com as reabertas e o cadastro reserva à parte", () => {
    expect(situacaoDasVagas({ vagas_total: 70, contratados: 0 })).toEqual({
      imediatas: 70,
      preenchidas: 0,
      reabertas: 0,
      abertas: 70,
      cadastroReserva: 0,
      texto: "0 de 70 preenchidas",
    });
    expect(
      situacaoDasVagas({
        vagas_total: 10,
        contratados: 13,
        vagas_reabertas: 0,
      }),
    ).toMatchObject({ preenchidas: 10, abertas: 0, cadastroReserva: 3 });
    expect(
      situacaoDasVagas({ vagas_total: 10, contratados: 4, vagas_reabertas: 2 }),
    ).toMatchObject({ preenchidas: 4, reabertas: 2, abertas: 4 });
    expect(situacaoDasVagas({ vagas_total: 1 }).texto).toBe(
      "0 de 1 preenchida",
    );
  });

  it("candidatos: aprovados, contratados, aguardando e demais", () => {
    expect(
      situacaoDosCandidatos({
        aprovados: 30,
        cadastro_reserva: 12,
        contratados: 10,
        desistentes: 3,
      }),
    ).toEqual({
      temLista: true,
      aprovados: 30,
      contratados: 10,
      aguardando: 12,
      desistentes: 3,
      demais: 5,
    });
    // Sem lista vigente: só os contratados.
    expect(
      situacaoDosCandidatos({ aprovados: null, contratados: 2 }),
    ).toMatchObject({ temLista: false, contratados: 2, demais: 0 });
  });
});

describe("linha do tempo", () => {
  const ETAPAS = [
    { ordem: 1, atividade: "Publicação", data_inicio: "2026-10-01" },
    {
      ordem: 2,
      atividade: "Inscrições",
      data_inicio: "2026-10-02",
      data_fim: "2026-11-30",
    },
    { ordem: 3, atividade: "Resultado", data_inicio: "2026-12-10" },
    { ordem: 4, atividade: "Homologação", data_inicio: "2026-12-20" },
  ];

  it("concluída, etapa atual e prevista, pelas datas de hoje", () => {
    const etapas = etapasNaLinhaDoTempo(ETAPAS, "2026-11-18");
    expect(etapas.map((e) => [e.atividade, e.marca, e.proxima])).toEqual([
      ["Publicação", "concluida", false],
      ["Inscrições", "atual", false],
      ["Resultado", "prevista", true],
      ["Homologação", "prevista", false],
    ]);
    expect(etapas[0]).toMatchObject({
      inicio: "2026-10-01",
      fim: "2026-10-01",
    });
    expect(contagemDasMarcas(etapas)).toEqual({
      concluida: 1,
      atual: 1,
      prevista: 2,
    });
    expect(etapasNaLinhaDoTempo(null, "2026-11-18")).toEqual([]);
  });

  it("retificações: só as erratas, da mais recente para a mais antiga", () => {
    expect(
      retificacoesDoHistorico([
        { acao: "salvar", created_at: "2026-11-01T10:00:00Z" },
        {
          acao: "errata",
          numero_errata: "Errata nº 1",
          motivo: "SEI 123",
          total_alteracoes: 2,
          created_at: "2026-10-01T10:00:00Z",
        },
        { acao: "errata", created_at: "2026-11-10T10:00:00Z" },
      ]),
    ).toEqual({
      retificacoes: [
        {
          chave: "2026-11-10T10:00:00Z:1",
          titulo: "Retificação",
          quando: "2026-11-10T10:00:00Z",
          motivo: "",
          alteracoes: 0,
        },
        {
          chave: "2026-10-01T10:00:00Z:0",
          titulo: "Errata nº 1",
          quando: "2026-10-01T10:00:00Z",
          motivo: "SEI 123",
          alteracoes: 2,
        },
      ],
      outrasAlteracoes: 1,
    });
  });
});

describe("situação excepcional", () => {
  it("a gravada no cronograma, com motivo e retomada", () => {
    expect(
      situacaoExcepcional(
        {
          status_override: "Suspenso",
          status_override_motivo: "Decisão judicial",
          status_override_data: "2026-11-01",
          status_override_previsao_retomada: "2027-01-10",
        },
        "Em andamento",
      ),
    ).toEqual({
      status: "Suspenso",
      motivo: "Decisão judicial",
      data: "2026-11-01",
      retomada: "2027-01-10",
    });
  });

  it("sem a gravada, a do status; edital normal, nenhuma", () => {
    expect(situacaoExcepcional(null, "Processo paralisado")).toEqual({
      status: "Paralisado",
      motivo: "",
      data: "",
      retomada: "",
    });
    expect(situacaoExcepcional({}, "Cancelado")?.status).toBe("Cancelado");
    expect(situacaoExcepcional(null, "Em andamento")).toBeNull();
  });
});

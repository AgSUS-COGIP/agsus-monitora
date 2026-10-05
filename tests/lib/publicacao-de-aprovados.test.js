import { describe, expect, it } from "vitest";
import {
  argumentosDaPublicacao,
  candidatosDaListaFinal,
  casarCandidatos,
  motivoValido,
  normalizarNome,
  origemDaLista,
  resumoDaPublicacao,
  resumoDasOrigens,
  temDadosDaLista,
} from "../../src/lib/publicacao-de-aprovados.js";

const retrato = {
  tipo: "FINAL",
  modalidades: [{ codigo: "PP", nome: "Pretos e pardos" }],
  vagas: [
    {
      chave: "V1",
      codigo: "V1",
      cargo: "Enfermeiro",
      geral: [
        {
          posicao: 1,
          analise_id: "a1",
          nome: "Ana Souza",
          nota: 90,
          situacao: "VAGA",
          modalidades: ["AC"],
        },
        {
          posicao: 2,
          analise_id: "a2",
          nome: "Bruno Lima",
          nota: 80,
          situacao: "VAGA",
          modalidades: ["AC", "PP"],
        },
        {
          posicao: 3,
          analise_id: "a3",
          nome: "Carla Dias",
          nota: 70,
          situacao: "CR",
          modalidades: ["AC"],
        },
      ],
      listas: {
        PP: [
          {
            posicao: 1,
            analise_id: "a2",
            nome: "Bruno Lima",
            nota: 80,
            situacao: "VAGA",
            modalidades: ["AC", "PP"],
          },
          {
            posicao: 2,
            analise_id: "a4",
            nome: "Davi Rocha",
            nota: 60,
            situacao: "CR",
            modalidades: ["PP"],
          },
        ],
      },
    },
    {
      chave: "quadro:9",
      codigo: "",
      cargo: "Técnico",
      geral: [
        {
          posicao: 1,
          analise_id: "a5",
          nome: "Élio Nunes",
          nota: 75,
          situacao: "VAGA",
          modalidades: ["AC"],
        },
        {
          posicao: 2,
          analise_id: "a1",
          nome: "Ana Souza",
          nota: 70,
          situacao: "CR",
          modalidades: ["AC"],
        },
      ],
      listas: {},
    },
  ],
};

describe("candidatosDaListaFinal", () => {
  it("um por análise, com a posição da geral e a da modalidade para quem só está nela", () => {
    const linhas = candidatosDaListaFinal(retrato, {
      analises: new Map([["a5", { vaga: "T-01", cargo: "Técnico" }]]),
    });
    expect(linhas.map((l) => [l.analise_id, l.posicao, l.codigo_vaga])).toEqual(
      [
        ["a1", 1, "V1"],
        ["a2", 2, "V1"],
        ["a3", 3, "V1"],
        ["a4", 2, "V1"],
        ["a5", 1, "T-01"],
      ],
    );
    expect(linhas[0]).toMatchObject({
      nome: "Ana Souza",
      nota: 90,
      situacao: "VAGA",
      cargo: "Enfermeiro",
    });
    expect(linhas[2].situacao).toBe("CR");
  });

  it("vaga sem código e sem análise conhecida usa a chave da vaga", () => {
    const [, , , , tecnico] = candidatosDaListaFinal(retrato);
    expect(tecnico.codigo_vaga).toBe("quadro:9");
  });

  it("retrato vazio não quebra", () => {
    expect(candidatosDaListaFinal(null)).toEqual([]);
  });
});

describe("normalizarNome", () => {
  it("sem acento, caixa e espaços extras", () => {
    expect(normalizarNome("  José   DA  Silva-Júnior ")).toBe(
      "jose da silva junior",
    );
  });
});

const novos = candidatosDaListaFinal(retrato);

describe("casarCandidatos", () => {
  it("lista publicada da Classificação: casa pela análise", () => {
    const anteriores = [
      {
        candidato_id: "c1",
        analise_id: "a1",
        nome: "Outro Nome",
        classificacao: 1,
        codigo_vaga: "V1",
      },
    ];
    const { vinculos, naoCasados } = casarCandidatos(anteriores, novos);
    expect(vinculos).toEqual([
      { candidato_id: "c1", analise_id: "a1", forma: "ANALISE" },
    ]);
    expect(naoCasados).toEqual([]);
  });

  it("lista de planilha: casa pelo nome normalizado", () => {
    const anteriores = [
      {
        candidato_id: "c2",
        nome: "BRUNO  LIMA",
        classificacao: 1,
        codigo_vaga: "V1",
        status: "Contratado",
        matricula: "9",
      },
    ];
    const { vinculos } = casarCandidatos(anteriores, novos);
    expect(vinculos).toEqual([
      { candidato_id: "c2", analise_id: "a2", forma: "NOME" },
    ]);
  });

  it("homônimos: desempata pela vaga; o que sobra fica para revisão", () => {
    const comHomonimo = [
      ...novos,
      {
        analise_id: "a9",
        nome: "Ana Souza",
        codigo_vaga: "V2",
        posicao: 1,
        nota: 50,
      },
    ];
    const anteriores = [
      {
        candidato_id: "c1",
        nome: "Ana Souza",
        codigo_vaga: "V2",
        classificacao: 4,
      },
      {
        candidato_id: "c3",
        nome: "Ana Souza",
        codigo_vaga: "",
        classificacao: 2,
        status: "Desistente",
      },
    ];
    const { vinculos, naoCasados } = casarCandidatos(anteriores, comHomonimo);
    expect(vinculos).toEqual([
      { candidato_id: "c1", analise_id: "a9", forma: "NOME_VAGA" },
    ]);
    expect(naoCasados).toHaveLength(1);
    expect(naoCasados[0]).toMatchObject({
      candidato_id: "c3",
      ambiguo: true,
      decidido: false,
    });
  });

  it("a revisão manual vence e pode dizer que a pessoa não está na lista nova", () => {
    const anteriores = [
      {
        candidato_id: "c3",
        nome: "Ana S.",
        status: "Contratado",
        matricula: "1",
      },
      { candidato_id: "c4", analise_id: "a3", nome: "Carla Dias" },
    ];
    const { vinculos, naoCasados } = casarCandidatos(anteriores, novos, {
      manuais: { c3: "a1", c4: "" },
    });
    expect(vinculos).toEqual([
      { candidato_id: "c3", analise_id: "a1", forma: "MANUAL" },
    ]);
    expect(naoCasados).toEqual([
      expect.objectContaining({ candidato_id: "c4", decidido: true }),
    ]);
  });

  it("um candidato novo não casa com duas pessoas", () => {
    const anteriores = [
      { candidato_id: "c1", analise_id: "a1", nome: "Ana Souza" },
      { candidato_id: "c2", nome: "Ana Souza" },
    ];
    const { vinculos, naoCasados } = casarCandidatos(anteriores, novos);
    expect(vinculos.map((v) => v.analise_id)).toEqual(["a1"]);
    expect(naoCasados.map((n) => n.candidato_id)).toEqual(["c2"]);
  });
});

describe("resumoDaPublicacao", () => {
  const anteriores = [
    {
      candidato_id: "c1",
      analise_id: "a1",
      nome: "Ana Souza",
      classificacao: 1,
      codigo_vaga: "V1",
    },
    {
      candidato_id: "c2",
      nome: "Bruno Lima",
      classificacao: 5,
      codigo_vaga: "V1",
      status: "Contratado",
      matricula: "7",
    },
    {
      candidato_id: "c5",
      nome: "Fulano Fora",
      classificacao: 9,
      codigo_vaga: "V1",
      status: "Desistente",
    },
    {
      candidato_id: "c6",
      nome: "Gina Sem Dados",
      classificacao: 10,
      codigo_vaga: "V1",
    },
    {
      candidato_id: "c7",
      nome: "Hugo Judicial",
      nota: 88,
      sub_judice: true,
      cargo: "Enfermeiro",
    },
  ];
  const casamento = casarCandidatos(anteriores, novos);
  const r = resumoDaPublicacao(anteriores, novos, casamento);

  it("entram, saem, mudam de posição e preserva status e sub judice", () => {
    expect(r.entram.map((n) => n.analise_id)).toEqual(["a3", "a4", "a5"]);
    expect(r.saem.map((a) => a.candidato_id)).toEqual(["c5", "c6"]);
    expect(r.mudam.map((m) => m.anterior.candidato_id)).toEqual(["c2"]);
    expect(r.preservados.map((p) => p.anterior.candidato_id)).toEqual(["c2"]);
    expect(r.subJudiceMantidos.map((a) => a.candidato_id)).toEqual(["c7"]);
    expect(r.total).toBe(novos.length + 1);
  });

  it("quem sai com status ou matrícula vai para a revisão; sem dados, não", () => {
    expect(r.pendencias.map((a) => a.candidato_id)).toEqual(["c5"]);
  });

  it("os vínculos que vão ao banco", () => {
    expect(argumentosDaPublicacao(casamento)).toEqual([
      { candidato_id: "c1", analise_id: "a1", forma: "ANALISE" },
      { candidato_id: "c2", analise_id: "a2", forma: "NOME" },
    ]);
  });

  it("mudar de vaga também conta como mudança", () => {
    const outra = [
      {
        candidato_id: "c1",
        analise_id: "a1",
        classificacao: 1,
        codigo_vaga: "V9",
      },
    ];
    const c = casarCandidatos(outra, novos);
    expect(resumoDaPublicacao(outra, novos, c).mudam).toHaveLength(1);
  });
});

describe("temDadosDaLista e motivo", () => {
  it("status, matrícula, processo e sub judice são da lista", () => {
    expect(temDadosDaLista({ status: "Contratado" })).toBe(true);
    expect(temDadosDaLista({ processo_sei: " 123 " })).toBe(true);
    expect(temDadosDaLista({ sub_judice: true })).toBe(true);
    expect(temDadosDaLista({ nome: "X" })).toBe(false);
  });

  it("motivo entre 3 e 500 caracteres", () => {
    expect(motivoValido("ok")).toBe(false);
    expect(motivoValido("Edital sem análise no sistema")).toBe(true);
    expect(motivoValido("x".repeat(501))).toBe(false);
  });
});

describe("origem da lista", () => {
  it("publicada da Classificação traz a data; planilha é manual", () => {
    expect(
      origemDaLista({
        origem: "CLASSIFICACAO",
        importado_em: "2026-10-05T15:00:00Z",
      }),
    ).toEqual({
      tipo: "CLASSIFICACAO",
      texto: "Publicada da Classificação em 05/10",
    });
    expect(origemDaLista({ origem: "XLSX" }).texto).toBe(
      "Lista manual (planilha)",
    );
    expect(origemDaLista({}).tipo).toBe("XLSX");
    expect(origemDaLista(null)).toBeNull();
  });

  it("várias listas: quantas de cada origem", () => {
    expect(resumoDasOrigens([])).toBe("");
    expect(resumoDasOrigens([{ origem: "XLSX" }])).toBe(
      "Lista manual (planilha)",
    );
    expect(
      resumoDasOrigens([
        { origem: "CLASSIFICACAO" },
        { origem: "XLSX" },
        { origem: "XLSX" },
      ]),
    ).toBe("Listas: 1 publicada da Classificação · 2 manuais (planilha)");
  });
});

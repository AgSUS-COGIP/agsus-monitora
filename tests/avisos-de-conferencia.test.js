import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONFERENCIAS,
  contagemPorModulo,
  diaDoAviso,
  agruparPorEdital,
  chaveDoCaso,
  erroDaEvidencia,
  erroDoMotivoDoTratamento,
  normalizarHistorico,
  opcoesDeTratamento,
  prazoVencido,
  filtrarPorModulo,
  normalizarAvisos,
  ondeDoAviso,
  tituloDaConferencia,
  tomDoSelo,
} from "../src/lib/avisos-de-conferencia.ts";

/*
  Regras puras dos avisos de conferência (src/lib/avisos-de-conferencia.ts).
  O catálogo é conferido contra o caso dourado compartilhado com o pytest
  (tests/fixtures/conferencias/catalogo.json ↔ scripts/conferencias/catalogo.py).
*/
const DOURADO = JSON.parse(
  readFileSync("tests/fixtures/conferencias/catalogo.json", "utf8"),
);

const PAYLOAD = {
  schema_version: 1,
  gerado_em: "2026-10-05T09:10:00Z",
  ultima_execucao: {
    inicio: "2026-10-05T09:00:00Z",
    fim: "2026-10-05T09:02:00Z",
    situacao: "CONCLUIDA",
  },
  avisos: [
    {
      id: "a2",
      conferencia: "CLASSIFICACAO_VAGA_SEM_QUADRO",
      escopo: "edital:e1",
      gravidade: "ATENCAO",
      modulo: "classificacao",
      area: "saude-indigena",
      edital_id: "e1",
      edital: "101/2026",
      quantidade: 2,
      exemplos: ["180001", "180002"],
      resumo:
        "2 vagas das análises sem linha no quadro de vagas no edital 101/2026.",
      situacao: "ABERTO",
      primeira_vez: "2026-10-04T09:00:00Z",
      ultima_vez: "2026-10-05T09:00:00Z",
      tratamento: "AGUARDANDO_DOCUMENTO",
      motivo: "Falta o quadro retificado.",
      responsavel_id: "u1",
      responsavel: "Pessoa Fictícia",
      prazo: "2026-10-10",
      evidencias: 2,
      pode_gerir: true,
      pode_tratar: true,
    },
    {
      id: "a1",
      conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
      escopo: "edital:e1",
      gravidade: "CRITICA",
      modulo: "analises",
      area: "saude-indigena",
      edital_id: "e1",
      edital: "101/2026",
      quantidade: 1,
      exemplos: [],
      resumo: "1 análise aprovada com nota abaixo de 60 no edital 101/2026.",
      situacao: "ABERTO",
      primeira_vez: "2026-10-05T09:00:00Z",
    },
    {
      id: "a3",
      conferencia: "CARGA_VARIACAO_BRUSCA",
      escopo: "vaga:177979",
      gravidade: "ATENCAO",
      modulo: "cargas",
      quantidade: 1,
      resumo: "Vaga 177979: candidatos foram de 1200 para 300.",
      situacao: "ABERTO",
      tratamento: "DISPENSADO",
      tratado_em: "2026-10-05T10:00:00Z",
      motivo: "Vaga encerrada na Empregare.",
    },
    {
      id: "a4",
      conferencia: "ENTREVISTA_HORARIO_DUPLICADO",
      escopo: "edital:e2",
      gravidade: "ATENCAO",
      modulo: "entrevistas",
      area: "saude-indigena",
      edital_id: "e2",
      edital: "80/2026",
      quantidade: 1,
      resumo:
        "1 candidato com mais de um horário de entrevista no edital 80/2026.",
      situacao: "RESOLVIDO",
      resolvido_em: "2026-10-05T09:02:00Z",
      tratamento: "RECHECADO_SEM_PROBLEMA",
    },
  ],
};

describe("catálogo das conferências", () => {
  it("igual ao caso dourado compartilhado com o pytest", () => {
    expect(JSON.parse(JSON.stringify(CONFERENCIAS))).toEqual(
      DOURADO.conferencias,
    );
  });

  it("título de código desconhecido é o próprio código", () => {
    expect(tituloDaConferencia("NOVA_CONFERENCIA")).toBe("NOVA_CONFERENCIA");
  });
});

describe("normalizarAvisos", () => {
  const lista = normalizarAvisos(PAYLOAD);

  it("abertos por gravidade; dispensados e resolvidos à parte", () => {
    expect(lista.abertos.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(lista.dispensados.map((a) => a.id)).toEqual(["a3"]);
    expect(lista.resolvidos.map((a) => a.id)).toEqual(["a4"]);
    expect(lista.abertos[0]).toMatchObject({
      titulo: "Aprovada com nota abaixo da mínima",
      tom: "perigo",
      rotuloDaGravidade: "Crítico",
      onde: "Edital 101/2026",
      tratamento: "PENDENTE",
      podeGerir: false,
      podeTratar: false,
    });
    expect(lista.abertos[1]).toMatchObject({
      tratamento: "AGUARDANDO_DOCUMENTO",
      motivo: "Falta o quadro retificado.",
      responsavelId: "u1",
      responsavel: "Pessoa Fictícia",
      prazo: "2026-10-10",
      evidencias: 2,
      podeGerir: true,
      podeTratar: true,
    });
    expect(lista.abertos[1].ultimaVez).toEqual(
      new Date("2026-10-05T09:00:00Z"),
    );
    expect(lista.dispensados[0]).toMatchObject({
      onde: "Vaga 177979",
      motivo: "Vaga encerrada na Empregare.",
    });
    expect(lista.resolvidos[0]).toMatchObject({
      situacao: "RESOLVIDO",
      tratamento: "RECHECADO_SEM_PROBLEMA",
    });
    expect(lista.ultimaExecucao.situacao).toBe("CONCLUIDA");
  });

  it("payload vazio ou estranho não quebra", () => {
    expect(normalizarAvisos(null)).toMatchObject({
      abertos: [],
      dispensados: [],
      resolvidos: [],
      ultimaExecucao: null,
    });
    expect(
      normalizarAvisos({ avisos: [{ id: "x", tratamento: "OUTRO" }] })
        .abertos[0].tratamento,
    ).toBe("PENDENTE");
  });

  it("contagem e tom do selo por módulo; filtro por módulo", () => {
    expect(contagemPorModulo(lista)).toEqual({
      analises: 1,
      entrevistas: 0,
      classificacao: 1,
      aprovados: 0,
      cargas: 0,
    });
    expect(tomDoSelo(lista.abertos)).toBe("perigo");
    expect(tomDoSelo([])).toBeNull();
    const so = filtrarPorModulo(lista, "cargas");
    expect(so.abertos).toEqual([]);
    expect(so.dispensados.map((a) => a.id)).toEqual(["a3"]);
    expect(filtrarPorModulo(lista, "entrevistas").resolvidos).toHaveLength(1);
    expect(filtrarPorModulo(lista, "todos")).toBe(lista);
  });
});

describe("textos", () => {
  it("onde: edital, vaga ou área", () => {
    expect(ondeDoAviso({ escopo: "area:sede", area: "sede" })).toBe("SEDE");
    expect(ondeDoAviso({ escopo: "area:sem-area" })).toBe("Sem área");
  });

  it("dia do aviso", () => {
    expect(diaDoAviso(new Date(2026, 9, 5))).toBe("05/10/2026");
    expect(diaDoAviso(null)).toBe("—");
  });
});

describe("central de avisos", () => {
  const [a1, a2] = normalizarAvisos(PAYLOAD).abertos;

  it("o gestor dispensa; o responsável só trata; o rechecado é da conferência", () => {
    expect(opcoesDeTratamento(a2)).toEqual([
      "EM_ANALISE",
      "AGUARDANDO_DOCUMENTO",
      "CORRIGIDO",
      "DISPENSADO",
    ]);
    expect(opcoesDeTratamento({ podeGerir: false, podeTratar: true })).toEqual([
      "EM_ANALISE",
      "AGUARDANDO_DOCUMENTO",
      "CORRIGIDO",
    ]);
    expect(opcoesDeTratamento(a1)).toEqual([]);
  });

  it("motivo: dispensar pede 10; aguardando e corrigido, 3; em análise, opcional; sem CPF nem e-mail", () => {
    expect(erroDoMotivoDoTratamento("DISPENSADO", "curto")).toMatch(
      /justificativa.*10/,
    );
    expect(
      erroDoMotivoDoTratamento("DISPENSADO", "Vaga cancelada no edital."),
    ).toBe("");
    expect(erroDoMotivoDoTratamento("CORRIGIDO", "")).toMatch(/pelo menos 3/);
    expect(erroDoMotivoDoTratamento("AGUARDANDO_DOCUMENTO", "SEI")).toBe("");
    expect(erroDoMotivoDoTratamento("EM_ANALISE", "")).toBe("");
    expect(erroDoMotivoDoTratamento("EM_ANALISE", "x".repeat(501))).toMatch(
      /500/,
    );
    expect(erroDoMotivoDoTratamento("CORRIGIDO", "CPF 00000000191")).toMatch(
      /CPF/,
    );
    expect(
      erroDoMotivoDoTratamento("CORRIGIDO", "pessoa@exemplo.invalid"),
    ).toMatch(/e-mail/);
  });

  it("prazo vencido só depois do dia", () => {
    expect(prazoVencido("2026-10-10", "2026-10-11")).toBe(true);
    expect(prazoVencido("2026-10-10", "2026-10-10")).toBe(false);
    expect(prazoVencido(null, "2026-10-11")).toBe(false);
  });

  it("agrupa por edital, o mais grave primeiro", () => {
    const grupos = agruparPorEdital(normalizarAvisos(PAYLOAD).abertos);
    expect(grupos.map((g) => [g.titulo, g.avisos.map((a) => a.id)])).toEqual([
      ["Edital 101/2026", ["a1", "a2"]],
    ]);
  });

  it("evidência: tipo, descrição, link https e sem dado pessoal", () => {
    expect(erroDaEvidencia({ tipo: "SEI", descricao: "" })).toMatch(/SEI/);
    expect(
      erroDaEvidencia({ tipo: "SEI", descricao: "25000.000001/2026-01" }),
    ).toBe("");
    expect(erroDaEvidencia({ tipo: "LINK", descricao: "Ata" })).toMatch(/link/);
    expect(
      erroDaEvidencia({ tipo: "LINK", descricao: "Ata", url: "http://x" }),
    ).toMatch(/https/);
    expect(
      erroDaEvidencia({ tipo: "NOTA", descricao: "pessoa@exemplo.invalid" }),
    ).toMatch(/e-mail/);
    expect(erroDaEvidencia({ tipo: "OUTRO", descricao: "Ata" })).toMatch(
      /tipo/,
    );
  });

  it("chave estável do caso para a evidência", () => {
    expect(chaveDoCaso({ analiseId: "an1", codigo: "C1" })).toBe("analise:an1");
    expect(chaveDoCaso({ codigo: "C1" })).toBe("codigo:C1");
    expect(chaveDoCaso({ aprovadoId: "ap1" })).toBe("referencia:ap1");
    expect(chaveDoCaso({})).toBeNull();
  });

  it("histórico: o que aconteceu, quem (ou a conferência) e as evidências", () => {
    const h = normalizarHistorico({
      eventos: [
        {
          id: 3,
          evento: "NAO_ACHADO",
          tratamento: "RECHECADO_SEM_PROBLEMA",
          robo: true,
          em: "2026-10-06T09:00:00Z",
        },
        {
          id: 2,
          evento: "TRATAMENTO",
          tratamento: "CORRIGIDO",
          motivo: "Nota refeita.",
          por: "Pessoa Fictícia",
        },
        {
          id: 1,
          evento: "RESPONSAVEL",
          responsavel: "Pessoa Fictícia",
          prazo: "2026-10-10",
        },
        { id: 0, evento: "MIGRADO", motivo: "Vaga encerrada." },
      ],
      evidencias: [
        {
          id: "ev1",
          tipo: "LINK",
          descricao: "Ata",
          url: "https://exemplo.invalid/ata",
          ativa: true,
        },
        {
          id: "ev2",
          tipo: "X",
          descricao: "Nota",
          url: "javascript:alert(1)",
          ativa: false,
        },
      ],
    });
    expect(h.eventos.map((e) => e.texto)).toEqual([
      "Rechecado sem problema",
      "Corrigido",
      "Responsável: Pessoa Fictícia, até 10/10/2026",
      "Dispensado (era “ignorado”)",
    ]);
    expect(h.eventos[0].por).toBe("Conferência automática");
    expect(h.eventos[1]).toMatchObject({
      por: "Pessoa Fictícia",
      motivo: "Nota refeita.",
    });
    expect(h.evidencias[0]).toMatchObject({
      tipo: "LINK",
      url: "https://exemplo.invalid/ata",
      ativa: true,
    });
    expect(h.evidencias[1]).toMatchObject({
      tipo: "NOTA",
      url: null,
      ativa: false,
    });
    expect(normalizarHistorico(null)).toEqual({ eventos: [], evidencias: [] });
  });
});

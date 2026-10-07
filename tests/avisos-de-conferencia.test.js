import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONFERENCIAS,
  contagemPorModulo,
  diaDoAviso,
  erroDoMotivo,
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
      pode_ignorar: true,
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
      situacao: "IGNORADO",
      ignorado_em: "2026-10-05T10:00:00Z",
      motivo: "Vaga encerrada na Empregare.",
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

  it("abertos por gravidade (crítico primeiro) e ignorados à parte", () => {
    expect(lista.abertos.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(lista.ignorados.map((a) => a.id)).toEqual(["a3"]);
    expect(lista.abertos[0]).toMatchObject({
      titulo: "Aprovada com nota abaixo da mínima",
      tom: "perigo",
      rotuloDaGravidade: "Crítico",
      onde: "Edital 101/2026",
      podeIgnorar: false,
    });
    expect(lista.abertos[1].podeIgnorar).toBe(true);
    expect(lista.ignorados[0]).toMatchObject({
      onde: "Vaga 177979",
      motivo: "Vaga encerrada na Empregare.",
    });
    expect(lista.ultimaExecucao.situacao).toBe("CONCLUIDA");
  });

  it("payload vazio ou estranho não quebra", () => {
    expect(normalizarAvisos(null)).toMatchObject({
      abertos: [],
      ignorados: [],
      ultimaExecucao: null,
    });
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
    expect(so.ignorados.map((a) => a.id)).toEqual(["a3"]);
    expect(filtrarPorModulo(lista, "todos")).toBe(lista);
  });
});

describe("textos", () => {
  it("onde: edital, vaga ou área", () => {
    expect(ondeDoAviso({ escopo: "area:sede", area: "sede" })).toBe("SEDE");
    expect(ondeDoAviso({ escopo: "area:sem-area" })).toBe("Sem área");
  });

  it("motivo do ignorar: 10 a 500 caracteres", () => {
    expect(erroDoMotivo("curto")).toMatch(/pelo menos 10/);
    expect(erroDoMotivo("x".repeat(501))).toMatch(/500/);
    expect(erroDoMotivo("Conferido com a banca.")).toBe("");
  });

  it("dia do aviso", () => {
    expect(diaDoAviso(new Date(2026, 9, 5))).toBe("05/10/2026");
    expect(diaDoAviso(null)).toBe("—");
  });
});

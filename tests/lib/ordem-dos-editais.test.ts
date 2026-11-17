import { describe, expect, it } from "vitest";
import {
  ORDEM_PADRAO_DOS_EDITAIS,
  ordenarEditais,
  proximaOrdemDosEditais,
} from "../../src/lib/ordem-dos-editais.ts";
import type {
  ChaveDaOrdemDosEditais,
  LinhaParaOrdenar,
  OrdemDosEditais,
} from "../../src/lib/ordem-dos-editais.ts";

type Linha = LinhaParaOrdenar & { id: string };

const LINHAS: Linha[] = [
  {
    id: "a",
    edital: "10/2025",
    data_inicio: "2025-03-01",
    unidade: "DSEI Xavante",
    status: "Concluído",
    etapa: "Resultado final",
    vagas_total: 40,
    contratados: 30,
    vagas_ociosas: 10,
    risco: "Baixo",
  },
  {
    id: "b",
    edital: "120/2026",
    data_inicio: "2026-08-10",
    unidade: "DSEI Alto Rio Purus",
    status: "Em andamento",
    etapa: "Entrevistas",
    vagas_total: 5,
    contratados: 0,
    vagas_ociosas: 5,
    risco: "Alto",
  },
  {
    id: "c",
    edital: "88/2026",
    data_inicio: "2026-02-15",
    unidade: "CASAI Brasília",
    status: "Cancelado",
    etapa: "",
    vagas_total: 12,
    contratados: 2,
    vagas_ociosas: 10,
    risco: "Médio",
  },
  // Sem data de início: vale o número do edital.
  {
    id: "d",
    edital: "9/2026",
    unidade: "dsei amapá",
    status: "Em andamento",
    etapa: "Análise",
    vagas_total: 5,
    contratados: 1,
    vagas_ociosas: 4,
    risco: "Baixo",
  },
];

const ids = (ordem: OrdemDosEditais) =>
  ordenarEditais(LINHAS, ordem, (l) => l).map((l) => l.id);
const por = (chave: ChaveDaOrdemDosEditais, sentido: "asc" | "desc") =>
  ids({ chave, sentido });

describe("ordem da tabela de Editais", () => {
  it("o padrão é cronológico, do mais recente para o mais antigo", () => {
    expect(ids(ORDEM_PADRAO_DOS_EDITAIS)).toEqual(["b", "c", "a", "d"]);
  });

  it("Edital crescente: do mais antigo para o mais novo", () => {
    expect(por("edital", "asc")).toEqual(["a", "c", "b", "d"]);
  });

  it("sem data, ordena pelo ano e pelo número do edital", () => {
    const semData = LINHAS.map(({ data_inicio: _sem, ...resto }) => resto);
    const ordem = ordenarEditais(
      semData,
      ORDEM_PADRAO_DOS_EDITAIS,
      (l) => l,
    ).map((l) => l.id);
    expect(ordem).toEqual(["b", "c", "d", "a"]);
  });

  it("texto em ordem alfabética, sem caixa nem acento", () => {
    expect(por("unidade", "asc")).toEqual(["c", "b", "d", "a"]);
    expect(por("unidade", "desc")).toEqual(["a", "d", "b", "c"]);
  });

  it("número em ordem numérica; empate fica no mais recente primeiro", () => {
    expect(por("vagas", "asc")).toEqual(["b", "d", "c", "a"]);
    expect(por("ociosas", "desc")).toEqual(["c", "a", "b", "d"]);
  });

  it("risco pela gravidade", () => {
    expect(por("risco", "asc")).toEqual(["a", "d", "c", "b"]);
    expect(por("risco", "desc")).toEqual(["b", "c", "a", "d"]);
  });

  it("vazio fica no fim nos dois sentidos", () => {
    expect(por("etapa", "asc").at(-1)).toBe("c");
    expect(por("etapa", "desc").at(-1)).toBe("c");
  });

  it("1º clique crescente, 2º decrescente, e alterna; outra coluna recomeça", () => {
    let ordem = proximaOrdemDosEditais(ORDEM_PADRAO_DOS_EDITAIS, "vagas");
    expect(ordem).toEqual({ chave: "vagas", sentido: "asc" });
    ordem = proximaOrdemDosEditais(ordem, "vagas");
    expect(ordem).toEqual({ chave: "vagas", sentido: "desc" });
    ordem = proximaOrdemDosEditais(ordem, "vagas");
    expect(ordem).toEqual({ chave: "vagas", sentido: "asc" });
    expect(proximaOrdemDosEditais(ordem, "status")).toEqual({
      chave: "status",
      sentido: "asc",
    });
    // A coluna do padrão (Edital, decrescente) vai para crescente no clique.
    expect(proximaOrdemDosEditais(ORDEM_PADRAO_DOS_EDITAIS, "edital")).toEqual({
      chave: "edital",
      sentido: "asc",
    });
  });

  it("não muda a lista recebida", () => {
    const copia = [...LINHAS];
    ordenarEditais(LINHAS, { chave: "unidade", sentido: "asc" }, (l) => l);
    expect(LINHAS).toEqual(copia);
  });
});

import { describe, expect, it } from "vitest";
import {
  buscarLinhas,
  ehAtalhoDaBusca,
  LIMITE_DE_RESULTADOS,
  partesRealcadas,
  proximoIndice,
  seloDoRisco,
  subtituloDoResultado,
  textoDaBusca,
  tituloDoResultado,
} from "../src/lib/busca-global.js";

const linha = (extra) => ({
  id: 1,
  edital: "Edital 01/2026",
  unidade: "DSEI Xavante",
  etapa: "Inscrições",
  uf: "MT",
  risco: "Alto",
  ...extra,
});

describe("buscarLinhas", () => {
  it("termo vazio ou só espaços não lista nada", () => {
    expect(buscarLinhas([linha()], "")).toEqual([]);
    expect(buscarLinhas([linha()], "   ")).toEqual([]);
  });

  it("procura nos nove campos, sem diferenciar maiúsculas e ignorando espaços nas pontas", () => {
    const linhas = [
      linha({ id: 1, status: "Em andamento" }),
      linha({ id: 2, ciclo: "2026" }),
      linha({ id: 3, responsavel: "Maria" }),
      linha({ id: 4, observacoes: "Aguardando PUBLICAÇÃO" }),
      linha({ id: 5, unidade: "DSEI Yanomami", uf: "RR" }),
    ];
    expect(buscarLinhas(linhas, "  maria ").map((l) => l.id)).toEqual([3]);
    expect(buscarLinhas(linhas, "publicação").map((l) => l.id)).toEqual([4]);
    expect(buscarLinhas(linhas, "andamento").map((l) => l.id)).toEqual([1]);
    expect(buscarLinhas(linhas, "rr").map((l) => l.id)).toEqual([5]);
    expect(buscarLinhas(linhas, "alto")).toHaveLength(5);
  });

  it("não procura em campos fora da lista", () => {
    expect(buscarLinhas([linha({ municipio: "Barra" })], "barra")).toEqual([]);
  });

  it("os campos viram um texto só: o termo pode atravessar dois deles", () => {
    expect(textoDaBusca(linha())).toContain("edital 01/2026 dsei xavante");
    expect(buscarLinhas([linha()], "2026 dsei")).toHaveLength(1);
  });

  it("mantém a ordem das linhas e para em 12", () => {
    const linhas = Array.from({ length: 20 }, (_, i) => linha({ id: i }));
    const achadas = buscarLinhas(linhas, "xavante");
    expect(LIMITE_DE_RESULTADOS).toBe(12);
    expect(achadas.map((l) => l.id)).toEqual([...Array(12).keys()]);
  });

  it("aceita lista ausente", () => {
    expect(buscarLinhas(null, "x")).toEqual([]);
  });
});

describe("textos do resultado", () => {
  it("título: edital (ou '-') e unidade", () => {
    expect(tituloDoResultado(linha())).toBe("Edital 01/2026 — DSEI Xavante");
    expect(tituloDoResultado(linha({ edital: "" }))).toBe("- — DSEI Xavante");
  });

  it("subtítulo: etapa e, se houver, UF", () => {
    expect(subtituloDoResultado(linha())).toBe("Inscrições · MT");
    expect(subtituloDoResultado(linha({ uf: "" }))).toBe("Inscrições");
    expect(subtituloDoResultado(linha({ etapa: null, uf: "AM" }))).toBe(
      " · AM",
    );
  });

  it("selo do risco: Alto, Médio (com ou sem acento) e Baixo para o resto", () => {
    expect(seloDoRisco("ALTO")).toEqual({ tom: "red", texto: "Alto" });
    expect(seloDoRisco("médio")).toEqual({ tom: "yellow", texto: "Médio" });
    expect(seloDoRisco("medio")).toEqual({ tom: "yellow", texto: "Médio" });
    expect(seloDoRisco("baixo")).toEqual({ tom: "green", texto: "Baixo" });
    expect(seloDoRisco(undefined)).toEqual({ tom: "green", texto: "Baixo" });
  });
});

describe("partesRealcadas", () => {
  it("marca todas as ocorrências, sem diferenciar maiúsculas", () => {
    expect(partesRealcadas("Dsei dsei X", " DSEI ")).toEqual([
      { texto: "Dsei", realce: true },
      { texto: " ", realce: false },
      { texto: "dsei", realce: true },
      { texto: " X", realce: false },
    ]);
  });

  it("sem termo ou sem ocorrência, o texto inteiro sem marca", () => {
    expect(partesRealcadas("Xavante", "")).toEqual([
      { texto: "Xavante", realce: false },
    ]);
    expect(partesRealcadas("Xavante", "zzz")).toEqual([
      { texto: "Xavante", realce: false },
    ]);
    expect(partesRealcadas("", "x")).toEqual([]);
  });
});

describe("proximoIndice", () => {
  it("setas andam sem passar das pontas; -1 é nenhum", () => {
    expect(proximoIndice(-1, "ArrowDown", 3)).toBe(0);
    expect(proximoIndice(2, "ArrowDown", 3)).toBe(2);
    expect(proximoIndice(0, "ArrowUp", 3)).toBe(0);
    expect(proximoIndice(-1, "ArrowUp", 3)).toBe(0);
    expect(proximoIndice(-1, "ArrowDown", 0)).toBe(-1);
    expect(proximoIndice(1, "Enter", 3)).toBe(1);
  });
});

describe("ehAtalhoDaBusca", () => {
  it("Ctrl+K e Cmd+K", () => {
    expect(ehAtalhoDaBusca({ ctrlKey: true, key: "k" })).toBe(true);
    expect(ehAtalhoDaBusca({ metaKey: true, key: "k" })).toBe(true);
    expect(ehAtalhoDaBusca({ key: "k" })).toBe(false);
    expect(ehAtalhoDaBusca({ ctrlKey: true, key: "j" })).toBe(false);
  });
});

describe("busca sem acento e atalho com Caps Lock", () => {
  it("'saude indigena' acha 'Saúde Indígena' e o realce cai no lugar certo", () => {
    const l = linha({ unidade: "Saúde Indígena", etapa: "Convocação" });
    expect(buscarLinhas([l], "saude indigena")).toHaveLength(1);
    expect(buscarLinhas([l], "convocacao")).toHaveLength(1);
    expect(partesRealcadas("Saúde Indígena", "indigena")).toEqual([
      { texto: "Saúde ", realce: false },
      { texto: "Indígena", realce: true },
    ]);
  });

  it("Ctrl+K com Caps Lock ou Shift também abre", () => {
    expect(ehAtalhoDaBusca({ ctrlKey: true, key: "K" })).toBe(true);
  });
});

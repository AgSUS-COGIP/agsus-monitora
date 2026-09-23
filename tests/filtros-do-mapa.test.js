import { describe, expect, it } from "vitest";
import {
  chaveDeFiltro,
  chaveDeRenderDoMapa,
  linhaAtende,
  opcoesDoCampo,
  podarSelecoes,
} from "../src/lib/filtros-do-mapa.js";

const CAMPOS = ["unidade", "edital", "status", "risco"];
const vazio = () => Object.fromEntries(CAMPOS.map((c) => [c, new Set()]));
const chaveDsei = (linha) =>
  String(linha.unidade || "")
    .replace(/^DSEI\s+/i, "")
    .toUpperCase();

const LINHAS = [
  {
    unidade: "DSEI Yanomami",
    edital: "01/2026",
    status: "Em Andamento",
    risco: "Alto",
    vagas_total: 10,
    vagas_ociosas: 4,
  },
  {
    unidade: "DSEI Yanomami",
    edital: "02/2026",
    status: "Concluído",
    risco: "Medio",
    vagas_total: 5,
    vagas_ociosas: 0,
  },
  {
    unidade: "DSEI Xingu",
    edital: "01/2026",
    status: "Em andamento",
    risco: "Médio",
    vagas_total: 3,
    vagas_ociosas: 1,
  },
  {
    unidade: "DSEI Xingu",
    edital: "03/2025",
    status: "Concluido",
    risco: "Baixo",
    vagas_total: 2,
    vagas_ociosas: 0,
  },
  {
    unidade: "DSEI Potiguara",
    edital: "03/2025",
    status: "Concluído",
    risco: "Médio",
    vagas_total: 1,
    vagas_ociosas: 1,
  },
];

describe("chaveDeFiltro", () => {
  it("ignora acento, caixa e espaços", () => {
    expect(chaveDeFiltro("  MÉDIO   Rio ")).toBe("medio rio");
    expect(chaveDeFiltro(null)).toBe("");
  });
});

describe("opcoesDoCampo", () => {
  it("não duplica grafias com e sem acento e usa a mais frequente", () => {
    expect(opcoesDoCampo(LINHAS, vazio(), "risco")).toEqual([
      "Alto",
      "Baixo",
      "Médio",
    ]);
    expect(opcoesDoCampo(LINHAS, vazio(), "status")).toEqual([
      "Concluído",
      "Em Andamento",
    ]);
  });

  it("oferece só o que casa com os outros filtros", () => {
    const estado = vazio();
    estado.edital = new Set(["03/2025"]);
    expect(opcoesDoCampo(LINHAS, estado, "unidade")).toEqual([
      "DSEI Potiguara",
      "DSEI Xingu",
    ]);
    // o próprio campo não se restringe
    expect(opcoesDoCampo(LINHAS, estado, "edital")).toHaveLength(3);
  });
});

describe("linhaAtende", () => {
  it("casa seleção com grafia diferente da linha", () => {
    const estado = vazio();
    estado.risco = new Set(["Médio"]);
    expect(LINHAS.filter((l) => linhaAtende(l, estado))).toHaveLength(3);
  });

  it("filtra pelo DSEI selecionado com a chave do mapa, não por texto", () => {
    const estado = vazio();
    const noXingu = LINHAS.filter((l) =>
      linhaAtende(l, estado, { dsei: "XINGU", chaveDsei }),
    );
    expect(noXingu.map((l) => l.edital)).toEqual(["01/2026", "03/2025"]);
  });

  it("aplica a regra extra de exclusão", () => {
    const encerrado = (l) => chaveDeFiltro(l.status).startsWith("conclu");
    expect(
      LINHAS.filter((l) => linhaAtende(l, vazio(), { excluir: encerrado })),
    ).toHaveLength(2);
  });
});

describe("podarSelecoes", () => {
  it("encadeia: poda repetida até não sobrar seleção órfã", () => {
    const estado = vazio();
    // Unidade=Potiguara só existe no edital 03/2025, com risco Médio.
    estado.unidade = new Set(["DSEI Potiguara"]);
    estado.risco = new Set(["Médio"]);
    estado.edital = new Set(["01/2026"]); // incompatível com Potiguara
    podarSelecoes(LINHAS, estado, { campos: CAMPOS });
    const recorte = LINHAS.filter((l) =>
      linhaAtende(l, estado, { campos: CAMPOS }),
    );
    // toda seleção que sobrou tem de ser oferecida pelas opções atuais
    CAMPOS.forEach((campo) => {
      const oferecidas = new Set(
        opcoesDoCampo(LINHAS, estado, campo, { campos: CAMPOS }),
      );
      estado[campo].forEach((v) => expect(oferecidas.has(v)).toBe(true));
    });
    expect(recorte.length).toBeGreaterThan(0);
  });

  it("devolve false quando nada muda e reescreve a grafia para a canônica", () => {
    const estado = vazio();
    estado.risco = new Set(["medio"]);
    expect(podarSelecoes(LINHAS, estado, { campos: CAMPOS })).toBe(true);
    expect([...estado.risco]).toEqual(["Médio"]);
    expect(podarSelecoes(LINHAS, estado, { campos: CAMPOS })).toBe(false);
  });

  it("respeita a exclusão (ocultar encerrados) ao podar", () => {
    const estado = vazio();
    estado.status = new Set(["Concluído"]);
    const encerrado = (l) => chaveDeFiltro(l.status).startsWith("conclu");
    podarSelecoes(LINHAS, estado, { campos: CAMPOS, excluir: encerrado });
    expect(estado.status.size).toBe(0);
  });
});

describe("chaveDeRenderDoMapa", () => {
  it("muda quando as vagas mudam com a mesma contagem de linhas", () => {
    const a = chaveDeRenderDoMapa([LINHAS[0]], chaveDsei);
    const b = chaveDeRenderDoMapa([LINHAS[1]], chaveDsei);
    expect(a).not.toBe(b);
  });

  it("não depende da ordem das linhas", () => {
    expect(chaveDeRenderDoMapa(LINHAS, chaveDsei, "F|")).toBe(
      chaveDeRenderDoMapa([...LINHAS].reverse(), chaveDsei, "F|"),
    );
  });
});

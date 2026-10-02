import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATALOGO_DE_CRITERIOS,
  codigosDaModalidade,
  simOuNao,
} from "../../src/lib/classificacao/catalogo.js";
import {
  arredondar,
  dataBR,
  escalar,
  formatarNota,
  idadeNaData,
  numeroBR,
} from "../../src/lib/classificacao/numeros.js";
import {
  normalizarRegra,
  REGRA_VAZIA,
  validarRegra,
} from "../../src/lib/classificacao/regra.js";
import {
  chaveDoGrupo,
  conferirSorteio,
  ordemDoSorteio,
  sementeValida,
  sha256Hex,
} from "../../src/lib/classificacao/sorteio.js";
import {
  nivelDaVaga,
  textoDasVagas,
  vagasPelosPercentuais,
} from "../../src/lib/classificacao/vagas.js";

const SEED = readFileSync(
  "supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql",
  "utf8",
);
const regraDoSeed = (marca) => {
  const inicio = SEED.indexOf(`$${marca}$`) + marca.length + 2;
  return JSON.parse(SEED.slice(inicio, SEED.indexOf(`$${marca}$`, inicio)));
};

describe("numeroBR", () => {
  it.each([
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["1.234,5", 1234.5],
    ["1,234.5", 1234.5],
    ["1.234.567", 1234567],
    [" 13 ", 13],
    ["-2,5", -2.5],
    [7, 7],
    ["0", 0],
    ["", null],
    [null, null],
    [undefined, null],
    ["abc", null],
    ["1,2,3", null],
    ["12,5 pontos", null],
    [Number.NaN, null],
  ])("%j → %j", (entrada, saida) => {
    expect(numeroBR(entrada)).toBe(saida);
  });
});

describe("arredondamento e formato", () => {
  it("meio para cima sem erro de ponto flutuante (1,005 → 1,01; 30,25 → 30,3)", () => {
    expect(arredondar(1.005, 2)).toBe(1.01);
    expect(arredondar(30.25, 1)).toBe(30.3);
    expect(arredondar(13 + 17.33, 1)).toBe(30.3);
    expect(arredondar(2.675, 2, "TRUNCAR")).toBe(2.67);
    expect(arredondar(2.675, 2, "NENHUM")).toBe(2.675);
    expect(arredondar(null, 2)).toBeNull();
  });

  it("comparação na escala das casas", () => {
    expect(escalar(52.004, 2)).toBe(escalar(52, 2));
    expect(escalar(52.006, 2)).toBeGreaterThan(escalar(52, 2));
  });

  it("formato pt-BR com casas fixas", () => {
    expect(formatarNota(52, 2)).toBe("52,00");
    expect(formatarNota(1234.5, 1)).toBe("1234,5");
    expect(formatarNota(null)).toBe("—");
    expect(dataBR("2026-07-20")).toBe("20/07/2026");
  });

  it("idade na data de corte", () => {
    expect(idadeNaData("1966-07-20", "2026-07-20")).toBe(60);
    expect(idadeNaData("1966-07-21", "2026-07-20")).toBe(59);
    expect(idadeNaData("20/07/1966", "2026-07-20")).toBe(60);
    expect(idadeNaData("1966-02-30", "2026-07-20")).toBeNull();
    expect(idadeNaData("", "2026-07-20")).toBeNull();
  });
});

describe("modalidades do candidato", () => {
  it.each([
    ["Ampla concorrência", ["AC"]],
    ["Pretos e pardos", ["PP"]],
    ["Ampla Concorrência / Indígenas", ["AC", "PI"]],
    ["Quilombola", ["PQ"]],
    ["Pessoa com deficiência (PcD)", ["PCD"]],
    ["", []],
  ])("%s", (texto, codigos) => {
    expect(codigosDaModalidade(texto)).toEqual(codigos);
  });

  it("PcD sim ou não", () => {
    expect(["Sim", "S", "true", "1", "PcD"].map(simOuNao)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(["Não", "N", "", null, "false"].map(simOuNao)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("regra: nada de regra fixa", () => {
  it("a regra vazia é neutra: sem desempate, sem mínimo, empate na mesma posição", () => {
    const r = normalizarRegra({});
    expect(r.desempate).toEqual([]);
    expect(r.documental.nota_minima).toBeNull();
    expect(r.entrevista.nota_minima).toBeNull();
    expect(r.empate_final.metodo).toBe("MESMA_POSICAO");
    expect(r.modalidades.map((m) => m.codigo)).toEqual(["AC"]);
    expect(normalizarRegra(REGRA_VAZIA)).toEqual(r);
  });

  it("normalizar é idempotente e a ampla entra sempre", () => {
    const r = normalizarRegra({
      modalidades: [{ codigo: "pp", remanejar_para: "AC, pp" }],
    });
    expect(r.modalidades.map((m) => m.codigo)).toEqual(["AC", "PP"]);
    expect(r.modalidades[1].remanejar_para).toEqual(["AC"]);
    expect(normalizarRegra(r)).toEqual(r);
  });

  it("as regras de exemplo do 83 e do 100 são válidas e já vêm normalizadas", () => {
    // O seed já aplicado é anterior às parciais e à lista da entrevista: os
    // campos novos entram neutros (nada muda no que o seed gravou).
    for (const marca of ["regra83", "regra100"]) {
      const regra = regraDoSeed(marca);
      expect(validarRegra(regra), marca).toEqual([]);
      const normal = normalizarRegra(regra);
      expect(normal, marca).toMatchObject(regra);
      expect(normal.documental.parciais).toEqual([]);
      expect(normal.listas.ENTREVISTA).toEqual({ empate: "MESMA_POSICAO" });
    }
  });

  it.each([
    [{ desempate: [{ criterio: "INVENTADO" }] }, "desempate"],
    [
      { desempate: [{ criterio: "IDOSO_60" }, { criterio: "IDOSO_60" }] },
      "desempate",
    ],
    [{ etapas: { documental: false, entrevista: false } }, "etapas"],
    [
      { composicao: { componentes: [{ codigo: "DOCUMENTAL", peso: 500 }] } },
      "composicao.componentes",
    ],
    [{ etapas: { entrevista: false } }, "composicao.componentes"],
    [
      {
        modalidades: [
          { codigo: "AC" },
          { codigo: "PP", remanejar_para: ["PI"] },
        ],
      },
      "modalidades",
    ],
    [{ modalidades: [{ codigo: "PP", percentual: 120 }] }, "modalidades"],
    [{ convocacao: { multiplo_vagas: 1000 } }, "convocacao.multiplo_vagas"],
    [{ data_corte: "31/02/2026" }, "data_corte"],
    [{ rodape: "x".repeat(1001) }, "rodape"],
    [
      { entrevista: { competencias: [{ ordem: 1 }, { ordem: 1 }] } },
      "entrevista.competencias",
    ],
  ])("%j é recusada em %s", (regra, campo) => {
    expect(validarRegra(regra).map((e) => e.campo)).toContain(campo);
  });

  it("todo critério do catálogo tem leitura e dado faltante descritos", () => {
    for (const c of CATALOGO_DE_CRITERIOS) {
      expect(typeof c.ler, c.codigo).toBe("function");
      expect(c.falta({}, {}), c.codigo).toBeTruthy();
    }
  });
});

describe("nível e vagas", () => {
  const regra = regraDoSeed("regra83");
  it("o cargo COMEÇA com o termo: Técnico de Enfermagem é técnico; Analista Técnico não", () => {
    expect(
      nivelDaVaga({ cargo: "Técnico de Enfermagem - CASAI Sinop" }, regra),
    ).toBe("tecnico");
    expect(
      nivelDaVaga({ cargo: "Analista Técnico de Saúde Indígena" }, regra),
    ).toBe("superior");
    expect(nivelDaVaga({ cargo: "Agente de Combate a Endemias" }, regra)).toBe(
      "fundamental",
    );
    expect(
      nivelDaVaga({ cargo: "Qualquer", categoria: "Nível Médio" }, {}),
    ).toBe("medio");
    expect(nivelDaVaga({ cargo: "Qualquer" }, {})).toBeNull();
  });

  it("reserva pelos percentuais só com o mínimo de vagas; PcD arredonda para cima", () => {
    expect(vagasPelosPercentuais(1, regra)).toEqual({ AC: 1 });
    expect(vagasPelosPercentuais(4, regra)).toEqual({ AC: 2, PCD: 1, PP: 1 });
    expect(
      textoDasVagas(
        { total: 3, porModalidade: { AC: 2, PP: 1 }, cadastroReserva: true },
        regra,
      ),
    ).toBe("3 vagas (2 AC + 1 Pretos e Pardos + CR)");
    expect(textoDasVagas({ total: 0, porModalidade: {} }, regra)).toBe(
      "Cadastro Reserva",
    );
  });
});

describe("sorteio reprodutível", () => {
  it("sha256 igual ao do Node (e ao sha256() do PostgreSQL)", () => {
    for (const texto of [
      "",
      "abc",
      "semente:00000000-0000-4000-8000-000000000001",
      "çãé",
      "x".repeat(200),
    ])
      expect(sha256Hex(texto)).toBe(
        createHash("sha256").update(texto, "utf8").digest("hex"),
      );
  });

  it("mesma semente, mesma ordem; outra semente, outra ordem possível", () => {
    const ids = ["b", "a", "c", "d"];
    const ordem = ordemDoSorteio("2026-10-02", ids);
    expect(ordemDoSorteio("2026-10-02", [...ids].reverse())).toEqual(ordem);
    expect([...ordem].sort()).toEqual(["a", "b", "c", "d"]);
    expect(conferirSorteio("2026-10-02", ordem)).toBe(true);
    expect(
      conferirSorteio("outra", ordem) &&
        conferirSorteio("2026-10-02", [...ordem].reverse()),
    ).toBe(false);
  });

  it("a ordem é a do hash crescente, como no banco", () => {
    const ids = ["x1", "x2", "x3"];
    const esperado = [...ids].sort((a, b) =>
      sha256Hex(`s:${a}`) < sha256Hex(`s:${b}`) ? -1 : 1,
    );
    expect(ordemDoSorteio("s", ids)).toEqual(esperado);
  });

  it("chave do grupo independe da ordem dos ids", () => {
    expect(chaveDoGrupo("FINAL", "169681", ["b", "a"])).toBe(
      "FINAL|169681|a,b",
    );
    expect(sementeValida("abc")).toBe(false);
    expect(sementeValida("abcd")).toBe(true);
  });
});

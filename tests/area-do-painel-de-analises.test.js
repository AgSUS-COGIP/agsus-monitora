import { describe, expect, it } from "vitest";
import {
  AREA_PADRAO_DO_PAINEL,
  areaDaUrlDoPainel,
  chaveDoCacheDoPayload,
  chaveDoCacheLocalDeAnalises,
  colunasDoCsvDeAnalises,
  ehAreaSaudeIndigena,
  experienciaProfissionalDaLinha,
  grupoDaPlanilhaDaArea,
  mensagemDeAreaSemAnalises,
  nomeDoCsvDeAnalises,
  parametroDeAreaDaRpc,
  rotuloDaAreaDoPainel,
  subtituloDoPainelDeAnalises,
  tituloDaAbaDoPainelDeAnalises,
  tituloDoPainelDeAnalises,
} from "../src/lib/area-do-painel-de-analises.js";

/*
  Saúde Indígena, SEDE e Projetos abrem o MESMO painel de análises; a área vem
  da URL. Sem área (ou com lixo), o painel é o da Saúde Indígena — igual ao de
  antes de haver áreas.
*/
describe("a área do painel pela URL", () => {
  it("aceita os três códigos", () => {
    expect(areaDaUrlDoPainel("?area=projetos")).toBe("projetos");
    expect(areaDaUrlDoPainel("?area=sede")).toBe("sede");
    expect(areaDaUrlDoPainel("area=saude-indigena")).toBe("saude-indigena");
    expect(areaDaUrlDoPainel("?aba=1&area=PROJETOS")).toBe("projetos");
  });

  it("sem área ou com código desconhecido, é a Saúde Indígena", () => {
    expect(AREA_PADRAO_DO_PAINEL).toBe("saude-indigena");
    expect(areaDaUrlDoPainel("")).toBe("saude-indigena");
    expect(areaDaUrlDoPainel(undefined)).toBe("saude-indigena");
    expect(areaDaUrlDoPainel("?area=")).toBe("saude-indigena");
    expect(areaDaUrlDoPainel("?area=paineis")).toBe("saude-indigena");
    expect(areaDaUrlDoPainel("?area=<script>")).toBe("saude-indigena");
  });

  it("título e rótulo de cada área", () => {
    expect(tituloDoPainelDeAnalises()).toBe("Painel de análises curriculares");
    expect(subtituloDoPainelDeAnalises("projetos")).toBe(
      "Projetos · Acompanhamento das análises dos processos seletivos",
    );
    expect(subtituloDoPainelDeAnalises("sede")).toMatch(/^SEDE · /);
    expect(tituloDaAbaDoPainelDeAnalises("saude-indigena")).toBe(
      "Painel de análises curriculares · Saúde Indígena — MONITORA",
    );
    expect(rotuloDaAreaDoPainel("xyz")).toBe("Saúde Indígena");
    expect(ehAreaSaudeIndigena("saude-indigena")).toBe(true);
    expect(ehAreaSaudeIndigena("projetos")).toBe(false);
  });

  it("grupo da planilha e parâmetro das RPCs", () => {
    expect(grupoDaPlanilhaDaArea("saude-indigena")).toBe("Saúde Indígena");
    expect(grupoDaPlanilhaDaArea("projetos")).toBe("Projetos");
    expect(grupoDaPlanilhaDaArea("sede")).toBe("SEDE");
    expect(parametroDeAreaDaRpc("sede")).toEqual({ p_area: "sede" });
    expect(parametroDeAreaDaRpc("qualquer")).toEqual({
      p_area: "saude-indigena",
    });
  });
});

describe("cache por área", () => {
  const base = {
    prefixo: "agsus_analises_cache_v1",
    versao: 5,
    usuario: "u1",
    escopo: "ativo",
  };

  it("a chave da Saúde Indígena é a de sempre (o cache já guardado vale)", () => {
    expect(
      chaveDoCacheLocalDeAnalises({ ...base, area: "saude-indigena" }),
    ).toBe("agsus_analises_cache_v1_v5_u1_ativo");
  });

  it("as outras áreas têm chave própria e nunca batem entre si", () => {
    const chaves = ["saude-indigena", "sede", "projetos"].map((area) =>
      chaveDoCacheLocalDeAnalises({ ...base, area }),
    );
    expect(chaves[2]).toBe("agsus_analises_cache_v1_v5_u1_projetos_ativo");
    expect(new Set(chaves).size).toBe(3);
    expect(
      chaveDoCacheLocalDeAnalises({ ...base, usuario: "", area: "sede" }),
    ).toBe("agsus_analises_cache_v1_v5_anonymous_sede_ativo");
  });

  it("o cache em memória do transporte também separa as áreas", () => {
    expect(chaveDoCacheDoPayload("projetos", "ativo")).toBe("projetos:ativo");
    expect(chaveDoCacheDoPayload("saude-indigena", "Todos")).toBe(
      "saude-indigena:todos",
    );
    expect(chaveDoCacheDoPayload("sede", "ativo")).not.toBe(
      chaveDoCacheDoPayload("saude-indigena", "ativo"),
    );
  });
});

describe("experiência profissional (SEDE e Projetos)", () => {
  it("anos, meses e dias quando a planilha traz as partes", () => {
    expect(
      experienciaProfissionalDaLinha({
        experiencia_profissional_anos: 8,
        experiencia_profissional_meses: 2,
        experiencia_profissional_dias: 15,
        experiencia_profissional_total: 2995,
      }),
    ).toBe("8 anos, 2 meses e 15 dias");
    expect(
      experienciaProfissionalDaLinha({
        experiencia_profissional_anos: 1,
        experiencia_profissional_meses: 0,
        experiencia_profissional_dias: 1,
      }),
    ).toBe("1 ano e 1 dia");
    expect(
      experienciaProfissionalDaLinha({
        experiencia_profissional_anos: 0,
        experiencia_profissional_meses: 1,
        experiencia_profissional_dias: 0,
      }),
    ).toBe("1 mês");
    expect(
      experienciaProfissionalDaLinha({
        experiencia_profissional_anos: 0,
        experiencia_profissional_meses: 0,
        experiencia_profissional_dias: 0,
      }),
    ).toBe("0 dias");
  });

  it("só o total (em dias), ou nada", () => {
    expect(
      experienciaProfissionalDaLinha({
        experiencia_profissional_total: "2943",
      }),
    ).toBe("2.943 dias");
    expect(experienciaProfissionalDaLinha({})).toBe("-");
    expect(experienciaProfissionalDaLinha(null)).toBe("-");
  });
});

describe("CSV e tabela vazia por área", () => {
  const colunas = ["grupo", "unidade", "analise"];

  it("a Saúde Indígena exporta as colunas de sempre", () => {
    expect(colunasDoCsvDeAnalises(colunas, "saude-indigena")).toEqual(colunas);
    expect(nomeDoCsvDeAnalises("saude-indigena")).toBe(
      "agsus_analises_curriculares_v3.csv",
    );
  });

  it("SEDE e Projetos ganham a experiência profissional no fim", () => {
    expect(colunasDoCsvDeAnalises(colunas, "projetos")).toEqual([
      ...colunas,
      "experiencia_profissional_anos",
      "experiencia_profissional_meses",
      "experiencia_profissional_dias",
      "experiencia_profissional_total",
    ]);
    expect(nomeDoCsvDeAnalises("projetos")).toBe(
      "agsus_analises_curriculares_projetos.csv",
    );
  });

  it("só a SEDE tem mensagem própria para área sem análises", () => {
    expect(mensagemDeAreaSemAnalises("sede")).toBe(
      "Ainda não há análises da SEDE. Elas aparecem quando a planilha da SEDE começar a enviar.",
    );
    expect(mensagemDeAreaSemAnalises("projetos")).toBe("");
    expect(mensagemDeAreaSemAnalises("saude-indigena")).toBe("");
  });
});

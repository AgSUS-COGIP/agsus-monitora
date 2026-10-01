import { describe, expect, it } from "vitest";
import {
  ayaPageContextFor,
  formatAyaPageContext,
} from "../src/modules/aya-page-context.js";
import { buildAyaSystemPrompt } from "../src/modules/aya-knowledge.js";

describe("contexto fixo da Aya por página", () => {
  it("dá à Visão geral o nome da área atual, não 'Saúde Indígena'", () => {
    expect(ayaPageContextFor("dashboard", "SEDE", { area: "sede" }).name).toBe(
      "Visão geral · SEDE",
    );
    expect(
      ayaPageContextFor("dashboard", "Projetos", { area: "projetos" }).name,
    ).toBe("Visão geral · Projetos");
    expect(
      ayaPageContextFor("dashboard", "Saúde Indígena", {
        area: "saude-indigena",
      }).name,
    ).toBe("Visão geral · Saúde Indígena");
  });

  it("só fala de DSEI/CASAI na Visão geral da Saúde Indígena", () => {
    const si = formatAyaPageContext("dashboard", "Saúde Indígena", {
      area: "saude-indigena",
    });
    const sede = formatAyaPageContext("dashboard", "SEDE", { area: "sede" });
    expect(si).toContain("DSEI é Distrito Sanitário Especial Indígena");
    expect(sede).not.toContain("DSEI");
    expect(sede).not.toContain("Saúde Indígena");
  });

  it("reconhece as páginas do menu, com a área", () => {
    expect(ayaPageContextFor("nucleo", "Editais", { area: "sede" }).name).toBe(
      "Editais · SEDE",
    );
    expect(ayaPageContextFor("panel:analises", "Análises").name).toBe(
      "Análises curriculares",
    );
    expect(
      ayaPageContextFor("recursos", "Recursos", { area: "projetos" }).name,
    ).toBe("Recursos · Projetos");
    expect(ayaPageContextFor("entrevistas", "Entrevistas").purpose).toContain(
      "janela",
    );
  });

  it("dá a seção aberta de Configurações e mantém fallback seguro", () => {
    expect(ayaPageContextFor("config", "Configurações").name).toBe(
      "Configurações",
    );
    expect(
      ayaPageContextFor("config", "Configurações", { secao: "acessos" }).name,
    ).toBe("Configurações › Acessos");
    expect(ayaPageContextFor("desconhecida", "Outra página").name).toBe(
      "MONITORA",
    );
  });

  it("formata finalidade, conceitos e regras específicas", () => {
    const text = formatAyaPageContext("dashboard", "Saúde Indígena", {
      area: "saude-indigena",
    });
    expect(text).toContain("PÁGINA ATUAL: Visão geral · Saúde Indígena");
    expect(text).toContain("Priorize os números, filtros e territórios");
  });
});

describe("área atual no prompt", () => {
  it("leva a área e a seção do contexto da tela ao prompt", () => {
    const prompt = buildAyaSystemPrompt({
      section: "dashboard",
      title: "SEDE",
      question: "o que aparece aqui?",
      context: { area: "sede" },
    });
    expect(prompt).toContain("PÁGINA ATUAL: Visão geral · SEDE");
    expect(prompt).toContain("Área atual: SEDE");
    expect(prompt).not.toContain("PÁGINA ATUAL: Saúde Indígena");

    const config = buildAyaSystemPrompt({
      section: "config",
      title: "Configurações",
      context: { secao: "modulos" },
    });
    expect(config).toContain("PÁGINA ATUAL: Configurações › Módulos e abas");
    expect(config).toContain("Seção de Configurações aberta: Módulos e abas");
  });

  it("leva o edital aberto, e só o número dele", () => {
    const prompt = buildAyaSystemPrompt({
      section: "nucleo",
      context: { area: "sede", registroAberto: "Edital 101/2026" },
    });
    expect(prompt).toContain("Registro aberto: Edital 101/2026");
  });
});

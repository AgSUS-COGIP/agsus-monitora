import { describe, expect, it } from "vitest";
import {
  ayaPageContextFor,
  formatAyaPageContext,
} from "../src/modules/aya-page-context.js";

describe("contexto fixo da Aya por página", () => {
  it("reconhece Saúde Indígena pelo identificador da seção", () => {
    const profile = ayaPageContextFor("dashboard", "Saúde Indígena");
    expect(profile.name).toBe("Saúde Indígena");
    expect(profile.purpose).toContain("DSEIs/CASAIs");
  });

  it("reconhece Equipe Núcleo e Análises", () => {
    expect(ayaPageContextFor("nucleo", "Equipe Núcleo").name).toBe(
      "Equipe Núcleo",
    );
    expect(ayaPageContextFor("panel:analises", "Análises").name).toBe(
      "Análises",
    );
  });

  it("reconhece Configurações e mantém fallback seguro", () => {
    expect(ayaPageContextFor("config", "Configurações").name).toBe(
      "Configurações",
    );
    expect(ayaPageContextFor("desconhecida", "Outra página").name).toBe(
      "MONITORA",
    );
  });

  it("formata finalidade, conceitos e regras específicas", () => {
    const text = formatAyaPageContext("dashboard", "Saúde Indígena");
    expect(text).toContain("PÁGINA ATUAL: Saúde Indígena");
    expect(text).toContain("DSEI é Distrito Sanitário Especial Indígena");
    expect(text).toContain("Priorize os números, filtros e territórios");
  });
});

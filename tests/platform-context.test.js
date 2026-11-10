import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  isAllowedInstitutionalEmail,
  normalizeAllowedDomains,
  normalizePlatformContext,
  profileDisplayName,
} from "../src/lib/platform-context";

describe("contexto institucional da plataforma", () => {
  it("normaliza domínios e valida contas institucionais", () => {
    expect(
      normalizeAllowedDomains("@AgenciaSUS.org.br, agsus.org.br, agsus.org.br"),
    ).toEqual(["agenciasus.org.br", "agsus.org.br"]);
    expect(
      isAllowedInstitutionalEmail(
        "Pessoa@AgenciaSUS.org.br",
        "agenciasus.org.br",
      ),
    ).toBe(true);
    expect(
      isAllowedInstitutionalEmail("pessoa@gmail.com", "agenciasus.org.br"),
    ).toBe(false);
  });

  it("converte a resposta única do banco sem duplicar painéis", () => {
    expect(
      normalizePlatformContext({
        profile: { id: "perfil-1", nome: "Ana", ativo: true },
        panel_ids: ["painel-1", "painel-1", "painel-2"],
        modules: { ind: true },
      }),
    ).toEqual({
      profile: { id: "perfil-1", nome: "Ana", ativo: true },
      panelIds: ["painel-1", "painel-2"],
      modules: { ind: true },
    });
  });

  it("prioriza o nome institucional no shell", () => {
    expect(
      profileDisplayName(
        { nome: "Ana Souza" },
        { email: "ana@agenciasus.org.br" },
      ),
    ).toBe("Ana Souza");
  });
});

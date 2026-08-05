import { describe, expect, it, vi } from "vitest";
import {
  avatarDataUri,
  avatarSvg,
  defaultAvatarConfig,
  initialsFromName,
  normalizeAvatarConfig,
  randomAvatarConfig,
} from "../src/lib/avatar-config.js";

describe("avatar institucional", () => {
  it("gera iniciais com primeiro e último nomes", () => {
    expect(initialsFromName("Yassury Sousa Suira")).toBe("YS");
    expect(initialsFromName("AgSUS")).toBe("A");
    expect(initialsFromName(" ")).toBe("?");
  });

  it("normaliza opções inválidas sem confiar no conteúdo persistido", () => {
    const normalized = normalizeAvatarConfig(
      {
        face: "inexistente",
        hair: "modern",
        outfit: "inexistente",
        glasses: "sim",
        skinColor: "javascript:alert(1)",
      },
      "Pessoa Teste",
    );

    expect(normalized.version).toBe(2);
    expect(normalized.face).toBe("soft");
    expect(normalized.hair).toBe("modern");
    expect(normalized.outfit).toBe("blazer");
    expect(normalized.glasses).toBe(false);
    expect(normalized.skinColor).toBe(
      defaultAvatarConfig("Pessoa Teste").skinColor,
    );
  });

  it("gera retrato premium autocontido e escapa o nome acessível", () => {
    const svg = avatarSvg(defaultAvatarConfig("Pessoa"), '<Pessoa & "Teste">');

    expect(svg).toContain("<svg");
    expect(svg).toContain('data-avatar-style="institutional-v2"');
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain("Avatar de &lt;Pessoa &amp; &quot;Teste&quot;&gt;");
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain('stroke-width="6"');
    expect(avatarDataUri(defaultAvatarConfig("Pessoa"), "Pessoa")).toMatch(
      /^data:image\/svg\+xml;charset=UTF-8,/,
    );
  });

  it("permite variar a composição com fonte de aleatoriedade controlada", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const randomized = randomAvatarConfig("Pessoa", () => 0.99);

    expect(randomized.seed).toBe("Pessoa-123");
    expect(randomized.hair).toBe("modern");
    expect(randomized.outfit).toBe("field");
    expect(randomized.glasses).toBe(true);
    expect(randomized.earrings).toBe(true);
  });
});

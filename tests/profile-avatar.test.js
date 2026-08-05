import { describe, expect, it } from "vitest";
import { resolveAvatarPresentation } from "../src/modules/profile-avatar.js";

describe("apresentação do avatar do perfil", () => {
  const user = {
    email: "pessoa@agenciasus.org.br",
    user_metadata: {
      full_name: "Pessoa da AgSUS",
      picture: "https://example.test/google.png",
    },
  };

  it("gera o personagem a partir da configuração persistida", () => {
    const presentation = resolveAvatarPresentation({
      user,
      profile: {
        nome: "Pessoa da AgSUS",
        avatar_source: "GENERATED",
        avatar_config: { hair: "modern", glasses: true },
      },
    });

    expect(presentation.source).toBe("GENERATED");
    expect(presentation.url).toMatch(/^data:image\/svg\+xml/);
    expect(presentation.config.hair).toBe("modern");
    expect(presentation.config.glasses).toBe(true);
  });

  it("usa a foto Google somente quando ela está disponível", () => {
    const presentation = resolveAvatarPresentation({
      user,
      profile: { nome: "Pessoa da AgSUS", avatar_source: "GOOGLE" },
    });

    expect(presentation.source).toBe("GOOGLE");
    expect(presentation.url).toBe("https://example.test/google.png");
  });

  it("preserva a foto enviada", () => {
    const presentation = resolveAvatarPresentation({
      user,
      profile: {
        nome: "Pessoa da AgSUS",
        avatar_source: "UPLOADED",
        avatar_url: "https://example.test/upload.png",
      },
    });

    expect(presentation.source).toBe("UPLOADED");
    expect(presentation.url).toBe("https://example.test/upload.png");
  });

  it("volta para iniciais quando a imagem escolhida está ausente", () => {
    const presentation = resolveAvatarPresentation({
      user: { ...user, user_metadata: { full_name: "Pessoa da AgSUS" } },
      profile: { nome: "Pessoa da AgSUS", avatar_source: "GOOGLE" },
    });

    expect(presentation.source).toBe("INITIALS");
    expect(presentation.url).toBe("");
    expect(presentation.initials).toBe("PA");
  });
});

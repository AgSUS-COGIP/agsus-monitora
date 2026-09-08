import { describe, expect, it } from "vitest";
import { normalizeOnlinePresenceList } from "../src/lib/online-presence.js";

describe("online presence", () => {
  it("normaliza, remove duplicados e ordena pessoas", () => {
    expect(
      normalizeOnlinePresenceList([
        { userId: "2", fullName: "Zuleica Lima", perfil: "editor" },
        {
          user_id: "1",
          nome: "Ana Souza",
          avatar_url: "https://example.com/a.png",
        },
        { userId: "2", fullName: "Zuleica Lima", currentView: "Análises" },
      ]),
    ).toEqual([
      expect.objectContaining({
        userId: "1",
        fullName: "Ana Souza",
        initials: "AS",
      }),
      expect.objectContaining({
        userId: "2",
        fullName: "Zuleica Lima",
        currentView: "Análises",
      }),
    ]);
  });

  it("ignora linhas sem identidade", () => {
    expect(normalizeOnlinePresenceList([null, {}, { userId: "1" }])).toEqual(
      [],
    );
  });
});

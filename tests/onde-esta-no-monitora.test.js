import { describe, expect, it } from "vitest";
import {
  normalizeOnlinePresenceList,
  ondeEstaNoMonitora,
  rotuloDoLocal,
} from "../src/lib/online-presence.js";

describe("onde a pessoa está, em Pessoas online", () => {
  it("página da área: nome da página e da área", () => {
    expect(
      ondeEstaNoMonitora({ view: "analises", area: "saude-indigena" }),
    ).toBe("Painel das análises · Saúde Indígena");
    expect(ondeEstaNoMonitora({ view: "approved", area: "projetos" })).toBe(
      "Lista de aprovados · Projetos",
    );
    expect(ondeEstaNoMonitora({ view: "dashboard", area: "sede" })).toBe(
      "Visão geral · SEDE",
    );
  });

  it("Configurações: a seção aberta, sem área", () => {
    expect(
      ondeEstaNoMonitora({
        view: "config",
        area: "saude-indigena",
        rotuloDaSecao: "Acessos",
      }),
    ).toBe("Configurações › Acessos");
    expect(ondeEstaNoMonitora({ view: "config" })).toBe("Configurações");
  });

  it("painel externo e view desconhecida", () => {
    expect(ondeEstaNoMonitora({ view: "panel:recursos", area: "sede" })).toBe(
      "Painel externo",
    );
    expect(ondeEstaNoMonitora({ view: "outra" })).toBe("outra");
    expect(ondeEstaNoMonitora({})).toBe("");
  });

  it("o que vem de quem ainda tem a versão anterior (só o código) vira o nome", () => {
    expect(rotuloDoLocal("analises")).toBe("Painel das análises");
    expect(rotuloDoLocal("entrevistas")).toBe("Entrevistas");
    expect(rotuloDoLocal("Recursos · Projetos")).toBe("Recursos · Projetos");
    expect(rotuloDoLocal("")).toBe("");
  });

  it("a lista mostra o local legível", () => {
    const [pessoa] = normalizeOnlinePresenceList([
      {
        user_id: "u1",
        full_name: "Gabriel Benjamin da Silva",
        profile_label: "Admin",
        current_view: "analises",
      },
    ]);
    expect(pessoa.currentView).toBe("Painel das análises");
  });
});

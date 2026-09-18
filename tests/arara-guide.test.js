import { beforeEach, describe, expect, it } from "vitest";
import {
  answerAraraQuestion,
  ARARA_VISIBILITY_STORAGE_KEY,
  updateAraraGuide,
} from "../src/modules/arara-guide.js";

describe("assistente Aya", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
    window.localStorage.clear();
  });

  it("mantém uma única assistente e preserva a conversa na mesma seção", () => {
    const host = document.getElementById("host");
    const guide = updateAraraGuide("dashboard", "Saúde Indígena", host);
    const input = guide.querySelector("input");

    input.value = "Como uso o mapa?";
    guide
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    updateAraraGuide("dashboard", "Saúde Indígena", host);

    expect(host.querySelectorAll("[data-arara-guide]")).toHaveLength(1);
    expect(guide.textContent).toContain("Como uso o mapa?");
    expect(guide.textContent).toContain("DSEI");
  });

  it("usa a primeira fala para apresentar a Aya e a seção", () => {
    const host = document.getElementById("host");
    const guide = updateAraraGuide("dashboard", "Saúde Indígena", host);

    expect(guide.textContent).toContain("Eu sou a Aya");
    expect(guide.textContent).toContain("Saúde Indígena");
    expect(guide.querySelector(".arara-assistant__header")).toBeNull();
    expect(guide.querySelector(".arara-stepper")).toBeNull();
    expect(guide.querySelector(".arara-assistant__suggestions")).toBeNull();
  });

  it("não mostra a antiga mensagem de orientação local", () => {
    const host = document.getElementById("host");
    const guide = updateAraraGuide("dashboard", "", host);

    expect(guide.textContent).not.toContain("Orientação local");
    expect(guide.textContent).not.toContain("não altera registros");
  });

  it("marca a própria Aya como alça para mover o painel", () => {
    const host = document.getElementById("host");
    const guide = updateAraraGuide("dashboard", "", host);

    expect(guide.querySelector("[data-nina-drag-handle]")).not.toBeNull();
  });

  it("oculta, reabre e preserva a preferência entre seções", () => {
    const host = document.getElementById("host");
    const guide = updateAraraGuide("dashboard", "", host);

    guide.querySelector(".arara-assistant__hide").click();
    expect(guide.classList.contains("is-hidden")).toBe(true);
    expect(window.localStorage.getItem(ARARA_VISIBILITY_STORAGE_KEY)).toBe("1");

    updateAraraGuide("analises", "Análises", host);
    expect(guide.classList.contains("is-hidden")).toBe(true);

    guide.querySelector("[data-arara-show]").click();
    expect(guide.classList.contains("is-hidden")).toBe(false);
    expect(window.localStorage.getItem(ARARA_VISIBILITY_STORAGE_KEY)).toBe("0");
  });

  it("responde perguntas livres com orientação contextual", () => {
    expect(answerAraraQuestion("dashboard", "", "Como uso o mapa?")).toContain(
      "DSEI",
    );
    expect(
      answerAraraQuestion(
        "analises",
        "",
        "Como encontro um candidato na fila?",
      ),
    ).toContain("fila");
  });

  it("não inventa uma resposta quando não reconhece a pergunta", () => {
    expect(
      answerAraraQuestion("dashboard", "", "qual é a previsão para amanhã?"),
    ).toContain("referência institucional segura");
  });

  it("trata títulos personalizados como texto, sem executar marcação", () => {
    const host = document.getElementById("host");

    updateAraraGuide("panel:custom", '<img src=x onerror="alert(1)">', host);

    expect(host.querySelector('img[src="x"]')).toBeNull();
    expect(host.textContent).toContain("<img");
  });

  it("não exige que o contêiner exista", () => {
    expect(updateAraraGuide("dashboard", "", null)).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import {
  answerAraraQuestion,
  ARARA_VISIBILITY_STORAGE_KEY,
  updateAraraGuide,
} from "../src/modules/arara-guide.js";

// Mantém a experiência da Arara coberta por regressões de interação e segurança.
describe("assistente Arara Azul", () => {
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

  it("troca o contexto e reinicia o passo a passo ao navegar", () => {
    const host = document.getElementById("host");
    const guide = updateAraraGuide("dashboard", "", host);

    guide.querySelector(".arara-stepper__actions button:last-child").click();
    updateAraraGuide("nucleo", "", host);

    expect(guide.textContent).toContain("Equipe Núcleo");
    expect(guide.textContent).toContain("Passo 1 de 4");
    expect(guide.textContent).toContain("cronograma");
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

  it("explica seus limites quando não reconhece a pergunta", () => {
    expect(
      answerAraraQuestion("dashboard", "", "qual é a previsão para amanhã?"),
    ).toContain("Não consulto registros individuais");
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

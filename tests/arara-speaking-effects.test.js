import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  araraOpeningMessage,
  araraSpeechDuration,
  shouldAnimateAraraSpeech,
} from "../src/modules/arara-speaking-effects.js";

const source = readFileSync("src/modules/arara-speaking-effects.js", "utf8");
const css = readFileSync("src/styles/arara-guide.css", "utf8");

describe("efeito de fala da Arara Azul", () => {
  it("usa duração curta mas perceptível e limita respostas longas", () => {
    expect(araraSpeechDuration("Oi")).toBe(650);
    expect(araraSpeechDuration("a".repeat(400))).toBe(3400);
  });

  it("respeita preferência de movimento reduzido", () => {
    expect(
      shouldAnimateAraraSpeech({ text: "Posso ajudar.", reducedMotion: false }),
    ).toBe(true);
    expect(
      shouldAnimateAraraSpeech({ text: "Posso ajudar.", reducedMotion: true }),
    ).toBe(false);
  });

  it("abre Saúde Indígena como conversa e não como texto institucional", () => {
    const opening = araraOpeningMessage("dashboard", "Saúde Indígena");
    expect(opening).toContain("Olá!");
    expect(opening).toContain("Você está em Saúde Indígena");
    expect(opening).toContain("O que você quer ver primeiro?");
    expect(opening).not.toContain("Aqui você acompanha processos seletivos");
  });

  it("adapta a abertura à seção atual", () => {
    expect(araraOpeningMessage("nucleo", "Equipe Núcleo")).toContain(
      "cronograma",
    );
    expect(araraOpeningMessage("config", "Configurações")).toContain("acessos");
    expect(araraOpeningMessage("analises", "Análises")).toContain(
      "fila operacional",
    );
  });

  it("mostra estado de fala e revela texto progressivamente", () => {
    expect(source).toContain("Arara está falando");
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain('root.classList.add("is-speaking")');
    expect(source).toContain("fullText.slice(0, visibleCharacters)");
  });

  it("anima avatar e balão sem ignorar reduced motion", () => {
    expect(css).toContain(
      ".arara-assistant.is-speaking .arara-assistant__avatar",
    );
    expect(css).toContain("@keyframes araraSpeaking");
    expect(css).toContain(".arara-message--assistant::before");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("prioriza o chat e esconde o texto introdutório duplicado", () => {
    expect(css).toContain(".arara-assistant__context");
    expect(css).toContain("display: none");
    expect(css).toContain(".arara-assistant__messages");
    expect(css).toContain("order: 1");
    expect(css).toContain(".arara-stepper");
    expect(css).toContain("order: 5");
  });
});

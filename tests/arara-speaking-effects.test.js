import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
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

  it("mostra estado de resposta e revela texto progressivamente", () => {
    expect(source).toContain("Arara está respondendo");
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain('root.classList.add("is-speaking")');
    expect(source).toContain("fullText.slice(0, visibleCharacters)");
  });

  it("anima avatar e balão sem ignorar reduced motion", () => {
    expect(css).toContain(".arara-assistant.is-speaking .arara-assistant__avatar");
    expect(css).toContain("@keyframes araraSpeaking");
    expect(css).toContain(".arara-message--assistant::before");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

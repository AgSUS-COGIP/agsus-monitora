import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  answerNinaInstitutionalQuestion,
  araraAssistantName,
  araraOpeningMessage,
  araraSpeechDuration,
  shouldAnimateAraraSpeech,
} from "../src/modules/arara-speaking-effects.js";

const source = readFileSync("src/modules/arara-speaking-effects.js", "utf8");
const css = readFileSync("src/styles/arara-guide.css", "utf8");

describe("efeito de fala da Nina", () => {
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

  it("usa Nina como nome único da assistente", () => {
    expect(araraAssistantName()).toBe("Nina");
    expect(source).toContain('const ASSISTANT_NAME = "Nina"');
    expect(source).toContain("${ASSISTANT_NAME} está falando");
  });

  it("abre Saúde Indígena como conversa e se apresenta pelo nome", () => {
    const opening = araraOpeningMessage("dashboard", "Saúde Indígena");
    expect(opening).toContain("Olá!");
    expect(opening).toContain("Eu sou a Nina");
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

  it("explica Terra Indígena sem confundir com DSEI", () => {
    const answer = answerNinaInstitutionalQuestion(
      "Qual a diferença entre Terra Indígena e DSEI?",
    );
    expect(answer).toContain("não é a mesma coisa que um DSEI");
    expect(answer).toContain("Funai");
  });

  it("explica DSEI e CASAI", () => {
    expect(answerNinaInstitutionalQuestion("O que é DSEI?")).toContain(
      "Distrito Sanitário Especial Indígena",
    );
    expect(answerNinaInstitutionalQuestion("O que é CASAI?")).toContain(
      "Casa de Saúde Indígena",
    );
  });

  it("lê editais visíveis sem consultar uma nova fonte", () => {
    const dom = new JSDOM(`
      <table><tbody id="monitorRows">
        <tr>
          <td><a>Edital 12/2026</a></td>
          <td>DSEI Xingu</td>
          <td>Inscrições</td>
        </tr>
      </tbody></table>
    `);
    const answer = answerNinaInstitutionalQuestion(
      "Quais editais aparecem aqui?",
      dom.window.document,
    );
    expect(answer).toContain("Edital 12/2026");
    expect(answer).toContain("DSEI Xingu");
  });

  it("lê DSEIs visíveis no mapa", () => {
    const dom = new JSDOM(`
      <button class="health-map-unit">
        <strong>DSEI Xingu</strong>
        <small>10 vagas · 2 ociosas</small>
      </button>
    `);
    const answer = answerNinaInstitutionalQuestion(
      "Quais DSEIs aparecem no mapa?",
      dom.window.document,
    );
    expect(answer).toContain("DSEI Xingu");
    expect(answer).toContain("10 vagas");
  });

  it("permite mover o launcher e preserva a posição", () => {
    expect(source).toContain("enhanceDraggableLauncher");
    expect(source).toContain("pointerdown");
    expect(source).toContain("pointermove");
    expect(source).toContain("LAUNCHER_POSITION_STORAGE_KEY");
    expect(source).toContain("writeLauncherPosition");
    expect(source).toContain("Clique para abrir a Nina ou arraste para mover");
  });

  it("mostra estado de fala e revela texto progressivamente", () => {
    expect(source).toContain("está falando");
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

  it("remove o passo a passo fixo da interface", () => {
    expect(source).toContain("removeFixedTutorial");
    expect(source).toContain('root.querySelector(".arara-stepper")?.remove()');
  });

  it("mantém memória curta do último assunto para perguntas de continuação", () => {
    expect(source).toContain("conversationMemory");
    expect(source).toContain("FOLLOW_UP_PATTERN");
    expect(source).toContain("CONTINUATIONS");
    expect(source).toContain("memory.lastTopic");
  });
});

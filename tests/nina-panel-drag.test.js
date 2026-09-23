import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PANEL_POSITION_STORAGE_KEY } from "../src/modules/nina-panel-drag.js";

const source = readFileSync("src/modules/nina-panel-drag.js", "utf8");
const styles = readFileSync("src/styles/nina-conversation.css", "utf8");

describe("movimento do painel da Aya", () => {
  it("persiste a posição do painel aberto", () => {
    expect(PANEL_POSITION_STORAGE_KEY).toBe(
      "agsus_monitora_nina_panel_position_v1",
    );
    expect(source).toContain("pointerdown");
    expect(source).toContain("pointermove");
    expect(source).toContain("writePosition");
  });

  it("permite mover a Aya e o painel depois de abrir a conversa", () => {
    expect(source).toContain("[data-nina-drag-handle]");
    expect(source).toContain(".arara-assistant__panel");
    expect(source).toContain("is-panel-dragging");
  });

  it("preserva os controles interativos durante o arraste", () => {
    expect(source).toContain("INTERACTIVE_SELECTOR");
    expect(source).toContain("button, input, textarea, select, a");
    expect(source).toContain(".arara-assistant__messages");
  });

  it("mantém o painel dentro da área visível", () => {
    expect(source).toContain("clampPosition");
    expect(source).toContain("win.innerWidth");
    expect(source).toContain("win.innerHeight");
    expect(source).toContain("keepInsideViewport");
  });

  it("mantém a Aya acima do restante da interface", () => {
    expect(styles).toContain("z-index: 2147483000");
  });

  it("não sobrescreve o visual do painel definido por arara-guide.css", () => {
    expect(styles).not.toMatch(
      /\.arara-assistant__panel\s*\{[\s\S]*?background:/,
    );
    expect(styles).not.toMatch(
      /\.arara-assistant__panel\s*\{[\s\S]*?box-shadow:/,
    );
    expect(styles).not.toMatch(/\.arara-assistant__panel\s*\{[\s\S]*?border:/);
  });

  it("não redefine mensagens nem controles da conversa", () => {
    expect(styles).not.toContain(".arara-assistant__messages");
    expect(styles).not.toContain(".arara-assistant__hide");
    expect(styles).not.toContain(".arara-assistant__reset");
    expect(styles).not.toContain(".arara-assistant__conversation-tools");
  });

  it("mantém no launcher somente as regras necessárias ao arraste", () => {
    expect(styles).toContain(".arara-assistant__launcher");
    expect(styles).toContain("touch-action: none");
    expect(styles).toContain("cursor: grab");
    expect(styles).not.toMatch(
      /\.arara-assistant__launcher\s*\{[\s\S]*?width:/,
    );
    expect(styles).not.toMatch(
      /\.arara-assistant__launcher\s*\{[\s\S]*?height:/,
    );
    expect(styles).not.toMatch(
      /\.arara-assistant__launcher\s*\{[\s\S]*?background:/,
    );
  });
});

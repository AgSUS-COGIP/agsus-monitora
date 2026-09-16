import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PANEL_POSITION_STORAGE_KEY } from "../src/modules/nina-panel-drag.js";

const source = readFileSync("src/modules/nina-panel-drag.js", "utf8");

describe("movimento do painel da Nina", () => {
  it("persiste a posição do painel aberto", () => {
    expect(PANEL_POSITION_STORAGE_KEY).toBe(
      "agsus_monitora_nina_panel_position_v1",
    );
    expect(source).toContain("pointerdown");
    expect(source).toContain("pointermove");
    expect(source).toContain("writePosition");
  });

  it("usa a própria Nina como alça de movimento", () => {
    expect(source).toContain("[data-nina-drag-handle]");
    expect(source).toContain("is-panel-dragging");
  });

  it("mantém o painel dentro da área visível", () => {
    expect(source).toContain("clampPosition");
    expect(source).toContain("win.innerWidth");
    expect(source).toContain("win.innerHeight");
  });
});

import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { updateAraraGuide } from "../src/modules/arara-guide.js";
import { definirPaginaDaAba } from "../src/lib/identidade-da-aba.js";

const app = readFileSync("src/modules/legacy-app.js", "utf8");
const start = app.indexOf("function setPageTitle(");
const end = app.indexOf("function isSidebarLockedViewport(", start);

describe("título e guia conectados à navegação real", () => {
  it.each([
    ["dashboard", "Saúde Indígena", "território"],
    ["nucleo", "Equipe Núcleo", "cronograma"],
    ["config", "Configurações", "permissões"],
    ["panel:analises", "Análises", "curriculares"],
  ])(
    "atualiza a orientação de %s sem renomear a aba",
    (view, title, instruction) => {
      document.body.innerHTML =
        '<h1 id="pageTitle"></h1><p id="pageSubtitle"></p><div id="araraGuideHost"></div>';
      const setPageTitle = runInNewContext(
        `${app.slice(start, end)}; setPageTitle`,
        {
          document,
          $: (id) => document.getElementById(id),
          currentView: view,
          updateAraraGuide,
          definirPaginaDaAba,
        },
      );
      setPageTitle(title, "Orientações da seção");
      setPageTitle(title, "Orientações da seção");
      expect(document.title).toBe("MONITORA");
      expect(document.getElementById("pageTitle").textContent).toBe(title);
      expect(document.querySelectorAll("[data-arara-guide]")).toHaveLength(1);
      expect(document.getElementById("araraGuideHost").textContent).toContain(
        instruction,
      );
    },
  );
});

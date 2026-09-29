import { describe, expect, it } from "vitest";
import { ehNomeDeRemendo } from "../scripts/check-no-new-patch-layers.mjs";

describe("sem novas camadas de remendo", () => {
  it("reconhece nomes de remendo", () => {
    for (const caminho of [
      "src/analises/analises-dark-mode-fix.js",
      "src/styles/system-ui-fixes.css",
      "src/modules/health-dashboard-refinements.js",
      "src/modules/config-page-enhancements.js",
      "src/analises/analises-active-cache-recovery.js",
      "src/styles/post-152-regression-fixes.css",
      "src/styles/post157-interface-tuning.css",
      "src/analises/analises-runtime-stability.js",
      "src/lib/hotfix.js",
    ]) {
      expect(ehNomeDeRemendo(caminho), caminho).toBe(true);
    }
  });

  it("não confunde nomes comuns", () => {
    for (const caminho of [
      "src/lib/prefixos.js",
      "src/lib/sufixo-do-edital.js",
      "src/modules/map-guard.js",
      "src/lib/paginas-em-paralelo.js",
      "src/componentes/modal.jsx",
      "src/lib/matriz-acessos.js",
      "src/lib/postos.js",
    ]) {
      expect(ehNomeDeRemendo(caminho), caminho).toBe(false);
    }
  });
});

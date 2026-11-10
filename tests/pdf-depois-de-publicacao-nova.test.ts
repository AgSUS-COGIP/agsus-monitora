import { describe, expect, it } from "vitest";
import {
  MENSAGEM_DE_VERSAO_NOVA,
  erroDeVersaoNova,
} from "../src/lib/importar-com-recarga.ts";

/*
  Depois de uma publicação nova, a página que já estava aberta pede o arquivo
  antigo do jsPDF, que não existe mais. A ficha mostrava "Não foi possível
  gerar o PDF: Failed to fetch dynamically imported module:
  https://…/assets/jspdf.es.min-COHpUqfX.js" (relato de 10/11/2026). Agora
  `carregarBibliotecasDoPdf` passa a falha por `erroDeVersaoNova` e a tela diz
  o que fazer.
*/
describe("PDF depois de uma publicação nova", () => {
  it("a falha de carregamento vira a frase de recarregar a página", () => {
    for (const mensagem of [
      "Failed to fetch dynamically imported module: https://x/assets/jspdf.es.min-COHpUqfX.js",
      "Importing a module script failed.",
      "error loading dynamically imported module",
    ]) {
      const original = new TypeError(mensagem);
      const traduzido = erroDeVersaoNova(original);
      expect(traduzido).toBeInstanceOf(Error);
      expect((traduzido as Error).message).toBe(MENSAGEM_DE_VERSAO_NOVA);
      expect((traduzido as Error).cause).toBe(original);
    }
  });

  it("outro erro passa igual", () => {
    const outro = new Error("Sem permissão");
    expect(erroDeVersaoNova(outro)).toBe(outro);
  });
});

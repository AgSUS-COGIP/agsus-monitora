// Sem DOM: o btoa/atob do jsdom é JS puro e leva segundos num PDF de 2 MB.
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  LIMITE_DO_ANEXO,
  anexosPorCandidato,
  arquivoEmBase64,
  formatarTamanho,
  pdfDoBase64,
  problemaDosAnexos,
} from "../src/lib/anexos-do-candidato.js";

const pdf = (name = "doc.pdf", size = 1000, type = "application/pdf") => ({
  name,
  size,
  type,
});

describe("problemaDosAnexos", () => {
  it("aceita nada e aceita PDFs dentro dos limites", () => {
    expect(problemaDosAnexos([])).toBe("");
    expect(problemaDosAnexos([pdf(), pdf("b.pdf")], 3)).toBe("");
    // Sem tipo (alguns navegadores), vale a extensão.
    expect(problemaDosAnexos([pdf("c.PDF", 10, "")])).toBe("");
  });

  it("recusa o que não é PDF", () => {
    expect(problemaDosAnexos([pdf("foto.png", 10, "image/png")])).toContain(
      "não é PDF",
    );
    expect(problemaDosAnexos([pdf("x.docx", 10, "")])).toContain("não é PDF");
  });

  it("recusa arquivo acima de 2 MB e arquivo vazio", () => {
    expect(problemaDosAnexos([pdf("g.pdf", LIMITE_DO_ANEXO)])).toBe("");
    expect(problemaDosAnexos([pdf("g.pdf", LIMITE_DO_ANEXO + 1)])).toContain(
      "2 MB",
    );
    expect(problemaDosAnexos([pdf("v.pdf", 0)])).toContain("vazio");
  });

  it("conta os que o candidato já tem contra o limite de 5", () => {
    const tres = [pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")];
    expect(problemaDosAnexos(tres, 2)).toBe("");
    expect(problemaDosAnexos(tres, 3)).toContain("Cabem só mais 2");
    expect(problemaDosAnexos([pdf()], 5)).toContain("já tem 5");
    expect(problemaDosAnexos(Array.from({ length: 6 }, () => pdf()))).toContain(
      "Cabem só mais 5",
    );
  });
});

describe("anexosPorCandidato", () => {
  it("agrupa por candidato, na ordem que veio", () => {
    const mapa = anexosPorCandidato([
      { anexo_id: 1, candidato_id: "a" },
      { anexo_id: 2, candidato_id: "b" },
      { anexo_id: 3, candidato_id: "a" },
      { anexo_id: 4 },
    ]);
    expect(mapa.get("a").map((x) => x.anexo_id)).toEqual([1, 3]);
    expect(mapa.get("b")).toHaveLength(1);
    expect(mapa.size).toBe(2);
    expect(anexosPorCandidato({ ok: true }).size).toBe(0);
  });
});

describe("formatarTamanho", () => {
  it("KB abaixo de 1 MB, MB com vírgula acima", () => {
    expect(formatarTamanho(100)).toBe("1 KB");
    expect(formatarTamanho(850 * 1024)).toBe("850 KB");
    expect(formatarTamanho(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });
});

describe("base64 do PDF", () => {
  it("vai e volta sem perder byte, inclusive num PDF de 2 MB", async () => {
    const bytes = new Uint8Array(LIMITE_DO_ANEXO).map((_, i) => i % 256);
    const arquivo = new File([bytes], "grande.pdf", {
      type: "application/pdf",
    });
    const base64 = await arquivoEmBase64(arquivo);
    expect(base64).not.toContain("data:");
    const volta = pdfDoBase64(base64);
    expect(volta.type).toBe("application/pdf");
    const recebidos = new Uint8Array(await volta.arrayBuffer());
    expect(Buffer.compare(recebidos, bytes)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  ACEITA_NO_SELETOR_DO_CHAT,
  caminhoDoAnexoDoChat,
  iconeDoAnexo,
  imagensColadas,
  juntarAnexos,
  LIMITE_DO_ANEXO_DO_CHAT,
  MAXIMO_DE_ANEXOS,
  nomeDoPrint,
  rotuloDoAnexo,
  tipoDoAnexo,
  TIPOS_DE_ANEXO,
  validarAnexoDoChat,
} from "../src/lib/anexos-do-chat.js";

/*
  Anexos do chat (src/lib/anexos-do-chat.js): tipos aceitos (PDF, imagem e
  planilha), até 10 MB e 5 por mensagem, caminho no Storage sem o nome
  original e o print colado com Ctrl+V. Histórias CV-1 em
  docs/historias-de-usuario/chat.md.
*/

const arquivo = (name, type, size = 1000) => ({ name, type, size });
const CONVERSA = "00000000-0000-4000-a000-000000000c01";
const ANEXO = "00000000-0000-4000-a000-0000000a0001";

describe("CV-1.1 — tipos e tamanho", () => {
  it("aceita PDF, imagens e planilhas pela extensão", () => {
    for (const nome of [
      "a.pdf",
      "b.PNG",
      "c.jpeg",
      "d.jpg",
      "e.webp",
      "f.gif",
      "g.xlsx",
      "h.xls",
      "i.ods",
      "j.csv",
    ])
      expect(validarAnexoDoChat(arquivo(nome, "")).mime, nome).toBeTruthy();
    expect(ACEITA_NO_SELETOR_DO_CHAT).toBe(
      ".pdf,.png,.jpg,.jpeg,.webp,.gif,.csv,.xlsx,.xls,.ods",
    );
  });

  it("recusa outros tipos, vazio, acima de 10 MB e nome longo", () => {
    expect(validarAnexoDoChat(arquivo("a.exe", "")).erro).toMatch(/não aceito/);
    expect(validarAnexoDoChat(arquivo("a.docx", "")).erro).toMatch(
      /não aceito/,
    );
    expect(validarAnexoDoChat(arquivo("a.pdf", "", 0)).erro).toBe(
      "O arquivo está vazio.",
    );
    expect(
      validarAnexoDoChat(arquivo("a.pdf", "", LIMITE_DO_ANEXO_DO_CHAT + 1))
        .erro,
    ).toBe("O arquivo passa de 10 MB.");
    expect(
      validarAnexoDoChat(arquivo(`${"x".repeat(200)}.pdf`, "")).erro,
    ).toMatch(/200/);
    expect(validarAnexoDoChat(null).erro).toBe("Escolha o arquivo.");
  });

  it("extensão que engana (o navegador diz outro tipo aceito de outra família) é recusada", () => {
    expect(tipoDoAnexo(arquivo("a.pdf", "image/png"))).toBeNull();
    // CSV no Windows chega como application/vnd.ms-excel: planilha e planilha.
    expect(tipoDoAnexo(arquivo("a.csv", "application/vnd.ms-excel")).mime).toBe(
      "text/csv",
    );
  });

  it("print colado sem extensão vale pelo tipo de imagem do navegador", () => {
    expect(validarAnexoDoChat(arquivo("", "image/png"))).toEqual({
      mime: "image/png",
      extensao: "png",
      familia: "imagem",
    });
    expect(tipoDoAnexo(arquivo("", "application/pdf"))).toBeNull();
  });

  it("os tipos são os do banco (FC_CHAT_TIPOS_ANEXO)", () => {
    expect(TIPOS_DE_ANEXO.map((t) => t.mime)).toEqual([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.oasis.opendocument.spreadsheet",
    ]);
  });
});

describe("CV-1.2 — até 5 por mensagem", () => {
  it("junta os válidos e devolve os recusados com o motivo", () => {
    const um = juntarAnexos([], [arquivo("a.pdf", ""), arquivo("b.exe", "")]);
    expect(um.anexos).toHaveLength(1);
    expect(um.recusados).toEqual([
      { nome: "b.exe", erro: expect.stringMatching(/não aceito/) },
    ]);
    const cheio = juntarAnexos(
      [],
      Array.from({ length: MAXIMO_DE_ANEXOS + 1 }, (_, i) =>
        arquivo(`f${i}.png`, "image/png"),
      ),
    );
    expect(cheio.anexos).toHaveLength(MAXIMO_DE_ANEXOS);
    expect(cheio.recusados[0].erro).toBe("No máximo 5 anexos por mensagem.");
  });
});

describe("CV-1.3 — caminho no Storage", () => {
  it("<conversa>/<uuid>.<extensão>, sem o nome original", () => {
    expect(caminhoDoAnexoDoChat(CONVERSA, ANEXO, "PDF")).toBe(
      `${CONVERSA}/${ANEXO}.pdf`,
    );
  });

  it("recusa id fora do formato e extensão não aceita", () => {
    expect(() => caminhoDoAnexoDoChat("../x", ANEXO, "pdf")).toThrow();
    expect(() => caminhoDoAnexoDoChat(CONVERSA, "1", "pdf")).toThrow();
    expect(() => caminhoDoAnexoDoChat(CONVERSA, ANEXO, "exe")).toThrow();
  });
});

describe("CV-1.4 — colar print (Ctrl+V)", () => {
  it("nome com data e hora, sem depender do relógio", () => {
    expect(nomeDoPrint(new Date(2026, 9, 7, 14, 5, 9))).toBe(
      "print-2026-10-07-14h05m09.png",
    );
    expect(nomeDoPrint(new Date(2026, 0, 2, 3, 4, 5), "jpg")).toBe(
      "print-2026-01-02-03h04m05.jpg",
    );
  });

  it("só as imagens coladas viram anexo (arquivos ou itens)", () => {
    const png = arquivo("image.png", "image/png");
    expect(
      imagensColadas({ files: [png, arquivo("a.txt", "text/plain")] }),
    ).toEqual([png]);
    expect(
      imagensColadas({
        files: [],
        items: [
          { kind: "string", type: "text/plain" },
          { kind: "file", type: "image/png", getAsFile: () => png },
        ],
      }),
    ).toEqual([png]);
    expect(imagensColadas(null)).toEqual([]);
  });
});

describe("rótulos", () => {
  it("ícone pela família e nome com tamanho", () => {
    expect(iconeDoAnexo("image/png")).toBe("fa-file-image");
    expect(iconeDoAnexo("application/pdf")).toBe("fa-file-pdf");
    expect(iconeDoAnexo("text/csv")).toBe("fa-file-excel");
    expect(rotuloDoAnexo({ nome: "Relatório.pdf", bytes: 2048 })).toBe(
      "Relatório.pdf · 2 KB",
    );
  });
});

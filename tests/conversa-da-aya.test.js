import { describe, expect, it } from "vitest";
import {
  intencaoDeConversa,
  textoDaConversa,
} from "../src/lib/conversa-da-aya.js";

describe("intenções de conversa", () => {
  it.each([
    ["obrigado", "agradecimento"],
    ["Muito obrigada, Aya!", "agradecimento"],
    ["valeu", "agradecimento"],
    ["tchau", "despedida"],
    ["até mais", "despedida"],
    ["o que posso perguntar?", "ajuda"],
    ["O que eu posso perguntar?", "ajuda"],
    ["como te uso?", "ajuda"],
    ["ajuda", "ajuda"],
    ["o que você faz?", "ajuda"],
    ["e aí", "saudacao"],
    ["tudo bem?", "saudacao"],
    ["oi", "saudacao"],
    ["Boa tarde!", "saudacao"],
  ])("%s é %s, sem pergunta junto", (mensagem, intencao) => {
    const conversa = intencaoDeConversa(mensagem);
    expect(conversa.intencao).toBe(intencao);
    expect(conversa.resto).toBe("");
  });

  it("separa a saudação da pergunta", () => {
    expect(intencaoDeConversa("bom dia, como dar acesso?")).toEqual({
      intencao: "saudacao",
      saudacao: "Bom dia!",
      resto: "como dar acesso",
      pergunta: "como dar acesso",
    });
  });

  it("tira o agradecimento da pergunta, mas não o pedido de ajuda", () => {
    expect(
      intencaoDeConversa("obrigado! e quem decide o recurso?").pergunta,
    ).toBe("e quem decide o recurso");
    const ajuda = intencaoDeConversa("como funciona o processo seletivo?");
    expect(ajuda.resto).not.toBe("");
    expect(ajuda.pergunta).toBe("como funciona o processo seletivo");
  });

  it("não confunde palavra do MONITORA com conversa", () => {
    expect(intencaoDeConversa("quem pode decidir um recurso").intencao).toBe(
      "",
    );
    expect(intencaoDeConversa("oitiva").intencao).toBe("");
  });
});

describe("texto da conversa", () => {
  it("abre com a saudação e apresenta a página", () => {
    expect(
      textoDaConversa({
        intencao: "saudacao",
        saudacao: "Bom dia!",
        intro: "Posso explicar Recursos.",
      }),
    ).toBe(
      "Bom dia! Sou a Aya, assistente do MONITORA. Posso explicar Recursos.",
    );
  });

  it("agradece e se despede sem repetir a apresentação", () => {
    expect(textoDaConversa({ intencao: "agradecimento", intro: "x" })).toMatch(
      /^De nada!/,
    );
    expect(textoDaConversa({ intencao: "despedida", intro: "x" })).toMatch(
      /^Até mais!/,
    );
  });

  it("explica o que a Aya faz quando pedem ajuda", () => {
    const texto = textoDaConversa({ intencao: "ajuda", intro: "Aqui é X." });
    expect(texto).toContain("editais");
    expect(texto).toContain("chamado");
    expect(texto).toMatch(/Aqui é X\.$/);
  });
});

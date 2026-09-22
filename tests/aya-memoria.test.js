import { beforeEach, describe, expect, it } from "vitest";
import {
  esquecerConversa,
  lerConversa,
  limitarConversa,
  salvarConversa,
} from "../src/modules/aya-memoria.js";

function janelaComArmazenamento() {
  const dados = new Map();
  return {
    sessionStorage: {
      getItem: (k) => (dados.has(k) ? dados.get(k) : null),
      setItem: (k, v) => dados.set(k, String(v)),
      removeItem: (k) => dados.delete(k),
    },
  };
}

describe("memória de conversa da Aya", () => {
  let win;
  beforeEach(() => {
    win = janelaComArmazenamento();
  });

  it("sobrevive ao recarregamento, que é o problema que motivou isto", () => {
    salvarConversa(
      [
        { role: "user", content: "Dsei alagoas" },
        { role: "assistant", content: "O DSEI AL/SE tem sede em Maceió." },
      ],
      win,
    );
    expect(lerConversa(win)).toEqual([
      { role: "user", content: "Dsei alagoas" },
      { role: "assistant", content: "O DSEI AL/SE tem sede em Maceió." },
    ]);
  });

  it("recomeçar apaga de verdade", () => {
    salvarConversa([{ role: "user", content: "oi" }], win);
    esquecerConversa(win);
    expect(lerConversa(win)).toEqual([]);
  });

  it("descarta turno malformado em vez de propagá-lo", () => {
    const limpa = limitarConversa([
      { role: "user", content: "válido" },
      { role: "system", content: "papel que não existe aqui" },
      { role: "assistant", content: "   " },
      { role: "assistant" },
      null,
    ]);
    expect(limpa).toEqual([{ role: "user", content: "válido" }]);
  });

  it("corta pelos mais antigos e mantém os recentes", () => {
    const muitos = Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `turno ${i}`,
    }));
    const limitada = limitarConversa(muitos);
    expect(limitada.length).toBeLessThanOrEqual(40);
    expect(limitada.at(-1).content).toBe("turno 59");
  });

  it("uma resposta gigante não apaga a conversa inteira", () => {
    const limitada = limitarConversa([
      { role: "user", content: "pergunta" },
      { role: "assistant", content: "x".repeat(9000) },
    ]);
    expect(limitada.length).toBeGreaterThan(0);
  });

  /*
    Janela anônima, cota estourada ou armazenamento bloqueado por política não
    podem derrubar o painel: a Aya perde a memória e segue funcionando.
  */
  it("aguenta armazenamento indisponível", () => {
    const semArmazenamento = {
      get sessionStorage() {
        throw new Error("bloqueado");
      },
    };
    expect(() => lerConversa(semArmazenamento)).not.toThrow();
    expect(lerConversa(semArmazenamento)).toEqual([]);
    expect(
      salvarConversa([{ role: "user", content: "a" }], semArmazenamento),
    ).toBe(false);
    expect(() => esquecerConversa(semArmazenamento)).not.toThrow();
  });

  it("conteúdo corrompido não quebra a leitura", () => {
    win.sessionStorage.setItem("agsus_aya_conversa_v1", "{isso não é json");
    expect(lerConversa(win)).toEqual([]);
  });
});

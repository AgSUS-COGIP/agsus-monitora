import { describe, expect, it, vi } from "vitest";
import {
  buscarEmojis,
  CATEGORIAS_DE_EMOJI,
  CHAVE_DOS_RECENTES,
  comRecente,
  guardarRecente,
  itensDosRecentes,
  lerRecentes,
  MAXIMO_DE_RECENTES,
  nomeDoEmoji,
  TOTAL_DE_EMOJIS,
} from "../src/lib/emojis-do-chat.js";

/*
  A lista própria de emojis do seletor do chat (src/lib/emojis-do-chat.js):
  ~150 emojis em categorias, busca por nome em português (sem acento) e
  "Recentes" no navegador, que não quebram sem armazenamento.
*/

function armazenamentoFalso(inicial = {}) {
  const dados = { ...inicial };
  return {
    dados,
    getItem: vi.fn((chave) => (chave in dados ? dados[chave] : null)),
    setItem: vi.fn((chave, valor) => {
      dados[chave] = String(valor);
    }),
  };
}

describe("lista de emojis", () => {
  it("tem cerca de 150 emojis, sem repetir, em cinco categorias não vazias", () => {
    expect(TOTAL_DE_EMOJIS).toBeGreaterThanOrEqual(140);
    expect(TOTAL_DE_EMOJIS).toBeLessThanOrEqual(180);
    const todos = CATEGORIAS_DE_EMOJI.flatMap((c) =>
      c.emojis.map((e) => e.emoji),
    );
    expect(new Set(todos).size).toBe(todos.length);
    expect(CATEGORIAS_DE_EMOJI.map((c) => c.rotulo)).toEqual([
      "Carinhas",
      "Gestos",
      "Trabalho",
      "Símbolos",
      "Celebração",
    ]);
    for (const c of CATEGORIAS_DE_EMOJI)
      expect(c.emojis.length).toBeGreaterThan(5);
  });

  it("tem os símbolos de trabalho pedidos e as reações rápidas", () => {
    const todos = new Set(
      CATEGORIAS_DE_EMOJI.flatMap((c) => c.emojis.map((e) => e.emoji)),
    );
    for (const e of [
      "✅",
      "❌",
      "⚠️",
      "📌",
      "📎",
      "📅",
      "👍",
      "❤️",
      "😂",
      "👀",
      "🙏",
    ])
      expect(todos.has(e), e).toBe(true);
  });

  it("todo emoji tem nome em português", () => {
    for (const c of CATEGORIAS_DE_EMOJI)
      for (const e of c.emojis) expect(e.nome.trim().length).toBeGreaterThan(1);
    expect(nomeDoEmoji("👍")).toBe("joinha");
    expect(nomeDoEmoji("🦄")).toBe("🦄");
  });
});

describe("busca", () => {
  it("acha por nome ou palavra, sem acento e sem maiúsculas", () => {
    expect(buscarEmojis("joinha").map((e) => e.emoji)).toEqual(["👍"]);
    expect(buscarEmojis("CAFE").map((e) => e.emoji)).toContain("☕");
    expect(buscarEmojis("atencao").map((e) => e.emoji)).toContain("⚠️");
    expect(buscarEmojis("calendário").map((e) => e.emoji)).toContain("📅");
    expect(buscarEmojis("anexo").map((e) => e.emoji)).toContain("📎");
  });
  it("todas as palavras do termo têm de aparecer", () => {
    expect(buscarEmojis("coracao verde").map((e) => e.emoji)).toEqual(["💚"]);
  });
  it("termo vazio ou sem resultado devolve vazio; respeita o limite", () => {
    expect(buscarEmojis("   ")).toEqual([]);
    expect(buscarEmojis("xyzxyz")).toEqual([]);
    expect(buscarEmojis("a", 5)).toHaveLength(5);
  });
});

describe("recentes", () => {
  it("o usado vai para o começo, sem repetir, até o máximo", () => {
    expect(comRecente(["👍", "✅"], "✅")).toEqual(["✅", "👍"]);
    const muitos = Array.from({ length: 30 }, (_, i) => `e${i}`);
    expect(comRecente(muitos, "👍")).toHaveLength(MAXIMO_DE_RECENTES);
    expect(comRecente(null, "")).toEqual([]);
  });

  it("guarda e lê do navegador, só emojis da lista", () => {
    const armazenamento = armazenamentoFalso();
    expect(guardarRecente(armazenamento, "👍")).toEqual(["👍"]);
    expect(guardarRecente(armazenamento, "☕")).toEqual(["☕", "👍"]);
    expect(JSON.parse(armazenamento.dados[CHAVE_DOS_RECENTES])).toEqual([
      "☕",
      "👍",
    ]);
    armazenamento.dados[CHAVE_DOS_RECENTES] = JSON.stringify([
      "👍",
      "<script>",
      7,
    ]);
    expect(lerRecentes(armazenamento)).toEqual(["👍"]);
    expect(itensDosRecentes(["👍", "🦄"]).map((i) => i.nome)).toEqual([
      "joinha",
    ]);
  });

  it("sem armazenamento, armazenamento que lança erro ou JSON quebrado: não quebra", () => {
    expect(lerRecentes(null)).toEqual([]);
    expect(
      lerRecentes({
        getItem: () => {
          throw new Error("bloqueado");
        },
      }),
    ).toEqual([]);
    expect(
      lerRecentes(armazenamentoFalso({ [CHAVE_DOS_RECENTES]: "{" })),
    ).toEqual([]);
    const quebrado = {
      getItem: () => null,
      setItem: () => {
        throw new Error("cheio");
      },
    };
    expect(guardarRecente(quebrado, "👍")).toEqual(["👍"]);
  });
});

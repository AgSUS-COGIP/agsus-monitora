import { describe, expect, it } from "vitest";
import {
  CONFLITO_DE_VERSAO,
  CONFLITO_DE_VERSAO_ANTIGO,
  ehConflitoDeVersao,
} from "../src/lib/conflito-de-versao.ts";

describe("ehConflitoDeVersao", () => {
  it("o código novo é PTxyz com 409: o PostgREST responde 409 e não repete", () => {
    expect(CONFLITO_DE_VERSAO).toBe("PT409");
    expect(CONFLITO_DE_VERSAO_ANTIGO).toBe("40001");
  });

  it.each(["PT409", "40001"])(
    "reconhece %s (erro do supabase-js ou Error)",
    (code) => {
      expect(ehConflitoDeVersao({ code, message: "mudou" })).toBe(true);
      expect(
        ehConflitoDeVersao(Object.assign(new Error("mudou"), { code })),
      ).toBe(true);
    },
  );

  it.each([
    null,
    undefined,
    "PT409",
    {},
    { code: 409 },
    { code: "55P03" },
    { code: "P0001" },
    { code: "42501" },
  ])("não confunde com outro erro: %j", (erro) => {
    expect(ehConflitoDeVersao(erro)).toBe(false);
  });
});

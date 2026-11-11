import { describe, expect, it } from "vitest";
import {
  ERRO_INESPERADO,
  SEM_PERMISSAO,
  SESSAO_VENCIDA,
  TEMPO_ESGOTADO_NO_BANCO,
  erroParaATela,
} from "../src/lib/erro-na-tela.ts";
import { SEM_SERVIDOR } from "../src/lib/falha-de-rede.ts";
import { MENSAGEM_DE_VERSAO_NOVA } from "../src/lib/importar-com-recarga.ts";

/*
  Auditoria das telas (10/11/2026): os avisos de erro mostravam o texto cru
  ("Failed to fetch dynamically imported module", "(código 42501)", "JWT
  expired"). A frase em português das RPCs passa igual; o técnico vira frase
  fixa que diz o que fazer.
*/
describe("erro na tela", () => {
  it("frase em português das RPCs passa igual", () => {
    for (const frase of [
      "Sem acesso a esta área",
      "Edital da agenda inválido.",
      "Sem permissão para Seleção",
      "A lista mudou desde que a tela foi carregada (4 na tela, 5 no banco). Clique em Atualizar e exporte de novo.",
    ]) {
      expect(erroParaATela(new Error(frase))).toBe(frase);
      expect(erroParaATela({ message: frase, code: "42501" })).toBe(frase);
    }
  });

  it("sem conexão, versão nova, sessão, tempo e permissão viram frase fixa", () => {
    expect(erroParaATela(new TypeError("Failed to fetch"))).toBe(SEM_SERVIDOR);
    expect(
      erroParaATela(
        new TypeError(
          "Failed to fetch dynamically imported module: https://x/assets/mapa-1.js",
        ),
      ),
    ).toBe(MENSAGEM_DE_VERSAO_NOVA);
    expect(erroParaATela({ message: "JWT expired", code: "PGRST301" })).toBe(
      SESSAO_VENCIDA,
    );
    expect(
      erroParaATela({
        message: "canceling statement due to statement timeout",
        code: "57014",
      }),
    ).toBe(TEMPO_ESGOTADO_NO_BANCO);
    expect(
      erroParaATela({
        message: "permission denied for function x",
        code: "42501",
      }),
    ).toBe(SEM_PERMISSAO);
  });

  it("outro texto técnico vira erro inesperado", () => {
    for (const tecnico of [
      'relation "public.TB_X" does not exist',
      "Could not find the function public.y in the schema cache",
      "duplicate key value violates unique constraint",
      "Cannot read properties of undefined (reading 'map')",
      "Unexpected token < in JSON at position 0",
    ])
      expect(erroParaATela(new Error(tecnico))).toBe(ERRO_INESPERADO);
    expect(erroParaATela(null)).toBe(ERRO_INESPERADO);
    expect(erroParaATela("")).toBe(ERRO_INESPERADO);
  });
});

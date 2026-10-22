import { describe, expect, it } from "vitest";
import {
  comPerguntaSemResposta,
  LIMITE_DE_PERGUNTAS,
  limparPergunta,
  perguntasGuardadas,
  textoDasPerguntas,
} from "../src/lib/perguntas-sem-resposta.js";

/*
  As perguntas que a Aya não resolveu, guardadas sem dado pessoal para o
  administrador melhorar a base (src/lib/perguntas-sem-resposta.js).
*/

describe("sem dado pessoal", () => {
  it("tira e-mail, CPF, telefone e números longos; o edital fica", () => {
    expect(
      limparPergunta(
        "o recurso de joao@agenciasus.org.br, CPF 123.456.789-09, tel (61) 99999-1234, inscrição 4455667, edital 93/2026",
      ),
    ).toBe(
      "o recurso de [e-mail], CPF [número], tel [número], inscrição [número], edital 93/2026",
    );
  });

  it("corta em 200 caracteres e junta os espaços", () => {
    expect(limparPergunta(`a   b\n${"x".repeat(300)}`)).toHaveLength(200);
  });
});

describe("lista", () => {
  it("sem repetir a mesma pergunta na mesma página, até o limite", () => {
    let lista = [];
    lista = comPerguntaSemResposta(lista, { pergunta: "oi?", pagina: "x" });
    lista = comPerguntaSemResposta(lista, { pergunta: "oi?", pagina: "x" });
    lista = comPerguntaSemResposta(lista, { pergunta: "", pagina: "x" });
    expect(lista).toHaveLength(1);
    for (let i = 0; i < LIMITE_DE_PERGUNTAS + 5; i += 1)
      lista = comPerguntaSemResposta(lista, { pergunta: `p${i}`, pagina: "y" });
    expect(lista).toHaveLength(LIMITE_DE_PERGUNTAS);
  });

  it("descarta o que está estragado e copia uma por linha", () => {
    const lista = perguntasGuardadas([
      null,
      { pergunta: 3 },
      {
        pergunta: "como zerar?",
        pagina: "config:mensagens",
        motivo: "nao-entendeu",
        quando: "2026-10-05T10:00:00Z",
      },
    ]);
    expect(lista).toHaveLength(1);
    expect(textoDasPerguntas(lista)).toBe(
      "- como zerar? (config:mensagens; não entendi; 2026-10-05)",
    );
    expect(perguntasGuardadas("x")).toEqual([]);
  });
});

import { expect, it } from "vitest";

/*
  O ambiente padrão dos testes é node: montar o jsdom custava 2495 s somados
  numa suíte de 557 arquivos, metade deles sem DOM nenhum. Arquivo que usa DOM
  pede o jsdom na primeira linha (docs/biblioteca/testes.md). Este comentário
  não escreve a anotação por extenso: o Vitest a leria mesmo aqui dentro.
*/
it("sem anotação, o arquivo roda em node (jsdom só onde é declarado)", () => {
  expect(typeof document).toBe("undefined");
  expect(typeof window).toBe("undefined");
});

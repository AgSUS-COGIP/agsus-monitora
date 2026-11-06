import { describe, expect, it, vi } from "vitest";
import {
  confirmarTrocaDeArea,
  criarGuardaDeAlteracoes,
} from "../../src/app/guarda-de-alteracoes.ts";

/*
  Trocar de área remonta as telas da área: a ficha aberta da Avaliação
  documental sai. Com mudança ainda não guardada, a troca pergunta antes.
*/
describe("troca de área e a guarda de alterações", () => {
  it("sem nada pendente, troca sem perguntar", () => {
    const confirmar = vi.fn(() => false);
    const guarda = criarGuardaDeAlteracoes({ janela: undefined });
    expect(confirmarTrocaDeArea(confirmar, guarda)).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("com alteração ainda não guardada, pergunta e respeita a resposta", () => {
    const guarda = criarGuardaDeAlteracoes({ janela: undefined });
    guarda.registrar({ comAlteracoes: () => true, naoGuardado: () => true });
    const recusar = vi.fn(() => false);
    expect(confirmarTrocaDeArea(recusar, guarda)).toBe(false);
    expect(recusar).toHaveBeenCalledWith(
      "Há alteração que ainda não foi salva. Trocar de área mesmo assim?",
    );
    expect(confirmarTrocaDeArea(() => true, guarda)).toBe(true);
  });
});
